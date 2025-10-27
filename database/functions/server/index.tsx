import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { cors, logger } from "https://deno.land/x/hono@v4.3.11/middleware.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { signJwt, verifyJwt } from "./lib/jwt.ts";
import { getDb } from "./lib/sqlite.ts";
import { sendBrevoTransactionalEmail } from "./lib/brevo.ts";

const app = new Hono();

// Configurar CORS controlado por ambiente
// ALLOWED_ORIGINS pode ser uma lista separada por vírgula (ex.: "https://app.vercel.app,https://admin.vercel.app")
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const isOriginAllowed = (origin?: string | null): boolean => {
  if (!origin) return true; // permitir chamadas server-to-server e curl
  if (ALLOWED_ORIGINS.includes("*")) return true;
  // suporta curingas simples do tipo "*.dominio.com"
  for (const rule of ALLOWED_ORIGINS) {
    if (rule === origin) return true;
    if (rule.startsWith("*.") && origin.endsWith(rule.slice(1))) return true;
  }
  return false;
};

app.use(
  "*",
  cors({
    origin: (origin) => (isOriginAllowed(origin) ? origin ?? "*" : ""),
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "apikey",
      "Accept",
      "X-Requested-With",
    ],
    allowMethods: ["POST", "GET", "PUT", "DELETE", "OPTIONS"],
    maxAge: 86400,
  }),
);

app.use("*", logger(console.log));

// Configurações gerais
const DB_SCHEMA = Deno.env.get("DB_SCHEMA") || "public";
const TABLE_PREFIX = Deno.env.get("TABLE_PREFIX") || "urede_";
const TBL = (name: string) => `${TABLE_PREFIX}${name}`;

// Auth / DB local
const AUTH_PROVIDER = "local";
const JWT_SECRET = Deno.env.get("JWT_SECRET") || "dev-secret-change-me";
const SQLITE_PATH_RAW = Deno.env.get("SQLITE_PATH") || "./data/urede.db";
// Resolver caminho absoluto do DB relativo à raiz do projeto (três níveis acima deste arquivo)
let SQLITE_PATH = SQLITE_PATH_RAW;
try {
  if (!/^(?:\w+:)?\//.test(SQLITE_PATH_RAW)) {
    const root = new URL("../../../", import.meta.url);
    SQLITE_PATH = new URL(SQLITE_PATH_RAW.replace(/^\.\//, ""), root).pathname;
  }
} catch {}
const DB_DRIVER = (Deno.env.get("DB_DRIVER") || "sqlite").toLowerCase(); // sqlite

// Modo inseguro para desenvolvimento local: quando true, pulamos checagens de autenticação e permissões.
// Defina INSECURE_MODE=true no arquivo database/functions/server/.env para habilitar.
const INSECURE_MODE =
  (Deno.env.get("INSECURE_MODE") || "").toLowerCase() === "true";

// Operação 100% local (SQLite)

// Helpers de mapeamento para o formato esperado pelo frontend
const normalizeCooperativaTipo = (value: unknown) => {
  const raw = (value ?? "").toString().trim();
  if (!raw) return "SINGULAR";
  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (normalized.includes("CONFEDER")) return "CONFEDERACAO";
  if (normalized.includes("FEDER")) return "FEDERACAO";
  return "SINGULAR";
};

const mapCooperativa = (row: any) => {
  const tipoOriginal = row.TIPO ?? row.tipo ?? "";
  const tipo = normalizeCooperativaTipo(tipoOriginal);
  return {
    id_singular: row.id_singular ?? row.ID_SINGULAR,
    uniodonto: row.UNIODONTO ?? row.uniodonto ?? "",
    cnpj: row.CNPJ ?? row.cnpj ?? "",
    cro_operadora: row.CRO_OPERAORA ?? row.CRO_OPERADORA ?? row.cro_operadora ??
      "",
    data_fundacao: row.DATA_FUNDACAO ?? row.data_fundacao ?? "",
    raz_social: row.RAZ_SOCIAL ?? row.raz_social ?? "",
    codigo_ans: row.CODIGO_ANS ?? row.codigo_ans ?? "",
    federacao: row.FEDERACAO ?? row.federacao ?? "",
    software: row.SOFTWARE ?? row.software ?? "",
    tipo,
    tipo_label: tipo === "CONFEDERACAO"
      ? "Confederação"
      : tipo === "FEDERACAO"
      ? "Federação"
      : "Singular",
    op_pr: row.OP_PR ?? row.op_pr ?? "",
  };
};

const mapCidade = (row: any) => ({
  cd_municipio_7: row.CD_MUNICIPIO_7 ?? row.cd_municipio_7,
  cd_municipio: row.CD_MUNICIPIO ?? row.cd_municipio,
  regional_saude: row.REGIONAL_SAUDE ?? row.regional_saude,
  nm_cidade: row.NM_CIDADE ?? row.nm_cidade,
  uf_municipio: row.UF_MUNICIPIO ?? row.uf_municipio,
  nm_regiao: row.NM_REGIAO ?? row.nm_regiao,
  cidades_habitantes: row.CIDADES_HABITANTES ?? row.cidades_habitantes,
  id_singular: row.ID_SINGULAR ?? row.id_singular,
  nm_singular: row.NM_SINGULAR ?? row.nm_singular ?? null,
});

const mapOperador = (row: any) => ({
  id: (row.id ?? "").toString(),
  nome: row.nome ?? "",
  email: row.email ?? "",
  telefone: row.telefone ?? "",
  whatsapp: row.whatsapp ?? "",
  cargo: row.cargo ?? "",
  id_singular: row.id_singular ?? "",
  ativo: (row.status ?? true) as boolean,
  data_cadastro: row.created_at ?? new Date().toISOString(),
  papel: row.auth_papel ?? row.papel ?? "operador",
});

const mapCoberturaLog = (row: any) => ({
  id: row.id,
  cidade_id: row.cidade_id,
  cidade_nome: row.cidade_nome ?? row.NM_CIDADE ?? null,
  cidade_uf: row.cidade_uf ?? row.UF_MUNICIPIO ?? null,
  cooperativa_origem: row.cooperativa_origem ?? null,
  cooperativa_origem_nome: row.cooperativa_origem_nome ?? null,
  cooperativa_destino: row.cooperativa_destino ?? null,
  cooperativa_destino_nome: row.cooperativa_destino_nome ?? null,
  usuario_email: row.usuario_email ?? "",
  usuario_nome: row.usuario_nome ?? "",
  usuario_papel: row.usuario_papel ?? "",
  detalhes: row.detalhes ?? null,
  timestamp: row.timestamp ?? null,
});

const computeDiasRestantes = (
  prazoIso: string | null | undefined,
  status?: string | null,
) => {
  if (!prazoIso) return 0;
  if (status && status.toLowerCase() === "concluido") return 0;
  const prazo = new Date(prazoIso);
  const agora = new Date();
  if (Number.isNaN(prazo.getTime())) return 0;

  const msPorDia = 24 * 60 * 60 * 1000;
  const inicioHoje = new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate(),
  );
  const inicioPrazo = new Date(
    prazo.getFullYear(),
    prazo.getMonth(),
    prazo.getDate(),
  );
  const diffTime = inicioPrazo.getTime() - inicioHoje.getTime();

  return Math.max(0, Math.floor(diffTime / msPorDia));
};

const getDeadlineDaysForNivel = (
  nivel: "singular" | "federacao" | "confederacao",
) => {
  try {
    const settings = readSystemSettings();
    if (nivel === "singular") {
      return Math.max(
        1,
        Number(
          settings.deadlines?.singularToFederacao ??
            DEFAULT_SYSTEM_SETTINGS.deadlines.singularToFederacao,
        ) || DEFAULT_SYSTEM_SETTINGS.deadlines.singularToFederacao,
      );
    }
    if (nivel === "federacao") {
      return Math.max(
        1,
        Number(
          settings.deadlines?.federacaoToConfederacao ??
            DEFAULT_SYSTEM_SETTINGS.deadlines.federacaoToConfederacao,
        ) || DEFAULT_SYSTEM_SETTINGS.deadlines.federacaoToConfederacao,
      );
    }
  } catch (error) {
    console.warn("[deadlines] falha ao ler configurações:", error);
  }
  return 30;
};

const computePrazoLimite = (
  nivel: "singular" | "federacao" | "confederacao",
  baseDate = new Date(),
) => {
  const dias = getDeadlineDaysForNivel(nivel);
  const prazoDate = new Date(baseDate.getTime() + dias * 24 * 60 * 60 * 1000);
  return prazoDate.toISOString();
};

// Carrega nomes de cidade e cooperativa para um conjunto de pedidos
console.log(`[sqlite] abrindo banco em: ${SQLITE_PATH}`);
const db = getDb(SQLITE_PATH);

const ensurePedidoSchema = () => {
  const alters = [
    `ALTER TABLE ${TBL("pedidos")} ADD COLUMN responsavel_atual_id TEXT`,
    `ALTER TABLE ${TBL("pedidos")} ADD COLUMN responsavel_atual_nome TEXT`,
    `ALTER TABLE ${TBL("pedidos")} ADD COLUMN criado_por_user TEXT`,
    `ALTER TABLE ${TBL("pedidos")} ADD COLUMN data_conclusao TEXT`,
  ];
  for (const stmt of alters) {
    try {
      db.query(stmt);
    } catch (e) {
      const message = (e && typeof e.message === "string")
        ? e.message
        : String(e);
      if (!/duplicate column name/i.test(message)) {
        console.warn("[schema] alteração falhou:", message);
      }
    }
  }
};

ensurePedidoSchema();

const ensureAuditoriaSchema = () => {
  try {
    db.query(
      `ALTER TABLE ${
        TBL("auditoria_logs")
      } ADD COLUMN usuario_display_nome TEXT`,
    );
  } catch (e) {
    const message = (e && typeof e.message === "string")
      ? e.message
      : String(e);
    if (!/duplicate column name/i.test(message)) {
      console.warn("[schema] auditoria alter falhou:", message);
    }
  }
};

ensureAuditoriaSchema();

const ensureCoberturaSchema = () => {
  try {
    db.query(`CREATE TABLE IF NOT EXISTS ${TBL("cobertura_logs")} (
      id TEXT PRIMARY KEY,
      cidade_id TEXT NOT NULL,
      cooperativa_origem TEXT,
      cooperativa_destino TEXT,
      usuario_email TEXT,
      usuario_nome TEXT,
      usuario_papel TEXT,
      detalhes TEXT,
      timestamp TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`);
  } catch (e) {
    console.warn("[schema] criacao de cobertura_logs falhou:", e);
  }

  try {
    db.query(
      `CREATE INDEX IF NOT EXISTS idx_${
        TBL("cobertura_logs").replace(".", "_")
      }_cidade ON ${TBL("cobertura_logs")}(cidade_id)`,
    );
  } catch (e) {
    console.warn("[schema] indice cobertura cidade falhou:", e);
  }
  try {
    db.query(
      `CREATE INDEX IF NOT EXISTS idx_${
        TBL("cobertura_logs").replace(".", "_")
      }_origem ON ${TBL("cobertura_logs")}(cooperativa_origem)`,
    );
  } catch (e) {
    console.warn("[schema] indice cobertura origem falhou:", e);
  }
  try {
    db.query(
      `CREATE INDEX IF NOT EXISTS idx_${
        TBL("cobertura_logs").replace(".", "_")
      }_destino ON ${TBL("cobertura_logs")}(cooperativa_destino)`,
    );
  } catch (e) {
    console.warn("[schema] indice cobertura destino falhou:", e);
  }
};

ensureCoberturaSchema();

const ensureSettingsSchema = () => {
  try {
    db.query(`CREATE TABLE IF NOT EXISTS ${TBL("settings")} (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`);
  } catch (e) {
    console.warn("[schema] criacao de settings falhou:", e);
  }
};

ensureSettingsSchema();

const ensureAlertasSchema = () => {
  try {
    db.query(`CREATE TABLE IF NOT EXISTS ${TBL("alertas")} (
      id TEXT PRIMARY KEY,
      pedido_id TEXT NOT NULL,
      pedido_titulo TEXT,
      destinatario_email TEXT NOT NULL,
      destinatario_nome TEXT,
      destinatario_cooperativa_id TEXT,
      tipo TEXT NOT NULL,
      mensagem TEXT,
      detalhes TEXT,
      lido INTEGER NOT NULL DEFAULT 0,
      criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      disparado_por_email TEXT,
      disparado_por_nome TEXT
    )`);
  } catch (e) {
    console.warn("[schema] criacao de alertas falhou:", e);
  }

  try {
    db.query(
      `CREATE INDEX IF NOT EXISTS idx_${
        TBL("alertas").replace(".", "_")
      }_destinatario ON ${TBL("alertas")}(destinatario_email)`,
    );
  } catch (e) {
    console.warn("[schema] indice alertas destinatario falhou:", e);
  }

  try {
    db.query(
      `CREATE INDEX IF NOT EXISTS idx_${
        TBL("alertas").replace(".", "_")
      }_pedido ON ${TBL("alertas")}(pedido_id)`,
    );
  } catch (e) {
    console.warn("[schema] indice alertas pedido falhou:", e);
  }

  try {
    db.query(
      `CREATE INDEX IF NOT EXISTS idx_${
        TBL("alertas").replace(".", "_")
      }_lido ON ${TBL("alertas")}(lido)`,
    );
  } catch (e) {
    console.warn("[schema] indice alertas lido falhou:", e);
  }
};

ensureAlertasSchema();

const ensureCooperativaSettingsSchema = () => {
  try {
    db.query(`CREATE TABLE IF NOT EXISTS ${TBL("cooperativa_settings")} (
      cooperativa_id TEXT PRIMARY KEY,
      auto_recusar INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`);
  } catch (error) {
    console.warn("[schema] criação de cooperativa_settings falhou:", error);
  }
};

ensureCooperativaSettingsSchema();

type SystemSettings = {
  theme: "light" | "dark" | "system";
  deadlines: {
    singularToFederacao: number;
    federacaoToConfederacao: number;
  };
  requireApproval: boolean;
  autoNotifyManagers: boolean;
  enableSelfRegistration: boolean;
};

const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  theme: "light",
  deadlines: {
    singularToFederacao: 30,
    federacaoToConfederacao: 30,
  },
  requireApproval: true,
  autoNotifyManagers: true,
  enableSelfRegistration: true,
};

const SETTINGS_KEY_SYSTEM = "system_preferences";

const readSystemSettings = (): SystemSettings => {
  try {
    const row = db.queryEntries<{ value: string }>(
      `SELECT value FROM ${TBL("settings")} WHERE key = ? LIMIT 1`,
      [SETTINGS_KEY_SYSTEM],
    )[0];
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      return {
        ...DEFAULT_SYSTEM_SETTINGS,
        ...parsed,
        deadlines: {
          ...DEFAULT_SYSTEM_SETTINGS.deadlines,
          ...(parsed?.deadlines ?? {}),
        },
      };
    }
  } catch (error) {
    console.warn("[settings] falha ao ler configurações:", error);
  }
  return { ...DEFAULT_SYSTEM_SETTINGS };
};

const persistSystemSettings = (settings: SystemSettings) => {
  const payload = JSON.stringify(settings);
  try {
    db.query(
      `INSERT INTO ${
        TBL("settings")
      } (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [SETTINGS_KEY_SYSTEM, payload],
    );
  } catch (error) {
    console.error("[settings] falha ao salvar configurações:", error);
    throw error;
  }
};

// Garante que haja um registro padrão
try {
  persistSystemSettings(readSystemSettings());
} catch (error) {
  console.warn("[settings] não foi possível inicializar configurações:", error);
}

const getCooperativaInfo = (id?: string | null) => {
  if (!id) return null;
  try {
    const row = db.queryEntries<any>(
      `SELECT * FROM ${TBL("cooperativas")} WHERE id_singular = ? LIMIT 1`,
      [id],
    )[0];
    return row ? mapCooperativa(row) : null;
  } catch (e) {
    console.warn("[cooperativas] falha ao buscar cooperativa:", e);
    return null;
  }
};

const normalizeBaseRole = (role?: string | null) => {
  const value = (role || "").toLowerCase();
  if (value === "admin") return "admin";
  return "operador";
};

const deriveRoleForCooperativa = (
  role: string | null | undefined,
  cooperativaId?: string | null,
) => {
  const base = normalizeBaseRole(role);
  if (base === "admin") return "admin";
  const info = getCooperativaInfo(cooperativaId);
  const tipo = info?.tipo;
  if (tipo === "CONFEDERACAO") return "confederacao";
  if (tipo === "FEDERACAO") return "federacao";
  return "operador";
};

const collectSingularesDaFederacao = (federacaoId?: string | null) => {
  if (!federacaoId) return [] as string[];
  try {
    const federacaoInfo = getCooperativaInfo(federacaoId);
    if (!federacaoInfo) return [federacaoId];
    if (federacaoInfo.tipo === "CONFEDERACAO") {
      const todas = db.queryEntries<any>(
        `SELECT id_singular FROM ${TBL("cooperativas")}`,
      ) || [];
      return todas.map((row) => row.id_singular).filter(Boolean);
    }
    const nomeFederacao = federacaoInfo.uniodonto;
    if (!nomeFederacao) return [federacaoId];
    const singulares = db.queryEntries<any>(
      `SELECT id_singular FROM ${TBL("cooperativas")} WHERE FEDERACAO = ?`,
      [nomeFederacao],
    ) || [];
    const ids = singulares.map((row) => row.id_singular).filter(Boolean);
    ids.push(federacaoId);
    return Array.from(new Set(ids));
  } catch (e) {
    console.warn("[cooperativas] falha ao coletar singulares da federacao:", e);
    return [federacaoId];
  }
};

const getVisibleCooperativas = (userData: any): Set<string> | null => {
  if (!userData) return new Set();
  if (userData.papel === "confederacao") return null;

  const cooperativaInfo = getCooperativaInfo(userData.cooperativa_id);
  const tipo = cooperativaInfo?.tipo;

  if (tipo === "CONFEDERACAO") return null;

  if (tipo === "FEDERACAO" || userData.papel === "federacao") {
    const ids = collectSingularesDaFederacao(userData.cooperativa_id);
    return new Set(ids);
  }

  const id = userData.cooperativa_id ? [userData.cooperativa_id] : [];
  return new Set(id);
};

const isCooperativaVisible = (userData: any, cooperativaId: string) => {
  const visible = getVisibleCooperativas(userData);
  if (visible === null) return true;
  return visible.has(cooperativaId);
};

type CoberturaScope = {
  level: "none" | "singular" | "federacao" | "confederacao";
  manageable: Set<string> | null;
};

const resolveCoberturaScope = (userData: any): CoberturaScope => {
  if (!userData) return { level: "none", manageable: new Set() };
  if (INSECURE_MODE) return { level: "confederacao", manageable: null };

  const papel = (userData.papel || "").toLowerCase();
  const cooperativaInfo = getCooperativaInfo(userData.cooperativa_id);
  const tipo = cooperativaInfo?.tipo;

  if (papel === "confederacao" || tipo === "CONFEDERACAO") {
    return { level: "confederacao", manageable: null };
  }

  if (papel === "federacao" || tipo === "FEDERACAO") {
    const ids = collectSingularesDaFederacao(userData.cooperativa_id);
    return { level: "federacao", manageable: new Set(ids.filter(Boolean)) };
  }

  if (papel === "admin" && tipo === "SINGULAR" && userData.cooperativa_id) {
    return {
      level: "singular",
      manageable: new Set([userData.cooperativa_id]),
    };
  }

  return { level: "none", manageable: new Set() };
};

const canManageCobertura = (scope: CoberturaScope, cooperativaId: string) => {
  if (scope.level === "confederacao") return true;
  if (scope.level === "none") return false;
  return scope.manageable?.has(cooperativaId) ?? false;
};

const safeRandomId = (prefix: string) => {
  try {
    if (typeof crypto?.randomUUID === "function") {
      return `${prefix}_${crypto.randomUUID()}`;
    }
  } catch {}
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const registrarLogCobertura = (
  cidadeId: string,
  origem: string | null,
  destino: string | null,
  userData: {
    email?: string;
    nome?: string;
    display_name?: string;
    papel?: string;
  },
  detalhes?: string,
) => {
  try {
    const id = safeRandomId("cov");
    const email = userData.email || "";
    const nome = userData.nome || userData.display_name || email;
    const papel = userData.papel || "";
    const timestamp = new Date().toISOString();
    db.query(
      `INSERT INTO ${
        TBL("cobertura_logs")
      } (id, cidade_id, cooperativa_origem, cooperativa_destino, usuario_email, usuario_nome, usuario_papel, detalhes, timestamp)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        id,
        cidadeId,
        origem,
        destino,
        email,
        nome,
        papel,
        detalhes ?? null,
        timestamp,
      ],
    );
  } catch (e) {
    console.warn("[cobertura] falha ao registrar log:", e);
  }
};

const ensureOperatorRecord = (user: {
  id: string;
  nome: string;
  display_name?: string;
  email: string;
  telefone?: string;
  whatsapp?: string;
  cargo?: string;
  cooperativa_id?: string;
}) => {
  if (!user?.email || !user.cooperativa_id) return;
  try {
    const existing = db.queryEntries<any>(
      `SELECT id FROM ${TBL("operadores")} WHERE email = ? LIMIT 1`,
      [user.email],
    )[0];
    if (existing) return;
    const now = new Date().toISOString();
    db.query(
      `INSERT INTO ${
        TBL("operadores")
      } (nome, id_singular, email, telefone, whatsapp, cargo, status, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        user.display_name || user.nome || user.email,
        user.cooperativa_id,
        user.email,
        user.telefone || "",
        user.whatsapp || "",
        user.cargo || "",
        1,
        now,
      ],
    );
    try {
      db.query(
        `UPDATE auth_users SET cooperativa_id = COALESCE(?, cooperativa_id), papel = COALESCE(papel, ?) WHERE email = ?`,
        [user.cooperativa_id, user.papel || "operador", user.email],
      );
    } catch (e) {
      console.warn(
        "[operadores] não foi possível sincronizar papel/cooperativa em auth_users:",
        e,
      );
    }
  } catch (e) {
    console.warn(
      "[operadores] não foi possível inserir registro automático:",
      e,
    );
  }
};

const getActiveUsersByCooperativa = (cooperativaId?: string | null) => {
  if (!cooperativaId) return [] as Array<any>;
  try {
    const rows = db.queryEntries<any>(
      `SELECT email, COALESCE(display_name, nome, email) AS nome, cooperativa_id, COALESCE(ativo, 1) AS ativo
         FROM auth_users
        WHERE cooperativa_id = ?`,
      [cooperativaId],
    ) || [];
    return rows.filter((row) => Number(row.ativo ?? 1) !== 0);
  } catch (error) {
    console.warn("[alertas] falha ao buscar usuários da cooperativa:", error);
    return [] as Array<any>;
  }
};

const getActiveUserByEmail = (email?: string | null) => {
  if (!email) return null;
  try {
    const row = db.queryEntries<any>(
      `SELECT email, COALESCE(display_name, nome, email) AS nome, cooperativa_id, COALESCE(ativo, 1) AS ativo
         FROM auth_users
        WHERE LOWER(email) = LOWER(?)
        LIMIT 1`,
      [email],
    )[0];
    if (!row) return null;
    if (Number(row.ativo ?? 1) === 0) return null;
    return row;
  } catch (error) {
    console.warn("[alertas] falha ao buscar usuário por email:", error);
    return null;
  }
};

const truncateText = (value: string, max = 280) => {
  if (!value) return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
};

const resolveAppBaseUrl = () => {
  const candidates = [
    Deno.env.get("APP_BASE_URL"),
    Deno.env.get("FRONTEND_BASE_URL"),
    Deno.env.get("APP_URL"),
    Deno.env.get("FRONTEND_URL"),
    Deno.env.get("PUBLIC_APP_URL"),
    Deno.env.get("WEB_APP_URL"),
  ];
  for (const candidate of candidates) {
    if (candidate && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "";
};

const normalizeIbgeInput = (value: unknown) => {
  const digits = (value ?? "").toString().replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length >= 7) {
    return {
      candidate7: digits.slice(0, 7),
      candidate6: digits.slice(0, 6),
    };
  }
  if (digits.length === 6) {
    return {
      candidate7: null,
      candidate6: digits,
    };
  }
  return null;
};

const parseEspecialidadesLista = (value: unknown) => {
  if (!value) return [] as string[];
  const raw = value.toString();
  return raw
    .split(/[;,\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const getCidadeInfoByCodigo = (codigo: unknown, cache: Map<string, any>) => {
  const normalized = normalizeIbgeInput(codigo);
  if (!normalized) return null;

  const { candidate7, candidate6 } = normalized;
  const db = getDb(SQLITE_PATH);

  const variants = [candidate7, candidate6].filter((item): item is string =>
    !!item
  );
  for (const variant of variants) {
    if (cache.has(variant)) {
      return cache.get(variant);
    }
  }

  for (const variant of variants) {
    try {
      const row = db.queryEntries<any>(
        `SELECT CD_MUNICIPIO_7, CD_MUNICIPIO, NM_CIDADE, UF_MUNICIPIO, ID_SINGULAR
           FROM ${TBL("cidades")}
          WHERE CD_MUNICIPIO_7 = ? OR CD_MUNICIPIO = ?
          LIMIT 1`,
        [variant, variant],
      )[0];
      if (row) {
        cache.set(variant, row);
        if (candidate7 && variant !== candidate7) cache.set(candidate7, row);
        if (candidate6 && variant !== candidate6) cache.set(candidate6, row);
        return row;
      }
    } catch (error) {
      console.warn(
        "[importacao] falha ao buscar cidade por código:",
        variant,
        error,
      );
    }
  }

  return null;
};

type PedidoAlertContext = {
  pedidoOriginal?: any;
  pedidoAtualizado: any;
  actor: any;
  detalhes: string[];
  comentario?: string;
  camposAlterados?: string[];
  action: "criado" | "atualizado";
  mensagemCustom?: string;
};

const dispatchPedidoAlert = async (context: PedidoAlertContext) => {
  try {
    const pedido = context.pedidoAtualizado;
    if (!pedido?.id) return;

    const actorEmailRaw = context.actor?.email || context.actor?.id || "";
    const actorEmail = (actorEmailRaw || "").toString().toLowerCase();
    const actorNome = context.actor?.display_name || context.actor?.nome ||
      actorEmailRaw || "Sistema";
    const titulo = pedido.titulo || "Pedido";

    const camposAlterados = context.camposAlterados || [];
    const detalhesLimpos = (context.detalhes || []).filter(Boolean);
    const comentarioTexto = context.comentario
      ? truncateText(context.comentario, 220)
      : "";

    const tipo = (() => {
      if (context.action === "criado") return "novo";
      if (comentarioTexto) return "comentario";
      if (camposAlterados.includes("status")) return "status";
      if (camposAlterados.includes("nivel_atual")) return "nivel";
      if (
        camposAlterados.includes("responsavel_atual_id") ||
        camposAlterados.includes("responsavel_atual_nome")
      ) return "responsavel";
      if (camposAlterados.includes("cooperativa_responsavel_id")) {
        return "responsavel";
      }
      return "atualizacao";
    })();

    const mensagem = truncateText(
      context.mensagemCustom ||
        (detalhesLimpos.length > 0
          ? detalhesLimpos.join(" • ")
          : (comentarioTexto
            ? `Comentário: ${comentarioTexto}`
            : (context.action === "criado"
              ? "Novo pedido criado."
              : "Pedido atualizado."))),
      320,
    );

    const detalhesTexto = truncateText(detalhesLimpos.join(" | "), 1200) ||
      null;
    const baseUrl = resolveAppBaseUrl();
    const pedidoUrl = baseUrl
      ? `${baseUrl.replace(/\/$/, "")}/pedidos/${pedido.id}`
      : null;
    const emailSubject = `[Urede] ${titulo}`;
    const fallbackHtmlParts = [
      `<p>${mensagem}</p>`,
    ];
    if (detalhesTexto) {
      fallbackHtmlParts.push(`<p>${detalhesTexto}</p>`);
    }
    if (pedidoUrl) {
      fallbackHtmlParts.push(
        `<p><a href="${pedidoUrl}" target="_blank" rel="noopener">Acesse o item</a></p>`,
      );
    }
    const fallbackHtmlContent = fallbackHtmlParts.join("");
    const fallbackTextContent = [
      mensagem,
      detalhesTexto ?? "",
      pedidoUrl ? `Acesse: ${pedidoUrl}` : "",
    ].filter(Boolean).join("\n");

    const baseTemplateParams: Record<string, unknown> = {
      subject: emailSubject,
      title: titulo,
      message: mensagem,
      details: detalhesTexto || "",
      actorName: actorNome,
      alertaTipo: tipo,
      action: context.action,
      pedidoId: pedido.id,
      pedidoTitulo: titulo,
      nivelAtual: pedido.nivel_atual ?? "",
      statusAtual: pedido.status ?? "",
      cooperativaSolicitante: pedido.cooperativa_solicitante_nome ||
        pedido.cooperativa_solicitante_id ||
        "",
      cooperativaResponsavel: pedido.cooperativa_responsavel_nome ||
        pedido.cooperativa_responsavel_id ||
        "",
      prazoLimite: pedido.prazo_atual || "",
      comentario: comentarioTexto || "",
      ctaLabel: "Acesse o item",
      ctaUrl: pedidoUrl || undefined,
      currentYear: new Date().getFullYear().toString(),
    };

    const recipients = new Map<
      string,
      { email: string; nome: string | null; cooperativaId: string | null }
    >();
    const addRecipient = (
      email?: string | null,
      nome?: string | null,
      cooperativaId?: string | null,
    ) => {
      if (!email) return;
      const key = email.toString().toLowerCase();
      if (!key) return;
      if (key === actorEmail) return;
      if (!recipients.has(key)) {
        recipients.set(key, {
          email: email,
          nome: nome || email,
          cooperativaId: cooperativaId || null,
        });
      }
    };

    if (pedido.cooperativa_solicitante_id) {
      const solicitantes = getActiveUsersByCooperativa(
        pedido.cooperativa_solicitante_id,
      );
      if (solicitantes.length > 0) {
        for (const usuario of solicitantes) {
          addRecipient(
            usuario.email,
            usuario.nome,
            usuario.cooperativa_id || pedido.cooperativa_solicitante_id,
          );
        }
      }
      if (solicitantes.length === 0 && pedido.criado_por_user) {
        addRecipient(
          pedido.criado_por_user,
          pedido.criado_por_user,
          pedido.cooperativa_solicitante_id,
        );
      }
    } else if (pedido.criado_por_user) {
      addRecipient(pedido.criado_por_user, pedido.criado_por_user, null);
    }

    if (pedido.responsavel_atual_id) {
      const responsavel = getActiveUserByEmail(pedido.responsavel_atual_id);
      if (responsavel) {
        addRecipient(
          responsavel.email,
          responsavel.nome,
          responsavel.cooperativa_id || pedido.cooperativa_responsavel_id ||
            null,
        );
      } else {
        addRecipient(
          pedido.responsavel_atual_id,
          pedido.responsavel_atual_nome || pedido.responsavel_atual_id,
          pedido.cooperativa_responsavel_id || null,
        );
      }
    } else if (pedido.cooperativa_responsavel_id) {
      const responsaveis = getActiveUsersByCooperativa(
        pedido.cooperativa_responsavel_id,
      );
      for (const usuario of responsaveis) {
        addRecipient(
          usuario.email,
          usuario.nome,
          usuario.cooperativa_id || pedido.cooperativa_responsavel_id,
        );
      }
    }

    if (recipients.size === 0) return;

    const agora = new Date().toISOString();
    const emailPromises: Promise<void>[] = [];

    for (const [, destinatario] of recipients) {
      try {
        const id = safeRandomId("alert");
        db.query(
          `INSERT INTO ${TBL("alertas")} (
            id,
            pedido_id,
            pedido_titulo,
            destinatario_email,
            destinatario_nome,
            destinatario_cooperativa_id,
            tipo,
            mensagem,
            detalhes,
            lido,
            criado_em,
            disparado_por_email,
            disparado_por_nome
          ) VALUES (?,?,?,?,?,?,?,?,?,0,?,?,?)`,
          [
            id,
            pedido.id,
            titulo,
            destinatario.email,
            destinatario.nome ?? destinatario.email,
            destinatario.cooperativaId ?? null,
            tipo,
            mensagem,
            detalhesTexto,
            agora,
            actorEmailRaw || null,
            actorNome,
          ],
        );
        emailPromises.push(
          sendBrevoTransactionalEmail({
            to: [{
              email: destinatario.email,
              name: destinatario.nome || undefined,
            }],
            subject: emailSubject,
            params: {
              ...baseTemplateParams,
              destinatarioNome: destinatario.nome || destinatario.email,
              destinatarioEmail: destinatario.email,
              destinatarioCooperativaId: destinatario.cooperativaId || "",
            },
            htmlContent: fallbackHtmlContent,
            textContent: fallbackTextContent,
          }),
        );
      } catch (error) {
        console.warn("[alertas] falha ao inserir alerta:", error);
      }
    }

    if (emailPromises.length > 0) {
      await Promise.allSettled(emailPromises);
    }
  } catch (error) {
    console.warn("[alertas] falha ao despachar alerta:", error);
  }
};

const getCooperativaSettings = (cooperativaId?: string | null) => {
  if (!cooperativaId) return { auto_recusar: false };
  try {
    const row = db.queryEntries<{ auto_recusar: number }>(
      `SELECT auto_recusar FROM ${
        TBL("cooperativa_settings")
      } WHERE cooperativa_id = ? LIMIT 1`,
      [cooperativaId],
    )[0];
    return { auto_recusar: !!(row?.auto_recusar) };
  } catch (error) {
    console.warn("[cooperativa_settings] falha ao buscar preferências:", error);
    return { auto_recusar: false };
  }
};

const setCooperativaSettings = (
  cooperativaId: string,
  settings: { auto_recusar?: boolean },
) => {
  if (!cooperativaId) return;
  try {
    const flag = settings.auto_recusar ? 1 : 0;
    db.query(
      `INSERT INTO ${
        TBL("cooperativa_settings")
      } (cooperativa_id, auto_recusar, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(cooperativa_id)
       DO UPDATE SET auto_recusar = excluded.auto_recusar, updated_at = excluded.updated_at`,
      [cooperativaId, flag],
    );
  } catch (error) {
    console.error(
      "[cooperativa_settings] falha ao salvar preferências:",
      error,
    );
    throw error;
  }
};

type EscalationTarget = {
  novoNivel: "singular" | "federacao" | "confederacao";
  novaCooperativa: string;
};

const computeEscalationTarget = (pedido: any): EscalationTarget | null => {
  if (!pedido || !pedido.nivel_atual) return null;

  const nivelAtual = (pedido.nivel_atual || "").toString();
  if (nivelAtual === "confederacao") return null;

  if (nivelAtual === "singular") {
    try {
      const coopSolic = db.queryEntries<any>(
        `SELECT FEDERACAO FROM ${
          TBL("cooperativas")
        } WHERE id_singular = ? LIMIT 1`,
        [pedido.cooperativa_solicitante_id],
      )[0];
      const federacaoNome = coopSolic?.FEDERACAO;
      if (federacaoNome) {
        const fed = db.queryEntries<any>(
          `SELECT id_singular FROM ${
            TBL("cooperativas")
          } WHERE TIPO LIKE 'FEDER%' AND FEDERACAO = ? LIMIT 1`,
          [federacaoNome],
        )[0];
        if (fed?.id_singular) {
          return {
            novoNivel: "federacao",
            novaCooperativa: fed.id_singular as string,
          };
        }
      }
    } catch (error) {
      console.warn(
        "[transferencia] falha ao localizar federação destino:",
        error,
      );
    }
    return null;
  }

  if (nivelAtual === "federacao") {
    try {
      const conf = db.queryEntries<any>(
        `SELECT id_singular FROM ${
          TBL("cooperativas")
        } WHERE TIPO LIKE 'CONFEDER%' LIMIT 1`,
      )[0];
      if (conf?.id_singular) {
        return {
          novoNivel: "confederacao",
          novaCooperativa: conf.id_singular as string,
        };
      }
    } catch (error) {
      console.warn(
        "[transferencia] falha ao localizar confederação destino:",
        error,
      );
    }
    return null;
  }

  return null;
};

const applyEscalation = async (
  pedido: any,
  actor:
    | { email?: string; id?: string; nome?: string; display_name?: string }
    | null,
  motivo: string,
) => {
  const target = computeEscalationTarget(pedido);
  if (!target) return null;

  const agoraDate = new Date();
  const agora = agoraDate.toISOString();
  const novoPrazo = computePrazoLimite(target.novoNivel, agoraDate);

  try {
    db.query(
      `UPDATE ${
        TBL("pedidos")
      } SET nivel_atual = ?, cooperativa_responsavel_id = ?, prazo_atual = ?, data_ultima_alteracao = ?, responsavel_atual_id = NULL, responsavel_atual_nome = NULL WHERE id = ?`,
      [target.novoNivel, target.novaCooperativa, novoPrazo, agora, pedido.id],
    );
  } catch (error) {
    console.error("[transferencia] falha ao aplicar escalonamento:", error);
    throw error;
  }

  const updatedRow = db.queryEntries<any>(
    `SELECT * FROM ${TBL("pedidos")} WHERE id = ? LIMIT 1`,
    [pedido.id],
  )[0];
  if (!updatedRow) return null;

  const updatedPedido = {
    ...updatedRow,
    especialidades: Array.isArray(updatedRow.especialidades)
      ? updatedRow.especialidades
      : (() => {
        try {
          return JSON.parse(updatedRow.especialidades || "[]");
        } catch {
          return [];
        }
      })(),
  };

  const base = [{
    ...updatedPedido,
    dias_restantes: computeDiasRestantes(
      updatedPedido.prazo_atual,
      updatedPedido.status,
    ),
  }];
  const [enriched] = await enrichPedidos(base);
  const result = enriched || base[0];
  if (result) {
    result.dias_restantes = computeDiasRestantes(
      result.prazo_atual,
      result.status,
    );
    if (
      result.status === "concluido" && result.data_conclusao &&
      result.data_criacao
    ) {
      const dataInicio = new Date(result.data_criacao);
      const dataFinal = new Date(result.data_conclusao);
      if (
        !Number.isNaN(dataInicio.getTime()) &&
        !Number.isNaN(dataFinal.getTime())
      ) {
        const diff = dataFinal.getTime() - dataInicio.getTime();
        (result as any).dias_para_concluir = Math.max(
          0,
          Math.round(diff / (1000 * 60 * 60 * 24)),
        );
      }
    }
  }

  const destinoInfo = getCooperativaInfo(target.novaCooperativa);
  const dadosActor = actor ||
    { email: "sistema@urede", nome: "Sistema Automático" };
  const actorNome = dadosActor.display_name || dadosActor.nome ||
    dadosActor.email || "Sistema";

  const auditoria = {
    id: safeRandomId("audit"),
    pedido_id: pedido.id,
    usuario_id: dadosActor.id || dadosActor.email || "sistema",
    usuario_nome: actorNome,
    usuario_display_nome: actorNome,
    acao: "Transferência de nível",
    timestamp: new Date().toISOString(),
    detalhes: `Novo nível: ${target.novoNivel}${
      destinoInfo?.uniodonto ? ` (${destinoInfo.uniodonto})` : ""
    } | Motivo: ${motivo}`,
  };

  try {
    db.query(
      `INSERT INTO ${
        TBL("auditoria_logs")
      } (id, pedido_id, usuario_id, usuario_nome, usuario_display_nome, acao, timestamp, detalhes)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        auditoria.id,
        auditoria.pedido_id,
        auditoria.usuario_id,
        auditoria.usuario_nome,
        auditoria.usuario_display_nome,
        auditoria.acao,
        auditoria.timestamp,
        auditoria.detalhes,
      ],
    );
  } catch (error) {
    console.warn(
      "[transferencia] não foi possível registrar auditoria:",
      error,
    );
  }

  try {
    await dispatchPedidoAlert({
      pedidoOriginal: pedido,
      pedidoAtualizado: result,
      actor: dadosActor,
      detalhes: [
        `Transferência para ${target.novoNivel}`,
        destinoInfo?.uniodonto
          ? `Nova responsável: ${destinoInfo.uniodonto}`
          : "",
        `Motivo: ${motivo}`,
      ],
      action: "atualizado",
      mensagemCustom: `Pedido transferido para ${target.novoNivel}`,
    });
  } catch (error) {
    console.warn(
      "[transferencia] falha ao despachar alerta de transferência:",
      error,
    );
  }

  return result;
};

const autoEscalateIfNeeded = async (
  pedido: any,
  actor:
    | { email?: string; id?: string; nome?: string; display_name?: string }
    | null,
) => {
  let current = pedido;
  const maxHops = 5;
  let hops = 0;

  while (current && hops < maxHops) {
    const coopAtual = current.cooperativa_responsavel_id;
    if (!coopAtual) break;
    const settings = getCooperativaSettings(coopAtual);
    if (!settings.auto_recusar) break;

    const coopInfo = getCooperativaInfo(coopAtual);
    const motivo = `Recusa automática por ${
      coopInfo?.uniodonto || "cooperativa responsável"
    }`;
    const escalado = await applyEscalation(current, actor, motivo);
    if (!escalado) break;
    current = escalado;
    hops += 1;
  }

  if (current) {
    current.dias_restantes = computeDiasRestantes(
      current.prazo_atual,
      current.status,
    );
    if (
      current.status === "concluido" && current.data_conclusao &&
      current.data_criacao
    ) {
      const dataInicio = new Date(current.data_criacao);
      const dataFinal = new Date(current.data_conclusao);
      if (
        !Number.isNaN(dataInicio.getTime()) &&
        !Number.isNaN(dataFinal.getTime())
      ) {
        const diff = dataFinal.getTime() - dataInicio.getTime();
        (current as any).dias_para_concluir = Math.max(
          0,
          Math.round(diff / (1000 * 60 * 60 * 24)),
        );
      }
    }
  }

  return current;
};

const autoEscalatePedidosForCooperativa = async (
  cooperativaId: string,
  actor:
    | { email?: string; id?: string; nome?: string; display_name?: string }
    | null,
) => {
  try {
    const rows = db.queryEntries<any>(
      `SELECT * FROM ${
        TBL("pedidos")
      } WHERE cooperativa_responsavel_id = ? AND status NOT IN ('concluido', 'cancelado')`,
      [cooperativaId],
    ) || [];

    for (const row of rows) {
      const pedido = {
        ...row,
        especialidades: Array.isArray(row.especialidades)
          ? row.especialidades
          : (() => {
            try {
              return JSON.parse(row.especialidades || "[]");
            } catch {
              return [];
            }
          })(),
      };
      await autoEscalateIfNeeded(pedido, actor);
    }
  } catch (error) {
    console.warn(
      "[transferencia] falha ao aplicar recusa automática em lote:",
      error,
    );
  }
};

const enrichPedidos = async (pedidos: any[]) => {
  if (!pedidos || pedidos.length === 0) return [] as any[];

  const cityIds = Array.from(
    new Set(
      pedidos
        .map((p) => p.cidade_id)
        .filter((v) => typeof v === "string" && v.trim().length > 0),
    ),
  );
  const coopIds = Array.from(
    new Set(
      pedidos
        .flatMap((
          p,
        ) => [p.cooperativa_solicitante_id, p.cooperativa_responsavel_id])
        .filter((v) => typeof v === "string" && v.trim().length > 0),
    ),
  );

  let cidadesMap: Record<string, any> = {};
  let coopsMap: Record<string, any> = {};

  try {
    if (cityIds.length > 0) {
      const placeholders = cityIds.map(() => "?").join(",");
      const cidadesRows = db.queryEntries(
        `SELECT CD_MUNICIPIO_7, NM_CIDADE, UF_MUNICIPIO FROM ${
          TBL("cidades")
        } WHERE CD_MUNICIPIO_7 IN (${placeholders})`,
        cityIds as any,
      );
      for (const r of cidadesRows || []) {
        const c = mapCidade(r);
        cidadesMap[c.cd_municipio_7] = c;
      }
    }
  } catch (e) {
    console.warn("[enrichPedidos] cidades lookup falhou:", e);
  }

  try {
    if (coopIds.length > 0) {
      const placeholders = coopIds.map(() => "?").join(",");
      const coopRows = db.queryEntries(
        `SELECT id_singular, UNIODONTO, FEDERACAO FROM ${
          TBL("cooperativas")
        } WHERE id_singular IN (${placeholders})`,
        coopIds as any,
      );
      for (const r of coopRows || []) {
        const c = mapCooperativa(r);
        coopsMap[c.id_singular] = c;
      }
    }
  } catch (e) {
    console.warn("[enrichPedidos] cooperativas lookup falhou:", e);
  }

  return pedidos.map((p) => {
    const cidade = cidadesMap[p.cidade_id];
    const coop = coopsMap[p.cooperativa_solicitante_id];
    const coopResp = coopsMap[p.cooperativa_responsavel_id];
    return {
      ...p,
      cidade_nome: cidade?.nm_cidade || null,
      estado: cidade?.uf_municipio || null,
      cooperativa_solicitante_nome: coop?.uniodonto || null,
      cooperativa_responsavel_nome: coopResp?.uniodonto || null,
    };
  });
};

// Middleware para verificar autenticação
const requireAuth = async (c: any, next: any) => {
  // Se INSECURE_MODE estiver ativado, bypass completo de autenticação/permissões
  if (INSECURE_MODE) {
    c.set("user", { id: "insecure", email: "insecure@local", claims: {} });
    return await next();
  }

  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : undefined;
  if (!token) return c.json({ error: "Token de acesso não fornecido" }, 401);

  if (AUTH_PROVIDER === "local") {
    try {
      const payload = await verifyJwt(JWT_SECRET, token);
      c.set("user", { id: payload.sub, email: payload.email, claims: payload });
      return await next();
    } catch {
      return c.json({ error: "Token inválido ou expirado" }, 401);
    }
  }

  // Nenhum fallback extra: apenas JWT local
  return c.json({ error: "Token inválido ou expirado" }, 401);
};

// Função para obter dados do usuário somente via SQL
const getUserData = async (userId: string, userEmail?: string | null) => {
  // Se INSECURE_MODE estiver ativo, retornar usuário com papel 'confederacao'
  // para permitir criar/editar/excluir localmente sem checagens de RBAC.
  if (INSECURE_MODE) {
    return {
      id: "insecure",
      nome: "Insecure",
      display_name: "Insecure",
      email: "insecure@local",
      telefone: "",
      whatsapp: "",
      cargo: "",
      cooperativa_id: "",
      papel: "confederacao",
      ativo: true,
      data_cadastro: new Date().toISOString(),
    } as any;
  }

  try {
    // Se provider local, primeiro tentar em auth_users (SQLite)
    if (AUTH_PROVIDER === "local") {
      try {
        const db = getDb(SQLITE_PATH);
        if (userEmail) {
          const row = db.queryEntries<{
            email: string;
            nome: string;
            display_name: string | null;
            telefone: string | null;
            whatsapp: string | null;
            cargo: string | null;
            cooperativa_id: string | null;
            papel: string | null;
            ativo: number | null;
            data_cadastro: string | null;
          }>(
            `SELECT email, nome, COALESCE(display_name, nome) as display_name, telefone, whatsapp, cargo, cooperativa_id, papel, COALESCE(ativo,1) as ativo, COALESCE(data_cadastro, CURRENT_TIMESTAMP) as data_cadastro FROM auth_users WHERE email = ?`,
            [userEmail],
          )[0];
          if (row) {
            const user = {
              id: userEmail,
              nome: row.nome || "Usuário",
              display_name: row.display_name || "Usuário",
              email: userEmail,
              telefone: row.telefone || "",
              whatsapp: row.whatsapp || "",
              cargo: row.cargo || "",
              cooperativa_id: row.cooperativa_id || "",
              papel: (row.papel as any) || "operador",
              ativo: !!row.ativo,
              data_cadastro: row.data_cadastro,
            } as any;
            ensureOperatorRecord(user);
            return user;
          }
        }
      } catch (e) {
        console.warn("[getUserData] sqlite auth_users lookup falhou:", e);
      }
    }

    // Tentar por email em operadores (SQLite)
    if (userEmail) {
      const byEmail = db.queryEntries(
        `SELECT * FROM ${TBL("operadores")} WHERE email = ? LIMIT 1`,
        [userEmail],
      )[0];
      if (byEmail) {
        const o = mapOperador(byEmail);
        const user = {
          ...o,
          cooperativa_id: o.id_singular,
          papel: "operador",
        } as any;
        ensureOperatorRecord({
          id: user.id,
          nome: user.nome,
          display_name: user.nome,
          email: user.email,
          telefone: user.telefone,
          whatsapp: user.whatsapp,
          cargo: user.cargo,
          cooperativa_id: user.cooperativa_id,
        });
        return user;
      }
    }

    // Fallback básico
    const fallback = {
      id: userId,
      nome: "Usuário",
      display_name: "Usuário",
      email: userEmail || "",
      telefone: "",
      whatsapp: "",
      cargo: "",
      cooperativa_id: "",
      papel: "operador",
      ativo: true,
      data_cadastro: new Date().toISOString(),
    };
    ensureOperatorRecord(fallback as any);
    return fallback;
  } catch (error) {
    console.error("Erro ao obter dados do usuário:", error);
    return null;
  }
};

// Middleware para verificar permissões RBAC
const requireRole = (roles: string[]) => {
  return async (c: any, next: any) => {
    const user = c.get("user");
    const userData = await getUserData(user.id, user.email);

    if (!roles.includes(userData.papel)) {
      return c.json({ error: "Acesso negado" }, 403);
    }

    c.set("userData", userData);
    await next();
  };
};

// Inicialização desativada (dados reais via SQL)
const initializeData = async () => {};

// Função para escalonar pedidos automaticamente
const escalarPedidos = async () => {
  try {
    const agoraDate = new Date();
    const pedidos = db.queryEntries<any>(
      `SELECT * FROM ${
        TBL("pedidos")
      } WHERE status IN ('novo','em_andamento') AND (nivel_atual IS NULL OR nivel_atual <> 'confederacao')`,
    );
    if (!pedidos || pedidos.length === 0) return;

    const systemActor = {
      email: "sistema@urede",
      nome: "Sistema Automático",
      display_name: "Sistema Automático",
      id: "sistema",
    };

    for (const row of pedidos as any[]) {
      const pedido = {
        ...row,
        especialidades: Array.isArray(row.especialidades)
          ? row.especialidades
          : (() => {
            try {
              return JSON.parse(row.especialidades || "[]");
            } catch {
              return [];
            }
          })(),
      };

      if (!pedido.prazo_atual) {
        continue;
      }

      const diasRestantes = computeDiasRestantes(
        pedido.prazo_atual,
        pedido.status,
      );
      const prazoExpirado = diasRestantes <= 0 ||
        new Date(pedido.prazo_atual) <= agoraDate;
      if (!prazoExpirado) {
        continue;
      }

      const target = computeEscalationTarget(pedido);
      if (!target) continue;

      try {
        const escalado = await applyEscalation(
          pedido,
          systemActor,
          "Escalonamento automático por vencimento de prazo",
        );
        if (escalado) {
          await autoEscalateIfNeeded(escalado, systemActor);
        }
      } catch (error) {
        console.error("Erro ao escalar pedido automaticamente:", error);
      }
    }
  } catch (error) {
    console.error("Erro ao escalar pedidos:", error);
  }
};

// ROTAS DA API

// Rota de autenticação - Cadastro (JWT local)
app.post("/auth/register", async (c) => {
  try {
    const {
      email,
      password,
      nome,
      display_name,
      telefone,
      whatsapp,
      cargo,
      cooperativa_id,
      papel,
    } = await c.req.json();

    if (AUTH_PROVIDER !== "local") {
      return c.json({ error: "Cadastro local desabilitado" }, 400);
    }
    if (!email || !password) {
      return c.json({ error: "Email e senha são obrigatórios" }, 400);
    }

    const db = getDb(SQLITE_PATH);
    db.execute(`CREATE TABLE IF NOT EXISTS auth_users (
      email TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      nome TEXT,
      display_name TEXT,
      telefone TEXT,
      whatsapp TEXT,
      cargo TEXT,
      cooperativa_id TEXT,
      papel TEXT DEFAULT 'operador',
      ativo INTEGER DEFAULT 1,
      data_cadastro TEXT DEFAULT (CURRENT_TIMESTAMP)
    )`);

    const already = db.queryEntries<{ email: string }>(
      `SELECT email FROM auth_users WHERE email = ?`,
      [email],
    )[0];
    if (already) return c.json({ error: "Email já registrado" }, 400);

    // Verificar se há Authorization: se sim, aplicar regras de criação por papéis
    let requester: any = null;
    const authHeader = c.req.header("Authorization");
    const authzToken = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : undefined;
    if (authzToken) {
      try {
        const payload = await verifyJwt(JWT_SECRET, authzToken);
        requester = await getUserData(
          payload.sub as string,
          payload.email as string,
        );
      } catch {}
    }

    // Regras:
    // - Sem Authorization (auto-registro): força papel 'operador' e exige cooperativa_id
    // - Com Authorization:
    //   * confederacao: pode criar para qualquer cooperativa, qualquer papel
    //   * federacao: pode criar para sua federação e singulares da sua federação
    //   * admin (singular): pode criar apenas para sua cooperativa
    let finalPapel = (papel as any) || "operador";
    let finalCoop = cooperativa_id || "";

    if (!requester) {
      // Auto-registro público
      finalPapel = "operador";
      if (!finalCoop) {
        return c.json({ error: "cooperativa_id é obrigatório" }, 400);
      }
    } else {
      if (requester.papel === "confederacao") {
        // Sem restrições
      } else if (requester.papel === "federacao") {
        // Verificar se destino pertence à sua federação ou é a própria federação
        if (!finalCoop) {
          return c.json({ error: "cooperativa_id é obrigatório" }, 400);
        }
        try {
          const dest = db.queryEntries<any>(
            `SELECT id_singular, FEDERACAO FROM ${
              TBL("cooperativas")
            } WHERE id_singular = ? LIMIT 1`,
            [finalCoop],
          )[0];
          const reqCoop = db.queryEntries<any>(
            `SELECT id_singular, UNIODONTO, FEDERACAO, TIPO FROM ${
              TBL("cooperativas")
            } WHERE id_singular = ? LIMIT 1`,
            [requester.cooperativa_id],
          )[0];
          const sameFed = dest && reqCoop &&
            (dest.FEDERACAO === reqCoop.UNIODONTO ||
              dest.FEDERACAO === reqCoop.FEDERACAO);
          const isSelf = dest && reqCoop &&
            dest.id_singular === reqCoop.id_singular;
          if (!sameFed && !isSelf) {
            return c.json({
              error: "Sem permissão para criar usuário nesta cooperativa",
            }, 403);
          }
        } catch {
          return c.json({ error: "Falha ao validar federação" }, 400);
        }
      } else if (requester.papel === "admin") {
        if (!finalCoop || finalCoop !== requester.cooperativa_id) {
          return c.json({
            error: "Admin de singular só cria usuários da sua operadora",
          }, 403);
        }
      } else if (requester.papel === "operador") {
        return c.json({ error: "Operador não pode criar usuários" }, 403);
      }
    }

    const hash = await bcrypt.hash(password);
    const resolvedRole = deriveRoleForCooperativa(finalPapel, finalCoop);
    db.query(
      `INSERT INTO auth_users (email, password_hash, nome, display_name, telefone, whatsapp, cargo, cooperativa_id, papel, ativo) VALUES (?,?,?,?,?,?,?,?,?,1)`,
      [
        email,
        hash,
        nome || "",
        display_name || nome || "",
        telefone || "",
        whatsapp || "",
        cargo || "",
        finalCoop,
        resolvedRole,
      ],
    );

    // Emitir token após cadastro
    const token = await signJwt(JWT_SECRET, {
      sub: email,
      email,
      nome: nome || "",
      cooperativa_id: finalCoop || "",
      papel: resolvedRole || "operador",
    });
    return c.json({
      message: "Usuário criado com sucesso",
      token,
      user: {
        id: email,
        nome: nome || "",
        display_name: display_name || nome || "",
        email,
        telefone: telefone || "",
        whatsapp: whatsapp || "",
        cargo: cargo || "",
        cooperativa_id: finalCoop || "",
        papel: resolvedRole,
        ativo: true,
        data_cadastro: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Erro no cadastro:", error);
    return c.json({ error: "Erro interno do servidor" }, 500);
  }
});

// Rota de autenticação - Login (JWT local)
app.post("/auth/login", async (c) => {
  try {
    const { email, password } = await c.req.json();
    if (AUTH_PROVIDER !== "local") {
      return c.json({ error: "Login local desabilitado" }, 400);
    }
    if (!email || !password) {
      return c.json({ error: "Email e senha são obrigatórios" }, 400);
    }

    const db = getDb(SQLITE_PATH);
    const row = db.queryEntries<
      {
        email: string;
        password_hash: string;
        nome: string | null;
        display_name: string | null;
        cooperativa_id: string | null;
        papel: string | null;
      }
    >(
      `SELECT email, password_hash, nome, display_name, cooperativa_id, papel FROM auth_users WHERE email = ?`,
      [email],
    )[0];
    if (!row) return c.json({ error: "Credenciais inválidas" }, 401);
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return c.json({ error: "Credenciais inválidas" }, 401);

    const token = await signJwt(JWT_SECRET, {
      sub: email,
      email,
      nome: row.nome || undefined,
      cooperativa_id: row.cooperativa_id || undefined,
      papel: (row.papel as any) || "operador",
    });

    return c.json({ token });
  } catch (error) {
    console.error("Erro no login:", error);
    return c.json({ error: "Erro interno do servidor" }, 500);
  }
});

// Rota para obter dados do usuário autenticado
app.get("/auth/me", requireAuth, async (c) => {
  try {
    const user = c.get("user");
    const userData = await getUserData(
      user.id,
      user.email || user?.claims?.email,
    );

    return c.json({ user: userData });
  } catch (error) {
    console.error("Erro ao obter dados do usuário:", error);
    return c.json({ error: "Erro ao obter dados do usuário" }, 500);
  }
});

app.get("/configuracoes/sistema", requireAuth, async (c) => {
  try {
    const settings = readSystemSettings();
    return c.json({ settings });
  } catch (error) {
    console.error("[settings] erro ao ler configurações:", error);
    return c.json({ error: "Erro ao carregar configurações" }, 500);
  }
});

app.put("/configuracoes/sistema", requireAuth, async (c) => {
  const authUser = c.get("user");
  const userData = await getUserData(
    authUser.id,
    authUser.email || authUser?.claims?.email,
  );
  if (!userData) return c.json({ error: "Usuário não encontrado" }, 401);

  const papel = (userData.papel || "").toLowerCase();
  if (papel !== "confederacao") {
    return c.json({ error: "Acesso negado" }, 403);
  }

  let payload: any;
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: "JSON inválido" }, 400);
  }

  const theme = ["light", "dark", "system"].includes(payload?.theme)
    ? payload.theme
    : DEFAULT_SYSTEM_SETTINGS.theme;
  const deadlinesPayload = payload?.deadlines ?? {};
  const singularToFederacao = Math.max(
    1,
    Number(
      deadlinesPayload.singularToFederacao ??
        DEFAULT_SYSTEM_SETTINGS.deadlines.singularToFederacao,
    ) || DEFAULT_SYSTEM_SETTINGS.deadlines.singularToFederacao,
  );
  const federacaoToConfederacao = Math.max(
    1,
    Number(
      deadlinesPayload.federacaoToConfederacao ??
        DEFAULT_SYSTEM_SETTINGS.deadlines.federacaoToConfederacao,
    ) || DEFAULT_SYSTEM_SETTINGS.deadlines.federacaoToConfederacao,
  );

  const settings: SystemSettings = {
    theme,
    deadlines: {
      singularToFederacao,
      federacaoToConfederacao,
    },
    requireApproval: Boolean(
      payload?.requireApproval ?? DEFAULT_SYSTEM_SETTINGS.requireApproval,
    ),
    autoNotifyManagers: Boolean(
      payload?.autoNotifyManagers ?? DEFAULT_SYSTEM_SETTINGS.autoNotifyManagers,
    ),
    enableSelfRegistration: Boolean(
      payload?.enableSelfRegistration ??
        DEFAULT_SYSTEM_SETTINGS.enableSelfRegistration,
    ),
  };

  try {
    persistSystemSettings(settings);
    return c.json({ settings });
  } catch (error) {
    console.error("[settings] erro ao salvar configurações:", error);
    return c.json({ error: "Falha ao salvar configurações" }, 500);
  }
});

app.put("/auth/me", requireAuth, async (c) => {
  try {
    const authUser = c.get("user");
    const userEmail = authUser.email || authUser?.claims?.email;
    if (!userEmail) {
      return c.json({ error: "Usuário não encontrado" }, 404);
    }

    let body: any = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "JSON inválido" }, 400);
    }

    const updatableFields = [
      "nome",
      "display_name",
      "telefone",
      "whatsapp",
      "cargo",
    ] as const;
    const updates: Record<string, string> = {};
    for (const field of updatableFields) {
      if (field in body && typeof body[field] === "string") {
        updates[field] = body[field].trim();
      }
    }

    if (Object.keys(updates).length === 0) {
      const current = await getUserData(authUser.id, userEmail);
      return c.json({ user: current, message: "Nenhuma alteração aplicada" });
    }

    const setClauses: string[] = [];
    const values: string[] = [];
    for (const [key, value] of Object.entries(updates)) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }

    try {
      db.query(
        `UPDATE auth_users SET ${setClauses.join(", ")} WHERE email = ?`,
        [...values, userEmail],
      );
    } catch (error) {
      console.error("[auth] falha ao atualizar auth_users:", error);
      return c.json({ error: "Não foi possível atualizar o perfil" }, 500);
    }

    try {
      const operatorUpdates: string[] = [];
      const operatorValues: string[] = [];
      if ("nome" in updates) {
        operatorUpdates.push("nome = ?");
        operatorValues.push(updates.nome);
      }
      if ("telefone" in updates) {
        operatorUpdates.push("telefone = ?");
        operatorValues.push(updates.telefone);
      }
      if ("whatsapp" in updates) {
        operatorUpdates.push("whatsapp = ?");
        operatorValues.push(updates.whatsapp);
      }
      if ("cargo" in updates) {
        operatorUpdates.push("cargo = ?");
        operatorValues.push(updates.cargo);
      }
      if (operatorUpdates.length > 0) {
        db.query(
          `UPDATE ${TBL("operadores")} SET ${
            operatorUpdates.join(", ")
          } WHERE email = ?`,
          [...operatorValues, userEmail],
        );
      }
    } catch (error) {
      console.warn("[auth] falha ao sincronizar dados em operadores:", error);
    }

    const updatedUser = await getUserData(authUser.id, userEmail);
    return c.json({ user: updatedUser });
  } catch (error) {
    console.error("Erro ao atualizar perfil do usuário:", error);
    return c.json({ error: "Erro ao atualizar perfil" }, 500);
  }
});

app.post("/auth/change-password", requireAuth, async (c) => {
  try {
    const authUser = c.get("user");
    const userEmail = authUser.email || authUser?.claims?.email;
    if (!userEmail) {
      return c.json({ error: "Usuário não encontrado" }, 404);
    }

    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "JSON inválido" }, 400);
    }

    const currentPassword = typeof body.current_password === "string"
      ? body.current_password
      : "";
    const newPassword = typeof body.new_password === "string"
      ? body.new_password
      : "";

    if (!INSECURE_MODE && (!currentPassword || !newPassword)) {
      return c.json(
        { error: "Senha atual e nova senha são obrigatórias" },
        400,
      );
    }

    if (newPassword && newPassword.length < 8) {
      return c.json(
        { error: "A nova senha deve ter pelo menos 8 caracteres" },
        400,
      );
    }

    const row = db.queryEntries<{ password_hash: string }>(
      "SELECT password_hash FROM auth_users WHERE email = ? LIMIT 1",
      [userEmail],
    )[0];
    if (!row) {
      return c.json({ error: "Usuário não encontrado" }, 404);
    }

    if (!INSECURE_MODE) {
      const matches = await bcrypt.compare(currentPassword, row.password_hash);
      if (!matches) {
        return c.json({ error: "Senha atual incorreta" }, 400);
      }
    }

    if (!newPassword) {
      return c.json({ error: "Nova senha inválida" }, 400);
    }

    const newHash = await bcrypt.hash(newPassword);
    db.query("UPDATE auth_users SET password_hash = ? WHERE email = ?", [
      newHash,
      userEmail,
    ]);

    return c.json({ message: "Senha atualizada com sucesso" });
  } catch (error) {
    console.error("Erro ao atualizar senha:", error);
    return c.json({ error: "Erro ao atualizar senha" }, 500);
  }
});

// ROTA PÚBLICA PARA COOPERATIVAS (para registro)
app.get("/cooperativas/public", async (c) => {
  try {
    const rows = db.queryEntries(`SELECT * FROM ${TBL("cooperativas")}`);
    const mapped = (rows || []).map(mapCooperativa);
    return c.json(mapped);
  } catch (error) {
    console.error("Erro ao buscar cooperativas públicas:", error);
    return c.json({ error: "Erro ao buscar cooperativas" }, 500);
  }
});

// ROTAS DE COOPERATIVAS
app.get("/cooperativas", requireAuth, async (c) => {
  try {
    const rows = db.queryEntries(`SELECT * FROM ${TBL("cooperativas")}`);
    const mapped = (rows || []).map(mapCooperativa);
    return c.json(mapped);
  } catch (error) {
    console.error("Erro ao buscar cooperativas:", error);
    return c.json({ error: "Erro ao buscar cooperativas" }, 500);
  }
});

app.get("/cooperativas/:id/config", requireAuth, async (c) => {
  try {
    const cooperativaId = c.req.param("id");
    if (!cooperativaId) {
      return c.json({ error: "Cooperativa inválida" }, 400);
    }

    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);
    if (!userData) {
      return c.json({ error: "Usuário não autenticado" }, 401);
    }

    const info = getCooperativaInfo(cooperativaId);
    if (!info) {
      return c.json({ error: "Cooperativa não encontrada" }, 404);
    }

    const isOwn = userData.cooperativa_id === cooperativaId;
    const podeVer = userData.papel === "confederacao" ||
      (isOwn && (userData.papel === "admin" || userData.papel === "federacao"));

    if (!podeVer) {
      return c.json({ error: "Acesso negado" }, 403);
    }

    const settings = getCooperativaSettings(cooperativaId);
    return c.json({
      cooperativa_id: cooperativaId,
      nome: info.uniodonto,
      tipo: info.tipo,
      auto_recusar: settings.auto_recusar,
    });
  } catch (error) {
    console.error("Erro ao carregar configurações da cooperativa:", error);
    return c.json({ error: "Erro ao carregar configurações" }, 500);
  }
});

app.put("/cooperativas/:id/config", requireAuth, async (c) => {
  try {
    const cooperativaId = c.req.param("id");
    if (!cooperativaId) {
      return c.json({ error: "Cooperativa inválida" }, 400);
    }

    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);
    if (!userData) {
      return c.json({ error: "Usuário não autenticado" }, 401);
    }

    const info = getCooperativaInfo(cooperativaId);
    if (!info) {
      return c.json({ error: "Cooperativa não encontrada" }, 404);
    }

    if (info.tipo === "CONFEDERACAO") {
      return c.json({
        error: "A Confederação não pode recusar pedidos automaticamente",
      }, 400);
    }

    const isOwn = userData.cooperativa_id === cooperativaId;
    const podeEditar = (isOwn &&
      (userData.papel === "admin" || userData.papel === "federacao")) ||
      userData.papel === "confederacao";

    if (!podeEditar) {
      return c.json({ error: "Acesso negado" }, 403);
    }

    let body: any = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "JSON inválido" }, 400);
    }

    const autoRecusar = Boolean(body?.auto_recusar);

    try {
      setCooperativaSettings(cooperativaId, { auto_recusar: autoRecusar });
    } catch (error) {
      console.error("Erro ao salvar preferências da cooperativa:", error);
      return c.json({ error: "Não foi possível salvar as preferências" }, 500);
    }

    if (autoRecusar) {
      const actor = {
        email: userData.email,
        id: userData.id,
        nome: userData.nome,
        display_name: userData.display_name,
      };
      await autoEscalatePedidosForCooperativa(cooperativaId, actor);
    }

    return c.json({
      cooperativa_id: cooperativaId,
      nome: info.uniodonto,
      tipo: info.tipo,
      auto_recusar: autoRecusar,
    });
  } catch (error) {
    console.error("Erro ao atualizar configurações da cooperativa:", error);
    return c.json({ error: "Erro ao atualizar configurações" }, 500);
  }
});

app.get("/cooperativas/:id/cobertura/historico", requireAuth, async (c) => {
  try {
    const cooperativaId = c.req.param("id");
    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);

    if (!userData) {
      return c.json({ error: "Usuário não autenticado" }, 401);
    }

    if (
      !isCooperativaVisible(userData, cooperativaId) &&
      resolveCoberturaScope(userData).level === "none"
    ) {
      return c.json({ error: "Acesso negado" }, 403);
    }

    const limitParam = Number(c.req.query("limit") || "200");
    const limit = Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(limitParam, 500)
      : 200;

    const rows = db.queryEntries<any>(
      `SELECT l.*, ci.NM_CIDADE AS cidade_nome, ci.UF_MUNICIPIO AS cidade_uf,
              co.UNIODONTO AS cooperativa_origem_nome,
              cd.UNIODONTO AS cooperativa_destino_nome
         FROM ${TBL("cobertura_logs")} l
    LEFT JOIN ${TBL("cidades")} ci ON ci.CD_MUNICIPIO_7 = l.cidade_id
    LEFT JOIN ${TBL("cooperativas")} co ON co.id_singular = l.cooperativa_origem
    LEFT JOIN ${
        TBL("cooperativas")
      } cd ON cd.id_singular = l.cooperativa_destino
        WHERE l.cooperativa_origem = ? OR l.cooperativa_destino = ?
        ORDER BY datetime(l.timestamp) DESC
        LIMIT ?`,
      [cooperativaId, cooperativaId, limit] as any,
    ) || [];

    const mapped = rows.map(mapCoberturaLog);
    return c.json({ logs: mapped });
  } catch (error) {
    console.error("Erro ao buscar histórico de cobertura:", error);
    return c.json({ error: "Erro ao buscar histórico de cobertura" }, 500);
  }
});

app.put("/cooperativas/:id/cobertura", requireAuth, async (c) => {
  try {
    const cooperativaId = c.req.param("id");
    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);

    if (!userData) {
      return c.json({ error: "Usuário não autenticado" }, 401);
    }

    const scope = resolveCoberturaScope(userData);
    if (!canManageCobertura(scope, cooperativaId)) {
      return c.json({
        error: "Acesso negado para gerenciar cobertura desta cooperativa",
      }, 403);
    }

    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "JSON inválido" }, 400);
    }

    if (!body || !Array.isArray(body.cidade_ids)) {
      return c.json({ error: "Envie cidade_ids como array" }, 400);
    }

    const cidadeIds = Array.from(
      new Set(
        body.cidade_ids
          .map((
            id: any,
          ) => (typeof id === "number"
            ? id.toString()
            : (id || "").toString().trim())
          )
          .filter((id: string) => id.length > 0),
      ),
    );

    const currentRows = db.queryEntries<any>(
      `SELECT CD_MUNICIPIO_7 FROM ${TBL("cidades")} WHERE ID_SINGULAR = ?`,
      [cooperativaId],
    ) || [];
    const currentSet = new Set(currentRows.map((row) => row.CD_MUNICIPIO_7));
    const desiredSet = new Set(cidadeIds);

    const toAssign = cidadeIds.filter((id) => !currentSet.has(id));
    const toRemove = Array.from(currentSet).filter((id) => !desiredSet.has(id));

    if (!toAssign.length && !toRemove.length) {
      return c.json({ message: "Nenhuma alteração necessária", updated: [] });
    }

    const manageableSet = scope.manageable;
    const invalid: string[] = [];
    const additions: Array<{ cidadeId: string; origem: string | null }> = [];
    const missing: string[] = [];

    if (toAssign.length) {
      const placeholders = toAssign.map(() => "?").join(",");
      const rows = db.queryEntries<any>(
        `SELECT CD_MUNICIPIO_7, ID_SINGULAR FROM ${
          TBL("cidades")
        } WHERE CD_MUNICIPIO_7 IN (${placeholders})`,
        toAssign as any,
      ) || [];
      const info = new Map(
        rows.map((row) => [row.CD_MUNICIPIO_7, row.ID_SINGULAR ?? null]),
      );

      for (const cidadeId of toAssign) {
        if (!info.has(cidadeId)) {
          missing.push(cidadeId);
          continue;
        }
        const atual = info.get(cidadeId) || null;
        if (scope.level === "singular" && atual && atual !== cooperativaId) {
          invalid.push(cidadeId);
          continue;
        }
        if (
          scope.level === "federacao" && atual && manageableSet &&
          !manageableSet.has(atual)
        ) {
          invalid.push(cidadeId);
          continue;
        }
        additions.push({ cidadeId, origem: atual });
      }
    }

    if (missing.length) {
      return c.json({
        error: "Algumas cidades não foram encontradas",
        cidades: missing,
      }, 404);
    }

    if (invalid.length) {
      return c.json({
        error: "Cidades já atribuídas a cooperativas fora do seu alcance",
        cidades: invalid,
      }, 409);
    }

    const removals = toRemove.map((cidadeId) => ({ cidadeId }));
    const alteredIds = new Set<string>();

    try {
      db.execute("BEGIN");

      for (const addition of additions) {
        db.query(
          `UPDATE ${
            TBL("cidades")
          } SET id_singular = ? WHERE CD_MUNICIPIO_7 = ?`,
          [cooperativaId, addition.cidadeId],
        );
        registrarLogCobertura(
          addition.cidadeId,
          addition.origem,
          cooperativaId,
          userData,
          "assign",
        );
        alteredIds.add(addition.cidadeId);
      }

      for (const removal of removals) {
        db.query(
          `UPDATE ${
            TBL("cidades")
          } SET id_singular = NULL WHERE CD_MUNICIPIO_7 = ? AND id_singular = ?`,
          [removal.cidadeId, cooperativaId],
        );
        registrarLogCobertura(
          removal.cidadeId,
          cooperativaId,
          null,
          userData,
          "unassign",
        );
        alteredIds.add(removal.cidadeId);
      }

      db.execute("COMMIT");
    } catch (e) {
      try {
        db.execute("ROLLBACK");
      } catch {}
      console.error("Erro ao atualizar cobertura:", e);
      return c.json({ error: "Erro ao atualizar cobertura" }, 500);
    }

    const changedIds = Array.from(alteredIds);
    let updated: any[] = [];
    if (changedIds.length) {
      const placeholders = changedIds.map(() => "?").join(",");
      const rows = db.queryEntries<any>(
        `SELECT * FROM ${
          TBL("cidades")
        } WHERE CD_MUNICIPIO_7 IN (${placeholders})`,
        changedIds as any,
      ) || [];
      updated = rows.map(mapCidade);
    }

    return c.json({ message: "Cobertura atualizada com sucesso", updated });
  } catch (error) {
    console.error("Erro ao atualizar cobertura:", error);
    return c.json({ error: "Erro ao atualizar cobertura" }, 500);
  }
});

// ROTAS DE CIDADES
app.get("/cidades", requireAuth, async (c) => {
  try {
    const rows = db.queryEntries(
      `SELECT c.*, coop.UNIODONTO AS NM_SINGULAR
       FROM ${TBL("cidades")} c
       LEFT JOIN ${
        TBL("cooperativas")
      } coop ON coop.id_singular = c.ID_SINGULAR`,
    );
    const mapped = (rows || []).map(mapCidade);
    return c.json(mapped);
  } catch (error) {
    console.error("Erro ao buscar cidades:", error);
    return c.json({ error: "Erro ao buscar cidades" }, 500);
  }
});

// ROTA PÚBLICA DE CIDADES (apenas leitura)
app.get("/cidades/public", async (c) => {
  try {
    const rows = db.queryEntries(
      `SELECT c.*, coop.UNIODONTO AS NM_SINGULAR
       FROM ${TBL("cidades")} c
       LEFT JOIN ${
        TBL("cooperativas")
      } coop ON coop.id_singular = c.ID_SINGULAR`,
    );
    const mapped = (rows || []).map(mapCidade);
    return c.json(mapped);
  } catch (error) {
    console.error("Erro ao buscar cidades públicas:", error);
    return c.json({ error: "Erro ao buscar cidades" }, 500);
  }
});

// ROTAS DE OPERADORES
app.get("/operadores", requireAuth, async (c) => {
  try {
    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);

    if (!userData) {
      return c.json({ error: "Usuário não autenticado" }, 401);
    }

    const baseQuery = `SELECT op.*, au.papel AS auth_papel FROM ${
      TBL("operadores")
    } op LEFT JOIN auth_users au ON au.email = op.email`;
    const visible = getVisibleCooperativas(userData);
    let rows: any[] = [];

    if (visible === null) {
      rows = db.queryEntries<any>(baseQuery) || [];
    } else {
      const ids = Array.from(visible);
      if (!ids.length) {
        return c.json([]);
      }
      rows = db.queryEntries<any>(
        `${baseQuery} WHERE op.id_singular IN (${
          ids.map(() => "?").join(",")
        })`,
        ids as any,
      ) || [];
    }

    const mapped = (rows || []).map(mapOperador);
    return c.json(mapped);
  } catch (error) {
    console.error("Erro ao buscar operadores:", error);
    return c.json({ error: "Erro ao buscar operadores" }, 500);
  }
});

app.post("/operadores", requireAuth, async (c) => {
  try {
    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);
    if (!userData) {
      return c.json({ error: "Usuário não autenticado" }, 401);
    }

    const cooperativaInfo = getCooperativaInfo(userData.cooperativa_id);
    const tipoCooperativa = cooperativaInfo?.tipo;
    const isConfAdmin = userData.papel === "confederacao" ||
      (userData.papel === "admin" && tipoCooperativa === "CONFEDERACAO");
    const isFederacaoAdmin = userData.papel === "federacao" ||
      (userData.papel === "admin" && tipoCooperativa === "FEDERACAO");
    const isSingularAdmin = userData.papel === "admin" &&
      tipoCooperativa === "SINGULAR";

    if (!(isConfAdmin || isFederacaoAdmin || isSingularAdmin)) {
      return c.json({ error: "Acesso negado para criar operadores" }, 403);
    }

    const body = await c.req.json();
    const nome = (body.nome || "").trim();
    const emailRaw = (body.email || "").trim();
    const email = emailRaw.toLowerCase();
    const cargo = (body.cargo || "").trim();
    const telefone = (body.telefone || "").trim();
    const whatsapp = (body.whatsapp || "").trim();
    let idSingular =
      (body.id_singular || body.cooperativa_id || userData.cooperativa_id || "")
        .trim();

    if (!nome || !email) {
      return c.json({ error: "Nome e email são obrigatórios" }, 400);
    }

    if (!idSingular) {
      return c.json({ error: "Cooperativa não informada" }, 400);
    }

    if (!isCooperativaVisible(userData, idSingular)) {
      return c.json(
        { error: "Acesso negado para cadastrar nesta cooperativa" },
        403,
      );
    }

    const existing = db.queryEntries<any>(
      `SELECT id FROM ${TBL("operadores")} WHERE email = ? LIMIT 1`,
      [email],
    )[0];
    if (existing) {
      return c.json({ error: "Operador já cadastrado" }, 409);
    }

    const now = new Date().toISOString();
    try {
      db.query(
        `INSERT INTO ${
          TBL("operadores")
        } (nome, id_singular, email, telefone, whatsapp, cargo, status, created_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        [nome, idSingular, email, telefone, whatsapp, cargo, 1, now],
      );
    } catch (e) {
      console.error("Erro ao inserir operador:", e);
      return c.json({ error: "Erro ao criar operador" }, 500);
    }

    try {
      const derivedRole = deriveRoleForCooperativa("operador", idSingular);
      db.query(
        `UPDATE auth_users SET cooperativa_id = COALESCE(?, cooperativa_id), papel = COALESCE(papel, ?) WHERE email = ?`,
        [idSingular, derivedRole, email],
      );
    } catch (e) {
      console.warn("[operadores] sincronização com auth_users falhou:", e);
    }

    const inserted = db.queryEntries<any>(
      `SELECT op.*, au.papel AS auth_papel FROM ${
        TBL("operadores")
      } op LEFT JOIN auth_users au ON au.email = op.email WHERE op.email = ? LIMIT 1`,
      [email],
    )[0];
    return c.json(mapOperador(inserted));
  } catch (error) {
    console.error("Erro ao criar operador:", error);
    return c.json({ error: "Erro ao criar operador" }, 500);
  }
});

// ROTA PÚBLICA DE OPERADORES (campos restritos, sem contatos)
app.get("/operadores/public", async (c) => {
  try {
    const rows = db.queryEntries(
      `SELECT op.*, au.papel AS auth_papel FROM ${
        TBL("operadores")
      } op LEFT JOIN auth_users au ON au.email = op.email`,
    );
    const mapped = (rows || []).map(mapOperador).map((o) => ({
      id: o.id,
      nome: o.nome,
      cargo: o.cargo,
      id_singular: o.id_singular,
      ativo: o.ativo,
      data_cadastro: o.data_cadastro,
      papel: o.papel,
    }));
    return c.json(mapped);
  } catch (error) {
    console.error("Erro ao buscar operadores públicos:", error);
    return c.json({ error: "Erro ao buscar operadores" }, 500);
  }
});

app.put("/operadores/:id", requireAuth, async (c) => {
  try {
    const operadorId = c.req.param("id");
    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);

    if (!userData) {
      return c.json({ error: "Usuário não autenticado" }, 401);
    }

    const row = db.queryEntries<any>(
      `SELECT * FROM ${TBL("operadores")} WHERE id = ? LIMIT 1`,
      [operadorId],
    )[0];
    if (!row) {
      return c.json({ error: "Operador não encontrado" }, 404);
    }

    const operador = mapOperador(row);
    const isSelf = operador.email === userData.email;
    const visible = isCooperativaVisible(userData, operador.id_singular);
    const cooperativaInfo = getCooperativaInfo(userData.cooperativa_id);
    const tipoCooperativa = cooperativaInfo?.tipo;

    const isConfAdmin = userData.papel === "confederacao" ||
      (userData.papel === "admin" && tipoCooperativa === "CONFEDERACAO");
    const isFederacaoAdmin =
      (userData.papel === "admin" && tipoCooperativa === "FEDERACAO") ||
      userData.papel === "federacao";
    const isSingularAdmin = userData.papel === "admin" &&
      tipoCooperativa === "SINGULAR";

    const canEdit = isSelf ||
      isConfAdmin ||
      (isFederacaoAdmin && visible) ||
      (isSingularAdmin && operador.id_singular === userData.cooperativa_id);

    if (!canEdit) {
      return c.json({ error: "Acesso negado para editar este operador" }, 403);
    }

    const body = await c.req.json();
    const allowed: Record<string, any> = {};
    const whitelist = ["nome", "telefone", "whatsapp", "cargo", "ativo"];
    const canEditRole = isConfAdmin || userData.papel === "admin";
    if (canEditRole) {
      whitelist.push("papel");
    }

    for (const key of whitelist) {
      if (key in body) {
        allowed[key] = body[key];
      }
    }

    if ("ativo" in allowed) {
      allowed.status = allowed.ativo ? 1 : 0;
      delete allowed.ativo;
    }

    if ("nome" in allowed && typeof allowed.nome === "string") {
      allowed.nome = allowed.nome.trim();
    }
    if ("cargo" in allowed && typeof allowed.cargo === "string") {
      allowed.cargo = allowed.cargo.trim();
    }
    if ("telefone" in allowed && typeof allowed.telefone === "string") {
      allowed.telefone = allowed.telefone.trim();
    }
    if ("whatsapp" in allowed && typeof allowed.whatsapp === "string") {
      allowed.whatsapp = allowed.whatsapp.trim();
    }
    if ("papel" in allowed && !canEditRole) {
      delete allowed.papel;
    } else if ("papel" in allowed) {
      allowed.papel = deriveRoleForCooperativa(
        allowed.papel,
        operador.id_singular,
      );
    }

    if (Object.keys(allowed).length === 0) {
      const refreshed = mapOperador(
        db.queryEntries<any>(
          `SELECT * FROM ${TBL("operadores")} WHERE id = ? LIMIT 1`,
          [operadorId],
        )[0],
      );
      return c.json(refreshed);
    }

    try {
      const cols = Object.keys(allowed).filter((c) => c !== "papel");
      if (cols.length > 0) {
        const placeholders = cols.map((c) => `${c} = ?`).join(", ");
        const values = cols.map((c) => (allowed as any)[c]);
        db.query(
          `UPDATE ${TBL("operadores")} SET ${placeholders} WHERE id = ?`,
          [...values, operadorId],
        );
      }
    } catch (e) {
      console.error("Erro ao atualizar operador:", e);
      return c.json({ error: "Erro ao atualizar operador" }, 500);
    }

    if (allowed.papel) {
      try {
        db.query(`UPDATE auth_users SET papel = ? WHERE email = ?`, [
          allowed.papel,
          operador.email,
        ]);
      } catch (e) {
        console.warn(
          "[operadores] não foi possível atualizar papel em auth_users:",
          e,
        );
      }
    }

    const updatedRow = db.queryEntries<any>(
      `SELECT * FROM ${TBL("operadores")} WHERE id = ? LIMIT 1`,
      [operadorId],
    )[0];
    const updatedOperador = mapOperador(updatedRow);
    return c.json(updatedOperador);
  } catch (error) {
    console.error("Erro ao atualizar operador:", error);
    return c.json({ error: "Erro ao atualizar operador" }, 500);
  }
});

// ROTA DE DEBUG: contagem de registros por tabela
app.get("/debug/counts", async (c) => {
  try {
    const tables = ["cooperativas", "cidades", "operadores", "pedidos"];
    const result: Record<string, number | null> = {};
    for (const t of tables) {
      const row = db.queryEntries<{ c: number }>(
        `SELECT COUNT(*) AS c FROM ${TBL(t)}`,
      )[0];
      result[TBL(t)] = row?.c ?? 0;
    }
    return c.json({ tables: result, prefix: TABLE_PREFIX, schema: DB_SCHEMA });
  } catch (e) {
    console.error("Erro em /debug/counts:", e);
    return c.json({ error: "Erro ao obter contagens" }, 500);
  }
});

// ROTA PÚBLICA DE PEDIDOS (opcional via env PUBLIC_PEDIDOS=true)
app.get("/pedidos/public", async (c) => {
  const enabledEnv = (Deno.env.get("PUBLIC_PEDIDOS") || "").toLowerCase();
  const enabled = enabledEnv === "true" || enabledEnv === "";
  if (!enabled) {
    return c.json({ error: "Endpoint desabilitado" }, 403);
  }
  try {
    const rows = db.queryEntries<any>(
      `SELECT id, titulo, cidade_id, prioridade, status, nivel_atual, prazo_atual, cooperativa_solicitante_id FROM ${
        TBL("pedidos")
      }`,
    );
    const base = (rows || []).map((p: any) => ({
      id: p.id,
      titulo: p.titulo,
      cidade_id: p.cidade_id,
      prioridade: p.prioridade,
      status: p.status,
      nivel_atual: p.nivel_atual,
      prazo_atual: p.prazo_atual,
      dias_restantes: computeDiasRestantes(p.prazo_atual, p.status),
      cooperativa_solicitante_id: p.cooperativa_solicitante_id,
    }));
    const enriched = await enrichPedidos(base);
    const sanitized = enriched.map(({ cooperativa_solicitante_id, ...rest }) =>
      rest
    );
    return c.json(sanitized);
  } catch (error) {
    console.error("Erro ao buscar pedidos públicos:", error);
    return c.json({ error: "Erro ao buscar pedidos" }, 500);
  }
});

// ROTAS DE PEDIDOS
app.get("/pedidos", requireAuth, async (c) => {
  try {
    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);
    await escalarPedidos();

    const pedidosRows = db.queryEntries<any>(`SELECT * FROM ${TBL("pedidos")}`);
    const pedidosData = (pedidosRows || []).map((r) => ({
      ...r,
      especialidades: Array.isArray(r.especialidades)
        ? r.especialidades
        : (() => {
          try {
            return JSON.parse(r.especialidades || "[]");
          } catch {
            return [];
          }
        })(),
    }));

    // Preparar mapas de cooperativas para federacao e nomes
    const coopIds = Array.from(
      new Set(
        (pedidosData || []).flatMap(
          (p) => [p.cooperativa_solicitante_id, p.cooperativa_responsavel_id],
        ).filter(Boolean),
      ),
    );
    const coops = coopIds.length
      ? db.queryEntries<any>(
        `SELECT id_singular, UNIODONTO, FEDERACAO FROM ${
          TBL("cooperativas")
        } WHERE id_singular IN (${coopIds.map(() => "?").join(",")})`,
        coopIds as any,
      )
      : [];
    const coopsMap: Record<string, any> = {};
    for (const r of coops) {
      const c = mapCooperativa(r);
      coopsMap[c.id_singular] = c;
    }
    const userFed = (userData?.cooperativa_id
      ? (coopsMap[userData.cooperativa_id]?.federacao ||
        db.queryEntries<any>(
          `SELECT FEDERACAO FROM ${
            TBL("cooperativas")
          } WHERE id_singular = ? LIMIT 1`,
          [userData.cooperativa_id],
        )[0]?.FEDERACAO)
      : null) as string | null;

    // Aplicar filtros baseados no papel do usuário (regras de negócio)
    const pedidosFiltrados = (pedidosData || []).filter((p) => {
      if (userData.papel === "admin" || userData.papel === "confederacao") {
        return true;
      }
      if (userData.papel === "operador") {
        return p.cooperativa_solicitante_id === userData.cooperativa_id ||
          p.cooperativa_responsavel_id === userData.cooperativa_id ||
          p.criado_por_user === userData.email;
      }
      if (userData.papel === "federacao") {
        const fedSolic = coopsMap[p.cooperativa_solicitante_id]?.federacao;
        const fedResp = coopsMap[p.cooperativa_responsavel_id]?.federacao;
        return !!userFed && (fedSolic === userFed || fedResp === userFed);
      }
      return false;
    });

    // Calcular dias restantes para cada pedido
    const pedidosComDias = pedidosFiltrados.map((p) => ({
      ...p,
      dias_restantes: computeDiasRestantes(p.prazo_atual, p.status),
    }));

    const enriquecidosBase = await enrichPedidos(pedidosComDias);
    // Computar ponto_de_vista para o viewer
    const viewerCoop = userData?.cooperativa_id || null;
    const enriquecidos = enriquecidosBase.map((p: any) => {
      const diasRestantes = computeDiasRestantes(p.prazo_atual, p.status);
      let diasParaConcluir = p.dias_para_concluir ?? null;
      if (p.status === "concluido" && p.data_conclusao && p.data_criacao) {
        const inicio = new Date(p.data_criacao);
        const fim = new Date(p.data_conclusao);
        if (!Number.isNaN(inicio.getTime()) && !Number.isNaN(fim.getTime())) {
          diasParaConcluir = Math.max(
            0,
            Math.round(
              (fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24),
            ),
          );
        }
      }
      let ponto: "feita" | "recebida" | "acompanhamento" | "interna" =
        "acompanhamento";
      if (viewerCoop) {
        const isSolic = p.cooperativa_solicitante_id === viewerCoop;
        const isResp = p.cooperativa_responsavel_id === viewerCoop;
        if (isSolic && isResp) {
          ponto = "interna";
        } else if (isSolic) {
          ponto = "feita";
        } else if (isResp) {
          ponto = "recebida";
        } else ponto = "acompanhamento";
      }
      return {
        ...p,
        ponto_de_vista: ponto,
        dias_restantes: diasRestantes,
        dias_para_concluir: diasParaConcluir,
      };
    });
    return c.json(enriquecidos);
  } catch (error) {
    console.error("Erro ao buscar pedidos:", error);
    return c.json({ error: "Erro ao buscar pedidos" }, 500);
  }
});

app.get("/pedidos/:id", requireAuth, async (c) => {
  try {
    const pedidoId = c.req.param("id");
    if (!pedidoId) {
      return c.json({ error: "Identificador inválido" }, 400);
    }

    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);
    if (!userData) {
      return c.json({ error: "Usuário não autenticado" }, 401);
    }

    const pedido = db.queryEntries<any>(
      `SELECT * FROM ${TBL("pedidos")} WHERE id = ? LIMIT 1`,
      [pedidoId],
    )[0];
    if (!pedido) {
      return c.json({ error: "Pedido não encontrado" }, 404);
    }

    let podeVer = false;
    if (userData.papel === "confederacao" || userData.papel === "admin") {
      podeVer = true;
    } else if (userData.papel === "operador") {
      const mesmoSolicitante =
        pedido.cooperativa_solicitante_id === userData.cooperativa_id;
      const mesmaResponsavel =
        pedido.cooperativa_responsavel_id === userData.cooperativa_id;
      const criadoPor = (pedido.criado_por_user || "").toLowerCase() ===
        (userData.email || "").toLowerCase();
      podeVer = mesmoSolicitante || mesmaResponsavel || criadoPor;
    } else if (userData.papel === "federacao") {
      const userFed = (() => {
        try {
          const row = db.queryEntries<any>(
            `SELECT FEDERACAO FROM ${
              TBL("cooperativas")
            } WHERE id_singular = ? LIMIT 1`,
            [userData.cooperativa_id],
          )[0];
          return row?.FEDERACAO || null;
        } catch {
          return null;
        }
      })();

      const fedSolic = (() => {
        try {
          const row = db.queryEntries<any>(
            `SELECT FEDERACAO FROM ${
              TBL("cooperativas")
            } WHERE id_singular = ? LIMIT 1`,
            [pedido.cooperativa_solicitante_id],
          )[0];
          return row?.FEDERACAO || null;
        } catch {
          return null;
        }
      })();

      const fedResp = (() => {
        try {
          const row = db.queryEntries<any>(
            `SELECT FEDERACAO FROM ${
              TBL("cooperativas")
            } WHERE id_singular = ? LIMIT 1`,
            [pedido.cooperativa_responsavel_id],
          )[0];
          return row?.FEDERACAO || null;
        } catch {
          return null;
        }
      })();

      podeVer = !!userFed && (fedSolic === userFed || fedResp === userFed);
    }

    if (!podeVer) {
      return c.json({ error: "Acesso negado a este pedido" }, 403);
    }

    const especialidades = Array.isArray(pedido.especialidades)
      ? pedido.especialidades
      : (() => {
        try {
          return JSON.parse(pedido.especialidades || "[]");
        } catch {
          return [];
        }
      })();
    const base = [{
      ...pedido,
      especialidades,
      dias_restantes: computeDiasRestantes(pedido.prazo_atual, pedido.status),
    }];
    const [enriched] = await enrichPedidos(base);
    const resultPedido = enriched || base[0];
    if (resultPedido) {
      resultPedido.dias_restantes = computeDiasRestantes(
        resultPedido.prazo_atual,
        resultPedido.status,
      );
      if (
        resultPedido.status === "concluido" && resultPedido.data_conclusao &&
        resultPedido.data_criacao
      ) {
        const inicio = new Date(resultPedido.data_criacao);
        const fim = new Date(resultPedido.data_conclusao);
        if (!Number.isNaN(inicio.getTime()) && !Number.isNaN(fim.getTime())) {
          const diff = fim.getTime() - inicio.getTime();
          (resultPedido as any).dias_para_concluir = Math.max(
            0,
            Math.round(diff / (1000 * 60 * 60 * 24)),
          );
        }
      }
    }
    return c.json(resultPedido);
  } catch (error) {
    console.error("Erro ao buscar pedido:", error);
    return c.json({ error: "Erro ao buscar pedido" }, 500);
  }
});

app.post("/pedidos/import", requireAuth, async (c) => {
  const startedAt = performance.now();
  try {
    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);

    if (!["operador", "admin", "confederacao"].includes(userData.papel)) {
      return c.json({ error: "Sem permissão para importar pedidos" }, 403);
    }

    if (!userData.cooperativa_id && userData.papel !== "confederacao") {
      return c.json(
        { error: "Usuário sem cooperativa solicitante definida" },
        400,
      );
    }

    let body: any;
    try {
      body = await c.req.json();
    } catch (error) {
      console.warn("[importacao] corpo inválido:", error);
      return c.json({ error: "Payload inválido para importação" }, 400);
    }

    const items = Array.isArray(body?.items) ? body.items : [];
    if (items.length === 0) {
      return c.json({ error: "Nenhum registro recebido para importação" }, 400);
    }

    const cidadeCache = new Map<string, any>();
    const summary = {
      total: items.length,
      imported: 0,
      skipped: 0,
      durationMs: 0,
    };

    const errors: Array<
      { rowNumber: number; message: string; details?: Record<string, unknown> }
    > = [];
    const imported: Array<any> = [];

    for (let index = 0; index < items.length; index++) {
      const raw = items[index] ?? {};
      const rowNumber = Number(raw.rowNumber ?? index + 2);
      const titulo = (raw.titulo ?? "").toString().trim();
      const especialidadeRaw = (raw.especialidade ?? "").toString();
      const cidadeCodigoRaw = raw.cidadeCodigo ?? raw.cidadeIBGE ??
        raw.cidade_ibge ?? "";
      const detalhes = (raw.detalhes ?? raw.observacoes ?? "").toString()
        .trim();

      if (!titulo || !especialidadeRaw || !cidadeCodigoRaw) {
        summary.skipped += 1;
        errors.push({
          rowNumber,
          message:
            "Campos obrigatórios ausentes (título, especialidade ou cidade)",
          details: {
            titulo,
            especialidade: especialidadeRaw,
            cidadeCodigo: cidadeCodigoRaw,
          },
        });
        continue;
      }

      const cidadeInfo = getCidadeInfoByCodigo(cidadeCodigoRaw, cidadeCache);
      if (!cidadeInfo) {
        summary.skipped += 1;
        errors.push({
          rowNumber,
          message: "Cidade não encontrada pelo código IBGE informado",
          details: {
            titulo,
            especialidade: especialidadeRaw,
            cidadeCodigo: cidadeCodigoRaw,
          },
        });
        continue;
      }

      const cidadeIdRaw = cidadeInfo.CD_MUNICIPIO_7 ??
        cidadeInfo.cd_municipio_7 ?? cidadeInfo.CD_MUNICIPIO ??
        cidadeInfo.cd_municipio;
      const cidadeId = cidadeIdRaw ? cidadeIdRaw.toString() : "";
      if (!cidadeId) {
        summary.skipped += 1;
        errors.push({
          rowNumber,
          message: "Cidade localizada, porém sem código IBGE compatível",
          details: {
            titulo,
            especialidade: especialidadeRaw,
            cidadeCodigo: cidadeCodigoRaw,
          },
        });
        continue;
      }

      const cooperativaResponsavel =
        (cidadeInfo.ID_SINGULAR ?? cidadeInfo.id_singular ?? "").toString();
      if (!cooperativaResponsavel) {
        summary.skipped += 1;
        errors.push({
          rowNumber,
          message: "Cidade não está vinculada a uma cooperativa responsável",
          details: {
            titulo,
            especialidade: especialidadeRaw,
            cidadeCodigo: cidadeCodigoRaw,
          },
        });
        continue;
      }

      const especialidades = parseEspecialidadesLista(especialidadeRaw);
      if (especialidades.length === 0) {
        summary.skipped += 1;
        errors.push({
          rowNumber,
          message: "Especialidade inválida ou vazia",
          details: {
            titulo,
            especialidade: especialidadeRaw,
            cidadeCodigo: cidadeCodigoRaw,
          },
        });
        continue;
      }

      const pedidoId = safeRandomId("ped");
      const agora = new Date();
      const agoraIso = agora.toISOString();
      const prazoInicial = computePrazoLimite("singular", agora);

      try {
        db.query(
          `INSERT INTO ${TBL("pedidos")}
            (id, titulo, criado_por, criado_por_user, cooperativa_solicitante_id, cooperativa_responsavel_id, cidade_id, especialidades, quantidade, observacoes, prioridade, nivel_atual, status, data_criacao, data_ultima_alteracao, prazo_atual)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            pedidoId,
            titulo,
            null,
            authUser?.email || null,
            userData.cooperativa_id,
            cooperativaResponsavel,
            cidadeId,
            JSON.stringify(especialidades),
            1,
            detalhes || null,
            "media",
            "singular",
            "novo",
            agoraIso,
            agoraIso,
            prazoInicial,
          ],
        );
      } catch (error) {
        console.error("[importacao] falha ao inserir pedido:", error);
        summary.skipped += 1;
        errors.push({
          rowNumber,
          message: "Erro ao gravar o pedido na base de dados",
          details: {
            titulo,
            especialidade: especialidadeRaw,
            cidadeCodigo: cidadeCodigoRaw,
          },
        });
        continue;
      }

      const auditoria = {
        id: safeRandomId("audit"),
        pedido_id: pedidoId,
        usuario_id: userData.id,
        usuario_nome: userData.nome,
        usuario_display_nome: userData.display_name || userData.nome,
        acao: "Criação do pedido (importação em lote)",
        timestamp: agoraIso,
        detalhes: `Pedido importado via lote: ${titulo}`,
      };

      try {
        db.query(
          `INSERT INTO ${
            TBL("auditoria_logs")
          } (id, pedido_id, usuario_id, usuario_nome, usuario_display_nome, acao, timestamp, detalhes)
           VALUES (?,?,?,?,?,?,?,?)`,
          [
            auditoria.id,
            auditoria.pedido_id,
            auditoria.usuario_id,
            auditoria.usuario_nome,
            auditoria.usuario_display_nome,
            auditoria.acao,
            auditoria.timestamp,
            auditoria.detalhes,
          ],
        );
      } catch (error) {
        console.warn("[importacao] auditoria não registrada:", error);
      }

      const base = [{
        id: pedidoId,
        titulo,
        criado_por: null,
        criado_por_user: authUser?.email || null,
        cooperativa_solicitante_id: userData.cooperativa_id,
        cooperativa_responsavel_id: cooperativaResponsavel,
        cidade_id: cidadeId,
        especialidades,
        quantidade: 1,
        observacoes: detalhes,
        prioridade: "media" as const,
        nivel_atual: "singular" as const,
        status: "novo" as const,
        data_criacao: agoraIso,
        data_ultima_alteracao: agoraIso,
        prazo_atual: prazoInicial,
        dias_restantes: computeDiasRestantes(prazoInicial, "novo"),
        responsavel_atual_id: null,
        responsavel_atual_nome: null,
      }];

      const [enriched] = await enrichPedidos(base);
      let pedidoResultado = enriched || base[0];

      try {
        const responsavelNome = pedidoResultado.cooperativa_responsavel_nome ||
          pedidoResultado.cooperativa_responsavel_id ||
          "Responsável indefinido";
        await dispatchPedidoAlert({
          pedidoAtualizado: pedidoResultado,
          actor: userData,
          detalhes: [
            "Pedido importado em lote",
            `Responsável: ${responsavelNome}`,
          ],
          action: "criado",
          mensagemCustom: `Pedido importado: ${pedidoResultado.titulo}`,
        });
      } catch (error) {
        console.warn("[importacao] falha ao gerar alerta:", error);
      }

      try {
        const finalPedido =
          await autoEscalateIfNeeded(pedidoResultado, userData) ||
          pedidoResultado;
        finalPedido.dias_restantes = computeDiasRestantes(
          finalPedido.prazo_atual,
          finalPedido.status,
        );
        imported.push(finalPedido);
        summary.imported += 1;
      } catch (error) {
        console.warn(
          "[importacao] falha ao aplicar auto escalonamento:",
          error,
        );
        imported.push(pedidoResultado);
        summary.imported += 1;
      }
    }

    summary.durationMs = Math.round(performance.now() - startedAt);

    return c.json({
      summary,
      errors,
      imported,
    });
  } catch (error) {
    console.error("[importacao] erro inesperado:", error);
    return c.json({ error: "Falha inesperada ao importar pedidos" }, 500);
  }
});

app.post("/pedidos", requireAuth, async (c) => {
  try {
    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);
    const pedidoData = await c.req.json();

    // Permissão para criar: operador/admin da solicitante, ou confederação (mestre).
    if (
      !(userData.papel === "operador" || userData.papel === "admin" ||
        userData.papel === "confederacao")
    ) {
      return c.json({ error: "Sem permissão para criar pedidos" }, 403);
    }

    const id = `ped_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const prazoInicial = computePrazoLimite("singular");

    const novoPedido = {
      id,
      titulo: pedidoData.titulo,
      // Em SQLite, criado_por referencia urede_operadores(id). Mantemos NULL (auth local)
      criado_por: null as any,
      criado_por_user: (authUser?.email || null) as any,
      cooperativa_solicitante_id: userData.cooperativa_id,
      cidade_id: pedidoData.cidade_id,
      especialidades: Array.isArray(pedidoData.especialidades)
        ? JSON.stringify(pedidoData.especialidades)
        : (pedidoData.especialidades || "[]"),
      quantidade: pedidoData.quantidade,
      observacoes: pedidoData.observacoes,
      nivel_atual: "singular",
      prazo_atual: prazoInicial,
      status: "novo",
      data_criacao: new Date().toISOString(),
      data_ultima_alteracao: new Date().toISOString(),
      cooperativa_responsavel_id: undefined as any, // será resolvido pela cidade
      prioridade: pedidoData.prioridade || "media",
    };

    // Resolver cooperativa responsável pela cidade
    try {
      const row = db.queryEntries<any>(
        `SELECT ID_SINGULAR FROM ${
          TBL("cidades")
        } WHERE CD_MUNICIPIO_7 = ? LIMIT 1`,
        [novoPedido.cidade_id],
      )[0];
      console.log(
        "[POST /pedidos] recebido cidade_id =",
        novoPedido.cidade_id,
        "lookup row =",
        row,
      );
      if (!row || !row.ID_SINGULAR) {
        console.warn(
          "[POST /pedidos] cidade não encontrada ou sem ID_SINGULAR:",
          novoPedido.cidade_id,
        );
        return c.json({
          error: "Cidade não cadastrada ou sem cooperativa responsável",
        }, 400);
      }
      novoPedido.cooperativa_responsavel_id = row.ID_SINGULAR as string;
    } catch (e) {
      console.error("Erro ao resolver cooperativa responsável:", e);
      return c.json(
        { error: "Erro ao determinar cooperativa responsável" },
        500,
      );
    }

    try {
      db.query(
        `INSERT INTO ${TBL("pedidos")} 
          (id, titulo, criado_por, criado_por_user, cooperativa_solicitante_id, cooperativa_responsavel_id, cidade_id, especialidades, quantidade, observacoes, prioridade, nivel_atual, status, data_criacao, data_ultima_alteracao, prazo_atual)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          novoPedido.id,
          novoPedido.titulo,
          novoPedido.criado_por,
          novoPedido.criado_por_user,
          novoPedido.cooperativa_solicitante_id,
          novoPedido.cooperativa_responsavel_id,
          novoPedido.cidade_id,
          novoPedido.especialidades,
          novoPedido.quantidade,
          novoPedido.observacoes || null,
          novoPedido.prioridade,
          novoPedido.nivel_atual,
          novoPedido.status,
          novoPedido.data_criacao,
          novoPedido.data_ultima_alteracao,
          novoPedido.prazo_atual,
        ],
      );
    } catch (e) {
      console.error("Erro ao inserir pedido na tabela:", e);
      return c.json({ error: "Erro ao criar pedido" }, 500);
    }

    // Registrar auditoria
    const auditoria = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      pedido_id: novoPedido.id,
      usuario_id: userData.id,
      usuario_nome: userData.nome,
      usuario_display_nome: userData.display_name || userData.nome,
      acao: "Criação do pedido",
      timestamp: new Date().toISOString(),
      detalhes: `Pedido criado: ${pedidoData.titulo}`,
    };

    try {
      db.query(
        `INSERT INTO ${
          TBL("auditoria_logs")
        } (id, pedido_id, usuario_id, usuario_nome, usuario_display_nome, acao, timestamp, detalhes)
         VALUES (?,?,?,?,?,?,?,?)`,
        [
          auditoria.id,
          auditoria.pedido_id,
          auditoria.usuario_id,
          auditoria.usuario_nome,
          auditoria.usuario_display_nome,
          auditoria.acao,
          auditoria.timestamp,
          auditoria.detalhes || null,
        ],
      );
    } catch (e) {
      console.warn("Erro ao salvar auditoria:", e);
    }

    {
      const base = [{
        ...novoPedido,
        especialidades: Array.isArray(pedidoData.especialidades)
          ? pedidoData.especialidades
          : (() => {
            try {
              return JSON.parse(novoPedido.especialidades || "[]");
            } catch {
              return [];
            }
          })(),
        dias_restantes: computeDiasRestantes(
          novoPedido.prazo_atual,
          novoPedido.status,
        ),
      }];
      const [enriched] = await enrichPedidos(base);
      let pedidoResposta = enriched || base[0];
      try {
        const responsavelNome = pedidoResposta.cooperativa_responsavel_nome ||
          pedidoResposta.cooperativa_responsavel_id ||
          "Responsável indefinido";
        await dispatchPedidoAlert({
          pedidoAtualizado: pedidoResposta,
          actor: userData,
          detalhes: [
            "Pedido criado",
            `Responsável: ${responsavelNome}`,
          ],
          action: "criado",
          mensagemCustom: `Novo pedido criado: ${pedidoResposta.titulo}`,
        });
      } catch (error) {
        console.warn("[alertas] falha ao gerar alerta de criação:", error);
      }
      const finalPedido =
        await autoEscalateIfNeeded(pedidoResposta, userData) || pedidoResposta;
      return c.json(finalPedido);
    }
  } catch (error) {
    console.error("Erro ao criar pedido:", error);
    return c.json({ error: "Erro ao criar pedido" }, 500);
  }
});

// Atualizar pedido
app.put("/pedidos/:id", requireAuth, async (c) => {
  try {
    const pedidoId = c.req.param("id");
    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);
    const updateData = await c.req.json();
    const comentarioAtual = typeof updateData.comentario_atual === "string"
      ? updateData.comentario_atual.trim()
      : "";
    delete updateData.comentario_atual;

    const pedido = db.queryEntries<any>(
      `SELECT * FROM ${TBL("pedidos")} WHERE id = ? LIMIT 1`,
      [pedidoId],
    )[0];
    if (!pedido) {
      return c.json({ error: "Pedido não encontrado" }, 404);
    }

    // Verificar permissões conforme regras
    let podeEditar = false;
    if (userData.papel === "confederacao") {
      podeEditar = true;
    } else if (
      userData.papel === "admin" &&
      pedido.cooperativa_solicitante_id === userData.cooperativa_id
    ) {
      // Admin da solicitante pode editar tudo
      podeEditar = true;
    } else if (pedido.cooperativa_responsavel_id === userData.cooperativa_id) {
      // Usuários da responsável podem editar parcialmente
      podeEditar = true;
    } else if (
      userData.papel === "operador" && pedido.criado_por_user === userData.email
    ) {
      // Operador que criou pode editar tudo
      podeEditar = true;
    }

    if (!podeEditar) {
      return c.json({ error: "Acesso negado para editar este pedido" }, 403);
    }

    // Sanitizar update com base no perfil
    const allowed: Record<string, any> = {};
    const whitelistAdminSolic = [
      "titulo",
      "cooperativa_responsavel_id",
      "cidade_id",
      "especialidades",
      "quantidade",
      "observacoes",
      "prioridade",
      "nivel_atual",
      "status",
      "prazo_atual",
    ];
    const whitelistResponsavel = [
      "status",
      "observacoes",
      "prioridade",
      "responsavel_atual_id",
      "responsavel_atual_nome",
      "prazo_atual",
    ];

    const effectiveWhitelist = (userData.papel === "confederacao" ||
        (userData.papel === "admin" &&
          pedido.cooperativa_solicitante_id === userData.cooperativa_id) ||
        (userData.papel === "operador" &&
          pedido.criado_por_user === userData.email))
      ? whitelistAdminSolic
      : whitelistResponsavel;

    for (const k of effectiveWhitelist) {
      if (k in updateData) allowed[k] = updateData[k];
    }
    allowed.data_ultima_alteracao = new Date().toISOString();

    try {
      // Normalizar campos especiais
      if (Array.isArray(allowed.especialidades)) {
        allowed.especialidades = JSON.stringify(allowed.especialidades);
      }
      const cols = Object.keys(allowed);
      const placeholders = cols.map((c) => `${c} = ?`).join(", ");
      const values = cols.map((c) => (allowed as any)[c]);
      db.query(`UPDATE ${TBL("pedidos")} SET ${placeholders} WHERE id = ?`, [
        ...values,
        pedidoId,
      ]);
    } catch (e) {
      console.error("Erro ao atualizar pedido:", e);
      return c.json({ error: "Erro ao atualizar pedido" }, 500);
    }

    // Registrar auditoria
    const camposAlterados = Object.keys(allowed).filter((k) =>
      k !== "data_ultima_alteracao"
    );
    const detalhesPartes: string[] = [];

    const toHumanLabel = (key: string) => {
      switch (key) {
        case "status":
          return `Status: ${String(allowed.status || "").replace(/_/g, " ")}`;
        case "prioridade":
          return `Prioridade: ${allowed.prioridade}`;
        case "nivel_atual":
          return `Nível atual: ${allowed.nivel_atual}`;
        case "cooperativa_responsavel_id":
          return `Cooperativa responsável: ${allowed.cooperativa_responsavel_id}`;
        case "responsavel_atual_nome":
          return "responsavel_atual_nome";
        case "observacoes":
          return comentarioAtual ? "" : "Observações atualizadas";
        case "responsavel_atual_id":
          return "";
        default:
          return "";
      }
    };

    for (const key of camposAlterados) {
      const label = toHumanLabel(key);
      if (label && label !== "responsavel_atual_nome") {
        detalhesPartes.push(label);
      }
    }

    if ("responsavel_atual_nome" in allowed) {
      let responsavelLabel = "Responsável liberado";
      if (allowed.responsavel_atual_nome) {
        let coopNome = "";
        if (userData.cooperativa_id) {
          try {
            const coopRow = db.queryEntries<any>(
              `SELECT UNIODONTO FROM ${
                TBL("cooperativas")
              } WHERE id_singular = ? LIMIT 1`,
              [userData.cooperativa_id],
            )[0];
            coopNome = coopRow?.UNIODONTO || "";
          } catch (e) {
            console.warn(
              "[auditoria] falha ao buscar nome da cooperativa do responsável:",
              e,
            );
          }
        }
        responsavelLabel =
          `Responsável atual: ${allowed.responsavel_atual_nome}${
            coopNome ? `, ${coopNome}` : ""
          }`;
      }
      detalhesPartes.push(responsavelLabel);
    }

    if (comentarioAtual) {
      detalhesPartes.push(`Comentário: ${comentarioAtual}`);
    }

    const auditoria = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      pedido_id: pedidoId,
      usuario_id: userData.id,
      usuario_nome: userData.nome,
      usuario_display_nome: userData.display_name || userData.nome,
      acao: "Atualização do pedido",
      timestamp: new Date().toISOString(),
      detalhes: detalhesPartes.join(" | ") || null,
    };

    try {
      db.query(
        `INSERT INTO ${
          TBL("auditoria_logs")
        } (id, pedido_id, usuario_id, usuario_nome, usuario_display_nome, acao, timestamp, detalhes)
         VALUES (?,?,?,?,?,?,?,?)`,
        [
          auditoria.id,
          auditoria.pedido_id,
          auditoria.usuario_id,
          auditoria.usuario_nome,
          auditoria.usuario_display_nome,
          auditoria.acao,
          auditoria.timestamp,
          auditoria.detalhes || null,
        ],
      );
    } catch (e) {
      console.warn("Auditoria não registrada (tabela ausente?):", e);
    }

    let dataConclusao = pedido.data_conclusao as string | null | undefined;

    const statusOriginal = pedido.status as Pedido["status"];
    const statusAtualizado =
      (allowed.status ?? pedido.status) as Pedido["status"];

    if (statusOriginal !== "concluido" && statusAtualizado === "concluido") {
      dataConclusao = new Date().toISOString();
      allowed.data_conclusao = dataConclusao;
    } else if (
      statusOriginal === "concluido" && statusAtualizado !== "concluido"
    ) {
      dataConclusao = null;
      allowed.data_conclusao = null;
    }

    const updated = {
      ...pedido,
      ...allowed,
      data_conclusao: dataConclusao,
    } as any;
    // Normalizar especialidades no retorno
    updated.especialidades = Array.isArray(updated.especialidades)
      ? updated.especialidades
      : (() => {
        try {
          return JSON.parse(updated.especialidades || "[]");
        } catch {
          return [];
        }
      })();
    {
      const base = [{
        ...updated,
        dias_restantes: computeDiasRestantes(
          updated.prazo_atual,
          updated.status,
        ),
      }];
      const [enriched] = await enrichPedidos(base);
      const result = enriched || base[0];
      if (result) {
        result.dias_restantes = computeDiasRestantes(
          result.prazo_atual,
          result.status,
        );
        if (
          result.status === "concluido" && result.data_conclusao &&
          result.data_criacao
        ) {
          const dataInicio = new Date(result.data_criacao);
          const dataFinal = new Date(result.data_conclusao);
          if (
            !Number.isNaN(dataInicio.getTime()) &&
            !Number.isNaN(dataFinal.getTime())
          ) {
            const diff = dataFinal.getTime() - dataInicio.getTime();
            (result as any).dias_para_concluir = Math.max(
              0,
              Math.round(diff / (1000 * 60 * 60 * 24)),
            );
          }
        }
      }
      if (result && dataConclusao) {
        result.data_conclusao = dataConclusao;
        const dataInicio = result.data_criacao
          ? new Date(result.data_criacao)
          : null;
        const dataFinal = new Date(dataConclusao);
        if (dataInicio && !Number.isNaN(dataInicio.getTime())) {
          const diff = dataFinal.getTime() - dataInicio.getTime();
          (result as any).dias_para_concluir = Math.max(
            0,
            Math.round(diff / (1000 * 60 * 60 * 24)),
          );
        }
      }
      try {
        await dispatchPedidoAlert({
          pedidoOriginal: pedido,
          pedidoAtualizado: result,
          actor: userData,
          detalhes: detalhesPartes,
          comentario: comentarioAtual,
          camposAlterados,
          action: "atualizado",
        });
      } catch (error) {
        console.warn("[alertas] falha ao gerar alerta de atualização:", error);
      }
      const finalResult = await autoEscalateIfNeeded(result, userData) ||
        result;
      if (finalResult) {
        finalResult.dias_restantes = computeDiasRestantes(
          finalResult.prazo_atual,
          finalResult.status,
        );
      }
      return c.json(finalResult);
    }
  } catch (error) {
    console.error("Erro ao atualizar pedido:", error);
    return c.json({ error: "Erro ao atualizar pedido" }, 500);
  }
});

app.post("/pedidos/:id/transferir", requireAuth, async (c) => {
  try {
    const pedidoId = c.req.param("id");
    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);
    if (!userData) {
      return c.json({ error: "Usuário não autenticado" }, 401);
    }

    const row = db.queryEntries<any>(
      `SELECT * FROM ${TBL("pedidos")} WHERE id = ? LIMIT 1`,
      [pedidoId],
    )[0];
    if (!row) {
      return c.json({ error: "Pedido não encontrado" }, 404);
    }

    const pedido = {
      ...row,
      especialidades: Array.isArray(row.especialidades)
        ? row.especialidades
        : (() => {
          try {
            return JSON.parse(row.especialidades || "[]");
          } catch {
            return [];
          }
        })(),
    };

    const target = computeEscalationTarget(pedido);
    if (!target) {
      return c.json({
        error: "Não há nível superior disponível para este pedido",
      }, 400);
    }

    const mesmaResponsavel = pedido.cooperativa_responsavel_id &&
      userData.cooperativa_id === pedido.cooperativa_responsavel_id;
    const mesmaSolicitante = pedido.cooperativa_solicitante_id &&
      userData.cooperativa_id === pedido.cooperativa_solicitante_id;
    const podeTransferir = userData.papel === "confederacao" ||
      mesmaResponsavel || mesmaSolicitante;

    if (!podeTransferir) {
      return c.json(
        { error: "Acesso negado para transferir este pedido" },
        403,
      );
    }

    let body: any = {};
    try {
      body = await c.req.json();
    } catch {}

    const motivoManual =
      typeof body?.motivo === "string" && body.motivo.trim().length > 0
        ? body.motivo.trim()
        : "Transferência manual solicitada pela cooperativa responsável";

    let atualizado;
    try {
      atualizado = await applyEscalation(pedido, userData, motivoManual);
    } catch (error) {
      console.error("Erro ao transferir pedido manualmente:", error);
      return c.json({ error: "Erro ao transferir o pedido" }, 500);
    }

    if (!atualizado) {
      return c.json({ error: "Não foi possível transferir este pedido" }, 400);
    }

    const finalPedido = await autoEscalateIfNeeded(atualizado, userData) ||
      atualizado;
    return c.json(finalPedido);
  } catch (error) {
    console.error("Erro na transferência manual do pedido:", error);
    return c.json({ error: "Erro ao transferir pedido" }, 500);
  }
});

// Excluir pedido
app.delete("/pedidos/:id", requireAuth, async (c) => {
  try {
    const pedidoId = c.req.param("id");
    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);
    const pedido = db.queryEntries<any>(
      `SELECT id, cooperativa_solicitante_id FROM ${
        TBL("pedidos")
      } WHERE id = ? LIMIT 1`,
      [pedidoId],
    )[0];
    if (!pedido) return c.json({ error: "Pedido não encontrado" }, 404);

    // Tentar obter quem criou o pedido; em instalações antigas a coluna `criado_por_user`
    // pode não existir — executar em try/catch para compatibilidade.
    let createdBy: any = {};
    try {
      createdBy = db.queryEntries<any>(
        `SELECT criado_por_user, cooperativa_solicitante_id FROM ${
          TBL("pedidos")
        } WHERE id = ?`,
        [pedidoId],
      )[0] || {};
    } catch (e) {
      console.warn(
        "[deletePedido] coluna criado_por_user ausente ou query falhou, fallback:",
        e,
      );
      try {
        createdBy = db.queryEntries<any>(
          `SELECT cooperativa_solicitante_id FROM ${
            TBL("pedidos")
          } WHERE id = ?`,
          [pedidoId],
        )[0] || {};
      } catch (e2) {
        console.warn("[deletePedido] fallback também falhou:", e2);
        createdBy = {};
      }
    }

    const podeApagar = userData.papel === "confederacao" ||
      (userData.papel === "admin" &&
        pedido.cooperativa_solicitante_id === userData.cooperativa_id) ||
      (userData.papel === "operador" &&
        (createdBy?.criado_por_user === userData.email ||
          (!createdBy?.criado_por_user &&
            createdBy?.cooperativa_solicitante_id ===
              userData.cooperativa_id)));
    if (!podeApagar) {
      return c.json({ error: "Acesso negado para apagar este pedido" }, 403);
    }

    try {
      db.query(`DELETE FROM ${TBL("auditoria_logs")} WHERE pedido_id = ?`, [
        pedidoId,
      ]);
      db.query(`DELETE FROM ${TBL("pedidos")} WHERE id = ?`, [pedidoId]);
    } catch (e) {
      console.error("Erro ao excluir pedido:", e);
      return c.json({ error: "Erro ao excluir pedido" }, 500);
    }
    return c.json({ ok: true });
  } catch (error) {
    console.error("Erro no delete de pedido:", error);
    return c.json({ error: "Erro ao excluir pedido" }, 500);
  }
});

// Buscar auditoria de um pedido
app.get("/pedidos/:id/auditoria", requireAuth, async (c) => {
  try {
    const pedidoId = c.req.param("id");
    const data = db.queryEntries<any>(
      `SELECT * FROM ${
        TBL("auditoria_logs")
      } WHERE pedido_id = ? ORDER BY timestamp DESC`,
      [pedidoId],
    );
    return c.json(data || []);
  } catch (error) {
    console.error("Erro ao buscar auditoria do pedido:", error);
    return c.json({ error: "Erro ao buscar auditoria do pedido" }, 500);
  }
});

// ROTAS DE ALERTAS
app.get("/alertas", requireAuth, async (c) => {
  try {
    const authUser = c.get("user");
    const email = authUser.email || authUser?.claims?.email;
    if (!email) {
      return c.json([]);
    }

    const limitParam = c.req.query("limit");
    const limit = (() => {
      const parsed = Number(limitParam);
      if (!Number.isFinite(parsed)) return 50;
      return Math.min(Math.max(Math.trunc(parsed), 1), 200);
    })();

    const rows = db.queryEntries<any>(
      `SELECT id, pedido_id, pedido_titulo, destinatario_email, destinatario_nome, destinatario_cooperativa_id, tipo, mensagem, detalhes, lido, criado_em, disparado_por_email, disparado_por_nome
         FROM ${TBL("alertas")}
        WHERE LOWER(destinatario_email) = LOWER(?)
        ORDER BY lido ASC, datetime(COALESCE(criado_em, CURRENT_TIMESTAMP)) DESC
        LIMIT ?`,
      [email, limit],
    ) || [];

    const mapped = rows.map((row) => ({
      id: row.id,
      pedido_id: row.pedido_id,
      pedido_titulo: row.pedido_titulo,
      tipo: row.tipo,
      mensagem: row.mensagem,
      detalhes: row.detalhes,
      lido: Number(row.lido ?? 0) !== 0,
      criado_em: row.criado_em,
      disparado_por_email: row.disparado_por_email,
      disparado_por_nome: row.disparado_por_nome,
    }));

    return c.json(mapped);
  } catch (error) {
    console.error("Erro ao buscar alertas:", error);
    return c.json({ error: "Erro ao buscar alertas" }, 500);
  }
});

app.post("/alertas/:id/lido", requireAuth, async (c) => {
  try {
    const authUser = c.get("user");
    const alertaId = c.req.param("id");
    if (!alertaId) {
      return c.json({ error: "Identificador inválido" }, 400);
    }

    const email = authUser.email || authUser?.claims?.email;
    if (!email) {
      return c.json({ error: "Usuário não autenticado" }, 401);
    }

    const userData = await getUserData(authUser.id, email);
    if (!userData) {
      return c.json({ error: "Usuário não autenticado" }, 401);
    }

    const alertaRow = db.queryEntries<any>(
      `SELECT * FROM ${
        TBL("alertas")
      } WHERE id = ? AND LOWER(destinatario_email) = LOWER(?) LIMIT 1`,
      [alertaId, email],
    )[0];
    if (!alertaRow) {
      return c.json({ error: "Alerta não encontrado" }, 404);
    }

    let body = {} as any;
    try {
      body = await c.req.json();
    } catch {}
    const marcado = body?.lido === false ? 0 : 1;

    db.query(
      `UPDATE ${
        TBL("alertas")
      } SET lido = ?, criado_em = criado_em WHERE id = ? AND LOWER(destinatario_email) = LOWER(?)`,
      [marcado, alertaId, email],
    );

    const estavaLido = Number(alertaRow.lido ?? 0) !== 0;
    if (!estavaLido && marcado === 1 && alertaRow.pedido_id) {
      try {
        const detalhes = truncateText(
          `Alerta visualizado: ${alertaRow.tipo || "atualizacao"}${
            alertaRow.mensagem ? ` • ${alertaRow.mensagem}` : ""
          }`,
          500,
        );
        const auditoria = {
          id: safeRandomId("audit"),
          pedido_id: alertaRow.pedido_id,
          usuario_id: userData.id,
          usuario_nome: userData.nome,
          usuario_display_nome: userData.display_name || userData.nome,
          acao: "Leitura de alerta",
          timestamp: new Date().toISOString(),
          detalhes,
        };
        db.query(
          `INSERT INTO ${
            TBL("auditoria_logs")
          } (id, pedido_id, usuario_id, usuario_nome, usuario_display_nome, acao, timestamp, detalhes)
           VALUES (?,?,?,?,?,?,?,?)`,
          [
            auditoria.id,
            auditoria.pedido_id,
            auditoria.usuario_id,
            auditoria.usuario_nome,
            auditoria.usuario_display_nome,
            auditoria.acao,
            auditoria.timestamp,
            auditoria.detalhes,
          ],
        );
      } catch (error) {
        console.warn(
          "[alertas] falha ao registrar auditoria de leitura:",
          error,
        );
      }
    }

    return c.json({ ok: true, lido: marcado === 1 });
  } catch (error) {
    console.error("Erro ao atualizar alerta:", error);
    return c.json({ error: "Erro ao atualizar alerta" }, 500);
  }
});

app.post("/alertas/marcar-todos", requireAuth, async (c) => {
  try {
    const authUser = c.get("user");
    const email = authUser.email || authUser?.claims?.email;
    if (!email) {
      return c.json({ error: "Usuário não autenticado" }, 401);
    }

    const userData = await getUserData(authUser.id, email);
    if (!userData) {
      return c.json({ error: "Usuário não autenticado" }, 401);
    }

    const alertas = db.queryEntries<any>(
      `SELECT * FROM ${
        TBL("alertas")
      } WHERE LOWER(destinatario_email) = LOWER(?) AND (lido IS NULL OR lido = 0)`,
      [email],
    ) || [];

    db.query(
      `UPDATE ${
        TBL("alertas")
      } SET lido = 1 WHERE LOWER(destinatario_email) = LOWER(?)`,
      [email],
    );

    for (const alerta of alertas) {
      if (!alerta?.pedido_id) continue;
      try {
        const detalhes = truncateText(
          `Alerta visualizado: ${alerta.tipo || "atualizacao"}${
            alerta.mensagem ? ` • ${alerta.mensagem}` : ""
          }`,
          500,
        );
        const auditoria = {
          id: safeRandomId("audit"),
          pedido_id: alerta.pedido_id,
          usuario_id: userData.id,
          usuario_nome: userData.nome,
          usuario_display_nome: userData.display_name || userData.nome,
          acao: "Leitura de alerta",
          timestamp: new Date().toISOString(),
          detalhes,
        };
        db.query(
          `INSERT INTO ${
            TBL("auditoria_logs")
          } (id, pedido_id, usuario_id, usuario_nome, usuario_display_nome, acao, timestamp, detalhes)
           VALUES (?,?,?,?,?,?,?,?)`,
          [
            auditoria.id,
            auditoria.pedido_id,
            auditoria.usuario_id,
            auditoria.usuario_nome,
            auditoria.usuario_display_nome,
            auditoria.acao,
            auditoria.timestamp,
            auditoria.detalhes,
          ],
        );
      } catch (error) {
        console.warn(
          "[alertas] falha ao registrar auditoria de leitura (marcar todos):",
          error,
        );
      }
    }

    return c.json({ ok: true, total: alertas.length });
  } catch (error) {
    console.error("Erro ao marcar alertas como lidos:", error);
    return c.json({ error: "Erro ao marcar alertas" }, 500);
  }
});

// Dashboard - Estatísticas
app.get("/dashboard/stats", requireAuth, async (c) => {
  try {
    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);
    await escalarPedidos();

    const pedidosData = db.queryEntries<any>(`SELECT * FROM ${TBL("pedidos")}`);

    // Preparar mapa de federações por cooperativa
    const coopIds = Array.from(
      new Set(
        (pedidosData || []).flatMap(
          (p) => [p.cooperativa_solicitante_id, p.cooperativa_responsavel_id],
        ).filter(Boolean),
      ),
    );
    const coops = coopIds.length
      ? db.queryEntries<any>(
        `SELECT id_singular, FEDERACAO FROM ${
          TBL("cooperativas")
        } WHERE id_singular IN (${coopIds.map(() => "?").join(",")})`,
        coopIds as any,
      )
      : [];
    const coopsFed: Record<string, string | null> = {};
    for (const r of coops) {
      coopsFed[r.id_singular] = r.FEDERACAO || null;
    }
    const userFed = userData?.cooperativa_id
      ? (coopsFed[userData.cooperativa_id] ||
        db.queryEntries<any>(
          `SELECT FEDERACAO FROM ${
            TBL("cooperativas")
          } WHERE id_singular = ? LIMIT 1`,
          [userData.cooperativa_id],
        )[0]?.FEDERACAO || null)
      : null;

    const agora = new Date();
    let totalPedidos = 0;
    let pedidosVencendo = 0;
    let pedidosEmAndamento = 0;
    let pedidosConcluidos = 0;
    let slaCumprido = 0;

    for (const pedidoData of (pedidosData || [])) {
      // Aplicar filtros baseados no papel do usuário (regras atualizadas)
      let podeVer = false;
      if (userData.papel === "admin" || userData.papel === "confederacao") {
        podeVer = true;
      } else if (userData.papel === "operador") {
        podeVer =
          pedidoData.cooperativa_solicitante_id === userData.cooperativa_id ||
          pedidoData.cooperativa_responsavel_id === userData.cooperativa_id;
      } else if (userData.papel === "federacao") {
        const fedSolic = coopsFed[pedidoData.cooperativa_solicitante_id] ||
          null;
        const fedResp = coopsFed[pedidoData.cooperativa_responsavel_id] || null;
        podeVer = !!userFed && (fedSolic === userFed || fedResp === userFed);
      }

      if (podeVer) {
        totalPedidos++;

        if (pedidoData.status === "concluido") {
          pedidosConcluidos++;
          // Verificar se foi concluído dentro do prazo
          if (
            new Date(pedidoData.data_ultima_alteracao) <=
              new Date(pedidoData.prazo_atual)
          ) {
            slaCumprido++;
          }
        } else if (pedidoData.status === "em_andamento") {
          pedidosEmAndamento++;

          // Verificar se está vencendo (próximos 7 dias)
          const prazo = new Date(pedidoData.prazo_atual);
          const diffTime = prazo.getTime() - agora.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays <= 7 && diffDays >= 0) {
            pedidosVencendo++;
          }
        }
      }
    }

    const slaPercentual = pedidosConcluidos > 0
      ? Math.round((slaCumprido / pedidosConcluidos) * 100)
      : 0;

    return c.json({
      total_pedidos: totalPedidos,
      pedidos_vencendo: pedidosVencendo,
      pedidos_em_andamento: pedidosEmAndamento,
      pedidos_concluidos: pedidosConcluidos,
      sla_cumprido: slaPercentual,
    });
  } catch (error) {
    console.error("Erro ao gerar estatísticas:", error);
    return c.json({ error: "Erro ao gerar estatísticas" }, 500);
  }
});

// Rota para executar escalonamento manual (admin only)
app.post(
  "/admin/escalar-pedidos",
  requireAuth,
  requireRole(["admin"]),
  async (c) => {
    try {
      await escalarPedidos();
      return c.json({ message: "Escalonamento executado com sucesso" });
    } catch (error) {
      console.error("Erro no escalonamento manual:", error);
      return c.json({ error: "Erro no escalonamento" }, 500);
    }
  },
);

// Inicializar dados e configurar cron job para escalonamento
const initServer = async () => {
  await initializeData();

  // Configurar cron job para escalonamento (executar a cada hora)
  setInterval(async () => {
    console.log("Executando escalonamento automático...");
    await escalarPedidos();
  }, 60 * 60 * 1000); // 1 hora
};

// Inicializar servidor
// Health check simples da função
app.get(
  "/health",
  (c) => c.json({ status: "ok", time: new Date().toISOString() }),
);

// Rotas raiz (úteis para testes rápidos: GET/POST /)
app.get(
  "/",
  (c) =>
    c.json({
      status: "ok",
      name: "server",
      method: "GET",
      time: new Date().toISOString(),
    }),
);
app.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const isSchedule = c.req.header("x-cron") === "true";
  if (isSchedule || body?.task === "escalar") {
    try {
      await escalarPedidos();
      return c.json({
        status: "ok",
        job: "escalar",
        time: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Erro no job escalonar:", e);
      return c.json({ status: "error", message: "cron failed" }, 500);
    }
  }
  return c.json({
    status: "ok",
    name: "server",
    method: "POST",
    body,
    time: new Date().toISOString(),
  });
});

// Observação: para jobs cron externos, envie header 'x-cron: true' e body {"task":"escalar"}

export default app.fetch;

// Permite rodar localmente sem Docker/Edge, usando Deno diretamente.
// Mantém compatível com Edge Functions (export default app.fetch acima).
if (import.meta.main) {
  const parsePortList = (raw?: string | null) =>
    (raw ? raw.split(",") : [])
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value > 0);

  const envPort = Number(Deno.env.get("PORT") || NaN);
  const fallbackPortsFromEnv = parsePortList(Deno.env.get("PORT_FALLBACKS"));
  const defaultPorts = [8300, 8301, 8302, 8303];

  const portsToTry = [
    ...(Number.isFinite(envPort) ? [envPort] : []),
    ...fallbackPortsFromEnv,
    ...defaultPorts,
  ].filter((port, index, all) => all.indexOf(port) === index); // deduplicar preservando ordem

  const startServer = () => {
    for (const port of portsToTry) {
      try {
        console.log(
          `[server] Iniciando servidor HTTP local na porta ${port}...`,
        );
        Deno.serve({ port }, app.fetch);
        return;
      } catch (error) {
        if (error instanceof Deno.errors.AddrInUse) {
          console.error(`[server] Porta ${port} em uso, tentando próxima...`);
          continue;
        }
        throw error;
      }
    }

    console.error(
      "[server] Nenhuma das portas configuradas está disponível. Defina PORT ou PORT_FALLBACKS.",
    );
    Deno.exit(1);
  };

  startServer();
}
