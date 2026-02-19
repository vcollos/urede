import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { cors, logger } from "https://deno.land/x/hono@v4.3.11/middleware.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { signJwt, verifyJwt } from "./lib/jwt.ts";
import {
  queryEntries as pgQueryEntries,
  queryArray as pgQueryArray,
  query as pgQuery,
  execute as pgExecute,
  transaction as pgTransaction,
} from "./lib/postgres.ts";
import { sendBrevoTransactionalEmail } from "./lib/brevo.ts";

// Configurar CORS controlado por ambiente
// ALLOWED_ORIGINS pode ser uma lista separada por vírgula (ex.: "https://app.vercel.app,https://admin.vercel.app")
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const ALLOW_PRIVATE_NETWORK_ORIGINS = (
  Deno.env.get("ALLOW_PRIVATE_NETWORK_ORIGINS") ?? "true"
).toLowerCase() !== "false";

const app = new Hono();
console.log("[cors] allowed origins", ALLOWED_ORIGINS);

const isOriginAllowed = (origin?: string | null): boolean => {
  if (!origin) return true; // permitir chamadas server-to-server e curl
  if (ALLOWED_ORIGINS.includes("*")) return true;
  if (ALLOW_PRIVATE_NETWORK_ORIGINS) {
    try {
      const { hostname } = new URL(origin);
      const isLoopback = hostname === "localhost" || hostname === "127.0.0.1" ||
        hostname === "::1";
      const isPrivate10 = hostname.startsWith("10.");
      const isPrivate192 = hostname.startsWith("192.168.");
      const isPrivate172 = /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
      if (isLoopback || isPrivate10 || isPrivate192 || isPrivate172) {
        return true;
      }
    } catch {
      // ignora origins inválidas e segue para regras explícitas
    }
  }
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
const DB_DRIVER = (Deno.env.get("DB_DRIVER") || "sqlite").toLowerCase();
const IS_POSTGRES = DB_DRIVER === "postgres";
const TBL = (name: string) =>
  IS_POSTGRES ? `${DB_SCHEMA}.${TABLE_PREFIX}${name}` : `${TABLE_PREFIX}${name}`;

// Auth / DB
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
type DbAdapter = {
  query: (text: string, args?: unknown[]) => void;
  queryEntries: <T = Record<string, unknown>>(text: string, args?: unknown[]) => T[];
  queryArray: (text: string, args?: unknown[]) => unknown[][];
  execute: (text: string, args?: unknown[]) => void;
};

type TransactionalDbAdapter = DbAdapter & {
  transaction?: <T>(fn: (tx: DbAdapter) => T) => T;
};

const pgDb: TransactionalDbAdapter = {
  query: (text: string, args: unknown[] = []) => pgQuery(text, args),
  queryEntries: <T = Record<string, unknown>>(text: string, args: unknown[] = []) =>
    pgQueryEntries<T>(text, args),
  queryArray: (text: string, args: unknown[] = []) => pgQueryArray(text, args),
  execute: (text: string, args: unknown[] = []) => pgExecute(text, args),
};

pgDb.transaction = <T>(fn: (tx: DbAdapter) => T) => pgTransaction(fn);
let sqliteGetDb: ((path: string) => DbAdapter) | null = null;
if (!IS_POSTGRES) {
  const sqliteModule = await import("./lib/sqlite.ts");
  sqliteGetDb = sqliteModule.getDb;
}

const getDb = (path: string = SQLITE_PATH) => {
  if (IS_POSTGRES) return pgDb;
  if (!sqliteGetDb) {
    throw new Error("[db] driver sqlite não carregado");
  }
  return sqliteGetDb(path);
};

if (IS_POSTGRES) {
  console.log("[db] usando driver postgres");
} else {
  console.log(`[db] abrindo banco sqlite em: ${SQLITE_PATH}`);
}

// Modo inseguro para desenvolvimento local: quando true, pulamos checagens de autenticação e permissões.
// Defina INSECURE_MODE=true no arquivo database/functions/server/.env para habilitar.
const INSECURE_MODE =
  (Deno.env.get("INSECURE_MODE") || "").toLowerCase() === "true";

const APP_URL = Deno.env.get("APP_URL") || "http://localhost:5173";
const DEFAULT_CONFEDERACAO_ID =
  Deno.env.get("DEFAULT_CONFEDERACAO_ID") || "001";
const EMAIL_CONFIRMATION_TIMEOUT_HOURS = Number(
  Deno.env.get("EMAIL_CONFIRMATION_TIMEOUT_HOURS") ?? 24,
);
const APPROVAL_ESCALATION_TIMEOUT_HOURS = Number(
  Deno.env.get("APPROVAL_ESCALATION_TIMEOUT_HOURS") ?? 48,
);
const BREVO_CONFIRMATION_TEMPLATE_ID = Number(
  Deno.env.get("BREVO_CONFIRMATION_TEMPLATE_ID") ?? "",
) || null;
const BREVO_APPROVAL_TEMPLATE_ID = Number(
  Deno.env.get("BREVO_APPROVAL_TEMPLATE_ID") ?? "",
) || null;

const GDRIVE_ENABLED =
  (Deno.env.get("GDRIVE_ENABLED") ?? "true").toLowerCase() !== "false";
const GDRIVE_DRIVE_ID = (Deno.env.get("GDRIVE_DRIVE_ID") || "").trim();
const GDRIVE_ROOT_FOLDER_ID = (Deno.env.get("GDRIVE_ROOT_FOLDER_ID") || "root")
  .trim() || "root";
const GDRIVE_UDOCS_ROOT_FOLDER_ID = (
  Deno.env.get("GDRIVE_UDOCS_ROOT_FOLDER_ID") || GDRIVE_ROOT_FOLDER_ID || "root"
).trim() || "root";
const GDRIVE_UMARKETING_ROOT_FOLDER_ID = (
  Deno.env.get("GDRIVE_UMARKETING_ROOT_FOLDER_ID") || ""
).trim();
const GDRIVE_SERVICE_ACCOUNT_EMAIL = (
  Deno.env.get("GDRIVE_SERVICE_ACCOUNT_EMAIL") || ""
).trim();
const GDRIVE_SERVICE_ACCOUNT_PRIVATE_KEY = (
  Deno.env.get("GDRIVE_SERVICE_ACCOUNT_PRIVATE_KEY") || ""
).replace(/\\n/g, "\n").trim();
const CENTRAL_ARQUIVOS_ENCRYPTION_KEY = (
  Deno.env.get("CENTRAL_ARQUIVOS_ENCRYPTION_KEY") || ""
).trim();
const GDRIVE_SCOPES = (Deno.env.get("GDRIVE_SCOPES") ||
  "https://www.googleapis.com/auth/drive.readonly").trim();
const GDRIVE_CATEGORY_FOLDERS_RAW = (
  Deno.env.get("GDRIVE_CATEGORY_FOLDERS_JSON") || "{}"
).trim();
const ARQUIVOS_AUDIT_RETENTION_DAYS = Math.max(
  1,
  Number(Deno.env.get("ARQUIVOS_AUDIT_RETENTION_DAYS") || 365) || 365,
);

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
    resp_tecnico: row.resp_tecnico ?? row.RESP_TECNICO ?? "",
    cro_resp_tecnico: row.cro_resp_tecnico ?? row.CRO_RESP_TECNICO ?? "",
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
  // compat: id_singular segue representando a cooperativa de credenciamento
  id_singular: row.id_singular_credenciamento ?? row.ID_SINGULAR ?? row.id_singular,
  id_singular_credenciamento: row.id_singular_credenciamento ?? row.ID_SINGULAR ?? null,
  id_singular_vendas: row.id_singular_vendas ?? null,
  reg_ans: row.reg_ans ?? row.REG_ANS ?? null,
  nm_singular: row.NM_SINGULAR ?? row.nm_singular ?? null,
});

const normalizeModuleAccess = (
  value: unknown,
  fallback: string[] = ["hub"],
) => {
  const allowed = new Set([
    "hub",
    "urede",
    "udocs",
    "umarketing",
    "ufast",
    "central_apps",
  ]);
  const collected: string[] = [];

  const toCanonicalModule = (entry: unknown) => {
    const raw = String(entry ?? "").trim().toLowerCase();
    if (!raw) return "";
    if (raw === "central-apps" || raw === "centralapps" || raw === "central de apps" || raw === "central_de_apps") {
      return "central_apps";
    }
    return raw;
  };

  const append = (entry: unknown) => {
    const normalized = toCanonicalModule(entry);
    if (!allowed.has(normalized)) return;
    if (!collected.includes(normalized)) {
      collected.push(normalized);
    }
  };

  if (Array.isArray(value)) {
    value.forEach((item) => append(item));
  } else if (typeof value === "string") {
    const raw = value.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((item) => append(item));
        } else {
          raw.split(/[;,]/g).forEach((item) => append(item));
        }
      } catch {
        raw.split(/[;,]/g).forEach((item) => append(item));
      }
    }
  } else if (value && typeof value === "object") {
    const maybe = value as Record<string, unknown>;
    if (maybe.hub) append("hub");
    if (maybe.urede) append("urede");
    if (maybe.udocs) append("udocs");
    if (maybe.umarketing) append("umarketing");
    if (maybe.ufast) append("ufast");
    if (maybe.central_apps) append("central_apps");
  }

  if (!collected.includes("hub")) {
    collected.unshift("hub");
  }

  const fallbackNormalized = Array.from(
    new Set(
      (fallback || [])
        .map((item) => toCanonicalModule(item))
        .filter((item) => allowed.has(item)),
    ),
  );

  const merged = collected.length ? collected : fallbackNormalized;
  return merged.length ? merged : ["hub"];
};

const serializeModuleAccess = (
  value: unknown,
  fallback: string[] = ["hub"],
) => JSON.stringify(normalizeModuleAccess(value, fallback));

const mapOperador = (row: any) => ({
  id: (row.id ?? "").toString(),
  nome: row.nome ?? "",
  email: row.email ?? "",
  telefone: row.telefone ?? "",
  whatsapp: row.whatsapp ?? "",
  wpp: normalizeBoolInt(row.wpp) === 1 ||
    Boolean(String(row.whatsapp ?? "").trim()) ||
    isLikelyBrazilMobile(normalizeDigitsString(row.telefone ?? "")),
  cargo: row.cargo ?? "",
  id_singular: row.id_singular ?? "",
  ativo: (row.status ?? true) as boolean,
  data_cadastro: row.created_at ?? new Date().toISOString(),
  papel: row.auth_papel ?? row.papel ?? "operador",
  modulos_acesso: normalizeModuleAccess(
    row.auth_module_access ?? row.module_access,
    ["hub"],
  ),
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

const mapCooperativaOverviewLog = (row: any) => ({
  id: row.id,
  cooperativa_id: row.cooperativa_id,
  cooperativa_nome: row.cooperativa_nome ?? row.UNIODONTO ?? null,
  campo: row.campo ?? "",
  acao: row.acao ?? "",
  valor_anterior: row.valor_anterior ?? null,
  valor_novo: row.valor_novo ?? null,
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
const db = getDb();

const getConfederacaoId = (() => {
  let cached: string | null = null;
  return () => {
    if (cached) return cached;
    let candidate = DEFAULT_CONFEDERACAO_ID;
    try {
      const row = db.queryEntries<any>(
        `SELECT id_singular FROM ${TBL("cooperativas")} WHERE UPPER(TIPO) LIKE 'CONFED%' LIMIT 1`,
      )[0];
      if (row?.id_singular) candidate = row.id_singular;
      if (!candidate && row?.ID_SINGULAR) candidate = row.ID_SINGULAR;
    } catch (_) {
      /* noop */
    }
    cached = candidate || "001";
    return cached;
  };
})();

const nowIso = () => new Date().toISOString();
const addHours = (hours: number) =>
  new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
const generateToken = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
};

const isDuplicateColumnError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate column|already exists|duplicate key/i.test(message);
};

const normalizeArquivoCategoryLabel = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

type ArquivoItemTipo = "pasta" | "arquivo";

const extractArquivoCodeAndLabel = (value: unknown) => {
  const title = String(value ?? "").trim();
  const match = title.match(/^\[(\d+)\]\s*(.+)$/);
  if (!match) {
    return {
      code: null as string | null,
      label: title,
    };
  }
  return {
    code: String(match[1] || "").trim() || null,
    label: String(match[2] || "").trim() || title,
  };
};

const hasArquivoLikeExtension = (value: string) =>
  /\.[a-z0-9]{2,5}$/i.test(String(value || "").trim());

const resolveArquivoItemTipo = (item: Pick<ArquivoItemRecord, "mime_type" | "titulo">): ArquivoItemTipo => {
  const mime = String(item.mime_type || "").toLowerCase().trim();
  if (mime === "application/vnd.google-apps.folder" || mime.includes("folder")) {
    return "pasta";
  }
  if (mime && mime !== "application/octet-stream") {
    return "arquivo";
  }

  const parsed = extractArquivoCodeAndLabel(item.titulo);
  if (!parsed.code) return "arquivo";
  if (hasArquivoLikeExtension(item.titulo)) return "arquivo";
  if (hasArquivoLikeExtension(parsed.label)) return "arquivo";
  return "pasta";
};

const parseDriveCategoryFolders = () => {
  try {
    const parsed = JSON.parse(GDRIVE_CATEGORY_FOLDERS_RAW || "{}");
    if (!parsed || typeof parsed !== "object") return {} as Record<string, string>;
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const label = normalizeArquivoCategoryLabel(key);
      const id = String(value ?? "").trim();
      if (!label || !id) continue;
      result[label] = id;
    }
    return result;
  } catch (error) {
    console.warn("[gdrive] GDRIVE_CATEGORY_FOLDERS_JSON inválido:", error);
    return {} as Record<string, string>;
  }
};

const GDRIVE_CATEGORY_FOLDERS = parseDriveCategoryFolders();

const ensureAuthUsersSchema = () => {
  try {
    db.query(`CREATE TABLE IF NOT EXISTS auth_users (
      email TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      nome TEXT,
      display_name TEXT,
      telefone TEXT,
      whatsapp TEXT,
      cargo TEXT,
      cooperativa_id TEXT,
      papel TEXT DEFAULT 'operador',
      requested_papel TEXT,
      ativo INTEGER DEFAULT 1,
      data_cadastro TEXT DEFAULT (CURRENT_TIMESTAMP),
      confirmation_token TEXT,
      confirmation_expires_at TEXT,
      email_confirmed_at TEXT,
      approval_status TEXT,
      approval_requested_at TEXT,
      approved_by TEXT,
      approved_at TEXT,
      auto_approve INTEGER DEFAULT 0,
      must_change_password INTEGER DEFAULT 0,
      module_access TEXT DEFAULT '["hub"]'
    )`);
  } catch (error) {
    console.warn("[auth_users] falha ao garantir tabela:", error);
  }

  const statements = IS_POSTGRES
    ? [
      "ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS confirmation_token TEXT",
      "ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS confirmation_expires_at TEXT",
      "ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS email_confirmed_at TEXT",
      "ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS approval_status TEXT",
      "ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS approval_requested_at TEXT",
      "ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS approved_by TEXT",
      "ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS approved_at TEXT",
      "ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS requested_papel TEXT",
      "ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS auto_approve INTEGER DEFAULT 0",
      "ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS must_change_password INTEGER DEFAULT 0",
      "ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS module_access TEXT DEFAULT '[\"hub\"]'",
    ]
    : [
      "ALTER TABLE auth_users ADD COLUMN confirmation_token TEXT",
      "ALTER TABLE auth_users ADD COLUMN confirmation_expires_at TEXT",
      "ALTER TABLE auth_users ADD COLUMN email_confirmed_at TEXT",
      "ALTER TABLE auth_users ADD COLUMN approval_status TEXT",
      "ALTER TABLE auth_users ADD COLUMN approval_requested_at TEXT",
      "ALTER TABLE auth_users ADD COLUMN approved_by TEXT",
      "ALTER TABLE auth_users ADD COLUMN approved_at TEXT",
      "ALTER TABLE auth_users ADD COLUMN requested_papel TEXT",
      "ALTER TABLE auth_users ADD COLUMN auto_approve INTEGER DEFAULT 0",
      "ALTER TABLE auth_users ADD COLUMN must_change_password INTEGER DEFAULT 0",
      "ALTER TABLE auth_users ADD COLUMN module_access TEXT DEFAULT '[\"hub\"]'",
    ];
  for (const stmt of statements) {
    try {
      db.query(stmt);
    } catch (error) {
      if (!isDuplicateColumnError(error)) {
        console.warn("[auth_users] alteração falhou:", error);
      }
    }
  }

  try {
    db.query(
      `UPDATE auth_users SET approval_status = 'approved' WHERE approval_status IS NULL`,
    );
  } catch (error) {
    console.warn("[auth_users] não foi possível definir approval_status:", error);
  }
  try {
    db.query(
      "UPDATE auth_users SET auto_approve = COALESCE(auto_approve, 0)",
    );
  } catch (_) {
    /* ignore */
  }
  try {
    db.query(
      "UPDATE auth_users SET requested_papel = COALESCE(requested_papel, papel)",
    );
  } catch (_) {
    /* ignore */
  }
  try {
    db.query(
      "UPDATE auth_users SET email_confirmed_at = COALESCE(email_confirmed_at, data_cadastro) WHERE email_confirmed_at IS NULL",
    );
  } catch (_) {
    /* ignore */
  }
  try {
    db.query(
      `UPDATE auth_users
          SET module_access = COALESCE(NULLIF(TRIM(module_access), ''), '["hub"]')
        WHERE module_access IS NULL OR TRIM(module_access) = ''`,
    );
  } catch (_) {
    /* ignore */
  }
};

const ensureAuthUserCooperativasSchema = () => {
  try {
    db.query(`CREATE TABLE IF NOT EXISTS auth_user_cooperativas (
      user_email TEXT NOT NULL,
      cooperativa_id TEXT NOT NULL,
      is_primary INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
      PRIMARY KEY (user_email, cooperativa_id)
    )`);
  } catch (error) {
    console.warn("[auth_user_cooperativas] falha ao garantir tabela:", error);
  }

  try {
    db.query(
      `CREATE INDEX IF NOT EXISTS idx_auth_user_cooperativas_coop
       ON auth_user_cooperativas(cooperativa_id)`,
    );
  } catch (error) {
    console.warn("[auth_user_cooperativas] falha ao criar índice:", error);
  }

  try {
    db.query(
      `INSERT INTO auth_user_cooperativas (user_email, cooperativa_id, is_primary, created_at, updated_at)
       SELECT email, cooperativa_id, 1, COALESCE(data_cadastro, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
         FROM auth_users
        WHERE COALESCE(TRIM(cooperativa_id), '') <> ''
       ON CONFLICT(user_email, cooperativa_id) DO NOTHING`,
    );
  } catch (error) {
    console.warn("[auth_user_cooperativas] falha ao sincronizar vínculos:", error);
  }

  try {
    db.query(
      `UPDATE auth_user_cooperativas
          SET is_primary = CASE
            WHEN cooperativa_id = (
              SELECT cooperativa_id
                FROM auth_users
               WHERE auth_users.email = auth_user_cooperativas.user_email
               LIMIT 1
            ) THEN 1
            ELSE 0
          END
        WHERE user_email IN (
          SELECT email FROM auth_users WHERE COALESCE(TRIM(cooperativa_id), '') <> ''
        )`,
    );
  } catch (error) {
    console.warn("[auth_user_cooperativas] falha ao alinhar cooperativa principal:", error);
  }
};

const ensureUserApprovalRequestsTable = () => {
  try {
    db.query(
      `CREATE TABLE IF NOT EXISTS user_approval_requests (
        id TEXT PRIMARY KEY,
        user_email TEXT NOT NULL,
        cooperativa_id TEXT,
        approver_cooperativa_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        decided_at TEXT,
        decided_by TEXT,
        decision_notes TEXT
      )`,
    );
  } catch (error) {
    console.warn("[approvals] criação de tabela falhou:", error);
  }

  try {
    db.query(
      `CREATE INDEX IF NOT EXISTS idx_user_approval_requests_status ON user_approval_requests(status)`,
    );
  } catch (_) {
    /* ignore */
  }
  try {
    db.query(
      `CREATE INDEX IF NOT EXISTS idx_user_approval_requests_approver ON user_approval_requests(approver_cooperativa_id, status)`,
    );
  } catch (_) {
    /* ignore */
  }
};

const ensureEnderecoTipoCorrespondencia = () => {
  try {
    db.query(
      `UPDATE ${TBL("cooperativa_enderecos")}
          SET tipo = 'correspondencia'
        WHERE lower(tipo) = 'sede'`,
    );
  } catch (error) {
    // Ambientes antigos podem não ter a tabela ainda; não bloquear bootstrap.
    console.warn("[enderecos] não foi possível normalizar tipo para correspondencia:", error);
  }
};

const ensureEnderecoVisaoGeralSchema = () => {
  const statements = IS_POSTGRES
    ? [
      `ALTER TABLE ${TBL("cooperativa_enderecos")} ADD COLUMN IF NOT EXISTS exibir_visao_geral INTEGER DEFAULT 1`,
      `ALTER TABLE ${TBL("cooperativa_enderecos")} ADD COLUMN IF NOT EXISTS plantao_clinica_id TEXT`,
      `ALTER TABLE ${TBL("cooperativa_plantao_clinicas")} ADD COLUMN IF NOT EXISTS endereco_id TEXT`,
    ]
    : [
      `ALTER TABLE ${TBL("cooperativa_enderecos")} ADD COLUMN exibir_visao_geral INTEGER DEFAULT 1`,
      `ALTER TABLE ${TBL("cooperativa_enderecos")} ADD COLUMN plantao_clinica_id TEXT`,
      `ALTER TABLE ${TBL("cooperativa_plantao_clinicas")} ADD COLUMN endereco_id TEXT`,
    ];

  for (const statement of statements) {
    try {
      db.query(statement);
    } catch (error) {
      if (!isDuplicateColumnError(error)) {
        console.warn("[enderecos] não foi possível ajustar colunas de visão geral/sincronização:", error);
      }
    }
  }

  try {
    db.query(
      `UPDATE ${TBL("cooperativa_enderecos")}
          SET exibir_visao_geral = COALESCE(exibir_visao_geral, 1)`,
    );
  } catch (_) {
    /* ignore */
  }
};

const ensureOperadoresTelefoneSchema = () => {
  const statements = IS_POSTGRES
    ? [
      `ALTER TABLE ${TBL("operadores")} ADD COLUMN IF NOT EXISTS wpp INTEGER DEFAULT 0`,
    ]
    : [
      `ALTER TABLE ${TBL("operadores")} ADD COLUMN wpp INTEGER DEFAULT 0`,
    ];

  for (const statement of statements) {
    try {
      db.query(statement);
    } catch (error) {
      if (!isDuplicateColumnError(error)) {
        console.warn("[operadores] não foi possível ajustar coluna wpp:", error);
      }
    }
  }

  try {
    db.query(
      `UPDATE ${TBL("operadores")}
          SET telefone = COALESCE(NULLIF(telefone, ''), NULLIF(whatsapp, ''), telefone)`,
    );
  } catch (_) {
    /* ignore */
  }
  try {
    db.query(
      `UPDATE ${TBL("operadores")}
          SET wpp = 1
        WHERE COALESCE(NULLIF(whatsapp, ''), '') <> ''
           OR LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(telefone, ''), ' ', ''), '(', ''), ')', ''), '-', '')) = 11`,
    );
  } catch (_) {
    /* ignore */
  }
  try {
    db.query(
      `UPDATE ${TBL("operadores")}
          SET whatsapp = CASE WHEN COALESCE(wpp, 0) = 1 THEN COALESCE(telefone, whatsapp, '') ELSE '' END`,
    );
  } catch (_) {
    /* ignore */
  }
};

ensureAuthUsersSchema();
ensureAuthUserCooperativasSchema();
ensureUserApprovalRequestsTable();
ensureEnderecoTipoCorrespondencia();
ensureEnderecoVisaoGeralSchema();
ensureOperadoresTelefoneSchema();

const getCooperativaRowRaw = (id?: string | null) => {
  if (!id) return null;
  try {
    return db.queryEntries<any>(
      `SELECT * FROM ${TBL("cooperativas")} WHERE id_singular = ? LIMIT 1`,
      [id],
    )[0] ?? null;
  } catch (error) {
    console.warn("[cooperativas] falha ao buscar registro bruto:", error);
    return null;
  }
};

const countApprovedAdmins = (coopId?: string | null) => {
  if (!coopId) return 0;
  try {
    const row = db.queryEntries<{ c: number }>(
      "SELECT COUNT(*) AS c FROM auth_users WHERE cooperativa_id = ? AND papel = 'admin' AND approval_status = 'approved'",
      [coopId],
    )[0];
    return Number(row?.c ?? 0);
  } catch (error) {
    console.warn("[auth] falha ao contar admins aprovados:", error);
    return 0;
  }
};

const hasApprovedAdmins = (coopId?: string | null) => {
  return countApprovedAdmins(coopId) > 0;
};

const getApprovedAdminsForCoop = (coopId?: string | null) => {
  if (!coopId) return [];
  try {
    return db.queryEntries<{ email: string; nome: string | null }>(
      "SELECT email, COALESCE(nome, display_name) AS nome FROM auth_users WHERE cooperativa_id = ? AND papel = 'admin' AND approval_status = 'approved'",
      [coopId],
    ).map((row) => ({
      email: row.email,
      nome: row.nome ?? row.email,
    }));
  } catch (error) {
    console.warn("[auth] falha ao buscar admins aprovados:", error);
    return [];
  }
};

const findFederationIdForCoop = (coopId?: string | null) => {
  if (!coopId) return null;
  const row = getCooperativaRowRaw(coopId);
  if (!row) return null;
  const tipo = normalizeCooperativaTipo(row.TIPO || row.tipo || "");
  if (tipo === "FEDERACAO") return row.ID_SINGULAR || row.id_singular || coopId;
  if (tipo === "CONFEDERACAO") return null;

  // Preferir ligação direta por ID (schema novo), com fallback para o modelo legado (nome da federação).
  const directFed = row.federacao_id || row.FEDERACAO_ID;
  if (directFed) return directFed;

  const fedName = row.FEDERACAO || row.federacao;
  if (!fedName) return null;
  try {
    const fedRow = db.queryEntries<any>(
      `SELECT * FROM ${TBL("cooperativas")} WHERE UPPER(UNIODONTO) = UPPER(?) OR id_singular = ? LIMIT 1`,
      [fedName, fedName],
    )[0];
    if (!fedRow) return null;
    return fedRow.ID_SINGULAR || fedRow.id_singular || null;
  } catch (error) {
    console.warn("[cooperativas] falha ao localizar federacao:", error);
    return null;
  }
};

type ApprovalTarget =
  | { targetId: string; level: "singular" | "federacao" | "confederacao"; admins: { email: string; nome: string }[] }
  | { targetId: null; level: "manual"; admins: { email: string; nome: string }[] };

const findApprovalTarget = (coopId?: string | null): ApprovalTarget => {
  const chain: { id: string | null; level: "singular" | "federacao" | "confederacao" }[] = [];
  const row = getCooperativaRowRaw(coopId);
  const tipo = normalizeCooperativaTipo(row?.TIPO || row?.tipo || "");

  if (tipo === "CONFEDERACAO") {
    chain.push({ id: row?.ID_SINGULAR || row?.id_singular || coopId || getConfederacaoId(), level: "confederacao" });
  } else if (tipo === "FEDERACAO") {
    chain.push({ id: row?.ID_SINGULAR || row?.id_singular || coopId || null, level: "federacao" });
    chain.push({ id: getConfederacaoId(), level: "confederacao" });
  } else {
    if (coopId) {
      chain.push({ id: coopId, level: "singular" });
    }
    const fedId = findFederationIdForCoop(coopId);
    if (fedId) {
      chain.push({ id: fedId, level: "federacao" });
    }
    chain.push({ id: getConfederacaoId(), level: "confederacao" });
  }

  const visited = new Set<string>();
  for (const step of chain) {
    if (!step.id) continue;
    if (visited.has(step.id)) continue;
    visited.add(step.id);
    if (hasApprovedAdmins(step.id)) {
      return {
        targetId: step.id,
        level: step.level,
        admins: getApprovedAdminsForCoop(step.id),
      };
    }
  }

  return { targetId: null, level: "manual", admins: [] };
};

const toBoolean = (value: unknown) =>
  value === true || value === 1 || value === "1";

const getAuthUser = (email: string) => {
  try {
    return db.queryEntries<any>(
      "SELECT * FROM auth_users WHERE email = ? LIMIT 1",
      [email],
    )[0] ?? null;
  } catch (error) {
    console.error("[auth] falha ao obter usuário:", error);
    return null;
  }
};

const normalizeCooperativaIdsInput = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => String(item || "").trim())
          .filter((item) => item.length > 0),
      ),
    );
  }
  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
      ),
    );
  }
  return [];
};

const getUserCooperativaAssociacoes = (email?: string | null): string[] => {
  if (!email) return [];
  try {
    const rows = db.queryEntries<any>(
      `SELECT cooperativa_id, COALESCE(is_primary, 0) AS is_primary
         FROM auth_user_cooperativas
        WHERE user_email = ?
        ORDER BY COALESCE(is_primary, 0) DESC, cooperativa_id ASC`,
      [email],
    ) || [];
    return rows
      .map((row) => String(row.cooperativa_id || "").trim())
      .filter((id) => id.length > 0);
  } catch (error) {
    console.warn("[auth_user_cooperativas] falha ao buscar vínculos:", error);
    return [];
  }
};

const syncUserCooperativaAssociacoes = (
  email: string,
  idsInput: string[],
  primaryInput?: string | null,
) => {
  const ids = Array.from(
    new Set(
      (idsInput || [])
        .map((item) => String(item || "").trim())
        .filter((item) => item.length > 0),
    ),
  );
  if (!email) return [] as string[];
  if (ids.length === 0) {
    try {
      db.query(`DELETE FROM auth_user_cooperativas WHERE user_email = ?`, [email]);
    } catch (_) {
      /* ignore */
    }
    return [] as string[];
  }

  const primary = ids.includes(String(primaryInput || "").trim())
    ? String(primaryInput).trim()
    : ids[0];
  const now = new Date().toISOString();

  try {
    const placeholders = ids.map(() => "?").join(",");
    db.query(
      `DELETE FROM auth_user_cooperativas
        WHERE user_email = ?
          AND cooperativa_id NOT IN (${placeholders})`,
      [email, ...ids],
    );
  } catch (error) {
    console.warn("[auth_user_cooperativas] falha ao remover vínculos antigos:", error);
  }

  for (const cooperativaId of ids) {
    try {
      db.query(
        `INSERT INTO auth_user_cooperativas (user_email, cooperativa_id, is_primary, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_email, cooperativa_id)
         DO UPDATE SET is_primary = excluded.is_primary, updated_at = excluded.updated_at`,
        [email, cooperativaId, cooperativaId === primary ? 1 : 0, now, now],
      );
    } catch (error) {
      console.warn("[auth_user_cooperativas] falha ao salvar vínculo:", error);
    }
  }

  try {
    db.query(
      `UPDATE auth_users
          SET cooperativa_id = ?
        WHERE email = ?`,
      [primary, email],
    );
  } catch (error) {
    console.warn("[auth_user_cooperativas] falha ao sincronizar cooperativa principal:", error);
  }

  return ids;
};

const buildCooperativaAssociacoesMap = (emails: string[]): Record<string, string[]> => {
  const normalized = Array.from(
    new Set(
      (emails || [])
        .map((email) => String(email || "").trim().toLowerCase())
        .filter((email) => email.length > 0),
    ),
  );
  if (normalized.length === 0) return {};
  try {
    const placeholders = normalized.map(() => "?").join(",");
    const rows = db.queryEntries<any>(
      `SELECT user_email, cooperativa_id, COALESCE(is_primary, 0) AS is_primary
         FROM auth_user_cooperativas
        WHERE LOWER(user_email) IN (${placeholders})
        ORDER BY COALESCE(is_primary, 0) DESC, cooperativa_id ASC`,
      normalized as any,
    ) || [];
    const map: Record<string, string[]> = {};
    for (const row of rows) {
      const email = String(row.user_email || "").trim().toLowerCase();
      const cooperativaId = String(row.cooperativa_id || "").trim();
      if (!email || !cooperativaId) continue;
      if (!map[email]) map[email] = [];
      if (!map[email].includes(cooperativaId)) {
        map[email].push(cooperativaId);
      }
    }
    return map;
  } catch (error) {
    console.warn("[auth_user_cooperativas] falha ao montar mapa de vínculos:", error);
    return {};
  }
};

const sendConfirmationEmail = async (
  user: { email: string; nome?: string | null; display_name?: string | null },
  token: string,
) => {
  const name = user.display_name || user.nome || user.email;
  const confirmUrl = `${APP_URL.replace(/\/$/, "")}/confirm-email?token=${encodeURIComponent(token)}`;
  const to = [{ email: user.email, name }];

  if (BREVO_CONFIRMATION_TEMPLATE_ID) {
    await sendBrevoTransactionalEmail({
      to,
      subject: "Confirme seu email",
      params: {
        confirm_url: confirmUrl,
        name,
      },
      templateId: BREVO_CONFIRMATION_TEMPLATE_ID,
    });
  } else {
    const htmlContent = `
      <p>Olá ${name},</p>
      <p>Recebemos o seu cadastro no sistema Urede. Para confirmar seu e-mail e concluir o processo, clique no link abaixo:</p>
      <p><a href="${confirmUrl}">${confirmUrl}</a></p>
      <p>Se você não solicitou este cadastro, ignore esta mensagem.</p>
      <p>Atenciosamente,<br/>Equipe Urede</p>
    `;
    await sendBrevoTransactionalEmail({
      to,
      subject: "Confirme seu email",
      htmlContent,
      textContent:
        `Olá ${name},\n\nConfirme o seu e-mail acessando: ${confirmUrl}\n\nSe você não solicitou este cadastro, ignore esta mensagem.\n\nEquipe Urede`,
    });
  }
};

const sendApprovalRequestEmails = async (
  approvers: { email: string; nome: string }[],
  user: { email: string; nome?: string | null; display_name?: string | null; cooperativa_id?: string | null },
) => {
  if (!approvers || approvers.length === 0) return;
  const pendingUrl =
    `${APP_URL.replace(/\/$/, "")}/admin/usuarios/pendentes`;
  const requesterName = user.display_name || user.nome || user.email;

  for (const approver of approvers) {
    const to = [{ email: approver.email, name: approver.nome }];
    const subject = "Aprovação pendente - novo usuário";
    const htmlContent = `
      <p>Olá ${approver.nome},</p>
      <p>O usuário <strong>${requesterName} (${user.email})</strong> aguarda aprovação para acessar o sistema.</p>
      <p>Acesse o painel para aprovar ou recusar: <a href="${pendingUrl}">${pendingUrl}</a></p>
      <p>Atenciosamente,<br/>Equipe Urede</p>
    `;
    const textContent =
      `Olá ${approver.nome},\n\nO usuário ${requesterName} (${user.email}) aguarda aprovação.\nAcesse ${pendingUrl} para decidir.\n\nEquipe Urede`;

    if (BREVO_APPROVAL_TEMPLATE_ID) {
      await sendBrevoTransactionalEmail({
        to,
        subject,
        params: {
          requester_email: user.email,
          requester_name: requesterName,
          pending_url: pendingUrl,
        },
        templateId: BREVO_APPROVAL_TEMPLATE_ID,
      });
    } else {
      await sendBrevoTransactionalEmail({
        to,
        subject,
        htmlContent,
        textContent,
      });
    }
  }
};

const enqueueApprovalRequest = (
  user: {
    email: string;
    nome?: string | null;
    display_name?: string | null;
    cooperativa_id?: string | null;
    requested_papel?: string | null;
  },
) => {
  const target = findApprovalTarget(user.cooperativa_id);
  if (!target.targetId) {
    try {
      db.query(
        "UPDATE auth_users SET approval_status = 'pending_manual' WHERE email = ?",
        [user.email],
      );
    } catch (error) {
      console.warn("[approvals] falha ao marcar pendência manual:", error);
    }
    return;
  }

  try {
    db.query(
      "DELETE FROM user_approval_requests WHERE user_email = ?",
      [user.email],
    );
  } catch (_) {
    /* ignore */
  }

  const requestId = generateToken();
  try {
    db.query(
      `INSERT INTO user_approval_requests (id, user_email, cooperativa_id, approver_cooperativa_id, status, created_at)
       VALUES (?,?,?,?,?,?)`,
      [
        requestId,
        user.email,
        user.cooperativa_id || null,
        target.targetId,
        "pending",
        nowIso(),
      ],
    );
  } catch (error) {
    console.error("[approvals] falha ao registrar solicitação:", error);
  }

  void sendApprovalRequestEmails(target.admins, user).catch((error) => {
    console.warn("[approvals] falha ao enviar notificação:", error);
  });
};

const sendApprovalResultEmail = async (
  user: { email: string; nome?: string | null; display_name?: string | null },
  status: "approved" | "rejected",
  approverName?: string | null,
  notes?: string | null,
) => {
  const name = user.display_name || user.nome || user.email;
  const subject = status === "approved"
    ? "Sua conta foi aprovada"
    : "Sua conta não foi aprovada";
  const approverText = approverName
    ? `por ${approverName}`
    : "pela administração";
  const additional = notes ? `<p><strong>Observação:</strong> ${notes}</p>` : "";
  const textAdditional = notes ? `\nObservação: ${notes}` : "";

  if (BREVO_APPROVAL_TEMPLATE_ID) {
    await sendBrevoTransactionalEmail({
      to: [{ email: user.email, name }],
      subject,
      params: {
        decision: status,
        approver: approverName || approverText,
        notes,
        painel_url: `${APP_URL.replace(/\/$/, "")}/login`,
      },
      templateId: BREVO_APPROVAL_TEMPLATE_ID,
    });
    return;
  }

  const htmlContent = `
    <p>Olá ${name},</p>
    <p>Sua conta no sistema Urede foi <strong>${
    status === "approved" ? "aprovada" : "rejeitada"
  }</strong> ${approverText}.</p>
    ${additional}
    <p>Acesse o sistema para mais detalhes: <a href="${APP_URL}">${APP_URL}</a></p>
    <p>Atenciosamente,<br/>Equipe Urede</p>
  `;
  const textContent =
    `Olá ${name},\n\nSua conta foi ${
      status === "approved" ? "aprovada" : "rejeitada"
    } ${approverText}.${textAdditional}\n\nAcesse ${APP_URL} para mais detalhes.\n\nEquipe Urede`;

  await sendBrevoTransactionalEmail({
    to: [{ email: user.email, name }],
    subject,
    htmlContent,
    textContent,
  });
};


if (IS_POSTGRES) {
  try {
    db.query(`CREATE SCHEMA IF NOT EXISTS ${DB_SCHEMA}`);
  } catch (error) {
    console.warn("[schema] falha ao garantir schema:", error);
  }
}

const ensurePedidoSchema = () => {
  const alters = [
    `ALTER TABLE ${TBL("pedidos")} ADD COLUMN responsavel_atual_id TEXT`,
    `ALTER TABLE ${TBL("pedidos")} ADD COLUMN responsavel_atual_nome TEXT`,
    `ALTER TABLE ${TBL("pedidos")} ADD COLUMN criado_por_user TEXT`,
    `ALTER TABLE ${TBL("pedidos")} ADD COLUMN data_conclusao TEXT`,
    `ALTER TABLE ${TBL("pedidos")} ADD COLUMN motivo_categoria TEXT`,
    `ALTER TABLE ${TBL("pedidos")} ADD COLUMN beneficiarios_quantidade INTEGER`,
    `ALTER TABLE ${TBL("pedidos")} ADD COLUMN excluido BOOLEAN`,
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

const ensureCooperativaOverviewLogSchema = () => {
  try {
    db.query(`CREATE TABLE IF NOT EXISTS ${TBL("cooperativa_overview_logs")} (
      id TEXT PRIMARY KEY,
      cooperativa_id TEXT NOT NULL,
      campo TEXT NOT NULL,
      acao TEXT NOT NULL,
      valor_anterior TEXT,
      valor_novo TEXT,
      usuario_email TEXT,
      usuario_nome TEXT,
      usuario_papel TEXT,
      detalhes TEXT,
      timestamp TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`);
  } catch (e) {
    console.warn("[schema] criacao de cooperativa_overview_logs falhou:", e);
  }

  try {
    db.query(
      `CREATE INDEX IF NOT EXISTS idx_${
        TBL("cooperativa_overview_logs").replace(".", "_")
      }_coop ON ${TBL("cooperativa_overview_logs")}(cooperativa_id)`,
    );
  } catch (e) {
    console.warn("[schema] indice cooperativa_overview_logs coop falhou:", e);
  }
  try {
    db.query(
      `CREATE INDEX IF NOT EXISTS idx_${
        TBL("cooperativa_overview_logs").replace(".", "_")
      }_ts ON ${TBL("cooperativa_overview_logs")}(timestamp)`,
    );
  } catch (e) {
    console.warn("[schema] indice cooperativa_overview_logs timestamp falhou:", e);
  }
};

ensureCooperativaOverviewLogSchema();

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

const ensureArquivosSchema = () => {
  try {
    db.query(`CREATE TABLE IF NOT EXISTS ${TBL("arquivos_itens")} (
      id TEXT PRIMARY KEY,
      drive_file_id TEXT NOT NULL UNIQUE,
      titulo TEXT NOT NULL,
      categoria TEXT,
      ano INTEGER,
      mime_type TEXT,
      item_tipo TEXT NOT NULL DEFAULT 'arquivo',
      parent_drive_file_id TEXT,
      ordem_manual INTEGER,
      tamanho_bytes INTEGER DEFAULT 0,
      drive_modified_at TEXT,
      drive_created_at TEXT,
      preview_url TEXT,
      download_url TEXT,
      checksum TEXT,
      modulo TEXT NOT NULL DEFAULT 'udocs',
      cooperativa_scope TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      sincronizado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`);
  } catch (error) {
    console.warn("[schema] falha ao criar arquivos_itens:", error);
  }

  try {
    db.query(`CREATE TABLE IF NOT EXISTS ${TBL("arquivos_atalhos")} (
      id TEXT PRIMARY KEY,
      modulo TEXT NOT NULL DEFAULT 'udocs',
      folder_drive_file_id TEXT NOT NULL,
      rotulo TEXT NOT NULL,
      ordem INTEGER NOT NULL DEFAULT 0,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      atualizado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`);
  } catch (error) {
    console.warn("[schema] falha ao criar arquivos_atalhos:", error);
  }

  try {
    db.query(`CREATE TABLE IF NOT EXISTS ${TBL("arquivos_acl")} (
      id TEXT PRIMARY KEY,
      scope_type TEXT NOT NULL DEFAULT 'global',
      scope_value TEXT,
      principal_type TEXT NOT NULL,
      principal_value TEXT NOT NULL,
      can_view INTEGER NOT NULL DEFAULT 1,
      can_download INTEGER NOT NULL DEFAULT 1,
      effect TEXT NOT NULL DEFAULT 'allow',
      ativo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`);
  } catch (error) {
    console.warn("[schema] falha ao criar arquivos_acl:", error);
  }

  try {
    db.query(`CREATE TABLE IF NOT EXISTS ${TBL("arquivos_grupos")} (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL UNIQUE,
      descricao TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`);
  } catch (error) {
    console.warn("[schema] falha ao criar arquivos_grupos:", error);
  }

  try {
    db.query(`CREATE TABLE IF NOT EXISTS ${TBL("arquivos_grupo_membros")} (
      grupo_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      ativo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      PRIMARY KEY (grupo_id, user_email)
    )`);
  } catch (error) {
    console.warn("[schema] falha ao criar arquivos_grupo_membros:", error);
  }

  try {
    db.query(`CREATE TABLE IF NOT EXISTS ${TBL("arquivos_sync_state")} (
      provider TEXT PRIMARY KEY,
      cursor_token TEXT,
      last_sync_at TEXT,
      last_status TEXT,
      last_error TEXT,
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`);
  } catch (error) {
    console.warn("[schema] falha ao criar arquivos_sync_state:", error);
  }

  try {
    db.query(`CREATE TABLE IF NOT EXISTS ${TBL("arquivos_auditoria")} (
      id TEXT PRIMARY KEY,
      arquivo_id TEXT,
      drive_file_id TEXT,
      acao TEXT NOT NULL,
      resultado TEXT NOT NULL DEFAULT 'ok',
      usuario_email TEXT,
      usuario_nome TEXT,
      usuario_papel TEXT,
      cooperativa_id TEXT,
      ip TEXT,
      user_agent TEXT,
      detalhes TEXT,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`);
  } catch (error) {
    console.warn("[schema] falha ao criar arquivos_auditoria:", error);
  }

  const alterStatements = IS_POSTGRES
    ? [
      `ALTER TABLE ${TBL("arquivos_itens")} ADD COLUMN IF NOT EXISTS cooperativa_scope TEXT`,
      `ALTER TABLE ${TBL("arquivos_itens")} ADD COLUMN IF NOT EXISTS preview_url TEXT`,
      `ALTER TABLE ${TBL("arquivos_itens")} ADD COLUMN IF NOT EXISTS download_url TEXT`,
      `ALTER TABLE ${TBL("arquivos_itens")} ADD COLUMN IF NOT EXISTS checksum TEXT`,
      `ALTER TABLE ${TBL("arquivos_itens")} ADD COLUMN IF NOT EXISTS modulo TEXT`,
      `ALTER TABLE ${TBL("arquivos_itens")} ADD COLUMN IF NOT EXISTS ano INTEGER`,
      `ALTER TABLE ${TBL("arquivos_itens")} ADD COLUMN IF NOT EXISTS item_tipo TEXT`,
      `ALTER TABLE ${TBL("arquivos_itens")} ADD COLUMN IF NOT EXISTS parent_drive_file_id TEXT`,
      `ALTER TABLE ${TBL("arquivos_itens")} ADD COLUMN IF NOT EXISTS ordem_manual INTEGER`,
      `ALTER TABLE ${TBL("arquivos_itens")} ADD COLUMN IF NOT EXISTS sincronizado_em TEXT`,
    ]
    : [
      `ALTER TABLE ${TBL("arquivos_itens")} ADD COLUMN cooperativa_scope TEXT`,
      `ALTER TABLE ${TBL("arquivos_itens")} ADD COLUMN preview_url TEXT`,
      `ALTER TABLE ${TBL("arquivos_itens")} ADD COLUMN download_url TEXT`,
      `ALTER TABLE ${TBL("arquivos_itens")} ADD COLUMN checksum TEXT`,
      `ALTER TABLE ${TBL("arquivos_itens")} ADD COLUMN modulo TEXT`,
      `ALTER TABLE ${TBL("arquivos_itens")} ADD COLUMN ano INTEGER`,
      `ALTER TABLE ${TBL("arquivos_itens")} ADD COLUMN item_tipo TEXT`,
      `ALTER TABLE ${TBL("arquivos_itens")} ADD COLUMN parent_drive_file_id TEXT`,
      `ALTER TABLE ${TBL("arquivos_itens")} ADD COLUMN ordem_manual INTEGER`,
      `ALTER TABLE ${TBL("arquivos_itens")} ADD COLUMN sincronizado_em TEXT`,
    ];
  for (const stmt of alterStatements) {
    try {
      db.query(stmt);
    } catch (error) {
      if (!isDuplicateColumnError(error)) {
        console.warn("[schema] falha ao ajustar coluna de arquivos:", error);
      }
    }
  }

  try {
    db.query(
      `UPDATE ${TBL("arquivos_itens")}
          SET modulo = 'udocs'
        WHERE modulo IS NULL OR TRIM(COALESCE(modulo, '')) = ''`,
    );
  } catch (error) {
    console.warn("[schema] falha ao ajustar modulo padrão em arquivos_itens:", error);
  }

  try {
    db.query(
      `UPDATE ${TBL("arquivos_itens")}
          SET item_tipo = CASE
            WHEN LOWER(COALESCE(mime_type, '')) = 'application/vnd.google-apps.folder'
              OR LOWER(COALESCE(mime_type, '')) LIKE '%folder%'
            THEN 'pasta'
            ELSE 'arquivo'
          END
        WHERE item_tipo IS NULL OR TRIM(COALESCE(item_tipo, '')) = ''`,
    );
  } catch (error) {
    console.warn("[schema] falha ao ajustar item_tipo padrão em arquivos_itens:", error);
  }

  try {
    const now = nowIso();
    db.query(
      `INSERT INTO ${TBL("arquivos_grupos")}
        (id, nome, descricao, ativo, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         nome = excluded.nome,
         descricao = excluded.descricao,
         updated_at = excluded.updated_at`,
      [
        CENTRAL_ARQUIVOS_ADMIN_GROUP_ID,
        "Administradores da Central",
        "Grupo com permissão para gerenciar integrações e ACL da UDocs.",
        now,
        now,
      ],
    );
  } catch (error) {
    console.warn("[schema] falha ao garantir grupo central_admin:", error);
  }

  try {
    db.query(
      `CREATE INDEX IF NOT EXISTS idx_${
        TBL("arquivos_itens").replace(".", "_")
      }_categoria ON ${TBL("arquivos_itens")}(categoria)`,
    );
    db.query(
      `CREATE INDEX IF NOT EXISTS idx_${
        TBL("arquivos_itens").replace(".", "_")
      }_ano ON ${TBL("arquivos_itens")}(ano)`,
    );
    db.query(
      `CREATE INDEX IF NOT EXISTS idx_${
        TBL("arquivos_itens").replace(".", "_")
      }_ativo ON ${TBL("arquivos_itens")}(ativo)`,
    );
    db.query(
      `CREATE INDEX IF NOT EXISTS idx_${
        TBL("arquivos_itens").replace(".", "_")
      }_scope ON ${TBL("arquivos_itens")}(cooperativa_scope)`,
    );
    db.query(
      `CREATE INDEX IF NOT EXISTS idx_${
        TBL("arquivos_itens").replace(".", "_")
      }_modulo ON ${TBL("arquivos_itens")}(modulo)`,
    );
    db.query(
      `CREATE INDEX IF NOT EXISTS idx_${
        TBL("arquivos_itens").replace(".", "_")
      }_parent ON ${TBL("arquivos_itens")}(parent_drive_file_id)`,
    );
    db.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_${
        TBL("arquivos_atalhos").replace(".", "_")
      }_modulo_folder ON ${TBL("arquivos_atalhos")}(modulo, folder_drive_file_id)`,
    );
    db.query(
      `CREATE INDEX IF NOT EXISTS idx_${
        TBL("arquivos_atalhos").replace(".", "_")
      }_ordem ON ${TBL("arquivos_atalhos")}(modulo, ordem)`,
    );
    db.query(
      `CREATE INDEX IF NOT EXISTS idx_${
        TBL("arquivos_acl").replace(".", "_")
      }_scope ON ${TBL("arquivos_acl")}(scope_type, scope_value)`,
    );
    db.query(
      `CREATE INDEX IF NOT EXISTS idx_${
        TBL("arquivos_acl").replace(".", "_")
      }_principal ON ${TBL("arquivos_acl")}(principal_type, principal_value)`,
    );
    db.query(
      `CREATE INDEX IF NOT EXISTS idx_${
        TBL("arquivos_grupo_membros").replace(".", "_")
      }_email ON ${TBL("arquivos_grupo_membros")}(user_email)`,
    );
    db.query(
      `CREATE INDEX IF NOT EXISTS idx_${
        TBL("arquivos_auditoria").replace(".", "_")
      }_created_at ON ${TBL("arquivos_auditoria")}(created_at)`,
    );
    db.query(
      `CREATE INDEX IF NOT EXISTS idx_${
        TBL("arquivos_auditoria").replace(".", "_")
      }_user ON ${TBL("arquivos_auditoria")}(usuario_email)`,
    );
    db.query(
      `CREATE INDEX IF NOT EXISTS idx_${
        TBL("arquivos_auditoria").replace(".", "_")
      }_arquivo ON ${TBL("arquivos_auditoria")}(arquivo_id)`,
    );
  } catch (error) {
    console.warn("[schema] falha ao criar indices de arquivos:", error);
  }
};

ensureArquivosSchema();

const ensureDiretoresPrivacidadeSchema = () => {
  try {
    db.query(
      `ALTER TABLE ${TBL("cooperativa_diretores")} ADD COLUMN divulgar_celular INTEGER DEFAULT 0`,
    );
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.warn("[schema] falha ao incluir divulgar_celular em diretores:", error);
    }
  }

  try {
    db.query(
      `UPDATE ${TBL("cooperativa_diretores")}
          SET divulgar_celular = COALESCE(divulgar_celular, 0)`,
    );
  } catch (error) {
    console.warn("[schema] falha ao normalizar divulgar_celular em diretores:", error);
  }

  try {
    db.query(`CREATE TABLE IF NOT EXISTS ${TBL("diretor_phone_access_requests")} (
      id TEXT PRIMARY KEY,
      cooperativa_id TEXT NOT NULL,
      diretor_id TEXT NOT NULL,
      requester_email TEXT NOT NULL,
      requester_nome TEXT,
      requester_cooperativa_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      motivo TEXT,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      decided_at TEXT,
      decided_by TEXT,
      decision_notes TEXT
    )`);
  } catch (error) {
    console.warn("[schema] falha ao criar diretor_phone_access_requests:", error);
  }

  try {
    db.query(
      `CREATE INDEX IF NOT EXISTS idx_${
        TBL("diretor_phone_access_requests").replace(".", "_")
      }_coop_status ON ${TBL("diretor_phone_access_requests")}(cooperativa_id, status)`,
    );
  } catch (error) {
    console.warn("[schema] falha ao criar índice de solicitações (coop_status):", error);
  }

  try {
    db.query(
      `CREATE INDEX IF NOT EXISTS idx_${
        TBL("diretor_phone_access_requests").replace(".", "_")
      }_requester_diretor ON ${TBL("diretor_phone_access_requests")}(requester_email, diretor_id)`,
    );
  } catch (error) {
    console.warn("[schema] falha ao criar índice de solicitações (requester_diretor):", error);
  }
};

ensureDiretoresPrivacidadeSchema();

type SystemSettings = {
  theme: "light" | "dark" | "system";
  deadlines: {
    singularToFederacao: number;
    federacaoToConfederacao: number;
  };
  requireApproval: boolean;
  autoNotifyManagers: boolean;
  enableSelfRegistration: boolean;
  pedido_motivos: string[];
  hub_cadastros: {
    tipos_endereco: string[];
    tipos_conselho: string[];
    tipos_contato: string[];
    subtipos_contato: string[];
    redes_sociais: string[];
    departamentos: string[];
  };
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
  pedido_motivos: [],
  hub_cadastros: {
    tipos_endereco: [
      "Sede",
      "Filial",
      "Núcleo",
      "Clínica",
      "Ponto de Venda",
      "Plantão de Urgência & Emergência",
      "Atendimento",
    ],
    tipos_conselho: ["Fiscal", "Administrativo", "Técnico"],
    tipos_contato: ["E-mail", "Telefone", "Website", "Rede social", "Outro"],
    subtipos_contato: [
      "LGPD",
      "Plantão",
      "Geral",
      "Emergência",
      "Divulgação",
      "Comercial PF",
      "Comercial PJ",
      "Institucional",
      "Portal do Prestador",
      "Portal do Cliente",
      "Portal da Empresa",
      "Portal do Corretor",
      "E-Commerce",
      "Portal do Cooperado",
    ],
    redes_sociais: ["Instagram", "Facebook", "LinkedIn", "YouTube", "TikTok", "X"],
    departamentos: ["INTERCÂMBIO", "COMERCIAL", "ATENDIMENTO", "FINANCEIRO"],
  },
};

const SETTINGS_KEY_SYSTEM = "system_preferences";
const SETTINGS_KEY_CENTRAL_ARQUIVOS_GDRIVE_SECRET =
  "central_arquivos_gdrive_service_account_secret";
const SETTINGS_KEY_CENTRAL_ARQUIVOS_GDRIVE_CONFIG =
  "central_arquivos_gdrive_config";
const CENTRAL_ARQUIVOS_ADMIN_GROUP_ID = "central_admin";

const sanitizeMotivos = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const normalized = trimmed.slice(0, 150);
    if (seen.has(normalized.toLowerCase())) continue;
    seen.add(normalized.toLowerCase());
    result.push(normalized);
  }
  return result;
};

const sanitizeCatalogList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.replace(/\s+/g, " ").trim();
    if (!trimmed) continue;
    const normalized = trimmed.slice(0, 120);
    if (seen.has(normalized.toLowerCase())) continue;
    seen.add(normalized.toLowerCase());
    result.push(normalized);
  }
  return result;
};

const sanitizeHubCadastros = (
  value: unknown,
): SystemSettings["hub_cadastros"] => {
  const source = (value && typeof value === "object") ? (value as Record<string, unknown>) : {};

  const tiposEndereco = sanitizeCatalogList(source.tipos_endereco);
  const tiposConselho = sanitizeCatalogList(source.tipos_conselho);
  const tiposContato = sanitizeCatalogList(source.tipos_contato);
  const subtiposContato = sanitizeCatalogList(source.subtipos_contato);
  const redesSociais = sanitizeCatalogList(source.redes_sociais);
  const departamentos = sanitizeCatalogList(source.departamentos);

  return {
    tipos_endereco: tiposEndereco.length
      ? tiposEndereco
      : [...DEFAULT_SYSTEM_SETTINGS.hub_cadastros.tipos_endereco],
    tipos_conselho: tiposConselho.length
      ? tiposConselho
      : [...DEFAULT_SYSTEM_SETTINGS.hub_cadastros.tipos_conselho],
    tipos_contato: tiposContato.length
      ? tiposContato
      : [...DEFAULT_SYSTEM_SETTINGS.hub_cadastros.tipos_contato],
    subtipos_contato: subtiposContato.length
      ? subtiposContato
      : [...DEFAULT_SYSTEM_SETTINGS.hub_cadastros.subtipos_contato],
    redes_sociais: redesSociais.length
      ? redesSociais
      : [...DEFAULT_SYSTEM_SETTINGS.hub_cadastros.redes_sociais],
    departamentos: departamentos.length
      ? departamentos
      : [...DEFAULT_SYSTEM_SETTINGS.hub_cadastros.departamentos],
  };
};

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
        pedido_motivos: sanitizeMotivos(parsed?.pedido_motivos),
        hub_cadastros: sanitizeHubCadastros(parsed?.hub_cadastros),
      };
    }
  } catch (error) {
    console.warn("[settings] falha ao ler configurações:", error);
  }
  return {
    ...DEFAULT_SYSTEM_SETTINGS,
    hub_cadastros: { ...DEFAULT_SYSTEM_SETTINGS.hub_cadastros },
  };
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

type GoogleServiceAccountPayload = {
  type: "service_account";
  project_id: string | null;
  private_key_id: string | null;
  private_key: string;
  client_email: string;
  client_id: string | null;
  token_uri: string;
};

type CentralArquivosDriveSecretPayload = {
  service_account: GoogleServiceAccountPayload;
  updated_at: string;
  updated_by_email: string | null;
  updated_by_nome: string | null;
};

type CentralArquivosDriveConfigPayload = {
  drive_id: string | null;
  udocs_root_folder_id: string;
  umarketing_root_folder_id: string | null;
  validation?: {
    status: "valid";
    checked_at: string;
    drive_name: string | null;
    udocs_folder_name: string | null;
    umarketing_folder_name: string | null;
  } | null;
  updated_at: string;
  updated_by_email: string | null;
  updated_by_nome: string | null;
};

type EncryptedSecretEnvelope = {
  v: number;
  alg: string;
  iv: string;
  ciphertext: string;
};

const toBase64 = (input: Uint8Array) => {
  let binary = "";
  for (const byte of input) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

const fromBase64 = (input: string) => {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const maskEmail = (email?: string | null) => {
  const raw = String(email || "").trim();
  if (!raw.includes("@")) return "";
  const [local, domain] = raw.split("@");
  if (!domain) return "";
  const visible = local.slice(0, Math.min(3, local.length));
  const masked = `${visible}${"*".repeat(Math.max(2, local.length - visible.length))}`;
  return `${masked}@${domain}`;
};

const normalizeDriveResourceId = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};

const normalizeCentralArquivosDriveConfigInput = (
  value: unknown,
  fallback?: Partial<CentralArquivosDriveConfigPayload>,
) => {
  const source = (value && typeof value === "object")
    ? (value as Record<string, unknown>)
    : {};

  const resolvedDriveId = normalizeDriveResourceId(
    source.drive_id ?? fallback?.drive_id ?? GDRIVE_DRIVE_ID,
  );
  const resolvedUdocsRoot = String(
    source.udocs_root_folder_id ??
      fallback?.udocs_root_folder_id ??
      GDRIVE_UDOCS_ROOT_FOLDER_ID,
  ).trim();
  if (!resolvedUdocsRoot) {
    throw new Error("Pasta raiz do UDocs é obrigatória.");
  }

  const resolvedUMarketingRoot = normalizeDriveResourceId(
    source.umarketing_root_folder_id ??
      fallback?.umarketing_root_folder_id ??
      GDRIVE_UMARKETING_ROOT_FOLDER_ID,
  );

  return {
    drive_id: resolvedDriveId,
    udocs_root_folder_id: resolvedUdocsRoot,
    umarketing_root_folder_id: resolvedUMarketingRoot,
  };
};

let centralArquivosEncryptionKeyPromise: Promise<CryptoKey> | null = null;

const getCentralArquivosEncryptionKey = async () => {
  if (!CENTRAL_ARQUIVOS_ENCRYPTION_KEY) {
    throw new Error(
      "Chave de criptografia não configurada. Defina CENTRAL_ARQUIVOS_ENCRYPTION_KEY no servidor.",
    );
  }
  if (!centralArquivosEncryptionKeyPromise) {
    centralArquivosEncryptionKeyPromise = (async () => {
      const raw = new TextEncoder().encode(CENTRAL_ARQUIVOS_ENCRYPTION_KEY);
      if (raw.length < 16) {
        throw new Error(
          "CENTRAL_ARQUIVOS_ENCRYPTION_KEY deve ter pelo menos 16 caracteres.",
        );
      }
      const digest = await crypto.subtle.digest("SHA-256", raw);
      return await crypto.subtle.importKey(
        "raw",
        digest,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"],
      );
    })();
  }
  return centralArquivosEncryptionKeyPromise;
};

const encryptCentralArquivosSecret = async (
  payload: CentralArquivosDriveSecretPayload,
) => {
  const key = await getCentralArquivosEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plain,
  );
  const envelope: EncryptedSecretEnvelope = {
    v: 1,
    alg: "AES-256-GCM",
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted)),
  };
  return JSON.stringify(envelope);
};

const decryptCentralArquivosSecret = async (
  encryptedValue: string,
): Promise<CentralArquivosDriveSecretPayload> => {
  const envelope = JSON.parse(encryptedValue || "{}") as EncryptedSecretEnvelope;
  if (
    !envelope || typeof envelope !== "object" ||
    !envelope.iv || !envelope.ciphertext
  ) {
    throw new Error("Formato de segredo criptografado inválido.");
  }
  const key = await getCentralArquivosEncryptionKey();
  const iv = fromBase64(String(envelope.iv));
  const ciphertext = fromBase64(String(envelope.ciphertext));
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  const parsed = JSON.parse(new TextDecoder().decode(decrypted)) as Partial<
    CentralArquivosDriveSecretPayload
  >;
  const serviceAccount = normalizeGoogleServiceAccountPayload(
    parsed?.service_account,
  );
  return {
    service_account: serviceAccount,
    updated_at: String(parsed?.updated_at || nowIso()),
    updated_by_email: parsed?.updated_by_email
      ? String(parsed.updated_by_email)
      : null,
    updated_by_nome: parsed?.updated_by_nome
      ? String(parsed.updated_by_nome)
      : null,
  };
};

const readSettingsValue = (key: string) => {
  try {
    const row = db.queryEntries<{ value: string; updated_at: string | null }>(
      `SELECT value, updated_at FROM ${TBL("settings")} WHERE key = ? LIMIT 1`,
      [key],
    )[0];
    if (!row?.value) return null;
    return {
      value: String(row.value),
      updated_at: row.updated_at ? String(row.updated_at) : null,
    };
  } catch (error) {
    console.warn("[settings] falha ao ler chave:", key, error);
    return null;
  }
};

const persistSettingsValue = (key: string, value: string) => {
  db.query(
    `INSERT INTO ${TBL("settings")} (key, value, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value],
  );
};

const deleteSettingsValue = (key: string) => {
  db.query(`DELETE FROM ${TBL("settings")} WHERE key = ?`, [key]);
};

const normalizeGoogleServiceAccountPayload = (
  value: unknown,
): GoogleServiceAccountPayload => {
  const source = (value && typeof value === "object")
    ? (value as Record<string, unknown>)
    : {};

  const type = String(source.type || "service_account").trim();
  if (type !== "service_account") {
    throw new Error("Arquivo inválido: esperado tipo service_account.");
  }

  const clientEmail = String(source.client_email || "").trim().toLowerCase();
  if (!clientEmail || !clientEmail.includes("@")) {
    throw new Error("Arquivo inválido: client_email ausente ou inválido.");
  }

  const privateKey = String(source.private_key || "")
    .replace(/\r/g, "")
    .replace(/\\n/g, "\n")
    .trim();
  if (
    !privateKey ||
    !privateKey.includes("BEGIN PRIVATE KEY") ||
    !privateKey.includes("END PRIVATE KEY")
  ) {
    throw new Error("Arquivo inválido: private_key ausente ou em formato inesperado.");
  }

  const tokenUri = String(source.token_uri || "https://oauth2.googleapis.com/token")
    .trim() || "https://oauth2.googleapis.com/token";

  return {
    type: "service_account",
    project_id: source.project_id ? String(source.project_id).trim() : null,
    private_key_id: source.private_key_id
      ? String(source.private_key_id).trim()
      : null,
    private_key: privateKey,
    client_email: clientEmail,
    client_id: source.client_id ? String(source.client_id).trim() : null,
    token_uri: tokenUri,
  };
};

const readStoredCentralArquivosDriveSecret = async () => {
  const stored = readSettingsValue(SETTINGS_KEY_CENTRAL_ARQUIVOS_GDRIVE_SECRET);
  if (!stored?.value) return null;
  const payload = await decryptCentralArquivosSecret(stored.value);
  return {
    ...payload,
    db_updated_at: stored.updated_at,
  };
};

const readStoredCentralArquivosDriveConfig = () => {
  const stored = readSettingsValue(SETTINGS_KEY_CENTRAL_ARQUIVOS_GDRIVE_CONFIG);
  if (!stored?.value) return null;
  try {
    const parsed = JSON.parse(stored.value) as Partial<CentralArquivosDriveConfigPayload>;
    const normalized = normalizeCentralArquivosDriveConfigInput(parsed);
    const parsedValidation = (
      parsed?.validation &&
        typeof parsed.validation === "object" &&
        (parsed.validation as Record<string, unknown>).status === "valid"
    )
      ? {
        status: "valid" as const,
        checked_at: String((parsed.validation as Record<string, unknown>).checked_at || ""),
        drive_name: normalizeDriveResourceId(
          (parsed.validation as Record<string, unknown>).drive_name,
        ),
        udocs_folder_name: normalizeDriveResourceId(
          (parsed.validation as Record<string, unknown>).udocs_folder_name,
        ),
        umarketing_folder_name: normalizeDriveResourceId(
          (parsed.validation as Record<string, unknown>).umarketing_folder_name,
        ),
      }
      : null;
    return {
      ...normalized,
      validation: parsedValidation,
      updated_at: parsed?.updated_at ? String(parsed.updated_at) : null,
      updated_by_email: parsed?.updated_by_email
        ? String(parsed.updated_by_email)
        : null,
      updated_by_nome: parsed?.updated_by_nome
        ? String(parsed.updated_by_nome)
        : null,
      db_updated_at: stored.updated_at,
    };
  } catch (error) {
    console.warn("[settings] falha ao ler configuração de pastas do Google Drive:", error);
    return null;
  }
};

const buildCentralArquivosDriveCredentialStatus = async () => {
  const secureStored = await readStoredCentralArquivosDriveSecret();
  if (secureStored?.service_account?.client_email) {
    return {
      configured: true,
      source: "secure_store" as const,
      credential: {
        project_id: secureStored.service_account.project_id,
        client_email_masked: maskEmail(secureStored.service_account.client_email),
        updated_at: secureStored.updated_at || secureStored.db_updated_at || null,
        updated_by: secureStored.updated_by_nome || secureStored.updated_by_email || null,
      },
    };
  }

  if (GDRIVE_SERVICE_ACCOUNT_EMAIL && GDRIVE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    return {
      configured: true,
      source: "env" as const,
      credential: {
        project_id: null,
        client_email_masked: maskEmail(GDRIVE_SERVICE_ACCOUNT_EMAIL),
        updated_at: null,
        updated_by: null,
      },
    };
  }

  return {
    configured: false,
    source: null as null | "env" | "secure_store",
    credential: null as null | {
      project_id: string | null;
      client_email_masked: string;
      updated_at: string | null;
      updated_by: string | null;
    },
  };
};

const buildCentralArquivosDriveConfigStatus = () => {
  const storedConfig = readStoredCentralArquivosDriveConfig();
  if (storedConfig) {
    return {
      source: "secure_store" as const,
      drive_id: storedConfig.drive_id,
      udocs_root_folder_id: storedConfig.udocs_root_folder_id,
      umarketing_root_folder_id: storedConfig.umarketing_root_folder_id,
      validation: storedConfig.validation || null,
      updated_at: storedConfig.updated_at || storedConfig.db_updated_at || null,
      updated_by: storedConfig.updated_by_nome || storedConfig.updated_by_email || null,
    };
  }

  return {
    source: "env" as const,
    drive_id: normalizeDriveResourceId(GDRIVE_DRIVE_ID),
    udocs_root_folder_id: GDRIVE_UDOCS_ROOT_FOLDER_ID,
    umarketing_root_folder_id: normalizeDriveResourceId(GDRIVE_UMARKETING_ROOT_FOLDER_ID),
    validation: null,
    updated_at: null,
    updated_by: null,
  };
};

const resolveCentralArquivosDriveRuntimeConfig = () => {
  const config = buildCentralArquivosDriveConfigStatus();
  return {
    driveId: config.drive_id,
    udocsRootFolderId: config.udocs_root_folder_id || "root",
    umarketingRootFolderId: config.umarketing_root_folder_id,
  };
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

const isConfederacaoSystemAdmin = (userData: any) => {
  if (!userData) return false;
  const papel = String(userData.papel || "").toLowerCase();
  if (papel !== "admin") return false;
  const cooperativaId = String(userData.cooperativa_id || "").trim();
  if (!cooperativaId) return false;
  const info = getCooperativaInfo(cooperativaId);
  return info?.tipo === "CONFEDERACAO";
};

const canManageCooperativa = (userData: any, cooperativaId: string) => {
  if (!userData || !cooperativaId) return false;

  const ownId = userData.cooperativa_id as string | null | undefined;
  const ownInfo = getCooperativaInfo(ownId);
  const ownTipo = (ownInfo?.tipo || "").toUpperCase();
  const papel = (userData.papel || "").toLowerCase();

  // Confederação: papel explícito OU admin "dentro" de uma cooperativa do tipo CONFEDERACAO.
  if (papel === "confederacao" || (papel === "admin" && ownTipo === "CONFEDERACAO")) {
    return true;
  }

  // Singular: admin só gerencia a própria cooperativa.
  if (papel === "admin" && ownTipo === "SINGULAR" && ownId === cooperativaId) {
    return true;
  }

  // Federação: papel explícito OU admin "dentro" de uma cooperativa do tipo FEDERACAO.
  if (papel === "federacao" || (papel === "admin" && ownTipo === "FEDERACAO")) {
    const ids = collectSingularesDaFederacao(ownId);
    return ids.includes(cooperativaId);
  }

  return false;
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

    // Preferir vínculo por ID (schema novo). Se a coluna não existir, cair no legado (FEDERACAO por nome).
    let ids: string[] = [];
    try {
      const singulares = db.queryEntries<any>(
        `SELECT id_singular FROM ${TBL("cooperativas")} WHERE federacao_id = ?`,
        [federacaoId],
      ) || [];
      ids = singulares.map((row) => row.id_singular).filter(Boolean);
    } catch (_) {
      const nomeFederacao = federacaoInfo.uniodonto;
      if (!nomeFederacao) return [federacaoId];
      const singulares = db.queryEntries<any>(
        `SELECT id_singular FROM ${TBL("cooperativas")} WHERE FEDERACAO = ?`,
        [nomeFederacao],
      ) || [];
      ids = singulares.map((row) => row.id_singular).filter(Boolean);
    }

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

  const associados = normalizeCooperativaIdsInput(userData.cooperativas_ids);
  const base = userData.cooperativa_id ? [userData.cooperativa_id] : [];
  const ids = Array.from(new Set([...associados, ...base].filter(Boolean)));
  return new Set(ids);
};

const buildCooperativaScopeClause = (
  userData: any,
  column = "cooperativa_solicitante_id",
) => {
  const visible = getVisibleCooperativas(userData);
  if (visible === null) {
    return { clause: "", params: [] as string[] };
  }
  const ids = Array.from(visible).filter((value) =>
    typeof value === "string" && value.trim().length > 0
  );
  if (ids.length === 0) {
    return { clause: "1=0", params: [] as string[] };
  }
  const placeholders = ids.map(() => "?").join(",");
  return {
    clause: `${column} IN (${placeholders})`,
    params: ids,
  };
};

const isMissingColumnError = (error: unknown, column: string) => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes(`no such column: ${column.toLowerCase()}`) ||
    message.includes(`column "${column.toLowerCase()}" does not exist`)
  );
};

const isCooperativaVisible = (userData: any, cooperativaId: string) => {
  const visible = getVisibleCooperativas(userData);
  if (visible === null) return true;
  return visible.has(cooperativaId);
};

// Regra de leitura: usuários do tipo "operador" podem visualizar cadastros e cidades
// de todas as cooperativas. Regras de edição continuam restritas por outros checks.
const canReadAnyCooperativaData = (userData: any) => {
  return Boolean(userData && String(userData.papel || "").toLowerCase() === "operador");
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
  dbClient: DbAdapter | null = null,
) => {
  try {
    const id = safeRandomId("cov");
    const email = userData.email || "";
    const nome = userData.nome || userData.display_name || email;
    const papel = userData.papel || "";
    const timestamp = new Date().toISOString();
    const target = (dbClient ?? (db as unknown as DbAdapter)) as DbAdapter;
    target.query(
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

const registrarLogCooperativaOverview = (
  cooperativaId: string,
  campo: string,
  acao: "create" | "update" | "delete",
  valorAnterior: string | null,
  valorNovo: string | null,
  userData: {
    email?: string;
    nome?: string;
    display_name?: string;
    papel?: string;
  },
  detalhes?: string,
  dbClient: DbAdapter | null = null,
) => {
  try {
    const id = safeRandomId("coopov");
    const email = userData.email || "";
    const nome = userData.nome || userData.display_name || email;
    const papel = userData.papel || "";
    const timestamp = new Date().toISOString();
    const target = (dbClient ?? (db as unknown as DbAdapter)) as DbAdapter;
    target.query(
      `INSERT INTO ${
        TBL("cooperativa_overview_logs")
      } (id, cooperativa_id, campo, acao, valor_anterior, valor_novo, usuario_email, usuario_nome, usuario_papel, detalhes, timestamp)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        cooperativaId,
        campo,
        acao,
        valorAnterior,
        valorNovo,
        email,
        nome,
        papel,
        detalhes ?? null,
        timestamp,
      ],
    );
  } catch (e) {
    console.warn("[cooperativas] falha ao registrar log de visão geral:", e);
  }
};

const resolveOverviewAction = (
  previousValue: string | null,
  nextValue: string | null,
): "create" | "update" | "delete" => {
  const prev = String(previousValue ?? "").trim();
  const next = String(nextValue ?? "").trim();
  if (!prev && next) return "create";
  if (prev && !next) return "delete";
  return "update";
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
  if ((user as any)?.approval_status &&
    (user as any).approval_status !== "approved") {
    return;
  }
  try {
    syncUserCooperativaAssociacoes(
      user.email,
      normalizeCooperativaIdsInput((user as any).cooperativas_ids).length
        ? normalizeCooperativaIdsInput((user as any).cooperativas_ids)
        : [user.cooperativa_id],
      user.cooperativa_id,
    );

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
        `UPDATE auth_users
            SET cooperativa_id = COALESCE(?, cooperativa_id),
                papel = COALESCE(papel, ?),
                module_access = COALESCE(module_access, '["hub"]')
          WHERE email = ?`,
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
        WHERE cooperativa_id = ?
       UNION
       SELECT au.email, COALESCE(au.display_name, au.nome, au.email) AS nome, auc.cooperativa_id AS cooperativa_id, COALESCE(au.ativo, 1) AS ativo
         FROM auth_users au
         JOIN auth_user_cooperativas auc ON auc.user_email = au.email
        WHERE auc.cooperativa_id = ?`,
      [cooperativaId, cooperativaId],
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

type ArquivoModule = "udocs" | "umarketing";

type ArquivoPermissionAction = "view" | "download";

type ArquivoItemRecord = {
  id: string;
  drive_file_id: string;
  modulo: ArquivoModule;
  titulo: string;
  categoria: string;
  ano: number | null;
  mime_type: string;
  item_tipo: ArquivoItemTipo;
  parent_drive_file_id: string | null;
  ordem_manual: number | null;
  tamanho_bytes: number;
  drive_modified_at: string | null;
  drive_created_at: string | null;
  preview_url: string | null;
  download_url: string | null;
  checksum: string | null;
  cooperativa_scope: string | null;
  ativo: boolean;
  sincronizado_em: string | null;
  criado_em: string | null;
};

type ArquivoAclRow = {
  id: string;
  scope_type: string;
  scope_value: string | null;
  principal_type: string;
  principal_value: string;
  can_view: number;
  can_download: number;
  effect: string;
  ativo: number;
};

type ArquivoAccessContext = {
  email: string;
  role: string;
  cooperativas: Set<string>;
  grupos: Set<string>;
  allCooperativas: boolean;
  isConfederacaoAdmin: boolean;
};

type DriveRepoEntry = {
  id: string;
  module: ArquivoModule;
  name: string;
  mimeType: string;
  itemTipo: ArquivoItemTipo;
  parentDriveFileId: string | null;
  size?: string;
  modifiedTime?: string;
  createdTime?: string;
  parents?: string[];
  webViewLink?: string;
  webContentLink?: string;
  md5Checksum?: string;
  category: string;
};

type DriveCategoryRoot = {
  module: ArquivoModule;
  category: string;
  folderId: string;
};

type DriveReadOptions = {
  driveId?: string | null;
};

type DriveRuntimeCredentials = {
  serviceAccountEmail: string;
  privateKey: string;
  source: "secure_store" | "env";
};

let gdriveTokenCache: { token: string; expiresAt: number } | null = null;
let arquivosAuditCleanupLastAt = 0;

const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_FILES_API = "https://www.googleapis.com/drive/v3/files";
const GOOGLE_DRIVE_DRIVES_API = "https://www.googleapis.com/drive/v3/drives";
const MAX_DRIVE_FULLTEXT_RESULTS = 1200;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetryGoogleStatus = (status: number) => status === 429 || status >= 500;

const fetchGoogleWithRetry = async (
  input: string,
  init: RequestInit,
  context: string,
  attempts = 4,
) => {
  let lastStatus = 0;
  let lastBody = "";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(input, init);
    if (response.ok) return response;
    lastStatus = response.status;
    lastBody = await response.text().catch(() => "");
    const retryable = shouldRetryGoogleStatus(response.status) && attempt < attempts;
    if (!retryable) {
      throw new Error(`${context} (${response.status}): ${lastBody.slice(0, 500)}`);
    }
    const delayMs = 300 * attempt + Math.floor(Math.random() * 200);
    console.warn(
      `[gdrive] erro transitório (${response.status}) em ${context}; tentativa ${attempt}/${attempts}.`,
    );
    await sleep(delayMs);
  }
  throw new Error(`${context} (${lastStatus || 0}): ${String(lastBody || "").slice(0, 500)}`);
};

const escapeDriveQueryLiteral = (value: string) =>
  String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");

const tokenizeSearchQuery = (value: string) => {
  const normalized = normalizeArquivoComparable(value);
  const tokens = normalized
    .split(/\s+/g)
    .map((token) => token.trim())
    .filter(Boolean);
  return Array.from(new Set(tokens));
};

const buildSearchSnippet = (text: string, queryTokens: string[]) => {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (!queryTokens.length) return clean.slice(0, 180);
  const normalized = normalizeArquivoComparable(clean);
  let bestIndex = -1;
  let bestToken = "";
  for (const token of queryTokens) {
    if (!token) continue;
    const idx = normalized.indexOf(token);
    if (idx >= 0 && (bestIndex < 0 || idx < bestIndex)) {
      bestIndex = idx;
      bestToken = token;
    }
  }
  if (bestIndex < 0) return clean.slice(0, 180);
  const start = Math.max(0, bestIndex - 48);
  const end = Math.min(clean.length, bestIndex + Math.max(bestToken.length, 1) + 72);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < clean.length ? "…" : "";
  return `${prefix}${clean.slice(start, end)}${suffix}`.slice(0, 220);
};

const normalizeArquivoComparable = (value: unknown) =>
  normalizeArquivoCategoryLabel(value).toLowerCase();

const toBase64Url = (input: Uint8Array) => {
  let binary = "";
  for (const byte of input) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const toBase64UrlString = (input: string) =>
  toBase64Url(new TextEncoder().encode(input));

const pemToPkcs8 = (pem: string) => {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const assertDriveEnabled = () => {
  if (!GDRIVE_ENABLED) {
    throw new Error("Integração com Google Drive desativada.");
  }
};

const resolveDriveRuntimeCredentials = async (): Promise<DriveRuntimeCredentials> => {
  assertDriveEnabled();

  const secureStored = await readStoredCentralArquivosDriveSecret().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Credencial criptografada inválida da UDocs: ${message.slice(0, 200)}`,
    );
  });
  if (secureStored?.service_account?.client_email && secureStored?.service_account?.private_key) {
    return {
      serviceAccountEmail: secureStored.service_account.client_email,
      privateKey: secureStored.service_account.private_key,
      source: "secure_store",
    };
  }

  if (GDRIVE_SERVICE_ACCOUNT_EMAIL && GDRIVE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    return {
      serviceAccountEmail: GDRIVE_SERVICE_ACCOUNT_EMAIL,
      privateKey: GDRIVE_SERVICE_ACCOUNT_PRIVATE_KEY,
      source: "env",
    };
  }

  throw new Error(
    "Credenciais do Google Drive não configuradas. Cadastre o JSON do Service Account em Configurações > Hub ou defina GDRIVE_SERVICE_ACCOUNT_EMAIL/GDRIVE_SERVICE_ACCOUNT_PRIVATE_KEY.",
  );
};

const getDriveAccessToken = async () => {
  assertDriveEnabled();
  if (gdriveTokenCache && gdriveTokenCache.expiresAt > Date.now() + 30_000) {
    return gdriveTokenCache.token;
  }
  const driveCredentials = await resolveDriveRuntimeCredentials();

  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: driveCredentials.serviceAccountEmail,
    scope: GDRIVE_SCOPES,
    aud: GOOGLE_OAUTH_TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };

  const encodedHeader = toBase64UrlString(JSON.stringify(header));
  const encodedPayload = toBase64UrlString(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(driveCredentials.privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(signingInput),
  );
  const signature = toBase64Url(new Uint8Array(signatureBuffer));
  const assertion = `${signingInput}.${signature}`;

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    const errorPayload = await response.text().catch(() => "");
    throw new Error(
      `[gdrive] falha ao obter access token (${response.status}): ${errorPayload.slice(0, 500)}`,
    );
  }
  const payloadToken = await response.json() as {
    access_token?: string;
    expires_in?: number;
  };
  const accessToken = payloadToken.access_token;
  if (!accessToken) {
    throw new Error("[gdrive] token não retornado pela API do Google.");
  }
  const ttlSeconds = Math.max(120, Number(payloadToken.expires_in ?? 3600));
  gdriveTokenCache = {
    token: accessToken,
    expiresAt: Date.now() + (ttlSeconds - 60) * 1000,
  };
  return accessToken;
};

const getDriveParentQueryToken = (parentId: string) =>
  parentId === "root" ? "root" : parentId;

const listDriveChildren = async (
  accessToken: string,
  parentId: string,
  pageToken?: string,
  options: DriveReadOptions = {},
) => {
  const params = new URLSearchParams();
  params.set(
    "q",
    `'${getDriveParentQueryToken(parentId)}' in parents and trashed = false`,
  );
  params.set(
    "fields",
    "nextPageToken,files(id,name,mimeType,size,modifiedTime,createdTime,parents,webViewLink,webContentLink,md5Checksum,shortcutDetails(targetId,targetMimeType))",
  );
  params.set("pageSize", "1000");
  params.set("supportsAllDrives", "true");
  params.set("includeItemsFromAllDrives", "true");
  const resolvedDriveId = normalizeDriveResourceId(options.driveId ?? GDRIVE_DRIVE_ID);
  if (resolvedDriveId) {
    params.set("corpora", "drive");
    params.set("driveId", resolvedDriveId);
  }
  if (pageToken) {
    params.set("pageToken", pageToken);
  }

  const response = await fetchGoogleWithRetry(
    `${GOOGLE_DRIVE_FILES_API}?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    `[gdrive] falha ao listar pasta ${parentId}`,
  );
  const payload = await response.json() as {
    files?: Array<Record<string, unknown>>;
    nextPageToken?: string;
  };
  return payload;
};

const listAllDriveChildren = async (
  accessToken: string,
  parentId: string,
  options: DriveReadOptions = {},
) => {
  const items: Array<Record<string, unknown>> = [];
  let nextPageToken: string | undefined;
  do {
    const page = await listDriveChildren(
      accessToken,
      parentId,
      nextPageToken,
      options,
    );
    if (Array.isArray(page.files)) {
      items.push(...page.files);
    }
    nextPageToken = page.nextPageToken;
  } while (nextPageToken);
  return items;
};

const searchDriveFullTextIds = async (
  accessToken: string,
  query: string,
  options: DriveReadOptions = {},
) => {
  const tokens = tokenizeSearchQuery(query).slice(0, 6);
  if (!tokens.length) return new Set<string>();

  const qClauses = ["trashed = false", ...tokens.map((token) =>
    `fullText contains '${escapeDriveQueryLiteral(token)}'`
  )];
  const found = new Set<string>();
  let nextPageToken: string | undefined;

  do {
    const params = new URLSearchParams();
    params.set("q", qClauses.join(" and "));
    params.set("fields", "nextPageToken,files(id)");
    params.set("pageSize", "200");
    params.set("supportsAllDrives", "true");
    params.set("includeItemsFromAllDrives", "true");
    const resolvedDriveId = normalizeDriveResourceId(options.driveId ?? GDRIVE_DRIVE_ID);
    if (resolvedDriveId) {
      params.set("corpora", "drive");
      params.set("driveId", resolvedDriveId);
    }
    if (nextPageToken) {
      params.set("pageToken", nextPageToken);
    }

    const response = await fetchGoogleWithRetry(
      `${GOOGLE_DRIVE_FILES_API}?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      "[gdrive] falha em busca fullText",
    );
    const payload = await response.json() as {
      files?: Array<{ id?: string }>;
      nextPageToken?: string;
    };
    for (const row of payload.files || []) {
      const id = String(row.id || "").trim();
      if (!id) continue;
      found.add(id);
      if (found.size >= MAX_DRIVE_FULLTEXT_RESULTS) {
        return found;
      }
    }
    nextPageToken = payload.nextPageToken;
  } while (nextPageToken);

  return found;
};

const discoverDriveCategoryRoots = async (
  accessToken: string,
  rootFolderId: string,
  module: ArquivoModule,
  options: DriveReadOptions = {},
): Promise<DriveCategoryRoot[]> => {
  if (Object.keys(GDRIVE_CATEGORY_FOLDERS).length > 0) {
    return Object.entries(GDRIVE_CATEGORY_FOLDERS).map(([category, folderId]) => ({
      module,
      category,
      folderId,
    }));
  }

  const topFolders = await listAllDriveChildren(accessToken, rootFolderId, options);
  const folders = topFolders.filter((item) =>
    String(item.mimeType || "") === "application/vnd.google-apps.folder"
  );
  if (folders.length === 0) {
    return [{ module, category: "Geral", folderId: rootFolderId }];
  }

  return folders
    .map((item) => ({
      module,
      category: normalizeArquivoCategoryLabel(item.name) || "Geral",
      folderId: String(item.id || "").trim(),
    }))
    .filter((item) => item.folderId);
};

const collectDriveEntriesByCategory = async (
  accessToken: string,
  root: DriveCategoryRoot,
  options: DriveReadOptions = {},
) => {
  const entries: DriveRepoEntry[] = [];
  const queue: Array<{ folderId: string; isCategoryRoot: boolean }> = [
    { folderId: root.folderId, isCategoryRoot: true },
  ];
  const visited = new Set<string>();

  const pushEntry = (
    rawItem: Record<string, unknown>,
    itemId: string,
    itemMimeType: string,
    itemTipo: ArquivoItemTipo,
    parentDriveFileId: string | null,
  ) => {
    entries.push({
      id: itemId,
      module: root.module,
      name: String(rawItem.name || itemId),
      mimeType: itemMimeType || "application/octet-stream",
      itemTipo,
      parentDriveFileId,
      size: rawItem.size ? String(rawItem.size) : undefined,
      modifiedTime: rawItem.modifiedTime ? String(rawItem.modifiedTime) : undefined,
      createdTime: rawItem.createdTime ? String(rawItem.createdTime) : undefined,
      parents: Array.isArray(rawItem.parents)
        ? rawItem.parents.map((item) => String(item))
        : [],
      webViewLink: rawItem.webViewLink ? String(rawItem.webViewLink) : undefined,
      webContentLink: rawItem.webContentLink ? String(rawItem.webContentLink) : undefined,
      md5Checksum: rawItem.md5Checksum ? String(rawItem.md5Checksum) : undefined,
      category: root.category,
    });
  };

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current?.folderId || visited.has(current.folderId)) continue;
    visited.add(current.folderId);

    const children = await listAllDriveChildren(accessToken, current.folderId, options);
    for (const rawItem of children) {
      const id = String(rawItem.id || "").trim();
      if (!id) continue;

      const ownMimeType = String(rawItem.mimeType || "").trim();
      const parentDriveFileId = current.isCategoryRoot ? null : current.folderId;
      if (ownMimeType === "application/vnd.google-apps.shortcut") {
        const shortcutDetails = rawItem.shortcutDetails &&
            typeof rawItem.shortcutDetails === "object"
          ? rawItem.shortcutDetails as Record<string, unknown>
          : null;
        const targetId = String(shortcutDetails?.targetId || "").trim();
        const targetMimeType = String(shortcutDetails?.targetMimeType || "").trim();
        if (!targetId) continue;

        if (targetMimeType === "application/vnd.google-apps.folder") {
          pushEntry(
            rawItem,
            targetId,
            targetMimeType || "application/vnd.google-apps.folder",
            "pasta",
            parentDriveFileId,
          );
          queue.push({ folderId: targetId, isCategoryRoot: false });
          continue;
        }

        pushEntry(
          rawItem,
          targetId,
          targetMimeType || "application/octet-stream",
          "arquivo",
          parentDriveFileId,
        );
        continue;
      }

      if (ownMimeType === "application/vnd.google-apps.folder") {
        pushEntry(rawItem, id, ownMimeType, "pasta", parentDriveFileId);
        queue.push({ folderId: id, isCategoryRoot: false });
        continue;
      }

      pushEntry(rawItem, id, ownMimeType, "arquivo", parentDriveFileId);
    }
  }

  return entries;
};

const getDriveFileMetadata = async (
  accessToken: string,
  fileId: string,
) => {
  const normalized = String(fileId || "").trim();
  if (!normalized) {
    throw new Error("ID de pasta inválido.");
  }
  const params = new URLSearchParams();
  params.set("fields", "id,name,mimeType,driveId,trashed,parents");
  params.set("supportsAllDrives", "true");
  const response = await fetchGoogleWithRetry(
    `${GOOGLE_DRIVE_FILES_API}/${encodeURIComponent(normalized)}?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    `ID de pasta ${normalized} não acessível`,
  );
  return await response.json() as {
    id?: string;
    name?: string;
    mimeType?: string;
    driveId?: string;
    trashed?: boolean;
    parents?: string[];
  };
};

const getSharedDriveMetadata = async (
  accessToken: string,
  driveId: string,
) => {
  const normalized = String(driveId || "").trim();
  if (!normalized) {
    throw new Error("Shared Drive ID é obrigatório.");
  }
  const params = new URLSearchParams();
  params.set("fields", "id,name");
  const response = await fetchGoogleWithRetry(
    `${GOOGLE_DRIVE_DRIVES_API}/${encodeURIComponent(normalized)}?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    `Shared Drive ${normalized} não acessível`,
  );
  return await response.json() as {
    id?: string;
    name?: string;
  };
};

const validateCentralArquivosDriveConfig = async (
  config: {
    drive_id: string | null;
    udocs_root_folder_id: string;
    umarketing_root_folder_id: string | null;
  },
) => {
  const driveId = normalizeDriveResourceId(config.drive_id);
  const udocsRootFolderId = String(config.udocs_root_folder_id || "").trim();
  const umarketingRootFolderId = String(config.umarketing_root_folder_id || "").trim();

  if (!driveId) {
    throw new Error("Informe o Shared Drive ID (U-Hub).");
  }
  if (!udocsRootFolderId) {
    throw new Error("Informe a pasta raiz do UDocs.");
  }
  if (!umarketingRootFolderId) {
    throw new Error("Informe a pasta raiz do UMkt.");
  }
  if (udocsRootFolderId === umarketingRootFolderId) {
    throw new Error("As pastas raiz de UDocs e UMkt devem ser diferentes.");
  }

  const accessToken = await getDriveAccessToken();
  const sharedDrive = await getSharedDriveMetadata(accessToken, driveId);
  const udocsFolder = await getDriveFileMetadata(accessToken, udocsRootFolderId);
  const umarketingFolder = await getDriveFileMetadata(accessToken, umarketingRootFolderId);

  for (const [label, folder] of [
    ["UDocs", udocsFolder],
    ["UMkt", umarketingFolder],
  ] as const) {
    if (String(folder.mimeType || "") !== "application/vnd.google-apps.folder") {
      throw new Error(`O ID informado para ${label} não é de pasta no Google Drive.`);
    }
    if (folder.trashed) {
      throw new Error(`A pasta informada para ${label} está na lixeira.`);
    }
    const folderDriveId = normalizeDriveResourceId(folder.driveId);
    if (!folderDriveId) {
      throw new Error(
        `A pasta de ${label} não está em um Shared Drive acessível pela Service Account.`,
      );
    }
    if (folderDriveId !== driveId) {
      throw new Error(`A pasta de ${label} não pertence ao Shared Drive informado (U-Hub).`);
    }
  }

  return {
    status: "valid" as const,
    checked_at: nowIso(),
    drive_name: normalizeDriveResourceId(sharedDrive.name),
    udocs_folder_name: normalizeDriveResourceId(udocsFolder.name),
    umarketing_folder_name: normalizeDriveResourceId(umarketingFolder.name),
  };
};

const resolveArquivoAno = (title: string, modifiedAt?: string, category?: string) => {
  const fromTitle = `${title || ""} ${category || ""}`.match(/\b(19|20)\d{2}\b/);
  if (fromTitle?.[0]) return Number(fromTitle[0]);
  if (modifiedAt) {
    const year = new Date(modifiedAt).getUTCFullYear();
    if (Number.isFinite(year) && year > 1900) return year;
  }
  return null;
};

const syncArquivosFromGoogleDrive = async (
  modules: ArquivoModule[] = ["udocs", "umarketing"],
) => {
  const accessToken = await getDriveAccessToken();
  const runtimeConfig = resolveCentralArquivosDriveRuntimeConfig();
  const readOptions: DriveReadOptions = { driveId: runtimeConfig.driveId };
  const synchronizedAt = nowIso();

  const targetModules = Array.from(new Set(modules.map((item) =>
    parseArquivoModule(item, "udocs")
  )));
  const moduleRoots: Array<{ module: ArquivoModule; rootFolderId: string }> = [];
  for (const module of targetModules) {
    const rootFolderId = module === "umarketing"
      ? normalizeDriveResourceId(runtimeConfig.umarketingRootFolderId)
      : normalizeDriveResourceId(runtimeConfig.udocsRootFolderId);
    if (!rootFolderId) continue;
    moduleRoots.push({ module, rootFolderId });
  }
  if (moduleRoots.length === 0) {
      throw new Error(
      "Pastas raiz não configuradas para sincronização. Configure UDocs/UMkt em Configurações > Hub.",
      );
  }

  const categoryRoots: DriveCategoryRoot[] = [];
  for (const moduleRoot of moduleRoots) {
    const rootMetadata = await getDriveFileMetadata(accessToken, moduleRoot.rootFolderId);
    if (String(rootMetadata.mimeType || "") !== "application/vnd.google-apps.folder") {
      throw new Error(
        `A pasta raiz configurada para ${getModuloLabel(moduleRoot.module)} não é uma pasta válida no Google Drive.`,
      );
    }
    const rootDriveId = normalizeDriveResourceId(rootMetadata.driveId);
    if (!rootDriveId) {
      throw new Error(
        `A pasta raiz de ${getModuloLabel(moduleRoot.module)} não está em um Shared Drive acessível pela Service Account.`,
      );
    }
    if (runtimeConfig.driveId && rootDriveId !== runtimeConfig.driveId) {
      throw new Error(
        `A pasta raiz de ${getModuloLabel(moduleRoot.module)} não pertence ao Shared Drive configurado.`,
      );
    }

    const discovered = await discoverDriveCategoryRoots(
      accessToken,
      moduleRoot.rootFolderId,
      moduleRoot.module,
      readOptions,
    );
    categoryRoots.push(...discovered);
  }

  const collectedEntries: DriveRepoEntry[] = [];
  for (const root of categoryRoots) {
    const files = await collectDriveEntriesByCategory(accessToken, root, readOptions);
    collectedEntries.push(...files);
  }

  const seenByModule: Record<ArquivoModule, string[]> = {
    udocs: [],
    umarketing: [],
  };
  const orderByPath = new Map<string, number>();
  for (const file of collectedEntries) {
    const driveFileId = String(file.id || "").trim();
    if (!driveFileId) continue;
    seenByModule[file.module].push(driveFileId);

    const title = String(file.name || driveFileId).trim() || driveFileId;
    const category = normalizeArquivoCategoryLabel(file.category) || "Geral";
    const isFolder = file.itemTipo === "pasta";
    const year = isFolder ? null : resolveArquivoAno(title, file.modifiedTime, category);
    const mimeType = String(file.mimeType || "").trim() || "application/octet-stream";
    const size = isFolder ? 0 : Number(file.size || 0);
    const modifiedAt = file.modifiedTime || null;
    const createdAt = file.createdTime || null;
    const checksum = isFolder ? null : (file.md5Checksum || null);
    const previewUrl = isFolder ? null : (file.webViewLink || null);
    const downloadUrl = isFolder ? null : (file.webContentLink || null);
    const parentDriveFileId = String(file.parentDriveFileId || "").trim() || null;
    const orderKey = `${file.module}::${parentDriveFileId || "__root__"}`;
    const nextOrder = (orderByPath.get(orderKey) || 0) + 10;
    orderByPath.set(orderKey, nextOrder);

    db.query(
      `INSERT INTO ${TBL("arquivos_itens")}
        (id, drive_file_id, modulo, titulo, categoria, ano, mime_type, item_tipo, parent_drive_file_id, ordem_manual, tamanho_bytes, drive_modified_at, drive_created_at, preview_url, download_url, checksum, ativo, sincronizado_em, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(drive_file_id) DO UPDATE SET
         modulo = excluded.modulo,
         titulo = excluded.titulo,
         categoria = excluded.categoria,
         ano = excluded.ano,
         mime_type = excluded.mime_type,
         item_tipo = excluded.item_tipo,
         parent_drive_file_id = excluded.parent_drive_file_id,
         ordem_manual = COALESCE(ordem_manual, excluded.ordem_manual),
         tamanho_bytes = excluded.tamanho_bytes,
         drive_modified_at = excluded.drive_modified_at,
         drive_created_at = excluded.drive_created_at,
         preview_url = excluded.preview_url,
         download_url = excluded.download_url,
         checksum = excluded.checksum,
         ativo = 1,
         sincronizado_em = excluded.sincronizado_em`,
      [
        safeRandomId("arq"),
        driveFileId,
        file.module,
        title,
        category,
        year,
        mimeType,
        isFolder ? "pasta" : "arquivo",
        parentDriveFileId,
        nextOrder,
        Number.isFinite(size) ? size : 0,
        modifiedAt,
        createdAt,
        previewUrl,
        downloadUrl,
        checksum,
        synchronizedAt,
        synchronizedAt,
      ],
    );
  }

  for (const moduleRoot of moduleRoots) {
    const seenIds = Array.from(new Set(seenByModule[moduleRoot.module]));
    if (seenIds.length > 0) {
      const placeholders = seenIds.map(() => "?").join(",");
      db.query(
        `UPDATE ${TBL("arquivos_itens")}
            SET ativo = 0, sincronizado_em = ?
          WHERE LOWER(COALESCE(modulo, 'udocs')) = LOWER(?)
            AND drive_file_id NOT IN (${placeholders})`,
        [synchronizedAt, moduleRoot.module, ...seenIds],
      );
    } else {
      db.query(
        `UPDATE ${TBL("arquivos_itens")}
            SET ativo = 0, sincronizado_em = ?
          WHERE LOWER(COALESCE(modulo, 'udocs')) = LOWER(?)`,
        [synchronizedAt, moduleRoot.module],
      );
    }
  }

  db.query(
    `INSERT INTO ${TBL("arquivos_sync_state")}
      (provider, cursor_token, last_sync_at, last_status, last_error, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(provider) DO UPDATE SET
       cursor_token = excluded.cursor_token,
       last_sync_at = excluded.last_sync_at,
       last_status = excluded.last_status,
       last_error = excluded.last_error,
       updated_at = excluded.updated_at`,
    ["google_drive", null, synchronizedAt, "ok", null, synchronizedAt],
  );

  const moduleSummaries = moduleRoots.map(({ module, rootFolderId }) => ({
    module,
    root_folder_id: rootFolderId,
    files: Array.from(new Set(seenByModule[module])).length,
    categories: categoryRoots.filter((item) => item.module === module).length,
  }));

  return {
    totalCategories: categoryRoots.length,
    totalFiles: collectedEntries.length,
    synchronizedAt,
    drive: {
      drive_id: runtimeConfig.driveId,
      modules: moduleSummaries,
    },
  };
};

const mapArquivoItemRecord = (row: Record<string, unknown>): ArquivoItemRecord => ({
  id: String(row.id || ""),
  drive_file_id: String(row.drive_file_id || ""),
  modulo: parseArquivoModule(row.modulo, "udocs"),
  titulo: String(row.titulo || row.name || row.id || ""),
  categoria: String(row.categoria || "Geral"),
  ano: row.ano != null ? Number(row.ano) : null,
  mime_type: String(row.mime_type || "application/octet-stream"),
  item_tipo: String(row.item_tipo || "").trim().toLowerCase() === "pasta"
    ? "pasta"
    : resolveArquivoItemTipo({
      mime_type: String(row.mime_type || "application/octet-stream"),
      titulo: String(row.titulo || row.name || row.id || ""),
    }),
  parent_drive_file_id: row.parent_drive_file_id
    ? String(row.parent_drive_file_id).trim() || null
    : null,
  ordem_manual: row.ordem_manual != null && Number.isFinite(Number(row.ordem_manual))
    ? Number(row.ordem_manual)
    : null,
  tamanho_bytes: Number(row.tamanho_bytes || 0),
  drive_modified_at: row.drive_modified_at ? String(row.drive_modified_at) : null,
  drive_created_at: row.drive_created_at ? String(row.drive_created_at) : null,
  preview_url: row.preview_url ? String(row.preview_url) : null,
  download_url: row.download_url ? String(row.download_url) : null,
  checksum: row.checksum ? String(row.checksum) : null,
  cooperativa_scope: row.cooperativa_scope ? String(row.cooperativa_scope) : null,
  ativo: Number(row.ativo ?? 1) !== 0,
  sincronizado_em: row.sincronizado_em ? String(row.sincronizado_em) : null,
  criado_em: row.criado_em ? String(row.criado_em) : null,
});

const getArquivoById = (id: string, module: ArquivoModule = "udocs") => {
  const normalized = String(id || "").trim();
  if (!normalized) return null;
  const row = db.queryEntries<Record<string, unknown>>(
    `SELECT *
       FROM ${TBL("arquivos_itens")}
      WHERE (id = ? OR drive_file_id = ?)
        AND LOWER(COALESCE(modulo, 'udocs')) = LOWER(?)
      LIMIT 1`,
    [normalized, normalized, module],
  )[0];
  return row ? mapArquivoItemRecord(row) : null;
};

const getActiveArquivoAclRows = () => {
  try {
    return db.queryEntries<ArquivoAclRow>(
      `SELECT *
         FROM ${TBL("arquivos_acl")}
        WHERE COALESCE(ativo, 1) = 1`,
    ) || [];
  } catch (error) {
    console.warn("[arquivos] falha ao carregar ACL:", error);
    return [] as ArquivoAclRow[];
  }
};

const getArquivoUserGroups = (email?: string | null) => {
  if (!email) return [] as string[];
  try {
    const rows = db.queryEntries<{ grupo_id: string }>(
      `SELECT grupo_id
         FROM ${TBL("arquivos_grupo_membros")}
        WHERE LOWER(user_email) = LOWER(?)
          AND COALESCE(ativo, 1) = 1`,
      [email],
    ) || [];
    return rows.map((row) => String(row.grupo_id || "").trim()).filter(Boolean);
  } catch (error) {
    console.warn("[arquivos] falha ao carregar grupos do usuário:", error);
    return [] as string[];
  }
};

const buildArquivoAccessContext = (userData: any): ArquivoAccessContext => {
  const email = String(userData?.email || "").trim().toLowerCase();
  const role = String(userData?.papel || "operador").trim().toLowerCase();
  const associated = normalizeCooperativaIdsInput(userData?.cooperativas_ids);
  const primary = String(userData?.cooperativa_id || "").trim();
  if (primary && !associated.includes(primary)) associated.push(primary);
  const visible = getVisibleCooperativas(userData);
  const allCooperativas = visible === null;
  const cooperativas = new Set<string>(
    (allCooperativas
      ? associated
      : Array.from(visible || new Set<string>()))
      .map((item) => String(item || "").trim().toLowerCase())
      .filter(Boolean),
  );
  const groups = getArquivoUserGroups(email);
  return {
    email,
    role,
    cooperativas,
    grupos: new Set(groups.map((item) => item.toLowerCase())),
    allCooperativas,
    isConfederacaoAdmin: isConfederacaoSystemAdmin(userData),
  };
};

const aclPrincipalMatches = (
  row: ArquivoAclRow,
  ctx: ArquivoAccessContext,
) => {
  const principalType = String(row.principal_type || "").trim().toLowerCase();
  const principalValue = String(row.principal_value || "").trim().toLowerCase();
  if (!principalType || !principalValue) return false;
  if (principalType === "all" || principalType === "*") return true;
  if (principalType === "user" || principalType === "usuario") {
    return ctx.email === principalValue;
  }
  if (principalType === "role" || principalType === "papel") {
    return ctx.role === principalValue;
  }
  if (principalType === "cooperativa" || principalType === "singular") {
    return ctx.cooperativas.has(principalValue);
  }
  if (principalType === "grupo" || principalType === "group") {
    return ctx.grupos.has(principalValue);
  }
  return false;
};

const aclScopeMatches = (row: ArquivoAclRow, item: ArquivoItemRecord) => {
  const scopeType = String(row.scope_type || "global").trim().toLowerCase();
  const scopeValue = String(row.scope_value || "").trim();
  if (scopeType === "global") return true;
  if (scopeType === "categoria") {
    return normalizeArquivoComparable(scopeValue) ===
      normalizeArquivoComparable(item.categoria);
  }
  if (scopeType === "arquivo") {
    return scopeValue === item.id || scopeValue === item.drive_file_id;
  }
  return false;
};

const aclActionAllowed = (row: ArquivoAclRow, action: ArquivoPermissionAction) => {
  if (action === "download") {
    return Number(row.can_download ?? 0) !== 0;
  }
  return Number(row.can_view ?? 0) !== 0;
};

const canAccessArquivo = (
  item: ArquivoItemRecord,
  action: ArquivoPermissionAction,
  userData: any,
  aclRows: ArquivoAclRow[],
  accessContext?: ArquivoAccessContext,
) => {
  if (INSECURE_MODE) return true;
  const ctx = accessContext || buildArquivoAccessContext(userData);
  if (ctx.isConfederacaoAdmin) return true;

  const coopScope = String(item.cooperativa_scope || "").trim().toLowerCase();
  if (coopScope && !ctx.allCooperativas && !ctx.cooperativas.has(coopScope)) {
    return false;
  }

  const scopedRows = aclRows.filter((row) => aclScopeMatches(row, item));
  if (scopedRows.length === 0) {
    return true;
  }

  const matchingRows = scopedRows.filter((row) => aclPrincipalMatches(row, ctx));
  if (matchingRows.length === 0) {
    return false;
  }

  const hasDeny = matchingRows.some((row) =>
    String(row.effect || "allow").trim().toLowerCase() === "deny" &&
    aclActionAllowed(row, action)
  );
  if (hasDeny) return false;

  return matchingRows.some((row) =>
    String(row.effect || "allow").trim().toLowerCase() !== "deny" &&
    aclActionAllowed(row, action)
  );
};

const resolveRequestIp = (c: any) => {
  const forwardedFor = c.req.header("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }
  return c.req.header("x-real-ip") || null;
};

const maybeCleanupArquivosAuditRetention = () => {
  const now = Date.now();
  if (arquivosAuditCleanupLastAt && now - arquivosAuditCleanupLastAt < 6 * 60 * 60 * 1000) {
    return;
  }
  arquivosAuditCleanupLastAt = now;
  try {
    const cutoff = new Date(
      Date.now() - ARQUIVOS_AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    db.query(
      `DELETE FROM ${TBL("arquivos_auditoria")} WHERE created_at < ?`,
      [cutoff],
    );
  } catch (error) {
    console.warn("[arquivos] falha ao aplicar retenção de auditoria:", error);
  }
};

const registrarAuditoriaArquivos = (
  c: any,
  userData: any,
  acao: string,
  resultado: "ok" | "deny" | "error",
  options: {
    arquivoId?: string | null;
    driveFileId?: string | null;
    detalhes?: unknown;
  } = {},
) => {
  try {
    const detalhes = (() => {
      if (options.detalhes == null) return null;
      if (typeof options.detalhes === "string") return truncateText(options.detalhes, 1200);
      try {
        return truncateText(JSON.stringify(options.detalhes), 1200);
      } catch {
        return null;
      }
    })();
    db.query(
      `INSERT INTO ${TBL("arquivos_auditoria")}
        (id, arquivo_id, drive_file_id, acao, resultado, usuario_email, usuario_nome, usuario_papel, cooperativa_id, ip, user_agent, detalhes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        safeRandomId("arqaudit"),
        options.arquivoId || null,
        options.driveFileId || null,
        acao,
        resultado,
        userData?.email || null,
        userData?.display_name || userData?.nome || userData?.email || null,
        userData?.papel || null,
        userData?.cooperativa_id || null,
        resolveRequestIp(c),
        c.req.header("user-agent") || null,
        detalhes,
        nowIso(),
      ],
    );
    maybeCleanupArquivosAuditRetention();
  } catch (error) {
    console.warn("[arquivos] falha ao registrar auditoria:", error);
  }
};

const getMimeDefaultExtension = (mimeType: string) => {
  const normalized = String(mimeType || "").toLowerCase();
  if (normalized.includes("pdf")) return "pdf";
  if (normalized.includes("msword")) return "doc";
  if (normalized.includes("wordprocessingml")) return "docx";
  if (normalized.includes("spreadsheetml")) return "xlsx";
  if (normalized.includes("presentationml")) return "pptx";
  if (normalized.includes("image/jpeg")) return "jpg";
  if (normalized.includes("image/png")) return "png";
  if (normalized.includes("video/mp4")) return "mp4";
  if (normalized.includes("text/plain")) return "txt";
  return "";
};

const resolveGoogleExportMimeType = (
  sourceMimeType: string,
  action: ArquivoPermissionAction,
) => {
  const mime = String(sourceMimeType || "");
  if (!mime.startsWith("application/vnd.google-apps.")) return null;
  if (mime === "application/vnd.google-apps.spreadsheet") {
    return action === "download"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "application/pdf";
  }
  if (mime === "application/vnd.google-apps.presentation") {
    return action === "download"
      ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      : "application/pdf";
  }
  if (mime === "application/vnd.google-apps.document") {
    return action === "download"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/pdf";
  }
  if (mime === "application/vnd.google-apps.drawing") {
    return "application/pdf";
  }
  return "application/pdf";
};

const buildArquivoFilename = (item: ArquivoItemRecord, fallbackMimeType?: string | null) => {
  const baseName = String(item.titulo || item.drive_file_id || "arquivo")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const safeBase = baseName || "arquivo";
  if (/\.[A-Za-z0-9]{2,5}$/.test(safeBase)) {
    return safeBase;
  }
  const extension = getMimeDefaultExtension(
    String(fallbackMimeType || item.mime_type || ""),
  );
  return extension ? `${safeBase}.${extension}` : safeBase;
};

const sanitizeHttpHeaderValue = (value: unknown) =>
  String(value ?? "")
    // Evita header injection e caracteres inválidos para ByteString.
    .replace(/[\r\n]+/g, " ")
    .replace(/[\u0000-\u0008\u000A-\u001F\u007F]/g, "")
    .replace(/[^\u0009\u0020-\u00FF]/g, "")
    .trim();

const buildContentDispositionHeader = (
  disposition: "inline" | "attachment",
  filename: string,
) => {
  const normalized = String(filename || "arquivo").trim() || "arquivo";
  const asciiFallback = normalized
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/["\\]/g, "_")
    .replace(/[^\x20-\x7E]+/g, "_")
    .replace(/\s+/g, " ")
    .trim() || "arquivo";
  const encodedUtf8 = encodeURIComponent(normalized);
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodedUtf8}`;
};

const openDriveStream = async (
  item: ArquivoItemRecord,
  action: ArquivoPermissionAction,
  rangeHeader?: string | null,
) => {
  const accessToken = await getDriveAccessToken();
  let targetFileId = String(item.drive_file_id || "").trim();
  let targetMimeType = String(item.mime_type || "").trim();
  if (targetMimeType === "application/vnd.google-apps.shortcut") {
    const params = new URLSearchParams();
    params.set("fields", "id,mimeType,shortcutDetails(targetId,targetMimeType)");
    params.set("supportsAllDrives", "true");
    const metadataResponse = await fetchGoogleWithRetry(
      `${GOOGLE_DRIVE_FILES_API}/${encodeURIComponent(targetFileId)}?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      `[gdrive] falha ao resolver atalho ${targetFileId}`,
    );
    const metadata = await metadataResponse.json() as {
      shortcutDetails?: {
        targetId?: string;
        targetMimeType?: string;
      };
    };
    const resolvedId = String(metadata.shortcutDetails?.targetId || "").trim();
    if (!resolvedId) {
      throw new Error(`Atalho ${targetFileId} sem targetId válido.`);
    }
    targetFileId = resolvedId;
    targetMimeType = String(
      metadata.shortcutDetails?.targetMimeType || targetMimeType,
    ).trim();
  }

  const exportMimeType = resolveGoogleExportMimeType(targetMimeType, action);
  const url = (() => {
    if (exportMimeType) {
      const params = new URLSearchParams();
      params.set("mimeType", exportMimeType);
      return `${GOOGLE_DRIVE_FILES_API}/${encodeURIComponent(targetFileId)}/export?${params.toString()}`;
    }
    const params = new URLSearchParams();
    params.set("alt", "media");
    params.set("supportsAllDrives", "true");
    return `${GOOGLE_DRIVE_FILES_API}/${encodeURIComponent(targetFileId)}?${params.toString()}`;
  })();

  const headers = new Headers({
    Authorization: `Bearer ${accessToken}`,
  });
  if (rangeHeader) {
    headers.set("Range", rangeHeader);
  }

  const upstream = await fetch(url, { headers });
  return {
    upstream,
    effectiveMimeType: exportMimeType || targetMimeType || null,
  };
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
    const candidatos = [
      pedido.cooperativa_responsavel_id,
      pedido.cooperativa_solicitante_id,
    ].map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value, index, arr) => value && arr.indexOf(value) === index);

    for (const cooperativaId of candidatos) {
      try {
        const coopRow = db.queryEntries<any>(
          `SELECT FEDERACAO FROM ${
            TBL("cooperativas")
          } WHERE id_singular = ? LIMIT 1`,
          [cooperativaId],
        )[0];
        const federacaoNome = coopRow?.FEDERACAO;
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
  const tokenFromHeader = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : undefined;
  const tokenFromQuery = c.req.query("token");
  const token = tokenFromHeader || tokenFromQuery || undefined;
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
      cooperativas_ids: [] as string[],
      papel: "confederacao",
      modulos_acesso: ["hub", "central_apps", "urede", "udocs", "umarketing", "ufast"],
      ativo: true,
      data_cadastro: new Date().toISOString(),
    } as any;
  }

  try {
    // Se provider local, primeiro tentar em auth_users (SQLite)
    if (AUTH_PROVIDER === "local") {
      try {
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
            approval_status: string | null;
            email_confirmed_at: string | null;
            approval_requested_at: string | null;
            approved_by: string | null;
            approved_at: string | null;
            requested_papel: string | null;
            must_change_password: number | null;
            module_access: string | null;
          }>(
            `SELECT email,
                    nome,
                    COALESCE(display_name, nome) AS display_name,
                    telefone,
                    whatsapp,
                    cargo,
                    cooperativa_id,
                    papel,
                    requested_papel,
                    COALESCE(ativo,1) AS ativo,
                    COALESCE(data_cadastro, CURRENT_TIMESTAMP) AS data_cadastro,
                    approval_status,
                    email_confirmed_at,
                    approval_requested_at,
                    approved_by,
                    approved_at,
                    must_change_password,
                    module_access
             FROM auth_users WHERE email = ?`,
            [userEmail],
          )[0];
          if (row) {
            const approvalStatus = row.approval_status || "approved";
            const cooperativasIds = getUserCooperativaAssociacoes(userEmail);
            const resolvedCooperativas = cooperativasIds.length
              ? cooperativasIds
              : (row.cooperativa_id ? [row.cooperativa_id] : []);
            const user = {
              id: userEmail,
              nome: row.nome || "Usuário",
              display_name: row.display_name || "Usuário",
              email: userEmail,
              telefone: row.telefone || "",
              whatsapp: row.whatsapp || "",
              cargo: row.cargo || "",
              cooperativa_id: row.cooperativa_id || "",
              cooperativas_ids: resolvedCooperativas,
              papel: (row.papel as any) || "operador",
              modulos_acesso: normalizeModuleAccess(row.module_access, ["hub"]),
              ativo: !!row.ativo,
              data_cadastro: row.data_cadastro,
              approval_status: approvalStatus,
              email_confirmed_at: row.email_confirmed_at || null,
              approval_requested_at: row.approval_requested_at || null,
              approved_by: row.approved_by || null,
              approved_at: row.approved_at || null,
              requested_papel: row.requested_papel || null,
              must_change_password: !!row.must_change_password,
            } as any;
            if (approvalStatus === "approved") {
              ensureOperatorRecord(user);
            }
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
        const cooperativasIds = getUserCooperativaAssociacoes(userEmail);
        const resolvedCooperativas = cooperativasIds.length
          ? cooperativasIds
          : (o.id_singular ? [o.id_singular] : []);
        const user = {
          ...o,
          cooperativa_id: o.id_singular,
          cooperativas_ids: resolvedCooperativas,
          papel: "operador",
          modulos_acesso: ["hub"],
          approval_status: "approved",
          email_confirmed_at: nowIso(),
          approval_requested_at: null,
          approved_by: null,
          approved_at: null,
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
      cooperativas_ids: [] as string[],
      papel: "operador",
      modulos_acesso: ["hub"],
      ativo: true,
      data_cadastro: new Date().toISOString(),
      approval_status: "approved",
      email_confirmed_at: nowIso(),
      approval_requested_at: null,
      approved_by: null,
      approved_at: null,
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
    const payload = await c.req.json();
    const emailRaw = (payload?.email || "").trim().toLowerCase();
    const password = payload?.password;
    const nome = (payload?.nome || "").trim();
    const displayName = (payload?.display_name || nome).trim();
    const telefone = (payload?.telefone || "").trim();
    const whatsapp = (payload?.whatsapp || "").trim();
    const cargo = (payload?.cargo || "").trim();
    const cooperativaId = (payload?.cooperativa_id || "").trim() || null;
    const requestedBaseRole = payload?.papel || "operador";

    if (AUTH_PROVIDER !== "local") {
      return c.json({ error: "Cadastro local desabilitado" }, 400);
    }

    if (!emailRaw || !password) {
      return c.json({ error: "Email e senha são obrigatórios" }, 400);
    }

    const existing = db.queryEntries<{ email: string }>(
      "SELECT email FROM auth_users WHERE email = ? LIMIT 1",
      [emailRaw],
    )[0];
    if (existing) {
      return c.json({ error: "Email já registrado" }, 400);
    }

    let requester: any = null;
    const authHeader = c.req.header("Authorization");
    const authzToken = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : undefined;
    if (authzToken) {
      try {
        const tokenPayload = await verifyJwt(JWT_SECRET, authzToken);
        requester = await getUserData(
          tokenPayload.sub as string,
          (tokenPayload.email as string) ?? undefined,
        );
      } catch (_) {
        requester = null;
      }
    }

    let finalPapel = requestedBaseRole;
    let finalCoop = cooperativaId || "";

    if (!requester) {
      finalPapel = "operador";
      if (!finalCoop) {
        return c.json({ error: "cooperativa_id é obrigatório" }, 400);
      }
    } else {
      if (requester.papel === "confederacao") {
        // Confederação pode criar sem restrições adicionais
      } else if (requester.papel === "federacao") {
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
        } catch (_) {
          return c.json({ error: "Falha ao validar federação" }, 400);
        }
      } else if (requester.papel === "admin") {
        if (!finalCoop || finalCoop !== requester.cooperativa_id) {
          return c.json({
            error: "Admin de singular só cria usuários da sua operadora",
          }, 403);
        }
      } else {
        return c.json({ error: "Operador não pode criar usuários" }, 403);
      }
    }

    const hash = await bcrypt.hash(password);
    const resolvedRole = deriveRoleForCooperativa(finalPapel, finalCoop);
    const confirmationToken = generateToken();
    const confirmationExpires = addHours(EMAIL_CONFIRMATION_TIMEOUT_HOURS);
    const now = nowIso();
    const autoApprove = finalCoop
      ? countApprovedAdmins(finalCoop) === 0
      : false;
    const requestedRole = autoApprove ? "admin" : resolvedRole;
    const storedRole = autoApprove ? "admin" : "operador";
    const moduleAccess = serializeModuleAccess(payload?.modulos_acesso, ["hub"]);

    db.query(
      `INSERT INTO auth_users (
        email,
        password_hash,
        nome,
        display_name,
        telefone,
        whatsapp,
        cargo,
        cooperativa_id,
        papel,
        requested_papel,
        ativo,
        data_cadastro,
        confirmation_token,
        confirmation_expires_at,
        email_confirmed_at,
        approval_status,
        approval_requested_at,
        approved_by,
        approved_at,
        auto_approve,
        must_change_password,
        module_access
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        emailRaw,
        hash,
        nome,
        displayName || nome || emailRaw,
        telefone,
        whatsapp,
        cargo,
        finalCoop || null,
        storedRole,
        requestedRole,
        1,
        now,
        confirmationToken,
        confirmationExpires,
        null,
        "pending_confirmation",
        null,
        null,
        null,
        autoApprove ? 1 : 0,
        0,
        moduleAccess,
      ],
    );

    await sendConfirmationEmail(
      { email: emailRaw, nome, display_name: displayName || nome },
      confirmationToken,
    );

    return c.json(
      {
        message:
          "Usuário criado com sucesso. Verifique seu e-mail para confirmar o cadastro.",
        status: "pending_confirmation",
        autoApprove: autoApprove ? true : false,
      },
      201,
    );
  } catch (error) {
    console.error("Erro no cadastro:", error);
    return c.json({ error: "Erro interno do servidor" }, 500);
  }
});

// Rota de autenticação - Login (JWT local)
app.post("/auth/login", async (c) => {
  try {
    const { email, password } = await c.req.json();
    const emailNormalized = (email || "").trim().toLowerCase();
    if (AUTH_PROVIDER !== "local") {
      return c.json({ error: "Login local desabilitado" }, 400);
    }
    if (!emailNormalized || !password) {
      return c.json({ error: "Email e senha são obrigatórios" }, 400);
    }

    const row = db.queryEntries<{
      email: string;
      password_hash: string;
      nome: string | null;
      display_name: string | null;
      cooperativa_id: string | null;
      papel: string | null;
      requested_papel: string | null;
      email_confirmed_at: string | null;
      approval_status: string | null;
    }>(
      `SELECT email, password_hash, nome, display_name, cooperativa_id, papel, requested_papel, email_confirmed_at, approval_status
       FROM auth_users WHERE email = ?`,
      [emailNormalized],
    )[0];
    if (!row) return c.json({ error: "Credenciais inválidas" }, 401);
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return c.json({ error: "Credenciais inválidas" }, 401);

    if (!row.email_confirmed_at) {
      return c.json({ error: "pending_confirmation" }, 403);
    }

    const approvalStatus = row.approval_status || "approved";
    if (approvalStatus !== "approved") {
      return c.json({ error: approvalStatus }, 403);
    }

    const effectiveRole = row.papel || row.requested_papel || "operador";

    const token = await signJwt(JWT_SECRET, {
      sub: row.email,
      email: row.email,
      nome: row.nome || undefined,
      cooperativa_id: row.cooperativa_id || undefined,
      papel: effectiveRole as any,
    });

    return c.json({ token });
  } catch (error) {
    console.error("Erro no login:", error);
    return c.json({ error: "Erro interno do servidor" }, 500);
  }
});

app.post("/auth/confirm-email", async (c) => {
  try {
    let body: any = {};
    try {
      body = await c.req.json();
    } catch {
      /* ignore */
    }
    const token = (body?.token || c.req.query("token") || "").trim();
    if (!token) {
      return c.json({ error: "Token inválido" }, 400);
    }

    const row = db.queryEntries<{
      email: string;
      nome: string | null;
      display_name: string | null;
      cooperativa_id: string | null;
      auto_approve: number | null;
      requested_papel: string | null;
      papel: string | null;
      approval_status: string | null;
      confirmation_expires_at: string | null;
    }>(
      `SELECT email, nome, display_name, cooperativa_id, auto_approve, requested_papel, papel, approval_status, confirmation_expires_at
       FROM auth_users WHERE confirmation_token = ? LIMIT 1`,
      [token],
    )[0];

    if (!row) {
      return c.json({ error: "Token inválido ou já utilizado" }, 404);
    }

    if (row.confirmation_expires_at) {
      const expiresAt = new Date(row.confirmation_expires_at);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
        return c.json({ error: "Token expirado" }, 400);
      }
    }

    const now = nowIso();
    const updates: { column: string; value: unknown }[] = [
      { column: "email_confirmed_at", value: now },
      { column: "confirmation_token", value: null },
      { column: "confirmation_expires_at", value: null },
    ];

    const autoApprove = toBoolean(row.auto_approve);
    if (autoApprove) {
      updates.push({ column: "approval_status", value: "approved" });
      updates.push({ column: "approved_at", value: now });
      updates.push({ column: "approved_by", value: "system" });
      updates.push({ column: "auto_approve", value: 0 });
      updates.push({
        column: "papel",
        value: row.requested_papel || row.papel || "admin",
      });
    } else {
      updates.push({ column: "approval_status", value: "pending_approval" });
      updates.push({ column: "approval_requested_at", value: now });
    }

    const setClause = updates.map((entry) => `${entry.column} = ?`).join(", ");
    const values = updates.map((entry) => entry.value);
    db.query(
      `UPDATE auth_users SET ${setClause} WHERE email = ?`,
      [...values, row.email],
    );

    if (autoApprove) {
      ensureOperatorRecord({
        id: row.email,
        nome: row.nome || row.email,
        display_name: row.display_name || row.nome || row.email,
        email: row.email,
        telefone: "",
        whatsapp: "",
        cargo: "",
        cooperativa_id: row.cooperativa_id || undefined,
        approval_status: "approved",
      });
      return c.json({
        message: "Email confirmado e conta ativada com sucesso.",
        status: "approved",
      });
    }

    enqueueApprovalRequest({
      email: row.email,
      nome: row.nome,
      display_name: row.display_name,
      cooperativa_id: row.cooperativa_id,
      requested_papel: row.requested_papel || row.papel,
    });

    return c.json({
      message:
        "Email confirmado. Aguarde a aprovação do responsável pela sua cooperativa.",
      status: "pending_approval",
    });
  } catch (error) {
    console.error("[auth] erro ao confirmar email:", error);
    return c.json({ error: "Erro interno do servidor" }, 500);
  }
});

app.get("/auth/pending", requireAuth, async (c) => {
  try {
    const authUser = c.get("user");
    const userData = await getUserData(
      authUser.id,
      authUser.email || authUser?.claims?.email,
    );
    if (!userData || userData.papel !== "admin" || !userData.cooperativa_id) {
      return c.json([]);
    }

    const rows = db.queryEntries<any>(
      `SELECT r.id,
              r.user_email,
              r.cooperativa_id,
              r.created_at,
              au.nome,
              au.display_name,
              au.requested_papel,
              au.papel,
              au.approval_status
       FROM user_approval_requests r
       LEFT JOIN auth_users au ON au.email = r.user_email
       WHERE r.status = 'pending' AND r.approver_cooperativa_id = ?
       ORDER BY r.created_at ASC`,
      [userData.cooperativa_id],
    );

    const enriched = rows.map((row) => {
      const cooperativaInfo = getCooperativaInfo(row.cooperativa_id);
      return {
        id: row.id,
        email: row.user_email,
        nome: row.nome || row.display_name || row.user_email,
        cooperativa_id: row.cooperativa_id,
        cooperativa_nome: cooperativaInfo?.uniodonto || null,
        requested_papel: row.requested_papel || row.papel || "operador",
        approval_status: row.approval_status || "pending_approval",
        created_at: row.created_at,
      };
    });

    return c.json(enriched);
  } catch (error) {
    console.error("[approvals] erro ao listar pendências:", error);
    return c.json({ error: "Erro ao carregar solicitações" }, 500);
  }
});

app.post("/auth/pending/:id/approve", requireAuth, async (c) => {
  try {
    const requestId = c.req.param("id");
    const authUser = c.get("user");
    const userData = await getUserData(
      authUser.id,
      authUser.email || authUser?.claims?.email,
    );
    if (!userData || userData.papel !== "admin" || !userData.cooperativa_id) {
      return c.json({ error: "Acesso negado" }, 403);
    }

    const request = db.queryEntries<any>(
      "SELECT * FROM user_approval_requests WHERE id = ? LIMIT 1",
      [requestId],
    )[0];
    if (!request) {
      return c.json({ error: "Solicitação não encontrada" }, 404);
    }
    if (request.status !== "pending") {
      return c.json({ error: "Solicitação já processada" }, 400);
    }
    if (request.approver_cooperativa_id !== userData.cooperativa_id) {
      return c.json({ error: "Acesso negado" }, 403);
    }

    let notes = "";
    try {
      const body = await c.req.json();
      notes = (body?.notes || "").trim();
    } catch {
      /* ignore */
    }

    const now = nowIso();
    db.query(
      `UPDATE user_approval_requests
         SET status = 'approved',
             decided_at = ?,
             decided_by = ?,
             decision_notes = ?
       WHERE id = ?`,
      [now, userData.email, notes || null, requestId],
    );

    const targetUser = getAuthUser(request.user_email);
    if (!targetUser) {
      return c.json({ error: "Usuário associado não encontrado" }, 404);
    }

    const finalRole = targetUser.requested_papel || targetUser.papel || "operador";

    db.query(
      `UPDATE auth_users
         SET approval_status = 'approved',
             approved_at = ?,
             approved_by = ?,
             papel = COALESCE(requested_papel, papel)
       WHERE email = ?`,
      [now, userData.email, request.user_email],
    );

    ensureOperatorRecord({
      id: targetUser.email,
      nome: targetUser.nome || targetUser.display_name || targetUser.email,
      display_name: targetUser.display_name || targetUser.nome || targetUser.email,
      email: targetUser.email,
      telefone: targetUser.telefone || "",
      whatsapp: targetUser.whatsapp || "",
      cargo: targetUser.cargo || "",
      cooperativa_id: targetUser.cooperativa_id || undefined,
      approval_status: "approved",
    });

    void sendApprovalResultEmail(
      {
        email: targetUser.email,
        nome: targetUser.nome,
        display_name: targetUser.display_name,
      },
      "approved",
      userData.display_name || userData.nome || userData.email,
      notes || undefined,
    );

    return c.json({ message: "Usuário aprovado com sucesso" });
  } catch (error) {
    console.error("[approvals] erro ao aprovar usuário:", error);
    return c.json({ error: "Erro interno do servidor" }, 500);
  }
});

app.post("/auth/pending/:id/reject", requireAuth, async (c) => {
  try {
    const requestId = c.req.param("id");
    const authUser = c.get("user");
    const userData = await getUserData(
      authUser.id,
      authUser.email || authUser?.claims?.email,
    );
    if (!userData || userData.papel !== "admin" || !userData.cooperativa_id) {
      return c.json({ error: "Acesso negado" }, 403);
    }

    const request = db.queryEntries<any>(
      "SELECT * FROM user_approval_requests WHERE id = ? LIMIT 1",
      [requestId],
    )[0];
    if (!request) {
      return c.json({ error: "Solicitação não encontrada" }, 404);
    }
    if (request.status !== "pending") {
      return c.json({ error: "Solicitação já processada" }, 400);
    }
    if (request.approver_cooperativa_id !== userData.cooperativa_id) {
      return c.json({ error: "Acesso negado" }, 403);
    }

    let notes = "";
    try {
      const body = await c.req.json();
      notes = (body?.notes || "").trim();
    } catch {
      /* ignore */
    }

    const now = nowIso();
    db.query(
      `UPDATE user_approval_requests
         SET status = 'rejected',
             decided_at = ?,
             decided_by = ?,
             decision_notes = ?
       WHERE id = ?`,
      [now, userData.email, notes || null, requestId],
    );

    db.query(
      `UPDATE auth_users
         SET approval_status = 'rejected',
             approved_at = NULL,
             approved_by = ?,
             auto_approve = 0
       WHERE email = ?`,
      [userData.email, request.user_email],
    );

    const targetUser = getAuthUser(request.user_email);
    if (targetUser) {
      void sendApprovalResultEmail(
        {
          email: targetUser.email,
          nome: targetUser.nome,
          display_name: targetUser.display_name,
        },
        "rejected",
        userData.display_name || userData.nome || userData.email,
        notes || undefined,
      );
    }

    return c.json({ message: "Solicitação rejeitada com sucesso" });
  } catch (error) {
    console.error("[approvals] erro ao rejeitar usuário:", error);
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

  if (!isConfederacaoSystemAdmin(userData)) {
    return c.json({ error: "Acesso negado. Apenas administradores da Confederação podem alterar estas configurações." }, 403);
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
  const currentSettings = readSystemSettings();
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
  const pedidoMotivos = payload?.pedido_motivos !== undefined
    ? sanitizeMotivos(payload?.pedido_motivos)
    : currentSettings.pedido_motivos;
  const hubCadastros = payload?.hub_cadastros !== undefined
    ? sanitizeHubCadastros(payload?.hub_cadastros)
    : currentSettings.hub_cadastros;

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
    pedido_motivos: pedidoMotivos,
    hub_cadastros: hubCadastros,
  };

  try {
    persistSystemSettings(settings);
    return c.json({ settings });
  } catch (error) {
    console.error("[settings] erro ao salvar configurações:", error);
    return c.json({ error: "Falha ao salvar configurações" }, 500);
  }
});

app.get("/configuracoes/sistema/central-arquivos/google-drive", requireAuth, async (c) => {
  const authUser = c.get("user");
  const userData = await getUserData(
    authUser.id,
    authUser.email || authUser?.claims?.email,
  );
  if (!userData) return c.json({ error: "Usuário não encontrado" }, 401);
  if (!canManageArquivosAdmin(userData)) {
    return c.json({ error: "Acesso negado. Apenas administradores da Central podem acessar esta configuração." }, 403);
  }

  try {
    const status = await buildCentralArquivosDriveCredentialStatus();
    const drive = buildCentralArquivosDriveConfigStatus();
    return c.json({
      can_manage: true,
      encryption_enabled: Boolean(CENTRAL_ARQUIVOS_ENCRYPTION_KEY),
      ...status,
      drive,
    });
  } catch (error) {
    console.error("[settings] erro ao consultar credencial do Google Drive:", error);
    return c.json({ error: "Erro ao consultar credencial do Google Drive" }, 500);
  }
});

app.put("/configuracoes/sistema/central-arquivos/google-drive", requireAuth, async (c) => {
  const authUser = c.get("user");
  const userData = await getUserData(
    authUser.id,
    authUser.email || authUser?.claims?.email,
  );
  if (!userData) return c.json({ error: "Usuário não encontrado" }, 401);
  if (!canManageArquivosAdmin(userData)) {
    return c.json({ error: "Acesso negado. Apenas administradores da Central podem alterar esta configuração." }, 403);
  }

  let payload: any;
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: "JSON inválido" }, 400);
  }

  try {
    const now = nowIso();
    const hasExplicitServiceAccount = Boolean(
      payload && typeof payload === "object" && "service_account" in payload,
    );
    const hasExplicitDrive = Boolean(
      payload && typeof payload === "object" && "drive" in payload,
    );
    const looksLikeDrivePayload = Boolean(
      payload && typeof payload === "object" &&
        (
          "drive_id" in payload ||
          "udocs_root_folder_id" in payload ||
          "umarketing_root_folder_id" in payload
        ),
    );

    const shouldUpdateServiceAccount = hasExplicitServiceAccount ||
      (!hasExplicitServiceAccount && !hasExplicitDrive && !looksLikeDrivePayload);
    const shouldUpdateDrive = hasExplicitDrive ||
      (!hasExplicitServiceAccount && !hasExplicitDrive && looksLikeDrivePayload);

    if (!shouldUpdateServiceAccount && !shouldUpdateDrive) {
      return c.json({ error: "Nada para atualizar." }, 400);
    }

    if (shouldUpdateServiceAccount) {
      let serviceAccount: GoogleServiceAccountPayload;
      try {
        const source = hasExplicitServiceAccount
          ? payload?.service_account
          : payload;
        serviceAccount = normalizeGoogleServiceAccountPayload(source);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Arquivo inválido";
        return c.json({ error: message }, 400);
      }

      const encrypted = await encryptCentralArquivosSecret({
        service_account: serviceAccount,
        updated_at: now,
        updated_by_email: userData.email ? String(userData.email) : null,
        updated_by_nome: userData.display_name || userData.nome || null,
      });
      persistSettingsValue(SETTINGS_KEY_CENTRAL_ARQUIVOS_GDRIVE_SECRET, encrypted);
      gdriveTokenCache = null;

      registrarAuditoriaArquivos(c, userData, "gdrive_secret_upsert", "ok", {
        detalhes: {
          source: "secure_store",
          project_id: serviceAccount.project_id || null,
          client_email_masked: maskEmail(serviceAccount.client_email),
        },
      });
    }

    if (shouldUpdateDrive) {
      const baseConfig = readStoredCentralArquivosDriveConfig() || {
        drive_id: normalizeDriveResourceId(GDRIVE_DRIVE_ID),
        udocs_root_folder_id: GDRIVE_UDOCS_ROOT_FOLDER_ID,
        umarketing_root_folder_id: normalizeDriveResourceId(
          GDRIVE_UMARKETING_ROOT_FOLDER_ID,
        ),
      };
      let driveConfig: {
        drive_id: string | null;
        udocs_root_folder_id: string;
        umarketing_root_folder_id: string | null;
      };
      try {
        driveConfig = normalizeCentralArquivosDriveConfigInput(
          hasExplicitDrive ? payload?.drive : payload,
          baseConfig,
        );
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : "Configuração de pastas inválida.";
        return c.json({ error: message }, 400);
      }

      let validationResult: {
        status: "valid";
        checked_at: string;
        drive_name: string | null;
        udocs_folder_name: string | null;
        umarketing_folder_name: string | null;
      };
      try {
        validationResult = await validateCentralArquivosDriveConfig(driveConfig);
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : "Não foi possível validar os IDs informados no Google Drive.";
        return c.json({ error: message }, 400);
      }

      const persistedDriveConfig: CentralArquivosDriveConfigPayload = {
        ...driveConfig,
        validation: validationResult,
        updated_at: now,
        updated_by_email: userData.email ? String(userData.email) : null,
        updated_by_nome: userData.display_name || userData.nome || null,
      };
      persistSettingsValue(
        SETTINGS_KEY_CENTRAL_ARQUIVOS_GDRIVE_CONFIG,
        JSON.stringify(persistedDriveConfig),
      );

      registrarAuditoriaArquivos(c, userData, "gdrive_config_upsert", "ok", {
        detalhes: {
          source: "secure_store",
          drive_id: driveConfig.drive_id,
          udocs_root_folder_id: driveConfig.udocs_root_folder_id,
          umarketing_root_folder_id: driveConfig.umarketing_root_folder_id,
        },
      });
    }

    const status = await buildCentralArquivosDriveCredentialStatus();
    const drive = buildCentralArquivosDriveConfigStatus();
    return c.json({
      ok: true,
      encryption_enabled: Boolean(CENTRAL_ARQUIVOS_ENCRYPTION_KEY),
      ...status,
      drive,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    console.error("[settings] erro ao salvar configuração do Google Drive:", error);
    return c.json({ error: `Falha ao salvar configuração: ${message.slice(0, 300)}` }, 500);
  }
});

app.delete("/configuracoes/sistema/central-arquivos/google-drive", requireAuth, async (c) => {
  const authUser = c.get("user");
  const userData = await getUserData(
    authUser.id,
    authUser.email || authUser?.claims?.email,
  );
  if (!userData) return c.json({ error: "Usuário não encontrado" }, 401);
  if (!canManageArquivosAdmin(userData)) {
    return c.json({ error: "Acesso negado. Apenas administradores da Central podem alterar esta configuração." }, 403);
  }

  try {
    deleteSettingsValue(SETTINGS_KEY_CENTRAL_ARQUIVOS_GDRIVE_SECRET);
    gdriveTokenCache = null;

    registrarAuditoriaArquivos(c, userData, "gdrive_secret_delete", "ok", {
      detalhes: { source: "secure_store" },
    });

    const status = await buildCentralArquivosDriveCredentialStatus();
    const drive = buildCentralArquivosDriveConfigStatus();
    return c.json({
      ok: true,
      encryption_enabled: Boolean(CENTRAL_ARQUIVOS_ENCRYPTION_KEY),
      ...status,
      drive,
    });
  } catch (error) {
    console.error("[settings] erro ao remover credencial do Google Drive:", error);
    return c.json({ error: "Falha ao remover credencial do Google Drive" }, 500);
  }
});

// Alias UDocs para configuração do Google Drive (legado: /configuracoes/sistema/central-arquivos/google-drive)
app.get("/configuracoes/sistema/udocs/google-drive", requireAuth, async (c) =>
  c.redirect(
    buildRedirectTarget(c, "/configuracoes/sistema/central-arquivos/google-drive"),
    307,
  )
);

app.put("/configuracoes/sistema/udocs/google-drive", requireAuth, async (c) =>
  c.redirect(
    buildRedirectTarget(c, "/configuracoes/sistema/central-arquivos/google-drive"),
    307,
  )
);

app.delete("/configuracoes/sistema/udocs/google-drive", requireAuth, async (c) =>
  c.redirect(
    buildRedirectTarget(c, "/configuracoes/sistema/central-arquivos/google-drive"),
    307,
  )
);

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
    db.query(
      "UPDATE auth_users SET password_hash = ?, must_change_password = 0 WHERE email = ?",
      [newHash, userEmail],
    );

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

const mapPessoaVinculoRow = (row: any) => ({
  vinculo_id: String(row?.vinculo_id ?? ""),
  pessoa_id: String(row?.pessoa_id ?? ""),
  id_singular: String(row?.id_singular ?? ""),
  singular_nome: String(row?.singular_nome ?? row?.id_singular ?? ""),
  categoria: String(row?.categoria ?? ""),
  subcategoria: row?.subcategoria ?? null,
  primeiro_nome: String(row?.primeiro_nome ?? ""),
  sobrenome: row?.sobrenome ?? null,
  email: row?.email ?? null,
  telefone: row?.telefone ?? null,
  wpp: Number(row?.wpp ?? 0) === 1,
  departamento: row?.departamento ?? null,
  cargo_funcao: row?.cargo_funcao ?? null,
  pasta: row?.pasta ?? null,
  principal: Number(row?.principal ?? 0) === 1,
  visivel: Number(row?.visivel ?? 1) === 1,
  chefia: Number(row?.chefia ?? 0) === 1,
  ativo: Number(row?.ativo ?? 1) === 1,
  inicio_mandato: row?.inicio_mandato ?? null,
  fim_mandato: row?.fim_mandato ?? null,
});

app.get("/pessoas", requireAuth, async (c) => {
  try {
    const authUser = c.get("user");
    const userData = await getUserData(
      authUser.id,
      authUser.email || authUser?.claims?.email,
    );
    if (!userData) return c.json({ error: "Usuário não autenticado" }, 401);

    const rawIdSingular = c.req.query("id_singular");
    const idSingular = normalizeIdSingular(rawIdSingular);
    if (rawIdSingular && !idSingular) {
      return c.json({ error: "id_singular inválido. Use 3 dígitos (ex.: 001)." }, 400);
    }
    const categoria = normalizeEnumText(c.req.query("categoria"));
    const qRaw = String(c.req.query("q") ?? "").trim().toLowerCase();
    const likeQuery = qRaw ? `%${qRaw.replace(/\s+/g, "%")}%` : "";

    const canReadAll = canReadAnyCooperativaData(userData);
    const visible = canReadAll ? null : getVisibleCooperativas(userData);
    if (idSingular && visible !== null && !visible.has(idSingular)) {
      return c.json({ error: "Acesso negado para esta singular." }, 403);
    }

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (idSingular) {
      whereClauses.push("v.id_singular = ?");
      params.push(idSingular);
    } else if (visible !== null) {
      const ids = Array.from(visible).filter(Boolean);
      if (ids.length === 0) return c.json([]);
      whereClauses.push(`v.id_singular IN (${ids.map(() => "?").join(",")})`);
      params.push(...ids);
    }

    if (categoria) {
      whereClauses.push("LOWER(TRIM(COALESCE(v.categoria, ''))) = ?");
      params.push(categoria);
    }

    if (likeQuery) {
      whereClauses.push(`(
        LOWER(COALESCE(p.primeiro_nome, '')) LIKE ?
        OR LOWER(COALESCE(p.sobrenome, '')) LIKE ?
        OR LOWER(COALESCE(p.email, '')) LIKE ?
        OR LOWER(COALESCE(p.telefone, '')) LIKE ?
        OR LOWER(COALESCE(v.categoria, '')) LIKE ?
        OR LOWER(COALESCE(v.cargo_funcao, p.cargo_funcao, '')) LIKE ?
        OR LOWER(COALESCE(c.UNIODONTO, c.id_singular, '')) LIKE ?
        OR LOWER(COALESCE(v.id_singular, '')) LIKE ?
      )`);
      params.push(
        likeQuery,
        likeQuery,
        likeQuery,
        likeQuery,
        likeQuery,
        likeQuery,
        likeQuery,
        likeQuery,
      );
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const rows = db.queryEntries<any>(
      `SELECT
         v.id AS vinculo_id,
         p.id AS pessoa_id,
         v.id_singular,
         COALESCE(c.UNIODONTO, c.id_singular, v.id_singular) AS singular_nome,
         v.categoria,
         v.subcategoria,
         p.primeiro_nome,
         p.sobrenome,
         p.email,
         p.telefone,
         COALESCE(p.wpp, 0) AS wpp,
         COALESCE(v.departamento, p.departamento) AS departamento,
         COALESCE(v.cargo_funcao, p.cargo_funcao) AS cargo_funcao,
         v.pasta,
         v.principal,
         v.visivel,
         v.chefia,
         COALESCE(v.ativo, p.ativo, 1) AS ativo,
         v.inicio_mandato,
         v.fim_mandato
       FROM ${TBL("pessoa_vinculos")} v
       INNER JOIN ${TBL("pessoas")} p ON p.id = v.pessoa_id
       LEFT JOIN ${TBL("cooperativas")} c ON c.id_singular = v.id_singular
       ${whereSql}
       ORDER BY v.id_singular, LOWER(COALESCE(v.categoria, '')), LOWER(COALESCE(p.primeiro_nome, '')), LOWER(COALESCE(p.sobrenome, ''))`,
      params as any,
    );

    return c.json((rows || []).map(mapPessoaVinculoRow));
  } catch (error) {
    const msg = String((error as any)?.message || "");
    if (msg.includes("no such table") && (msg.includes(TBL("pessoas")) || msg.includes(TBL("pessoa_vinculos")))) {
      return c.json({ error: "Estrutura de pessoas ainda não aplicada. Rode as migrações do banco." }, 500);
    }
    console.error("[pessoas] erro ao listar:", error);
    return c.json({ error: "Erro ao carregar pessoas" }, 500);
  }
});

app.put("/pessoas/:vinculoId", requireAuth, async (c) => {
  try {
    const vinculoId = String(c.req.param("vinculoId") ?? "").trim();
    if (!vinculoId) return c.json({ error: "vinculoId inválido" }, 400);

    const authUser = c.get("user");
    const userData = await getUserData(
      authUser.id,
      authUser.email || authUser?.claims?.email,
    );
    if (!userData) return c.json({ error: "Usuário não autenticado" }, 401);

    const current = db.queryEntries<any>(
      `SELECT v.id, v.id_singular, v.pessoa_id
         FROM ${TBL("pessoa_vinculos")} v
        WHERE v.id = ?
        LIMIT 1`,
      [vinculoId],
    )?.[0];

    if (!current?.id) {
      return c.json({ error: "Vínculo de pessoa não encontrado." }, 404);
    }

    if (!canManageCooperativa(userData, String(current.id_singular))) {
      return c.json({ error: "Acesso negado para editar pessoas desta singular." }, 403);
    }

    const body = await c.req.json().catch(() => ({}));
    if (!body || typeof body !== "object") {
      return c.json({ error: "Payload inválido." }, 400);
    }

    const pessoaUpdates: Record<string, unknown> = {};
    const vinculoUpdates: Record<string, unknown> = {};

    if (Object.prototype.hasOwnProperty.call(body, "primeiro_nome")) {
      const nome = String((body as any).primeiro_nome ?? "").trim();
      if (!nome) return c.json({ error: "primeiro_nome é obrigatório." }, 400);
      pessoaUpdates.primeiro_nome = nome;
    }
    if (Object.prototype.hasOwnProperty.call(body, "sobrenome")) {
      const sobrenome = String((body as any).sobrenome ?? "").replace(/\s+/g, " ").trim();
      pessoaUpdates.sobrenome = sobrenome || null;
    }
    if (Object.prototype.hasOwnProperty.call(body, "email")) {
      const email = String((body as any).email ?? "").trim().toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return c.json({ error: "Email inválido." }, 400);
      }
      pessoaUpdates.email = email || null;
    }
    if (Object.prototype.hasOwnProperty.call(body, "telefone")) {
      const original = String((body as any).telefone ?? "").trim();
      const telefone = normalizeDigitsString((body as any).telefone);
      if (original && !telefone) {
        return c.json({ error: "Telefone inválido. Use apenas números." }, 400);
      }
      pessoaUpdates.telefone = telefone || null;
      if (!Object.prototype.hasOwnProperty.call(body, "wpp")) {
        pessoaUpdates.wpp = isLikelyBrazilMobile(telefone) ? 1 : 0;
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, "wpp")) {
      pessoaUpdates.wpp = normalizeBoolInt((body as any).wpp);
    }
    if (Object.prototype.hasOwnProperty.call(body, "ativo")) {
      const ativoInt = normalizeBoolInt((body as any).ativo);
      pessoaUpdates.ativo = ativoInt;
      vinculoUpdates.ativo = ativoInt;
    }

    if (Object.prototype.hasOwnProperty.call(body, "categoria")) {
      const categoria = normalizeEnumText((body as any).categoria);
      const categoriasPermitidas = new Set([
        "diretoria",
        "regulatorio",
        "conselho",
        "colaborador",
        "ouvidoria",
        "lgpd",
        "auditoria",
        "dentista",
      ]);
      if (!categoria || !categoriasPermitidas.has(categoria)) {
        return c.json({ error: "categoria inválida." }, 400);
      }
      vinculoUpdates.categoria = categoria;
    }
    if (Object.prototype.hasOwnProperty.call(body, "subcategoria")) {
      const subcategoria = String((body as any).subcategoria ?? "").replace(/\s+/g, " ").trim();
      vinculoUpdates.subcategoria = subcategoria || null;
    }
    if (Object.prototype.hasOwnProperty.call(body, "cargo_funcao")) {
      const cargo = String((body as any).cargo_funcao ?? "").replace(/\s+/g, " ").trim();
      vinculoUpdates.cargo_funcao = cargo || null;
    }
    if (Object.prototype.hasOwnProperty.call(body, "departamento")) {
      const departamento = normalizeColaboradorDepartamentos((body as any).departamento);
      vinculoUpdates.departamento = departamento || null;
    }
    if (Object.prototype.hasOwnProperty.call(body, "pasta")) {
      const pasta = String((body as any).pasta ?? "").replace(/\s+/g, " ").trim();
      vinculoUpdates.pasta = pasta || null;
    }
    if (Object.prototype.hasOwnProperty.call(body, "principal")) {
      vinculoUpdates.principal = normalizeBoolInt((body as any).principal);
    }
    if (Object.prototype.hasOwnProperty.call(body, "visivel")) {
      vinculoUpdates.visivel = normalizeBoolInt((body as any).visivel);
    }
    if (Object.prototype.hasOwnProperty.call(body, "chefia")) {
      vinculoUpdates.chefia = normalizeBoolInt((body as any).chefia);
    }
    if (Object.prototype.hasOwnProperty.call(body, "inicio_mandato")) {
      const raw = String((body as any).inicio_mandato ?? "").trim();
      if (!raw) vinculoUpdates.inicio_mandato = null;
      else {
        const n = Number(raw);
        if (!Number.isFinite(n)) return c.json({ error: "inicio_mandato inválido." }, 400);
        vinculoUpdates.inicio_mandato = Math.trunc(n);
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, "fim_mandato")) {
      const raw = String((body as any).fim_mandato ?? "").trim();
      if (!raw) vinculoUpdates.fim_mandato = null;
      else {
        const n = Number(raw);
        if (!Number.isFinite(n)) return c.json({ error: "fim_mandato inválido." }, 400);
        vinculoUpdates.fim_mandato = Math.trunc(n);
      }
    }

    if (Object.keys(pessoaUpdates).length === 0 && Object.keys(vinculoUpdates).length === 0) {
      const row = db.queryEntries<any>(
        `SELECT
           v.id AS vinculo_id,
           p.id AS pessoa_id,
           v.id_singular,
           COALESCE(c.UNIODONTO, c.id_singular, v.id_singular) AS singular_nome,
           v.categoria,
           v.subcategoria,
           p.primeiro_nome,
           p.sobrenome,
           p.email,
           p.telefone,
           COALESCE(p.wpp, 0) AS wpp,
           COALESCE(v.departamento, p.departamento) AS departamento,
           COALESCE(v.cargo_funcao, p.cargo_funcao) AS cargo_funcao,
           v.pasta,
           v.principal,
           v.visivel,
           v.chefia,
           COALESCE(v.ativo, p.ativo, 1) AS ativo,
           v.inicio_mandato,
           v.fim_mandato
         FROM ${TBL("pessoa_vinculos")} v
         INNER JOIN ${TBL("pessoas")} p ON p.id = v.pessoa_id
         LEFT JOIN ${TBL("cooperativas")} c ON c.id_singular = v.id_singular
         WHERE v.id = ?
         LIMIT 1`,
        [vinculoId],
      )?.[0];
      return c.json(mapPessoaVinculoRow(row || {}));
    }

    if (!IS_POSTGRES) db.execute("BEGIN");
    try {
      if (Object.keys(pessoaUpdates).length > 0) {
        const entries = Object.entries(pessoaUpdates);
        const setClause = entries.map(([k]) => `${k} = ?`).join(", ");
        db.query(
          `UPDATE ${TBL("pessoas")}
             SET ${setClause}, atualizado_em = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [...entries.map(([, v]) => v), current.pessoa_id] as any,
        );
      }

      if (Object.keys(vinculoUpdates).length > 0) {
        const entries = Object.entries(vinculoUpdates);
        const setClause = entries.map(([k]) => `${k} = ?`).join(", ");
        db.query(
          `UPDATE ${TBL("pessoa_vinculos")}
             SET ${setClause}, atualizado_em = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [...entries.map(([, v]) => v), vinculoId] as any,
        );
      }

      if (!IS_POSTGRES) db.execute("COMMIT");
    } catch (error) {
      if (!IS_POSTGRES) {
        try {
          db.execute("ROLLBACK");
        } catch {}
      }
      const msg = String((error as any)?.message || "");
      if (msg.includes("UNIQUE constraint failed") && msg.includes("ux_urede_presidente_ativo_por_singular")) {
        return c.json({ error: "Já existe um presidente ativo para esta singular." }, 400);
      }
      throw error;
    }

    const row = db.queryEntries<any>(
      `SELECT
         v.id AS vinculo_id,
         p.id AS pessoa_id,
         v.id_singular,
         COALESCE(c.UNIODONTO, c.id_singular, v.id_singular) AS singular_nome,
         v.categoria,
         v.subcategoria,
         p.primeiro_nome,
         p.sobrenome,
         p.email,
         p.telefone,
         COALESCE(p.wpp, 0) AS wpp,
         COALESCE(v.departamento, p.departamento) AS departamento,
         COALESCE(v.cargo_funcao, p.cargo_funcao) AS cargo_funcao,
         v.pasta,
         v.principal,
         v.visivel,
         v.chefia,
         COALESCE(v.ativo, p.ativo, 1) AS ativo,
         v.inicio_mandato,
         v.fim_mandato
       FROM ${TBL("pessoa_vinculos")} v
       INNER JOIN ${TBL("pessoas")} p ON p.id = v.pessoa_id
       LEFT JOIN ${TBL("cooperativas")} c ON c.id_singular = v.id_singular
       WHERE v.id = ?
       LIMIT 1`,
      [vinculoId],
    )?.[0];

    if (!row) return c.json({ error: "Registro atualizado não encontrado." }, 404);
    return c.json(mapPessoaVinculoRow(row));
  } catch (error) {
    const msg = String((error as any)?.message || "");
    if (msg.includes("no such table") && (msg.includes(TBL("pessoas")) || msg.includes(TBL("pessoa_vinculos")))) {
      return c.json({ error: "Estrutura de pessoas ainda não aplicada. Rode as migrações do banco." }, 500);
    }
    console.error("[pessoas] erro ao atualizar vínculo:", error);
    return c.json({ error: "Erro ao atualizar pessoa" }, 500);
  }
});

// ROTAS AUXILIARES DE COOPERATIVAS (pessoas/contatos/endereços etc)
const COOP_AUX_RESOURCES: Record<
  string,
  { table: string; columns: string[] }
> = {
  auditores: {
    table: TBL("cooperativa_auditores"),
    columns: ["primeiro_nome", "sobrenome", "telefone", "wpp", "email", "ativo"],
  },
  colaboradores: {
    table: TBL("cooperativa_colaboradores"),
    columns: [
      "nome",
      "sobrenome",
      "email",
      "telefone",
      "wpp",
      "departamento",
      "chefia",
      "ativo",
    ],
  },
  conselhos: {
    table: TBL("cooperativa_conselhos"),
    columns: [
      "tipo",
      "primeiro_nome",
      "sobrenome",
      "posicao",
      "ano_inicio_mandato",
      "ano_fim_mandato",
      "ativo",
    ],
  },
  contatos: {
    table: TBL("cooperativa_contatos"),
    columns: ["tipo", "subtipo", "valor", "wpp", "principal", "ativo", "label"],
  },
  diretores: {
    table: TBL("cooperativa_diretores"),
    columns: [
      "cargo",
      "pasta",
      "primeiro_nome",
      "sobrenome",
      "email",
      "telefone",
      "wpp",
      "divulgar_celular",
      "inicio_mandato",
      "fim_mandato",
      "ativo",
    ],
  },
  enderecos: {
    table: TBL("cooperativa_enderecos"),
    columns: [
      "tipo",
      "nome_local",
      "cd_municipio_7",
      "cep",
      "logradouro",
      "numero",
      "complemento",
      "bairro",
      "cidade",
      "uf",
      "telefone",
      "wpp",
      "exibir_visao_geral",
      "plantao_clinica_id",
      "ativo",
    ],
  },
  lgpd: {
    table: TBL("cooperativa_lgpd"),
    columns: ["primeiro_nome", "sobrenome", "email", "telefone", "wpp", "ativo"],
  },
  ouvidores: {
    table: TBL("cooperativa_ouvidores"),
    columns: [
      "primeiro_nome",
      "sobrenome",
      "telefone",
      "wpp",
      "email",
      "ativo",
    ],
  },
  plantao: {
    table: TBL("cooperativa_plantao"),
    columns: ["modelo_atendimento", "descricao", "ativo"],
  },
  plantao_clinicas: {
    table: TBL("cooperativa_plantao_clinicas"),
    columns: [
      "cd_municipio_7",
      "nome_local",
      "cep",
      "logradouro",
      "numero",
      "complemento",
      "bairro",
      "cidade",
      "uf",
      "telefone",
      "wpp",
      "descricao",
      "endereco_id",
      "ativo",
    ],
  },
  plantao_contatos: {
    table: TBL("cooperativa_plantao_contatos"),
    columns: ["tipo", "numero_ou_url", "telefone", "wpp", "principal", "descricao", "ativo"],
  },
  plantao_horarios: {
    table: TBL("cooperativa_plantao_horarios"),
    columns: ["plantao_clinica_id", "dia_semana", "hora_inicio", "hora_fim", "observacao", "ativo"],
  },
  regulatorio: {
    table: TBL("cooperativa_regulatorio"),
    columns: [
      "tipo_unidade",
      "nome_unidade",
      "reg_ans",
      "responsavel_tecnico",
      "email_responsavel_tecnico",
      "cro_responsavel_tecnico",
      "cro_unidade",
      "ativo",
    ],
  },
};

const DIGITS_ONLY_COLUMNS = new Set([
  "cpf",
  "cnpj",
  "cep",
  "telefone",
  "telefone_fixo",
  "telefone_celular",
  "whatsapp",
  "celular",
  "reg_ans",
  "cd_municipio_7",
  "ibge",
  "codigo_ibge",
]);

const normalizeDigitsString = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits || null;
};

const isLikelyBrazilMobile = (value: unknown) => {
  const digits = normalizeDigitsString(value) || "";
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  return local.length === 11 && local.charAt(2) === "9";
};

const normalizeAuxValue = (column: string, value: unknown) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (DIGITS_ONLY_COLUMNS.has(column)) return normalizeDigitsString(value);
  if (column === "dia_semana") {
    const n = Number(String(value ?? "").trim());
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  return value;
};

const pickAuxPayload = (resource: string, body: any) => {
  const def = COOP_AUX_RESOURCES[resource];
  if (!def) return null;
  const data: Record<string, unknown> = {};
  for (const col of def.columns) {
    if (Object.prototype.hasOwnProperty.call(body ?? {}, col)) {
      data[col] = normalizeAuxValue(col, body[col]);
    }
  }
  if (resource === "enderecos" && Object.prototype.hasOwnProperty.call(data, "cd_municipio_7")) {
    data.cd_municipio_7 = normalizeCdMunicipio7(data.cd_municipio_7);
  }
  if (resource === "plantao_clinicas" && Object.prototype.hasOwnProperty.call(data, "cd_municipio_7")) {
    data.cd_municipio_7 = normalizeCdMunicipio7(data.cd_municipio_7);
  }
  if (resource === "enderecos" && Object.prototype.hasOwnProperty.call(data, "tipo")) {
    data.tipo = normalizeEnderecoTipo(data.tipo);
  }
  if (resource === "contatos" && Object.prototype.hasOwnProperty.call(data, "valor")) {
    const tipo = normalizeEnumText(data.tipo);
    // Para contatos telefônicos, forçar armazenamento sem máscara.
    if (tipo === "telefone" || tipo === "whatsapp" || tipo === "celular") {
      data.valor = normalizeDigitsString(data.valor);
    }
  }
  if (resource === "colaboradores") {
    if (Object.prototype.hasOwnProperty.call(data, "departamento")) {
      data.departamento = normalizeColaboradorDepartamentos(data.departamento);
    }
    if (Object.prototype.hasOwnProperty.call(data, "chefia")) {
      data.chefia = normalizeBoolInt(data.chefia);
    }
  }
  return { def, data };
};

const normalizeEnumText = (value: unknown) => {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const normalizeIdSingular = (value: unknown): string | null => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length > 3) return null;
  return digits.padStart(3, "0");
};

const normalizeCdMunicipio7 = (value: unknown): string | null => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 7) return null;
  return digits;
};

const getCidadeByCdMunicipio7 = (codigo: unknown) => {
  const cd = normalizeCdMunicipio7(codigo);
  if (!cd) return null;
  try {
    const row = db.queryEntries<any>(
      `SELECT CD_MUNICIPIO_7, NM_CIDADE, UF_MUNICIPIO
         FROM ${TBL("cidades")}
        WHERE CD_MUNICIPIO_7 = ?
        LIMIT 1`,
      [cd],
    )[0];
    if (!row) return null;
    return {
      cd_municipio_7: row.CD_MUNICIPIO_7 ?? row.cd_municipio_7 ?? cd,
      cidade: row.NM_CIDADE ?? row.nm_cidade ?? null,
      uf: row.UF_MUNICIPIO ?? row.uf_municipio ?? null,
    };
  } catch (e) {
    console.warn("[enderecos] falha ao buscar cidade por cd_municipio_7:", e);
    return null;
  }
};

const applyEnderecoByCdMunicipio7 = (data: Record<string, unknown>) => {
  if (!Object.prototype.hasOwnProperty.call(data, "cd_municipio_7")) {
    return { ok: true as const };
  }

  const cd = normalizeCdMunicipio7(data.cd_municipio_7);
  if (!cd) {
    return {
      ok: false as const,
      error: "cd_municipio_7 inválido. Informe o código IBGE com 7 dígitos.",
    };
  }

  const cidade = getCidadeByCdMunicipio7(cd);
  if (!cidade) {
    return {
      ok: false as const,
      error: `cd_municipio_7 não encontrado em cidades: ${cd}`,
    };
  }

  // Regra de negócio: código IBGE é a referência principal; cidade/UF são derivados dele.
  data.cd_municipio_7 = cidade.cd_municipio_7;
  data.cidade = cidade.cidade;
  data.uf = cidade.uf;
  return { ok: true as const };
};

const getExistingCooperativaIds = (ids: string[]) => {
  const normalized = Array.from(new Set(ids.map((v) => normalizeIdSingular(v)).filter(Boolean) as string[]));
  if (!normalized.length) return new Set<string>();
  const placeholders = normalized.map(() => "?").join(",");
  const rows = db.queryEntries<{ id_singular: string }>(
    `SELECT id_singular FROM ${TBL("cooperativas")} WHERE id_singular IN (${placeholders})`,
    normalized as any,
  ) || [];
  return new Set(rows.map((r) => normalizeIdSingular(r.id_singular)).filter(Boolean) as string[]);
};

const normalizeConselhoTipo = (value: unknown) => {
  const s = normalizeEnumText(value);
  if (!s) return s;
  if (s === "fiscal" || s === "administrativo" || s === "tecnico") return s;
  if (s.includes("fiscal")) return "fiscal";
  if (s.includes("administr")) return "administrativo";
  if (s.includes("tecn")) return "tecnico";
  return s;
};

const normalizeConselhoPosicao = (value: unknown) => {
  const s = normalizeEnumText(value);
  if (!s) return s;
  if (s === "titular" || s === "suplente") return s;
  if (s.includes("titular")) return "titular";
  if (s.includes("suplente")) return "suplente";
  return s;
};

const ENDERECO_TIPO_PLANTAO = "plantao_urgencia_emergencia";

const normalizeEnderecoTipo = (value: unknown) => {
  const s = normalizeEnumText(value);
  if (!s) return s;
  if (s === ENDERECO_TIPO_PLANTAO) return ENDERECO_TIPO_PLANTAO;
  if (s.includes("plantao") && (s.includes("urgencia") || s.includes("emergenc"))) return ENDERECO_TIPO_PLANTAO;

  if (s === "nucleo" || s.includes("nucleo")) return "nucleo";
  if (s === "clinica" || s.includes("clinica")) return "clinica";
  if (s === "pontodevenda" || s === "ponto_venda" || s === "ponto de venda" || (s.includes("ponto") && s.includes("venda"))) return "ponto_venda";

  // Regra de negócio: "sede" foi substituído por "correspondencia".
  if (s === "sede") return "correspondencia";
  if (s === "correspondencia" || s === "filial" || s === "atendimento") return s;
  return s;
};

const isEnderecoTipoPlantao = (value: unknown) => normalizeEnderecoTipo(value) === ENDERECO_TIPO_PLANTAO;

const normalizeRegulatorioTipoUnidade = (value: unknown) => {
  const s = normalizeEnumText(value);
  if (!s) return s;
  if (s === "matriz" || s === "martiz") return "matriz";
  if (s === "filial") return "filial";
  return s;
};

const normalizeColaboradorDepartamentos = (value: unknown) => {
  if (Array.isArray(value)) {
    const tags = value
      .map((v) => String(v ?? "").trim())
      .filter(Boolean);
    return Array.from(new Set(tags)).join("; ");
  }
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const parts = raw
    .split(/[;,|]/g)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return "";
  return Array.from(new Set(parts)).join("; ");
};

const normalizeBoolInt = (value: unknown) => {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value !== 0 ? 1 : 0;
  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return 0;
  return (s === "1" || s === "true" || s === "sim" || s === "s" || s === "yes" || s === "y" || s === "x")
    ? 1
    : 0;
};

const normalizeAuxImportRow = (resource: string, raw: any) => {
  if (!raw || typeof raw !== "object") return raw;
  const row: Record<string, unknown> = { ...raw };

  if (resource === "conselhos") {
    if (row.tipo !== undefined) row.tipo = normalizeConselhoTipo(row.tipo);
    if (row.posicao !== undefined) row.posicao = normalizeConselhoPosicao(row.posicao);
  }

  if (resource === "enderecos") {
    if ((row.telefone === undefined || row.telefone === null || String(row.telefone).trim() === "")) {
      row.telefone = row.telefone_celular ?? row.telefone_fixo ?? row.telefone;
    }
    if (row.wpp === undefined && row.telefone_celular !== undefined) {
      row.wpp = String(row.telefone_celular ?? "").trim() ? 1 : 0;
    }
    if (row.exibir_visao_geral === undefined) {
      row.exibir_visao_geral = 1;
    } else {
      row.exibir_visao_geral = normalizeBoolInt(row.exibir_visao_geral);
    }
    if (row.tipo !== undefined) row.tipo = normalizeEnderecoTipo(row.tipo);
    if (row.cd_municipio_7 !== undefined) {
      row.cd_municipio_7 = normalizeCdMunicipio7(row.cd_municipio_7);
    }
  }

  if (resource === "plantao_clinicas") {
    if ((row.telefone === undefined || row.telefone === null || String(row.telefone).trim() === "")) {
      row.telefone = row.telefone_celular ?? row.telefone_fixo ?? row.telefone;
    }
    if (row.wpp === undefined && row.telefone_celular !== undefined) {
      row.wpp = String(row.telefone_celular ?? "").trim() ? 1 : 0;
    }
    if (row.cd_municipio_7 !== undefined) {
      row.cd_municipio_7 = normalizeCdMunicipio7(row.cd_municipio_7);
    }
  }

  if (resource === "auditores") {
    if ((row.telefone === undefined || row.telefone === null || String(row.telefone).trim() === "")) {
      row.telefone = row.telefone_celular ?? row.telefone;
    }
    if (row.wpp === undefined && row.telefone_celular !== undefined) {
      row.wpp = String(row.telefone_celular ?? "").trim() ? 1 : 0;
    }
  }

  if (resource === "diretores") {
    if ((row.telefone === undefined || row.telefone === null || String(row.telefone).trim() === "")) {
      row.telefone = row.telefone_celular ?? row.telefone;
    }
    if (row.wpp === undefined && row.telefone_celular !== undefined) {
      row.wpp = String(row.telefone_celular ?? "").trim() ? 1 : 0;
    }
  }

  if (resource === "ouvidores") {
    if ((row.telefone === undefined || row.telefone === null || String(row.telefone).trim() === "")) {
      row.telefone = row.telefone_celular ?? row.telefone_fixo ?? row.telefone;
    }
    if (row.wpp === undefined && row.telefone_celular !== undefined) {
      row.wpp = String(row.telefone_celular ?? "").trim() ? 1 : 0;
    }
  }

  if (resource === "lgpd" || resource === "colaboradores") {
    if (row.wpp !== undefined) row.wpp = normalizeBoolInt(row.wpp);
  }

  if (resource === "plantao_contatos") {
    const tipoRaw = row.tipo !== undefined ? normalizeEnumText(row.tipo) : undefined;
    if (tipoRaw !== undefined) {
      const t = tipoRaw;
      if (t.includes("whats")) row.tipo = "telefone";
      else if (t === "website" || t === "site" || t === "web" || t === "url") row.tipo = "website";
      else row.tipo = "telefone";
    }
    if (row.wpp === undefined) {
      row.wpp = String(tipoRaw ?? "").includes("whats") ? 1 : 0;
    } else {
      row.wpp = normalizeBoolInt(row.wpp);
    }
    if ((row.telefone === undefined || row.telefone === null || String(row.telefone).trim() === "")) {
      row.telefone = row.numero_ou_url ?? row.telefone;
    }
    if (row.principal !== undefined) {
      const p = String(row.principal ?? "").trim().toLowerCase();
      row.principal = (p === "1" || p === "true" || p === "sim" || p === "s" || p === "yes" || p === "x") ? 1 : 0;
    }
  }

  if (resource === "plantao_horarios") {
    if (row.dia_semana !== undefined) {
      const n = Number(String(row.dia_semana ?? "").trim());
      row.dia_semana = Number.isFinite(n) ? Math.trunc(n) : null;
    }
    if (row.hora_inicio !== undefined) row.hora_inicio = String(row.hora_inicio ?? "").trim();
    if (row.hora_fim !== undefined) row.hora_fim = String(row.hora_fim ?? "").trim();
    if (row.plantao_clinica_id !== undefined && !String(row.plantao_clinica_id ?? "").trim()) {
      row.plantao_clinica_id = null;
    }
  }

  if (resource === "contatos") {
    const tipoRaw = row.tipo !== undefined ? normalizeEnumText(row.tipo) : undefined;
    if (tipoRaw !== undefined) {
      const t = tipoRaw;
      if (t === "e-mail" || t === "email" || t === "mail") row.tipo = "email";
      else if (t.includes("whats")) row.tipo = "telefone";
      else if (t.includes("telefone") || t === "tel") row.tipo = "telefone";
      else if (t === "website" || t === "site" || t === "web") row.tipo = "website";
      else if (t === "outro" || t === "outros") row.tipo = "outro";
      else row.tipo = t;
    }
    if (row.wpp === undefined) {
      row.wpp = String(tipoRaw ?? "").includes("whats") ? 1 : 0;
    } else {
      row.wpp = normalizeBoolInt(row.wpp);
    }

    const subtipoRaw = row.subtipo !== undefined ? normalizeEnumText(row.subtipo) : undefined;
    if (subtipoRaw !== undefined) {
      const s = subtipoRaw;
      if (s === "plantao" || s === "plantao24h" || s === "plantao_24h") row.subtipo = "plantao";
      else if (s === "emergencia") row.subtipo = "emergencia";
      else if (s === "divulgacao") row.subtipo = "divulgacao";
      else if (s === "lgpd") row.subtipo = "lgpd";
      else if (s.replace(/\s+/g, " ") === "comercial pf") row.subtipo = "comercial pf";
      else if (s.replace(/\s+/g, " ") === "comercial pj") row.subtipo = "comercial pj";
      else if (s === "institucional") row.subtipo = "institucional";
      else if (s === "portal do prestador") row.subtipo = "portal do prestador";
      else if (s === "portal do cliente") row.subtipo = "portal do cliente";
      else if (s === "portal da empresa") row.subtipo = "portal da empresa";
      else if (s === "portal do corretor") row.subtipo = "portal do corretor";
      else if (s === "e-commerce" || s === "ecommerce") row.subtipo = "e-commerce";
      else if (s === "portal do cooperado") row.subtipo = "portal do cooperado";
      else row.subtipo = s;
    }

    // Normalizar principal para 0/1 (CSV costuma vir com 0/1 ou SIM/NAO).
    if (row.principal !== undefined) {
      const p = String(row.principal ?? "").trim().toLowerCase();
      if (!p) row.principal = 0;
      else if (p === "1" || p === "true" || p === "sim" || p === "s" || p === "y" || p === "yes" || p === "x") {
        row.principal = 1;
      } else {
        row.principal = 0;
      }
    }
  }

  if (resource === "colaboradores") {
    if (row.nome === undefined && row.primeiro_nome !== undefined) row.nome = row.primeiro_nome;
    if (row.departamento === undefined && row.departamentos !== undefined) row.departamento = row.departamentos;
    if (row.departamento !== undefined) row.departamento = normalizeColaboradorDepartamentos(row.departamento);
    if (row.chefia !== undefined) row.chefia = normalizeBoolInt(row.chefia);
  }

  if (resource === "regulatorio") {
    if (row.tipo_unidade === undefined && row.tipo !== undefined) row.tipo_unidade = row.tipo;
    if (row.responsavel_tecnico === undefined && row.nome_responsavel_tecnico !== undefined) {
      row.responsavel_tecnico = row.nome_responsavel_tecnico;
    }
    if (row.responsavel_tecnico === undefined && row.responsavel !== undefined) {
      row.responsavel_tecnico = row.responsavel;
    }
    if (row.email_responsavel_tecnico === undefined && row.email !== undefined) {
      row.email_responsavel_tecnico = row.email;
    }
    if (row.cro_responsavel_tecnico === undefined && row.cro_resp_tecnico !== undefined) {
      row.cro_responsavel_tecnico = row.cro_resp_tecnico;
    }
    if (row.cro_unidade === undefined && row.cro_operadora !== undefined) {
      row.cro_unidade = row.cro_operadora;
    }
    if (row.email_responsavel_tecnico === undefined || !String(row.email_responsavel_tecnico ?? "").trim()) {
      const id = normalizeIdSingular(row.id_singular) ?? "000";
      row.email_responsavel_tecnico = `nao-informado+${id}@pendente.local`;
    }
    if (row.tipo_unidade !== undefined) {
      row.tipo_unidade = normalizeRegulatorioTipoUnidade(row.tipo_unidade);
    }
  }

  return row;
};

const validateRegulatorio = (data: Record<string, unknown>) => {
  const tipoUnidade = normalizeRegulatorioTipoUnidade(data.tipo_unidade);
  if (tipoUnidade !== "matriz" && tipoUnidade !== "filial") {
    return { ok: false as const, error: "tipo_unidade é obrigatório e deve ser matriz ou filial." };
  }
  data.tipo_unidade = tipoUnidade;

  const responsavel = String(data.responsavel_tecnico ?? "").trim();
  if (!responsavel) {
    return { ok: false as const, error: "responsavel_tecnico é obrigatório." };
  }
  data.responsavel_tecnico = responsavel;

  const email = String(data.email_responsavel_tecnico ?? "").trim();
  if (!email) {
    return { ok: false as const, error: "email_responsavel_tecnico é obrigatório." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false as const, error: "email_responsavel_tecnico inválido." };
  }
  data.email_responsavel_tecnico = email.toLowerCase();

  const croResp = String(data.cro_responsavel_tecnico ?? "").trim();
  if (!croResp) {
    return { ok: false as const, error: "cro_responsavel_tecnico é obrigatório." };
  }
  data.cro_responsavel_tecnico = croResp;

  const croUnidade = String(data.cro_unidade ?? "").trim();
  if (!croUnidade) {
    return { ok: false as const, error: "cro_unidade é obrigatório." };
  }
  data.cro_unidade = croUnidade;

  if (Object.prototype.hasOwnProperty.call(data, "reg_ans")) {
    const regAns = String(data.reg_ans ?? "").trim();
    data.reg_ans = regAns || null;
  }
  if (Object.prototype.hasOwnProperty.call(data, "nome_unidade")) {
    const nomeUnidade = String(data.nome_unidade ?? "").trim();
    data.nome_unidade = nomeUnidade || null;
  }

  return { ok: true as const };
};

const validateColaborador = (data: Record<string, unknown>) => {
  const nome = String(data.nome ?? "").trim();
  if (!nome) {
    return { ok: false as const, error: "nome é obrigatório." };
  }
  data.nome = nome;

  const sobrenome = String(data.sobrenome ?? "").trim();
  data.sobrenome = sobrenome || null;

  const email = String(data.email ?? "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false as const, error: "email inválido." };
  }
  data.email = email ? email.toLowerCase() : null;

  if (Object.prototype.hasOwnProperty.call(data, "telefone")) {
    const tel = normalizeDigitsString(data.telefone);
    data.telefone = tel || null;
    if (Object.prototype.hasOwnProperty.call(data, "wpp")) {
      data.wpp = normalizeBoolInt(data.wpp) || isLikelyBrazilMobile(tel) ? 1 : 0;
    } else {
      data.wpp = isLikelyBrazilMobile(tel) ? 1 : 0;
    }
  }

  const departamentos = normalizeColaboradorDepartamentos(data.departamento);
  if (!departamentos) {
    return { ok: false as const, error: "departamento é obrigatório." };
  }
  data.departamento = departamentos;

  data.chefia = normalizeBoolInt(data.chefia);

  return { ok: true as const };
};

const normalizeTelefoneAndWpp = (data: Record<string, unknown>) => {
  if (!Object.prototype.hasOwnProperty.call(data, "telefone")) return { ok: true as const };
  const tel = normalizeDigitsString(data.telefone);
  data.telefone = tel || null;
  data.wpp = normalizeBoolInt(data.wpp) || isLikelyBrazilMobile(tel) ? 1 : 0;
  return { ok: true as const };
};

const isValidHourHHMM = (value: unknown) => {
  const s = String(value ?? "").trim();
  if (!/^\d{2}:\d{2}$/.test(s)) return false;
  const h = Number(s.slice(0, 2));
  const m = Number(s.slice(3, 5));
  return Number.isInteger(h) && Number.isInteger(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59;
};

const validatePlantaoContato = (data: Record<string, unknown>) => {
  const tipo = normalizeEnumText(data.tipo);
  const raw = String(data.numero_ou_url ?? data.telefone ?? "").trim();
  if (!raw) return { ok: false as const, error: "numero_ou_url é obrigatório." };
  if (tipo === "website") {
    const u = normalizeWebsiteValue(raw);
    if (!u) return { ok: false as const, error: "URL inválida em numero_ou_url (use http/https)." };
    data.numero_ou_url = u;
    data.telefone = null;
    data.wpp = 0;
    data.tipo = "website";
    return { ok: true as const };
  }
  // telefone: somente números; WhatsApp fica no booleano wpp.
  const digits = normalizeDigitsString(raw);
  if (!digits) return { ok: false as const, error: "Número inválido em numero_ou_url." };
  data.numero_ou_url = digits;
  data.telefone = digits;
  data.wpp = normalizeBoolInt(data.wpp) || isLikelyBrazilMobile(digits) ? 1 : 0;
  data.tipo = "telefone";
  return { ok: true as const };
};

const validatePlantaoHorario = (data: Record<string, unknown>, idSingular: string) => {
  const dia = Number(data.dia_semana);
  if (!Number.isFinite(dia) || dia < 0 || dia > 6) {
    return { ok: false as const, error: "dia_semana inválido. Use 0 (domingo) a 6 (sábado)." };
  }
  if (!isValidHourHHMM(data.hora_inicio) || !isValidHourHHMM(data.hora_fim)) {
    return { ok: false as const, error: "hora_inicio/hora_fim inválidos. Use HH:MM (24h)." };
  }
  const clinicaId = String(data.plantao_clinica_id ?? "").trim();
  if (clinicaId) {
    const exists = db.queryEntries<any>(
      `SELECT id FROM ${TBL("cooperativa_plantao_clinicas")} WHERE id = ? AND id_singular = ? LIMIT 1`,
      [clinicaId, idSingular],
    )?.[0];
    if (!exists?.id) {
      return { ok: false as const, error: "plantao_clinica_id não pertence à cooperativa informada." };
    }
    data.plantao_clinica_id = clinicaId;
  } else {
    data.plantao_clinica_id = null;
  }
  data.dia_semana = Math.trunc(dia);
  return { ok: true as const };
};

const syncPlantaoClinicaFromEndereco = (cooperativaId: string, enderecoId: string) => {
  const endereco = db.queryEntries<any>(
    `SELECT * FROM ${TBL("cooperativa_enderecos")} WHERE id = ? AND id_singular = ? LIMIT 1`,
    [enderecoId, cooperativaId],
  )?.[0];
  if (!endereco?.id) return null;

  const tipo = normalizeEnderecoTipo(endereco.tipo);
  const linkedClinicId = String(endereco.plantao_clinica_id ?? "").trim();

  if (!isEnderecoTipoPlantao(tipo)) {
    if (linkedClinicId) {
      try {
        db.query(
          `UPDATE ${TBL("cooperativa_plantao_clinicas")}
              SET endereco_id = NULL
            WHERE id = ? AND id_singular = ?`,
          [linkedClinicId, cooperativaId],
        );
      } catch (_) {
        /* ignore */
      }
      try {
        db.query(
          `UPDATE ${TBL("cooperativa_enderecos")}
              SET plantao_clinica_id = NULL
            WHERE id = ? AND id_singular = ?`,
          [enderecoId, cooperativaId],
        );
      } catch (_) {
        /* ignore */
      }
    }
    return null;
  }

  const cdMunicipio = normalizeCdMunicipio7(endereco.cd_municipio_7);
  if (!cdMunicipio) return null;

  let clinica = linkedClinicId
    ? db.queryEntries<any>(
      `SELECT * FROM ${TBL("cooperativa_plantao_clinicas")} WHERE id = ? AND id_singular = ? LIMIT 1`,
      [linkedClinicId, cooperativaId],
    )?.[0]
    : null;

  if (!clinica) {
    clinica = db.queryEntries<any>(
      `SELECT * FROM ${TBL("cooperativa_plantao_clinicas")} WHERE endereco_id = ? AND id_singular = ? LIMIT 1`,
      [enderecoId, cooperativaId],
    )?.[0] ?? null;
  }

  const clinicaId = String(clinica?.id ?? "").trim() || safeRandomId("pcl");
  const nomeLocal = String(endereco.nome_local ?? "").trim();
  const descricao = String(clinica?.descricao ?? "").trim() || (nomeLocal ? `Vinculado: ${nomeLocal}` : "Endereço de plantão");
  const ativo = normalizeBoolInt(endereco.ativo ?? 1);
  const telefone = normalizeDigitsString(endereco.telefone ?? null);
  const wpp = normalizeBoolInt(endereco.wpp);

  if (clinica?.id) {
    db.query(
      `UPDATE ${TBL("cooperativa_plantao_clinicas")}
          SET cd_municipio_7 = ?, nome_local = ?, cep = ?, logradouro = ?, numero = ?, complemento = ?, bairro = ?, cidade = ?, uf = ?, telefone = ?, wpp = ?, descricao = ?, ativo = ?, endereco_id = ?
        WHERE id = ? AND id_singular = ?`,
      [
        cdMunicipio,
        nomeLocal || null,
        endereco.cep ?? null,
        endereco.logradouro ?? null,
        endereco.numero ?? null,
        endereco.complemento ?? null,
        endereco.bairro ?? null,
        endereco.cidade ?? null,
        endereco.uf ?? null,
        telefone,
        wpp,
        descricao,
        ativo,
        enderecoId,
        clinicaId,
        cooperativaId,
      ] as any,
    );
  } else {
    db.query(
      `INSERT INTO ${
        TBL("cooperativa_plantao_clinicas")
      } (id, id_singular, cd_municipio_7, nome_local, cep, logradouro, numero, complemento, bairro, cidade, uf, telefone, wpp, descricao, endereco_id, ativo)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        clinicaId,
        cooperativaId,
        cdMunicipio,
        nomeLocal || null,
        endereco.cep ?? null,
        endereco.logradouro ?? null,
        endereco.numero ?? null,
        endereco.complemento ?? null,
        endereco.bairro ?? null,
        endereco.cidade ?? null,
        endereco.uf ?? null,
        telefone,
        wpp,
        descricao,
        enderecoId,
        ativo,
      ] as any,
    );
  }

  db.query(
    `UPDATE ${TBL("cooperativa_enderecos")}
        SET plantao_clinica_id = ?
      WHERE id = ? AND id_singular = ?`,
    [clinicaId, enderecoId, cooperativaId],
  );

  return clinicaId;
};

const syncEnderecoFromPlantaoClinica = (cooperativaId: string, plantaoClinicaId: string) => {
  const clinica = db.queryEntries<any>(
    `SELECT * FROM ${TBL("cooperativa_plantao_clinicas")} WHERE id = ? AND id_singular = ? LIMIT 1`,
    [plantaoClinicaId, cooperativaId],
  )?.[0];
  if (!clinica?.id) return null;

  const cdMunicipio = normalizeCdMunicipio7(clinica.cd_municipio_7);
  if (!cdMunicipio) return null;

  let endereco = String(clinica.endereco_id ?? "").trim()
    ? db.queryEntries<any>(
      `SELECT * FROM ${TBL("cooperativa_enderecos")} WHERE id = ? AND id_singular = ? LIMIT 1`,
      [String(clinica.endereco_id).trim(), cooperativaId],
    )?.[0]
    : null;

  if (!endereco) {
    endereco = db.queryEntries<any>(
      `SELECT * FROM ${TBL("cooperativa_enderecos")} WHERE plantao_clinica_id = ? AND id_singular = ? LIMIT 1`,
      [plantaoClinicaId, cooperativaId],
    )?.[0] ?? null;
  }

  const enderecoId = String(endereco?.id ?? "").trim() || safeRandomId("end");
  const ativo = normalizeBoolInt(clinica.ativo ?? 1);
  const wpp = normalizeBoolInt(clinica.wpp);
  const telefone = normalizeDigitsString(clinica.telefone ?? null);
  const exibirVisaoGeral = normalizeBoolInt(endereco?.exibir_visao_geral ?? 1);

  if (endereco?.id) {
    db.query(
      `UPDATE ${TBL("cooperativa_enderecos")}
          SET tipo = ?, nome_local = ?, cd_municipio_7 = ?, cep = ?, logradouro = ?, numero = ?, complemento = ?, bairro = ?, cidade = ?, uf = ?, telefone = ?, wpp = ?, exibir_visao_geral = ?, plantao_clinica_id = ?, ativo = ?
        WHERE id = ? AND id_singular = ?`,
      [
        ENDERECO_TIPO_PLANTAO,
        clinica.nome_local ?? null,
        cdMunicipio,
        clinica.cep ?? null,
        clinica.logradouro ?? null,
        clinica.numero ?? null,
        clinica.complemento ?? null,
        clinica.bairro ?? null,
        clinica.cidade ?? null,
        clinica.uf ?? null,
        telefone,
        wpp,
        exibirVisaoGeral,
        plantaoClinicaId,
        ativo,
        enderecoId,
        cooperativaId,
      ] as any,
    );
  } else {
    db.query(
      `INSERT INTO ${
        TBL("cooperativa_enderecos")
      } (id, id_singular, tipo, nome_local, cd_municipio_7, cep, logradouro, numero, complemento, bairro, cidade, uf, telefone, wpp, exibir_visao_geral, plantao_clinica_id, ativo)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        enderecoId,
        cooperativaId,
        ENDERECO_TIPO_PLANTAO,
        clinica.nome_local ?? null,
        cdMunicipio,
        clinica.cep ?? null,
        clinica.logradouro ?? null,
        clinica.numero ?? null,
        clinica.complemento ?? null,
        clinica.bairro ?? null,
        clinica.cidade ?? null,
        clinica.uf ?? null,
        telefone,
        wpp,
        1,
        plantaoClinicaId,
        ativo,
      ] as any,
    );
  }

  db.query(
    `UPDATE ${TBL("cooperativa_plantao_clinicas")}
        SET endereco_id = ?
      WHERE id = ? AND id_singular = ?`,
    [enderecoId, plantaoClinicaId, cooperativaId],
  );

  return enderecoId;
};

const isValidEmailValue = (value: unknown) => {
  const v = String(value ?? "").trim();
  if (!v) return false;
  if (v.length > 254) return false;
  // Validação simples e pragmática (evita bloquear emails válidos por regras RFC complexas).
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
};

const normalizeEmailValue = (value: unknown) => {
  const v = String(value ?? "").trim();
  if (!v) return null;
  return v.toLowerCase();
};

const normalizeWebsiteValue = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    return null;
  }
  const proto = (u.protocol || "").toLowerCase();
  if (proto !== "http:" && proto !== "https:") return null;
  // Comparação/armazenamento: remover fragmento e padronizar host; manter query.
  u.hash = "";
  u.protocol = proto;
  u.hostname = u.hostname.toLowerCase();
  // Remover "/" final, exceto root.
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.slice(0, -1);
  }
  return u.toString();
};

const validateAndNormalizeContato = (data: Record<string, unknown>) => {
  const tipo = normalizeEnumText(data.tipo);
  const valor = data.valor;
  if (tipo === "email") {
    const normalized = normalizeEmailValue(valor);
    if (!normalized || !isValidEmailValue(normalized)) {
      return { ok: false as const, error: "Email inválido em valor.", normalizedValor: null };
    }
    return { ok: true as const, normalizedValor: normalized };
  }
  if (tipo === "website") {
    const normalized = normalizeWebsiteValue(valor);
    if (!normalized) {
      return { ok: false as const, error: "URL inválida em valor (use http/https).", normalizedValor: null };
    }
    return { ok: true as const, normalizedValor: normalized };
  }
  if (tipo === "telefone" || tipo === "whatsapp" || tipo === "celular") {
    const digits = normalizeDigitsString(valor);
    if (!digits) {
      return { ok: false as const, error: "Telefone inválido em valor.", normalizedValor: null };
    }
    data.tipo = "telefone";
    data.wpp = normalizeBoolInt(data.wpp) || tipo === "whatsapp" || isLikelyBrazilMobile(digits) ? 1 : 0;
    return { ok: true as const, normalizedValor: digits };
  }
  return { ok: true as const, normalizedValor: valor ?? null };
};

const isWebsiteContato = (row: any) => {
  const tipo = normalizeEnumText(row?.tipo);
  if (tipo === "website") return true;
  if (tipo === "outro") {
    const label = normalizeEnumText(row?.label);
    if (
      label.includes("site") || label.includes("web") ||
      label.includes("url")
    ) {
      return true;
    }
  }
  if (!tipo || tipo === "website" || tipo === "outro") {
    return Boolean(normalizeWebsiteValue(row?.valor));
  }
  return false;
};

const getCooperativaWebsiteContato = (
  cooperativaId: string,
  dbClient: DbAdapter | null = null,
) => {
  const target = (dbClient ?? (db as unknown as DbAdapter)) as DbAdapter;
  const rows = target.queryEntries<any>(
    `SELECT id, id_singular, tipo, subtipo, valor, wpp, principal, ativo, label
       FROM ${TBL("cooperativa_contatos")}
      WHERE id_singular = ?
      ORDER BY COALESCE(ativo, 1) DESC, COALESCE(principal, 0) DESC, id DESC`,
    [cooperativaId],
  ) || [];
  return rows.find((row) => isWebsiteContato(row)) ?? null;
};

const getCooperativaWebsiteValue = (
  cooperativaId: string,
  dbClient: DbAdapter | null = null,
) => {
  const contato = getCooperativaWebsiteContato(cooperativaId, dbClient);
  if (!contato) return null;
  const normalized = normalizeWebsiteValue(contato.valor);
  if (normalized) return normalized;
  const raw = String(contato.valor ?? "").trim();
  return raw || null;
};

const dedupeCooperativaContatosByTargets = (targets: string[]) => {
  if (!targets.length) return { deleted: 0 };
  let deleted = 0;
  for (const idSingular of targets) {
    const rows = db.queryEntries<any>(
      `SELECT id, tipo, valor, principal, criado_em
         FROM ${TBL("cooperativa_contatos")}
        WHERE id_singular = ?`,
      [idSingular],
    ) || [];
    const groups = new Map<string, any[]>();
    for (const r of rows) {
      const tipo = normalizeAuxImportRow("contatos", { tipo: r.tipo, subtipo: null, valor: r.valor, principal: r.principal })?.tipo;
      const normalizedTipo = normalizeEnumText(tipo);
      let normalizedValor: string | null = String(r.valor ?? "").trim();
      if (normalizedTipo === "email") {
        normalizedValor = normalizeEmailValue(normalizedValor);
      } else if (normalizedTipo === "website") {
        normalizedValor = normalizeWebsiteValue(normalizedValor);
      }
      if (!normalizedTipo || !normalizedValor) continue;
      const key = `${idSingular}|${normalizedTipo}|${normalizedValor}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    for (const list of groups.values()) {
      if (list.length <= 1) continue;
      list.sort((a, b) => {
        const pa = Number(a.principal || 0);
        const pb = Number(b.principal || 0);
        if (pa !== pb) return pb - pa;
        const ca = String(a.criado_em || "");
        const cb = String(b.criado_em || "");
        if (ca !== cb) return cb.localeCompare(ca);
        return String(a.id || "").localeCompare(String(b.id || ""));
      });
      const keep = list[0];
      const toDelete = list.slice(1).map((x) => String(x.id || "")).filter(Boolean);
      if (!toDelete.length) continue;
      const placeholders = toDelete.map(() => "?").join(",");
      db.query(
        `DELETE FROM ${TBL("cooperativa_contatos")} WHERE id IN (${placeholders})`,
        toDelete as any,
      );
      deleted += toDelete.length;
      // Garantir que o "keep" permaneça principal se existia algum principal no grupo.
      if (list.some((x) => Number(x.principal || 0) === 1) && Number(keep.principal || 0) !== 1) {
        db.query(
          `UPDATE ${TBL("cooperativa_contatos")} SET principal = 1 WHERE id = ?`,
          [keep.id],
        );
      }
    }
  }
  return { deleted };
};

const canViewDiretorCelularByRole = (userData: any, cooperativaId: string) => {
  if (!userData) return false;
  const papel = (userData.papel || "").toLowerCase();
  if (papel === "confederacao" || papel === "federacao") return true;

  if (papel === "admin" && userData.cooperativa_id === cooperativaId) return true;

  // Admin em cooperativas do tipo FEDERACAO/CONFEDERACAO também é considerado admin de sistema.
  if (papel === "admin") {
    const ownInfo = getCooperativaInfo(userData.cooperativa_id);
    const ownTipo = (ownInfo?.tipo || "").toUpperCase();
    if (ownTipo === "FEDERACAO" || ownTipo === "CONFEDERACAO") return true;
  }

  return false;
};

const getDiretorPhoneRequestStatusMapForUser = (
  cooperativaId: string,
  requesterEmail: string,
) => {
  try {
    const rows = db.queryEntries<any>(
      `SELECT diretor_id, status
         FROM ${TBL("diretor_phone_access_requests")}
        WHERE cooperativa_id = ?
          AND LOWER(requester_email) = LOWER(?)
        ORDER BY created_at DESC`,
      [cooperativaId, requesterEmail],
    ) || [];

    const map = new Map<string, string>();
    for (const row of rows) {
      const diretorId = String(row.diretor_id || "");
      if (!diretorId || map.has(diretorId)) continue;
      map.set(diretorId, String(row.status || "pending"));
    }
    return map;
  } catch (error) {
    console.warn("[diretores] falha ao buscar status de solicitação por usuário:", error);
    return new Map<string, string>();
  }
};

const notifyDiretorPhoneRequestAdmins = async (params: {
  cooperativaId: string;
  requestId: string;
  diretorNome: string;
  requesterEmail: string;
  requesterNome: string;
  motivo?: string | null;
}) => {
  try {
    const admins = getApprovedAdminsForCoop(params.cooperativaId);
    if (!admins.length) return;
    const now = nowIso();
    const mensagemBase =
      `Solicitação LGPD: ${params.requesterNome} pediu acesso ao celular de ${params.diretorNome}.`;
    const detalhes = params.motivo
      ? `Motivo: ${params.motivo}`
      : "Sem motivo informado.";

    for (const admin of admins) {
      if (admin.email.toLowerCase() === params.requesterEmail.toLowerCase()) continue;
      db.query(
        `INSERT INTO ${TBL("alertas")} (
          id, pedido_id, pedido_titulo, destinatario_email, destinatario_nome, destinatario_cooperativa_id,
          tipo, mensagem, detalhes, lido, criado_em, disparado_por_email, disparado_por_nome
        ) VALUES (?,?,?,?,?,?,?,?,?,0,?,?,?)`,
        [
          safeRandomId("alert"),
          `LGPD-DIR-${params.requestId}`,
          "Solicitação de contato de diretor",
          admin.email,
          admin.nome || admin.email,
          params.cooperativaId,
          "atualizacao",
          mensagemBase,
          detalhes,
          now,
          params.requesterEmail,
          params.requesterNome,
        ],
      );
    }
  } catch (error) {
    console.warn("[diretores] falha ao notificar admins sobre solicitação:", error);
  }
};

const notifyDiretorPhoneRequesterDecision = (params: {
  requestId: string;
  cooperativaId: string;
  requesterEmail: string;
  requesterNome: string;
  diretorNome: string;
  status: "approved" | "rejected";
  decidedBy: string;
  decisionNotes?: string | null;
}) => {
  try {
    const now = nowIso();
    const aprovado = params.status === "approved";
    const mensagem = aprovado
      ? `Sua solicitação de acesso ao celular de ${params.diretorNome} foi aprovada.`
      : `Sua solicitação de acesso ao celular de ${params.diretorNome} foi rejeitada.`;
    const detalhes = params.decisionNotes?.trim()
      ? `Observação: ${params.decisionNotes.trim()}`
      : null;

    db.query(
      `INSERT INTO ${TBL("alertas")} (
        id, pedido_id, pedido_titulo, destinatario_email, destinatario_nome, destinatario_cooperativa_id,
        tipo, mensagem, detalhes, lido, criado_em, disparado_por_email, disparado_por_nome
      ) VALUES (?,?,?,?,?,?,?,?,?,0,?,?,?)`,
      [
        safeRandomId("alert"),
        `LGPD-DIR-${params.requestId}`,
        "Solicitação de contato de diretor",
        params.requesterEmail,
        params.requesterNome || params.requesterEmail,
        params.cooperativaId,
        "atualizacao",
        mensagem,
        detalhes,
        now,
        params.decidedBy,
        params.decidedBy,
      ],
    );
  } catch (error) {
    console.warn("[diretores] falha ao notificar solicitante sobre decisão:", error);
  }
};

app.post("/cooperativas/:id/diretores/:diretorId/solicitar-celular", requireAuth, async (c) => {
  try {
    const cooperativaId = normalizeIdSingular(c.req.param("id"));
    const diretorId = c.req.param("diretorId");
    if (!cooperativaId || !diretorId) {
      return c.json({ error: "Parâmetros inválidos" }, 400);
    }

    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);
    if (!userData) return c.json({ error: "Usuário não autenticado" }, 401);
    if (!isCooperativaVisible(userData, cooperativaId)) {
      return c.json({ error: "Acesso negado" }, 403);
    }

    const diretor = db.queryEntries<any>(
      `SELECT * FROM ${TBL("cooperativa_diretores")} WHERE id = ? AND id_singular = ? LIMIT 1`,
      [diretorId, cooperativaId],
    )[0];
    if (!diretor) return c.json({ error: "Diretor não encontrado" }, 404);

    const telefone = normalizeDigitsString(diretor.telefone || diretor.telefone_celular || "");
    if (!telefone) return c.json({ error: "Diretor sem celular cadastrado" }, 400);

    const canViewByRole = canViewDiretorCelularByRole(userData, cooperativaId);
    const divulgarCelular = toBoolean(diretor.divulgar_celular);
    if (canViewByRole || divulgarCelular) {
      return c.json({ error: "Celular já disponível para seu perfil" }, 400);
    }

    const requesterEmail = String(userData.email || "").toLowerCase();
    const requesterNome = userData.display_name || userData.nome || userData.email || "Usuário";

    const existing = db.queryEntries<any>(
      `SELECT id, status
         FROM ${TBL("diretor_phone_access_requests")}
        WHERE cooperativa_id = ?
          AND diretor_id = ?
          AND LOWER(requester_email) = LOWER(?)
        ORDER BY created_at DESC
        LIMIT 1`,
      [cooperativaId, diretorId, requesterEmail],
    )[0];

    if (existing?.status === "pending") {
      return c.json({ message: "Solicitação já pendente de aprovação.", status: "pending", id: existing.id });
    }
    if (existing?.status === "approved") {
      return c.json({ message: "Solicitação já aprovada anteriormente.", status: "approved", id: existing.id });
    }

    let motivo = "";
    try {
      const body = await c.req.json();
      motivo = String(body?.motivo || "").trim();
    } catch {
      /* vazio */
    }

    const requestId = safeRandomId("dirphone");
    db.query(
      `INSERT INTO ${TBL("diretor_phone_access_requests")} (
        id, cooperativa_id, diretor_id, requester_email, requester_nome, requester_cooperativa_id, status, motivo, created_at
      ) VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        requestId,
        cooperativaId,
        diretorId,
        requesterEmail,
        requesterNome,
        userData.cooperativa_id || null,
        "pending",
        motivo || null,
        nowIso(),
      ],
    );

    const diretorNome = [diretor.primeiro_nome, diretor.sobrenome].filter(Boolean).join(" ").trim() || "Diretor";
    await notifyDiretorPhoneRequestAdmins({
      cooperativaId,
      requestId,
      diretorNome,
      requesterEmail,
      requesterNome,
      motivo: motivo || null,
    });

    return c.json({ ok: true, id: requestId, status: "pending" });
  } catch (error) {
    console.error("[diretores] erro ao solicitar celular:", error);
    return c.json({ error: "Erro ao solicitar acesso ao celular" }, 500);
  }
});

app.get("/cooperativas/:id/diretores/celular-requests", requireAuth, async (c) => {
  try {
    const cooperativaId = normalizeIdSingular(c.req.param("id"));
    if (!cooperativaId) return c.json({ error: "id_singular inválido" }, 400);

    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);
    if (!userData) return c.json({ error: "Usuário não autenticado" }, 401);
    if (userData.papel !== "admin" || userData.cooperativa_id !== cooperativaId) {
      return c.json({ error: "Acesso negado" }, 403);
    }

    const statusFilter = String(c.req.query("status") || "pending").toLowerCase();
    const rows = db.queryEntries<any>(
      `SELECT r.*,
              d.primeiro_nome,
              d.sobrenome,
              d.cargo
         FROM ${TBL("diretor_phone_access_requests")} r
         LEFT JOIN ${TBL("cooperativa_diretores")} d ON d.id = r.diretor_id
        WHERE r.cooperativa_id = ?
          AND (? = 'all' OR r.status = ?)
        ORDER BY r.created_at DESC`,
      [cooperativaId, statusFilter, statusFilter],
    ) || [];

    const payload = rows.map((row) => ({
      id: row.id,
      cooperativa_id: row.cooperativa_id,
      diretor_id: row.diretor_id,
      diretor_nome: [row.primeiro_nome, row.sobrenome].filter(Boolean).join(" ").trim() || "Diretor",
      diretor_cargo: row.cargo || null,
      requester_email: row.requester_email,
      requester_nome: row.requester_nome || row.requester_email,
      requester_cooperativa_id: row.requester_cooperativa_id || null,
      status: row.status,
      motivo: row.motivo || null,
      created_at: row.created_at,
      decided_at: row.decided_at || null,
      decided_by: row.decided_by || null,
      decision_notes: row.decision_notes || null,
    }));

    return c.json(payload);
  } catch (error) {
    console.error("[diretores] erro ao listar solicitações de celular:", error);
    return c.json({ error: "Erro ao carregar solicitações" }, 500);
  }
});

app.post("/cooperativas/:id/diretores/celular-requests/:requestId/approve", requireAuth, async (c) => {
  try {
    const cooperativaId = normalizeIdSingular(c.req.param("id"));
    const requestId = c.req.param("requestId");
    if (!cooperativaId || !requestId) return c.json({ error: "Parâmetros inválidos" }, 400);

    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);
    if (!userData) return c.json({ error: "Usuário não autenticado" }, 401);
    if (userData.papel !== "admin" || userData.cooperativa_id !== cooperativaId) {
      return c.json({ error: "Acesso negado" }, 403);
    }

    const reqRow = db.queryEntries<any>(
      `SELECT r.*, d.primeiro_nome, d.sobrenome
         FROM ${TBL("diretor_phone_access_requests")} r
         LEFT JOIN ${TBL("cooperativa_diretores")} d ON d.id = r.diretor_id
        WHERE r.id = ? AND r.cooperativa_id = ? LIMIT 1`,
      [requestId, cooperativaId],
    )[0];
    if (!reqRow) return c.json({ error: "Solicitação não encontrada" }, 404);
    if (reqRow.status !== "pending") return c.json({ error: "Solicitação já processada" }, 400);

    let notes = "";
    try {
      const body = await c.req.json();
      notes = String(body?.notes || "").trim();
    } catch {
      /* ignore */
    }

    const now = nowIso();
    db.query(
      `UPDATE ${TBL("diretor_phone_access_requests")}
          SET status = 'approved',
              decided_at = ?,
              decided_by = ?,
              decision_notes = ?
        WHERE id = ?`,
      [now, userData.email, notes || null, requestId],
    );

    const diretorNome = [reqRow.primeiro_nome, reqRow.sobrenome].filter(Boolean).join(" ").trim() || "Diretor";
    notifyDiretorPhoneRequesterDecision({
      requestId,
      cooperativaId,
      requesterEmail: reqRow.requester_email,
      requesterNome: reqRow.requester_nome || reqRow.requester_email,
      diretorNome,
      status: "approved",
      decidedBy: userData.email || "admin",
      decisionNotes: notes || null,
    });

    return c.json({ ok: true });
  } catch (error) {
    console.error("[diretores] erro ao aprovar solicitação de celular:", error);
    return c.json({ error: "Erro ao aprovar solicitação" }, 500);
  }
});

app.post("/cooperativas/:id/diretores/celular-requests/:requestId/reject", requireAuth, async (c) => {
  try {
    const cooperativaId = normalizeIdSingular(c.req.param("id"));
    const requestId = c.req.param("requestId");
    if (!cooperativaId || !requestId) return c.json({ error: "Parâmetros inválidos" }, 400);

    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);
    if (!userData) return c.json({ error: "Usuário não autenticado" }, 401);
    if (userData.papel !== "admin" || userData.cooperativa_id !== cooperativaId) {
      return c.json({ error: "Acesso negado" }, 403);
    }

    const reqRow = db.queryEntries<any>(
      `SELECT r.*, d.primeiro_nome, d.sobrenome
         FROM ${TBL("diretor_phone_access_requests")} r
         LEFT JOIN ${TBL("cooperativa_diretores")} d ON d.id = r.diretor_id
        WHERE r.id = ? AND r.cooperativa_id = ? LIMIT 1`,
      [requestId, cooperativaId],
    )[0];
    if (!reqRow) return c.json({ error: "Solicitação não encontrada" }, 404);
    if (reqRow.status !== "pending") return c.json({ error: "Solicitação já processada" }, 400);

    let notes = "";
    try {
      const body = await c.req.json();
      notes = String(body?.notes || "").trim();
    } catch {
      /* ignore */
    }

    const now = nowIso();
    db.query(
      `UPDATE ${TBL("diretor_phone_access_requests")}
          SET status = 'rejected',
              decided_at = ?,
              decided_by = ?,
              decision_notes = ?
        WHERE id = ?`,
      [now, userData.email, notes || null, requestId],
    );

    const diretorNome = [reqRow.primeiro_nome, reqRow.sobrenome].filter(Boolean).join(" ").trim() || "Diretor";
    notifyDiretorPhoneRequesterDecision({
      requestId,
      cooperativaId,
      requesterEmail: reqRow.requester_email,
      requesterNome: reqRow.requester_nome || reqRow.requester_email,
      diretorNome,
      status: "rejected",
      decidedBy: userData.email || "admin",
      decisionNotes: notes || null,
    });

    return c.json({ ok: true });
  } catch (error) {
    console.error("[diretores] erro ao rejeitar solicitação de celular:", error);
    return c.json({ error: "Erro ao rejeitar solicitação" }, 500);
  }
});

app.get("/cooperativas/:id/aux/:resource", requireAuth, async (c) => {
  try {
    const cooperativaId = normalizeIdSingular(c.req.param("id"));
    if (!cooperativaId) return c.json({ error: "id_singular inválido" }, 400);
    const resource = (c.req.param("resource") || "").toLowerCase();
    const def = COOP_AUX_RESOURCES[resource];
    if (!def) return c.json({ error: "Recurso inválido" }, 400);

    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);
    if (!userData) return c.json({ error: "Usuário não autenticado" }, 401);

    const visible = getVisibleCooperativas(userData);
    if (!canReadAnyCooperativaData(userData) && visible && !visible.has(cooperativaId) && userData.papel !== "confederacao") {
      return c.json({ error: "Acesso negado" }, 403);
    }

    let rows: any[] = [];
    try {
      rows = db.queryEntries<any>(
        `SELECT * FROM ${def.table} WHERE id_singular = ? ORDER BY ativo DESC`,
        [cooperativaId],
      ) || [];
    } catch (queryError) {
      const msg = String((queryError as any)?.message || "").toLowerCase();
      // Tolerância para ambiente sem migração aplicada ainda: evita quebrar a tela.
      if (
        (resource === "regulatorio" || resource === "colaboradores") &&
        msg.includes("no such table")
      ) {
        return c.json([]);
      }
      throw queryError;
    }
    if (resource !== "diretores") {
      return c.json(rows);
    }

    const canViewByRole = canViewDiretorCelularByRole(userData, cooperativaId);
    const requesterEmail = String(userData.email || "").toLowerCase();
    const requestStatusMap = requesterEmail
      ? getDiretorPhoneRequestStatusMapForUser(cooperativaId, requesterEmail)
      : new Map<string, string>();

    const masked = rows.map((row) => {
      const divulgar = toBoolean(row.divulgar_celular);
      const requestStatus = requestStatusMap.get(String(row.id || "")) || null;
      const approvedForRequester = requestStatus === "approved";
      const hidePhone = !canViewByRole && !divulgar && !approvedForRequester;

      return {
        ...row,
        divulgar_celular: divulgar ? 1 : 0,
        telefone_celular_restrito: hidePhone,
        pode_solicitar_celular: hidePhone && Boolean(normalizeDigitsString(row.telefone || row.telefone_celular || "")),
        celular_request_status: requestStatus,
        telefone: hidePhone ? null : (row.telefone || row.telefone_celular || null),
        telefone_celular: hidePhone ? null : (row.telefone || row.telefone_celular || null),
      };
    });

    return c.json(masked);
  } catch (error) {
    console.error("[coop-aux] erro ao listar:", error);
    return c.json({ error: "Erro ao carregar dados auxiliares" }, 500);
  }
});

app.post("/cooperativas/:id/aux/:resource", requireAuth, async (c) => {
  try {
    const cooperativaId = normalizeIdSingular(c.req.param("id"));
    if (!cooperativaId) return c.json({ error: "id_singular inválido" }, 400);
    const resource = (c.req.param("resource") || "").toLowerCase();
    const body = await c.req.json().catch(() => ({}));
    const picked = pickAuxPayload(resource, body);
    if (!picked) return c.json({ error: "Recurso inválido" }, 400);
    if (resource === "plantao") {
      const already = db.queryEntries<any>(
        `SELECT id FROM ${TBL("cooperativa_plantao")} WHERE id_singular = ? LIMIT 1`,
        [cooperativaId],
      )?.[0];
      if (already?.id) {
        return c.json({ error: "Já existe um registro de plantão para esta singular. Edite o registro existente." }, 400);
      }
    }
    if (resource === "plantao_clinicas") {
      const cd = normalizeCdMunicipio7((picked.data as any).cd_municipio_7);
      if (!cd) {
        return c.json({ error: "cd_municipio_7 obrigatório e deve ter 7 dígitos (IBGE)." }, 400);
      }
      (picked.data as any).cd_municipio_7 = cd;
    }
    if (resource === "enderecos" || resource === "plantao_clinicas") {
      const normalized = applyEnderecoByCdMunicipio7(picked.data as Record<string, unknown>);
      if (!normalized.ok) return c.json({ error: normalized.error }, 400);
    }
    if (["auditores", "diretores", "enderecos", "ouvidores", "lgpd", "colaboradores", "plantao_clinicas"].includes(resource)) {
      const normalized = normalizeTelefoneAndWpp(picked.data as Record<string, unknown>);
      if (!normalized.ok) return c.json({ error: "Telefone inválido." }, 400);
    }
    if (resource === "plantao_contatos") {
      const ok = validatePlantaoContato(picked.data as Record<string, unknown>);
      if (!ok.ok) return c.json({ error: ok.error }, 400);
    }
    if (resource === "contatos") {
      const ok = validateAndNormalizeContato(picked.data as Record<string, unknown>);
      if (!ok.ok) return c.json({ error: ok.error }, 400);
      (picked.data as any).valor = ok.normalizedValor;
    }
    if (resource === "plantao_horarios") {
      const ok = validatePlantaoHorario(picked.data as Record<string, unknown>, cooperativaId);
      if (!ok.ok) return c.json({ error: ok.error }, 400);
    }
    if (resource === "regulatorio") {
      const ok = validateRegulatorio(picked.data as Record<string, unknown>);
      if (!ok.ok) return c.json({ error: ok.error }, 400);
    }
    if (resource === "colaboradores") {
      const ok = validateColaborador(picked.data as Record<string, unknown>);
      if (!ok.ok) return c.json({ error: ok.error }, 400);
    }
    if (resource === "enderecos") {
      if (!Object.prototype.hasOwnProperty.call(picked.data, "exibir_visao_geral")) {
        (picked.data as any).exibir_visao_geral = 1;
      } else {
        (picked.data as any).exibir_visao_geral = normalizeBoolInt((picked.data as any).exibir_visao_geral);
      }
    }

    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);
    if (!userData) return c.json({ error: "Usuário não autenticado" }, 401);
    if (!canManageCooperativa(userData, cooperativaId)) {
      return c.json({ error: "Acesso negado" }, 403);
    }

    const id = generateToken();
    const cols = ["id", "id_singular", ...Object.keys(picked.data)];
    const placeholders = cols.map(() => "?").join(",");
    const values = [
      id,
      cooperativaId,
      ...Object.keys(picked.data).map((k) => (picked.data as any)[k]),
    ];
    db.query(
      `INSERT INTO ${picked.def.table} (${cols.join(",")}) VALUES (${placeholders})`,
      values as any,
    );

    let row = db.queryEntries<any>(
      `SELECT * FROM ${picked.def.table} WHERE id = ? AND id_singular = ? LIMIT 1`,
      [id, cooperativaId],
    )[0];
    if (resource === "enderecos") {
      syncPlantaoClinicaFromEndereco(cooperativaId, id);
      row = db.queryEntries<any>(
        `SELECT * FROM ${picked.def.table} WHERE id = ? AND id_singular = ? LIMIT 1`,
        [id, cooperativaId],
      )[0] ?? row;
    }
    if (resource === "plantao_clinicas") {
      syncEnderecoFromPlantaoClinica(cooperativaId, id);
      row = db.queryEntries<any>(
        `SELECT * FROM ${picked.def.table} WHERE id = ? AND id_singular = ? LIMIT 1`,
        [id, cooperativaId],
      )[0] ?? row;
    }
    return c.json(row ?? { id, id_singular: cooperativaId, ...picked.data });
  } catch (error) {
    console.error("[coop-aux] erro ao criar:", error);
    const msg = String((error as any)?.message || "");
    if (msg.includes("UNIQUE constraint failed") && msg.includes(`${TBL("cooperativa_plantao")}.id_singular`)) {
      return c.json({ error: "Já existe um registro de plantão para esta singular. Edite o existente." }, 400);
    }
    return c.json({ error: "Erro ao salvar registro" }, 500);
  }
});

app.put("/cooperativas/:id/aux/:resource/:itemId", requireAuth, async (c) => {
  try {
    const cooperativaId = normalizeIdSingular(c.req.param("id"));
    if (!cooperativaId) return c.json({ error: "id_singular inválido" }, 400);
    const resource = (c.req.param("resource") || "").toLowerCase();
    const itemId = c.req.param("itemId");
    const body = await c.req.json().catch(() => ({}));
    const picked = pickAuxPayload(resource, body);
    if (!picked) return c.json({ error: "Recurso inválido" }, 400);
    if (resource === "plantao_clinicas") {
      const cd = normalizeCdMunicipio7((picked.data as any).cd_municipio_7);
      if (!cd) {
        return c.json({ error: "cd_municipio_7 obrigatório e deve ter 7 dígitos (IBGE)." }, 400);
      }
      (picked.data as any).cd_municipio_7 = cd;
    }
    if (resource === "enderecos" || resource === "plantao_clinicas") {
      const normalized = applyEnderecoByCdMunicipio7(picked.data as Record<string, unknown>);
      if (!normalized.ok) return c.json({ error: normalized.error }, 400);
    }
    if (["auditores", "diretores", "enderecos", "ouvidores", "lgpd", "colaboradores", "plantao_clinicas"].includes(resource)) {
      const normalized = normalizeTelefoneAndWpp(picked.data as Record<string, unknown>);
      if (!normalized.ok) return c.json({ error: "Telefone inválido." }, 400);
    }
    if (resource === "plantao_contatos") {
      const ok = validatePlantaoContato(picked.data as Record<string, unknown>);
      if (!ok.ok) return c.json({ error: ok.error }, 400);
    }
    if (resource === "contatos") {
      const ok = validateAndNormalizeContato(picked.data as Record<string, unknown>);
      if (!ok.ok) return c.json({ error: ok.error }, 400);
      (picked.data as any).valor = ok.normalizedValor;
    }
    if (resource === "plantao_horarios") {
      const ok = validatePlantaoHorario(picked.data as Record<string, unknown>, cooperativaId);
      if (!ok.ok) return c.json({ error: ok.error }, 400);
    }
    if (resource === "regulatorio") {
      const ok = validateRegulatorio(picked.data as Record<string, unknown>);
      if (!ok.ok) return c.json({ error: ok.error }, 400);
    }
    if (resource === "colaboradores") {
      const ok = validateColaborador(picked.data as Record<string, unknown>);
      if (!ok.ok) return c.json({ error: ok.error }, 400);
    }
    if (resource === "enderecos" && Object.prototype.hasOwnProperty.call(picked.data, "exibir_visao_geral")) {
      (picked.data as any).exibir_visao_geral = normalizeBoolInt((picked.data as any).exibir_visao_geral);
    }

    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);
    if (!userData) return c.json({ error: "Usuário não autenticado" }, 401);
    if (!canManageCooperativa(userData, cooperativaId)) {
      return c.json({ error: "Acesso negado" }, 403);
    }

    const keys = Object.keys(picked.data);
    if (!keys.length) return c.json({ error: "Nenhum campo para atualizar" }, 400);

    const sets = keys.map((k) => `${k} = ?`).join(", ");
    const values = keys.map((k) => (picked.data as any)[k]);
    db.query(
      `UPDATE ${picked.def.table} SET ${sets} WHERE id = ? AND id_singular = ?`,
      [...values, itemId, cooperativaId] as any,
    );

    let row = db.queryEntries<any>(
      `SELECT * FROM ${picked.def.table} WHERE id = ? AND id_singular = ? LIMIT 1`,
      [itemId, cooperativaId],
    )[0];
    if (resource === "enderecos") {
      syncPlantaoClinicaFromEndereco(cooperativaId, itemId);
      row = db.queryEntries<any>(
        `SELECT * FROM ${picked.def.table} WHERE id = ? AND id_singular = ? LIMIT 1`,
        [itemId, cooperativaId],
      )[0] ?? row;
    }
    if (resource === "plantao_clinicas") {
      syncEnderecoFromPlantaoClinica(cooperativaId, itemId);
      row = db.queryEntries<any>(
        `SELECT * FROM ${picked.def.table} WHERE id = ? AND id_singular = ? LIMIT 1`,
        [itemId, cooperativaId],
      )[0] ?? row;
    }
    return c.json(row ?? { id: itemId, id_singular: cooperativaId, ...picked.data });
  } catch (error) {
    console.error("[coop-aux] erro ao atualizar:", error);
    return c.json({ error: "Erro ao atualizar registro" }, 500);
  }
});

app.delete("/cooperativas/:id/aux/:resource/:itemId", requireAuth, async (c) => {
  try {
    const cooperativaId = normalizeIdSingular(c.req.param("id"));
    if (!cooperativaId) return c.json({ error: "id_singular inválido" }, 400);
    const resource = (c.req.param("resource") || "").toLowerCase();
    const itemId = c.req.param("itemId");
    const def = COOP_AUX_RESOURCES[resource];
    if (!def) return c.json({ error: "Recurso inválido" }, 400);

    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);
    if (!userData) return c.json({ error: "Usuário não autenticado" }, 401);
    if (!canManageCooperativa(userData, cooperativaId)) {
      return c.json({ error: "Acesso negado" }, 403);
    }

    const existing = db.queryEntries<any>(
      `SELECT * FROM ${def.table} WHERE id = ? AND id_singular = ? LIMIT 1`,
      [itemId, cooperativaId],
    )?.[0] ?? null;

    db.query(
      `DELETE FROM ${def.table} WHERE id = ? AND id_singular = ?`,
      [itemId, cooperativaId],
    );

    if (resource === "enderecos") {
      const linkedClinicId = String(existing?.plantao_clinica_id ?? "").trim();
      if (linkedClinicId) {
        try {
          db.query(
            `DELETE FROM ${TBL("cooperativa_plantao_horarios")} WHERE plantao_clinica_id = ? AND id_singular = ?`,
            [linkedClinicId, cooperativaId],
          );
        } catch (_) {
          /* ignore */
        }
        try {
          db.query(
            `DELETE FROM ${TBL("cooperativa_plantao_clinicas")} WHERE id = ? AND id_singular = ?`,
            [linkedClinicId, cooperativaId],
          );
        } catch (_) {
          /* ignore */
        }
      }
    }

    if (resource === "plantao_clinicas") {
      const linkedEnderecoId = String(existing?.endereco_id ?? "").trim();
      if (linkedEnderecoId) {
        try {
          db.query(
            `DELETE FROM ${TBL("cooperativa_enderecos")} WHERE id = ? AND id_singular = ?`,
            [linkedEnderecoId, cooperativaId],
          );
        } catch (_) {
          /* ignore */
        }
      }
    }
    return c.json({ ok: true });
  } catch (error) {
    console.error("[coop-aux] erro ao deletar:", error);
    return c.json({ error: "Erro ao remover registro" }, 500);
  }
});

app.post("/cooperativas/:id/aux/:resource/import", requireAuth, async (c) => {
  try {
    const cooperativaId = normalizeIdSingular(c.req.param("id"));
    if (!cooperativaId) return c.json({ error: "id_singular inválido" }, 400);
    const resource = (c.req.param("resource") || "").toLowerCase();
    const def = COOP_AUX_RESOURCES[resource];
    if (!def) return c.json({ error: "Recurso inválido" }, 400);

    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);
    if (!userData) return c.json({ error: "Usuário não autenticado" }, 401);
    if (!canManageCooperativa(userData, cooperativaId)) {
      return c.json({ error: "Acesso negado" }, 403);
    }
    const existingTarget = getExistingCooperativaIds([cooperativaId]);
    if (!existingTarget.has(cooperativaId)) {
      return c.json({ error: `id_singular destino não existe: ${cooperativaId}` }, 400);
    }

    const body = await c.req.json().catch(() => ({}));
    const items = Array.isArray(body?.items) ? body.items : [];
    const mode = (c.req.query("mode") || "replace").toLowerCase();
    if (!items.length) return c.json({ ok: true, inserted: 0 });

    if (!IS_POSTGRES) {
      db.execute("BEGIN");
    }
    try {
      if (mode === "replace") {
        db.query(`DELETE FROM ${def.table} WHERE id_singular = ?`, [cooperativaId]);
      }

      let inserted = 0;
      const seenKeys = new Set<string>();

      // Limpar duplicidades anteriores para evitar acumular lixo por importações repetidas.
      if (resource === "contatos" && mode !== "replace") {
        dedupeCooperativaContatosByTargets([cooperativaId]);
      }
      let skippedOtherSingular = 0;
      for (const raw of items) {
        // Import por singular: se vier arquivo com múltiplos id_singular, processa apenas o destino atual.
        if (
          raw &&
          typeof raw === "object" &&
          "id_singular" in raw &&
          raw.id_singular
        ) {
          const rowIdSingular = normalizeIdSingular(raw.id_singular);
          if (rowIdSingular && rowIdSingular !== String(cooperativaId)) {
            skippedOtherSingular++;
            continue;
          }
        }

        const sanitized = normalizeAuxImportRow(
          resource,
          (raw && typeof raw === "object") ? { ...raw } : raw,
        );
        // "ativo" é controlado pelo sistema no import: sempre entra ativo.
        if (sanitized && typeof sanitized === "object") {
          delete (sanitized as any).ativo;
        }

        const picked = pickAuxPayload(resource, sanitized);
        if (!picked) continue;
        if (resource === "plantao_clinicas") {
          const cd = normalizeCdMunicipio7((picked.data as any).cd_municipio_7);
          if (!cd) {
            if (!IS_POSTGRES) {
              try {
                db.execute("ROLLBACK");
              } catch {}
            }
            return c.json({ error: "cd_municipio_7 obrigatório e deve ter 7 dígitos (IBGE)." }, 400);
          }
          (picked.data as any).cd_municipio_7 = cd;
        }
        if (resource === "enderecos" || resource === "plantao_clinicas") {
          const normalized = applyEnderecoByCdMunicipio7(picked.data as Record<string, unknown>);
          if (!normalized.ok) {
            if (!IS_POSTGRES) {
              try {
                db.execute("ROLLBACK");
              } catch {}
            }
            return c.json({ error: normalized.error }, 400);
          }
        }
        if (["auditores", "diretores", "enderecos", "ouvidores", "lgpd", "colaboradores", "plantao_clinicas"].includes(resource)) {
          normalizeTelefoneAndWpp(picked.data as Record<string, unknown>);
        }
        if (resource === "plantao_contatos") {
          const ok = validatePlantaoContato(picked.data as Record<string, unknown>);
          if (!ok.ok) {
            if (!IS_POSTGRES) {
              try {
                db.execute("ROLLBACK");
              } catch {}
            }
            return c.json({ error: ok.error }, 400);
          }
        }
        if (resource === "plantao_horarios") {
          const ok = validatePlantaoHorario(picked.data as Record<string, unknown>, cooperativaId);
          if (!ok.ok) {
            if (!IS_POSTGRES) {
              try {
                db.execute("ROLLBACK");
              } catch {}
            }
            return c.json({ error: ok.error }, 400);
          }
        }
        if (resource === "regulatorio") {
          const ok = validateRegulatorio(picked.data as Record<string, unknown>);
          if (!ok.ok) {
            if (!IS_POSTGRES) {
              try {
                db.execute("ROLLBACK");
              } catch {}
            }
            return c.json({ error: ok.error }, 400);
          }
        }
        if (resource === "colaboradores") {
          const ok = validateColaborador(picked.data as Record<string, unknown>);
          if (!ok.ok) {
            if (!IS_POSTGRES) {
              try {
                db.execute("ROLLBACK");
              } catch {}
            }
            return c.json({ error: ok.error }, 400);
          }
        }
        if (resource === "contatos") {
          const res = validateAndNormalizeContato(picked.data as Record<string, unknown>);
          if (!res.ok) {
            if (!IS_POSTGRES) {
              try {
                db.execute("ROLLBACK");
              } catch {}
            }
            return c.json(
              {
                error: "Arquivo contém linhas inválidas para contatos.",
                invalid_rows: [
                  {
                    reason: res.error,
                    id_singular: cooperativaId,
                    row: sanitized,
                  },
                ],
              },
              400,
            );
          }
          (picked.data as any).valor = res.normalizedValor;

          const tipo = normalizeEnumText((picked.data as any).tipo);
          const valorKey = String((picked.data as any).valor ?? "").trim();
          const key = `${cooperativaId}|${tipo}|${valorKey}`;
          if (tipo && valorKey) {
            if (seenKeys.has(key)) continue;
            seenKeys.add(key);
          }

          // Evitar duplicar se já existe no banco.
          if (tipo && valorKey) {
            const exists = db.queryEntries<any>(
              `SELECT id FROM ${def.table} WHERE id_singular = ? AND tipo = ? AND valor = ? LIMIT 1`,
              [cooperativaId, tipo, valorKey],
            )?.[0];
            if (exists?.id) continue;
          }
        }
        if (picked.def.columns.includes("ativo")) {
          (picked.data as any).ativo = 1;
        }
        const id = (raw?.id ?? raw?.ID ?? null) || generateToken();
        const cols = ["id", "id_singular", ...Object.keys(picked.data)];
        const placeholders = cols.map(() => "?").join(",");
        const values = [
          id,
          cooperativaId,
          ...Object.keys(picked.data).map((k) => (picked.data as any)[k]),
        ];
        db.query(
          `INSERT INTO ${def.table} (${cols.join(",")}) VALUES (${placeholders})`,
          values as any,
        );
        inserted++;
      }

      if (!IS_POSTGRES) {
        db.execute("COMMIT");
      }
      return c.json({ ok: true, inserted, skipped_other_singular: skippedOtherSingular });
    } catch (e) {
      if (!IS_POSTGRES) {
        try {
          db.execute("ROLLBACK");
        } catch {}
      }
      console.error("[coop-aux] import falhou:", e);
      const msg = String((e as any)?.message || "");
      if (msg.includes("CHECK constraint failed")) {
        return c.json(
          {
            error:
              "Erro de validação no arquivo importado. Revise os campos de enumeração (ex.: tipo/posicao).",
            details: msg,
          },
          400,
        );
      }
      if (msg.includes("FOREIGN KEY constraint failed")) {
        return c.json(
          {
            error:
              "Erro de relacionamento no arquivo importado. Verifique se o id_singular existe em cooperativas.",
            details: msg,
          },
          400,
        );
      }
      if (msg.includes("UNIQUE constraint failed") && msg.includes(`${TBL("cooperativa_plantao")}.id_singular`)) {
        return c.json(
          {
            error: "Já existe um registro de plantão para esta singular. Use edição ou importação em modo replace.",
            details: msg,
          },
          400,
        );
      }
      return c.json({ error: "Erro ao importar dados" }, 500);
    }
  } catch (error) {
    console.error("[coop-aux] erro no import:", error);
    return c.json({ error: "Erro ao importar dados" }, 500);
  }
});

// Gestão de dados (admin): importação em massa de cadastros auxiliares para múltiplas singulares.
// Regras:
// - Admin de SINGULAR: só pode importar para sua própria id_singular.
// - Admin de FEDERACAO: pode importar para a federação e suas singulares.
// - Admin de CONFEDERACAO: pode importar para qualquer cooperativa.
app.post("/admin/gestao-dados/aux/:resource/import", requireAuth, async (c) => {
  try {
    const resource = (c.req.param("resource") || "").toLowerCase();
    const def = COOP_AUX_RESOURCES[resource];
    if (!def) return c.json({ error: "Recurso inválido" }, 400);

    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);
    if (!userData) return c.json({ error: "Usuário não autenticado" }, 401);

    const body = await c.req.json().catch(() => ({}));
    const items = Array.isArray(body?.items) ? body.items : [];
    const mode = (c.req.query("mode") || "replace").toLowerCase();
    if (!items.length) return c.json({ ok: true, inserted: 0, targets: {} });

    // Agrupar por id_singular (obrigatório nesta rota)
    const groups = new Map<string, any[]>();
    for (const raw of items) {
      const idSingular = normalizeIdSingular(raw?.id_singular);
      if (!idSingular) {
        return c.json(
          { error: "Importação em massa requer id_singular com 3 dígitos em todas as linhas (ex.: 001)." },
          400,
        );
      }
      if (!groups.has(idSingular)) groups.set(idSingular, []);
      groups.get(idSingular)!.push(raw);
    }

    // Validar permissões para TODOS os alvos antes de começar a alterar o banco.
    const denied: string[] = [];
    for (const targetId of groups.keys()) {
      if (!canManageCooperativa(userData, targetId)) denied.push(targetId);
    }
    if (denied.length) {
      return c.json(
        { error: "Acesso negado para importar em algumas cooperativas.", denied },
        403,
      );
    }

    // Validar alvos existentes para evitar FK error durante o insert.
    const existingTargets = getExistingCooperativaIds(Array.from(groups.keys()));
    const missingTargets = Array.from(groups.keys()).filter((id) => !existingTargets.has(id));
    if (missingTargets.length) {
      return c.json(
        {
          error:
            "Existem id_singular no arquivo que não existem em cooperativas.",
          missing_id_singular: missingTargets,
        },
        400,
      );
    }

    if (!IS_POSTGRES) db.execute("BEGIN");
    try {
      const perTarget: Record<string, { inserted: number }> = {};
      let insertedTotal = 0;

      if (mode === "replace") {
        for (const targetId of groups.keys()) {
          db.query(`DELETE FROM ${def.table} WHERE id_singular = ?`, [targetId]);
        }
      }
      if (resource === "contatos" && mode !== "replace") {
        dedupeCooperativaContatosByTargets(Array.from(groups.keys()));
      }

      for (const [targetId, rows] of groups.entries()) {
        let inserted = 0;
        const seenKeys = new Set<string>();
        for (const raw of rows) {
          const sanitized = normalizeAuxImportRow(
            resource,
            (raw && typeof raw === "object") ? { ...raw } : raw,
          );
          // "ativo" é controlado pelo sistema no import: sempre entra ativo.
          if (sanitized && typeof sanitized === "object") {
            delete (sanitized as any).ativo;
          }

          const picked = pickAuxPayload(resource, sanitized);
          if (!picked) continue;
          if (resource === "plantao_clinicas") {
            const cd = normalizeCdMunicipio7((picked.data as any).cd_municipio_7);
            if (!cd) {
              if (!IS_POSTGRES) {
                try {
                  db.execute("ROLLBACK");
                } catch {}
              }
              return c.json({ error: "cd_municipio_7 obrigatório e deve ter 7 dígitos (IBGE)." }, 400);
            }
            (picked.data as any).cd_municipio_7 = cd;
          }
          if (resource === "enderecos" || resource === "plantao_clinicas") {
            const normalized = applyEnderecoByCdMunicipio7(picked.data as Record<string, unknown>);
            if (!normalized.ok) {
              if (!IS_POSTGRES) {
                try {
                  db.execute("ROLLBACK");
                } catch {}
              }
              return c.json({ error: normalized.error }, 400);
            }
          }
          if (["auditores", "diretores", "enderecos", "ouvidores", "lgpd", "colaboradores", "plantao_clinicas"].includes(resource)) {
            normalizeTelefoneAndWpp(picked.data as Record<string, unknown>);
          }
          if (resource === "plantao_contatos") {
            const ok = validatePlantaoContato(picked.data as Record<string, unknown>);
            if (!ok.ok) {
              if (!IS_POSTGRES) {
                try {
                  db.execute("ROLLBACK");
                } catch {}
              }
              return c.json(
                { error: "Arquivo contém linhas inválidas para contatos de plantão.", invalid_rows: [{ reason: ok.error, id_singular: targetId, row: sanitized }] },
                400,
              );
            }
          }
          if (resource === "plantao_horarios") {
            const ok = validatePlantaoHorario(picked.data as Record<string, unknown>, targetId);
            if (!ok.ok) {
              if (!IS_POSTGRES) {
                try {
                  db.execute("ROLLBACK");
                } catch {}
              }
              return c.json(
                { error: "Arquivo contém linhas inválidas para horários de plantão.", invalid_rows: [{ reason: ok.error, id_singular: targetId, row: sanitized }] },
                400,
              );
            }
          }
          if (resource === "regulatorio") {
            const ok = validateRegulatorio(picked.data as Record<string, unknown>);
            if (!ok.ok) {
              if (!IS_POSTGRES) {
                try {
                  db.execute("ROLLBACK");
                } catch {}
              }
              return c.json(
                { error: "Arquivo contém linhas inválidas para dados regulatórios.", invalid_rows: [{ reason: ok.error, id_singular: targetId, row: sanitized }] },
                400,
              );
            }
          }
          if (resource === "colaboradores") {
            const ok = validateColaborador(picked.data as Record<string, unknown>);
            if (!ok.ok) {
              if (!IS_POSTGRES) {
                try {
                  db.execute("ROLLBACK");
                } catch {}
              }
              return c.json(
                { error: "Arquivo contém linhas inválidas para colaboradores.", invalid_rows: [{ reason: ok.error, id_singular: targetId, row: sanitized }] },
                400,
              );
            }
          }
          if (resource === "contatos") {
            const res = validateAndNormalizeContato(picked.data as Record<string, unknown>);
            if (!res.ok) {
              if (!IS_POSTGRES) {
                try {
                  db.execute("ROLLBACK");
                } catch {}
              }
              return c.json(
                {
                  error: "Arquivo contém linhas inválidas para contatos.",
                  invalid_rows: [
                    {
                      reason: res.error,
                      id_singular: targetId,
                      row: sanitized,
                    },
                  ],
                },
                400,
              );
            }
            (picked.data as any).valor = res.normalizedValor;

            const tipo = normalizeEnumText((picked.data as any).tipo);
            const valorKey = String((picked.data as any).valor ?? "").trim();
            const key = `${targetId}|${tipo}|${valorKey}`;
            if (tipo && valorKey) {
              if (seenKeys.has(key)) continue;
              seenKeys.add(key);
            }

            if (tipo && valorKey) {
              const exists = db.queryEntries<any>(
                `SELECT id FROM ${def.table} WHERE id_singular = ? AND tipo = ? AND valor = ? LIMIT 1`,
                [targetId, tipo, valorKey],
              )?.[0];
              if (exists?.id) continue;
            }
          }
          if (picked.def.columns.includes("ativo")) {
            (picked.data as any).ativo = 1;
          }
          const id = (raw?.id ?? raw?.ID ?? null) || generateToken();
          const cols = ["id", "id_singular", ...Object.keys(picked.data)];
          const placeholders = cols.map(() => "?").join(",");
          const values = [
            id,
            targetId,
            ...Object.keys(picked.data).map((k) => (picked.data as any)[k]),
          ];
          db.query(
            `INSERT INTO ${def.table} (${cols.join(",")}) VALUES (${placeholders})`,
            values as any,
          );
          inserted++;
          insertedTotal++;
        }
        perTarget[targetId] = { inserted };
      }

      if (!IS_POSTGRES) db.execute("COMMIT");
      return c.json({ ok: true, inserted: insertedTotal, targets: perTarget });
    } catch (e) {
      if (!IS_POSTGRES) {
        try {
          db.execute("ROLLBACK");
        } catch {}
      }
      console.error("[gestao-dados] import aux falhou:", e);
      const msg = String((e as any)?.message || "");
      if (msg.includes("CHECK constraint failed")) {
        return c.json(
          {
            error:
              "Erro de validação no arquivo importado. Revise os campos de enumeração (ex.: tipo/posicao).",
            details: msg,
          },
          400,
        );
      }
      if (msg.includes("FOREIGN KEY constraint failed")) {
        return c.json(
          {
            error:
              "Erro de relacionamento no arquivo importado. Verifique se o id_singular existe em cooperativas.",
            details: msg,
          },
          400,
        );
      }
      if (msg.includes("UNIQUE constraint failed") && msg.includes(`${TBL("cooperativa_plantao")}.id_singular`)) {
        return c.json(
          {
            error: "Importação inválida: só é permitido 1 registro de plantão por id_singular.",
            details: msg,
          },
          400,
        );
      }
      return c.json({ error: "Erro ao importar dados" }, 500);
    }
  } catch (error) {
    console.error("[gestao-dados] erro no import:", error);
    return c.json({ error: "Erro ao importar dados" }, 500);
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

app.get("/cooperativas/:id/overview/historico", requireAuth, async (c) => {
  try {
    const cooperativaId = normalizeIdSingular(c.req.param("id"));
    if (!cooperativaId) {
      return c.json({ error: "Cooperativa inválida" }, 400);
    }

    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);
    if (!userData) {
      return c.json({ error: "Usuário não autenticado" }, 401);
    }

    if (
      !canReadAnyCooperativaData(userData) &&
      !isCooperativaVisible(userData, cooperativaId) &&
      !canManageCooperativa(userData, cooperativaId)
    ) {
      return c.json({ error: "Acesso negado" }, 403);
    }

    const limitParam = Number(c.req.query("limit") || "200");
    const limit = Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(limitParam, 500)
      : 200;

    const rows = db.queryEntries<any>(
      `SELECT l.*, co.UNIODONTO AS cooperativa_nome
         FROM ${TBL("cooperativa_overview_logs")} l
    LEFT JOIN ${TBL("cooperativas")} co ON co.id_singular = l.cooperativa_id
        WHERE l.cooperativa_id = ?
        ORDER BY CASE
          WHEN l.timestamp IS NULL OR l.timestamp = '' THEN ''
          ELSE l.timestamp
        END DESC
        LIMIT ?`,
      [cooperativaId, limit] as any,
    ) || [];

    return c.json({ logs: rows.map(mapCooperativaOverviewLog) });
  } catch (error) {
    console.error("Erro ao buscar histórico da visão geral:", error);
    return c.json({ error: "Erro ao buscar histórico da visão geral" }, 500);
  }
});

app.put("/cooperativas/:id/overview", requireAuth, async (c) => {
  try {
    const cooperativaId = normalizeIdSingular(c.req.param("id"));
    if (!cooperativaId) {
      return c.json({ error: "Cooperativa inválida" }, 400);
    }

    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);
    if (!userData) {
      return c.json({ error: "Usuário não autenticado" }, 401);
    }
    if (!canManageCooperativa(userData, cooperativaId)) {
      return c.json({ error: "Acesso negado" }, 403);
    }

    let body: any = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "JSON inválido" }, 400);
    }

    const currentRow = db.queryEntries<any>(
      `SELECT * FROM ${TBL("cooperativas")} WHERE id_singular = ? LIMIT 1`,
      [cooperativaId],
    )[0];
    if (!currentRow) {
      return c.json({ error: "Cooperativa não encontrada" }, 404);
    }

    const editableFields: Array<{
      field:
        | "cnpj"
        | "codigo_ans"
        | "data_fundacao"
        | "federacao"
        | "software"
        | "raz_social";
      column: string;
    }> = [
      { field: "cnpj", column: "CNPJ" },
      { field: "codigo_ans", column: "CODIGO_ANS" },
      { field: "data_fundacao", column: "DATA_FUNDACAO" },
      { field: "federacao", column: "FEDERACAO" },
      { field: "software", column: "SOFTWARE" },
      { field: "raz_social", column: "RAZ_SOCIAL" },
    ];

    const normalizeOverviewFieldValue = (
      field: string,
      value: unknown,
    ): string => {
      let normalized = String(value ?? "").trim();
      if (field === "cnpj") {
        normalized = normalizeDigitsString(normalized).slice(0, 14);
      }
      return normalized;
    };

    const cooperativaChanges = editableFields
      .filter(({ field }) => Object.prototype.hasOwnProperty.call(body, field))
      .map(({ field, column }) => {
        const prev = String(
          currentRow[column] ?? currentRow[column.toLowerCase()] ?? "",
        ).trim();
        const next = normalizeOverviewFieldValue(field, body[field]);
        return { field, column, prev, next };
      })
      .filter((item) => item.prev !== item.next);

    const hasWebsiteInput = Object.prototype.hasOwnProperty.call(body, "website");
    const websiteRaw = hasWebsiteInput ? String(body.website ?? "").trim() : "";
    const websiteTarget = hasWebsiteInput && websiteRaw
      ? normalizeWebsiteValue(websiteRaw)
      : websiteRaw
      ? null
      : null;
    if (hasWebsiteInput && websiteRaw && !websiteTarget) {
      return c.json({ error: "Website inválido. Use um endereço http/https válido." }, 400);
    }

    let finalWebsite: string | null = null;

    const applyChanges = (target: DbAdapter) => {
      if (cooperativaChanges.length) {
        const sets = cooperativaChanges.map((item) => `${item.column} = ?`).join(", ");
        const values = cooperativaChanges.map((item) => item.next);
        target.query(
          `UPDATE ${TBL("cooperativas")} SET ${sets} WHERE id_singular = ?`,
          [...values, cooperativaId] as any,
        );
        for (const change of cooperativaChanges) {
          const oldValue = change.prev || null;
          const newValue = change.next || null;
          registrarLogCooperativaOverview(
            cooperativaId,
            change.field,
            resolveOverviewAction(oldValue, newValue),
            oldValue,
            newValue,
            userData,
            null,
            target,
          );
        }
      }

      if (hasWebsiteInput) {
        const contatoAtual = getCooperativaWebsiteContato(cooperativaId, target);
        const websiteAtual = contatoAtual
          ? (normalizeWebsiteValue(contatoAtual.valor) ||
            String(contatoAtual.valor ?? "").trim() || null)
          : null;

        if (!websiteTarget) {
          if (contatoAtual?.id) {
            target.query(
              `DELETE FROM ${TBL("cooperativa_contatos")} WHERE id = ? AND id_singular = ?`,
              [String(contatoAtual.id), cooperativaId],
            );
            registrarLogCooperativaOverview(
              cooperativaId,
              "website",
              resolveOverviewAction(websiteAtual, null),
              websiteAtual,
              null,
              userData,
              null,
              target,
            );
          }
          finalWebsite = null;
        } else if (contatoAtual?.id) {
          const currentTipo = normalizeEnumText(contatoAtual.tipo);
          const currentSubtipo = normalizeEnumText(contatoAtual.subtipo);
          const currentAtivo = normalizeBoolInt(contatoAtual.ativo ?? 1);
          const nextLabel = String(contatoAtual.label ?? "").trim() || "Site oficial";
          const principal = normalizeBoolInt(contatoAtual.principal ?? 1);
          const requiresUpdate = websiteAtual !== websiteTarget ||
            currentTipo !== "website" ||
            currentSubtipo !== "institucional" ||
            currentAtivo !== 1;

          if (requiresUpdate) {
            target.query(
              `UPDATE ${TBL("cooperativa_contatos")}
                  SET tipo = ?, subtipo = ?, valor = ?, wpp = ?, principal = ?, ativo = ?, label = ?
                WHERE id = ? AND id_singular = ?`,
              [
                "website",
                "institucional",
                websiteTarget,
                0,
                principal || 1,
                1,
                nextLabel,
                String(contatoAtual.id),
                cooperativaId,
              ],
            );
            registrarLogCooperativaOverview(
              cooperativaId,
              "website",
              resolveOverviewAction(websiteAtual, websiteTarget),
              websiteAtual,
              websiteTarget,
              userData,
              null,
              target,
            );
          }
          finalWebsite = websiteTarget;
        } else {
          const contatoId = safeRandomId("ctt");
          target.query(
            `INSERT INTO ${
              TBL("cooperativa_contatos")
            } (id, id_singular, tipo, subtipo, valor, wpp, principal, ativo, label)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [
              contatoId,
              cooperativaId,
              "website",
              "institucional",
              websiteTarget,
              0,
              1,
              1,
              "Site oficial",
            ],
          );
          registrarLogCooperativaOverview(
            cooperativaId,
            "website",
            "create",
            null,
            websiteTarget,
            userData,
            null,
            target,
          );
          finalWebsite = websiteTarget;
        }
      }
    };

    try {
      if (IS_POSTGRES && typeof pgDb.transaction === "function") {
        pgDb.transaction((tx) => {
          applyChanges(tx);
        });
      } else {
        db.execute("BEGIN");
        try {
          applyChanges(db as unknown as DbAdapter);
          db.execute("COMMIT");
        } catch (txError) {
          try {
            db.execute("ROLLBACK");
          } catch {}
          throw txError;
        }
      }
    } catch (error) {
      console.error("Erro ao atualizar visão geral da cooperativa:", error);
      return c.json({ error: "Erro ao atualizar visão geral da cooperativa" }, 500);
    }

    const updatedRow = db.queryEntries<any>(
      `SELECT * FROM ${TBL("cooperativas")} WHERE id_singular = ? LIMIT 1`,
      [cooperativaId],
    )[0];
    if (!updatedRow) {
      return c.json({ error: "Cooperativa não encontrada após atualização" }, 404);
    }

    if (finalWebsite === null && hasWebsiteInput) {
      finalWebsite = getCooperativaWebsiteValue(cooperativaId);
    } else if (!hasWebsiteInput) {
      finalWebsite = getCooperativaWebsiteValue(cooperativaId);
    }

    return c.json({
      cooperativa: mapCooperativa(updatedRow),
      website: finalWebsite,
    });
  } catch (error) {
    console.error("Erro ao atualizar visão geral da cooperativa:", error);
    return c.json({ error: "Erro ao atualizar visão geral da cooperativa" }, 500);
  }
});

app.get("/cooperativas/:id/cobertura/historico", requireAuth, async (c) => {
  try {
    const cooperativaId = normalizeIdSingular(c.req.param("id"));
    const authUser = c.get("user");
    const userData = await getUserData(authUser.id, authUser.email);

    if (!userData) {
      return c.json({ error: "Usuário não autenticado" }, 401);
    }

    if (
      !canReadAnyCooperativaData(userData) &&
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
        ORDER BY CASE
          WHEN l.timestamp IS NULL OR l.timestamp = '' THEN ''
          ELSE l.timestamp
        END DESC
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
      if (IS_POSTGRES && typeof pgDb.transaction === "function") {
        pgDb.transaction((tx) => {
          for (const addition of additions) {
            tx.query(
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
              tx,
            );
            alteredIds.add(addition.cidadeId);
          }

          for (const removal of removals) {
            tx.query(
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
              tx,
            );
            alteredIds.add(removal.cidadeId);
          }
        });
      } else {
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
      }
    } catch (e) {
      if (!IS_POSTGRES) {
        try {
          db.execute("ROLLBACK");
        } catch {}
      }
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

    const baseQuery = `SELECT op.*, au.papel AS auth_papel, au.module_access AS auth_module_access FROM ${
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
    const associacoesMap = buildCooperativaAssociacoesMap(
      mapped.map((item) => item.email || ""),
    );
    const enriched = mapped.map((item) => {
      const key = String(item.email || "").trim().toLowerCase();
      const cooperativasIds = associacoesMap[key]?.length
        ? associacoesMap[key]
        : (item.id_singular ? [item.id_singular] : []);
      return {
        ...item,
        cooperativas_ids: cooperativasIds,
        cooperativa_principal_id: item.id_singular || cooperativasIds[0] || "",
      };
    });
    return c.json(enriched);
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
    const telefone = normalizeDigitsString(body.telefone || "");
    const whatsappInput = normalizeDigitsString(body.whatsapp || "");
    const wpp = normalizeBoolInt(body.wpp) === 1 || Boolean(whatsappInput) ||
      isLikelyBrazilMobile(telefone);
    const whatsapp = wpp ? (whatsappInput || telefone) : "";
    const moduleAccess = serializeModuleAccess(body.modulos_acesso, ["hub"]);
    const payloadCooperativas = normalizeCooperativaIdsInput(
      body.cooperativas_ids,
    );
    const explicitPrincipal = String(
      body.cooperativa_principal_id || body.id_singular || body.cooperativa_id ||
        "",
    ).trim();
    const ownCooperativaId = String(userData.cooperativa_id || "").trim();
    let cooperativasIds = Array.from(
      new Set(
        [
          ...payloadCooperativas,
          explicitPrincipal,
        ].filter((item) => String(item || "").trim().length > 0),
      ),
    );
    if (!cooperativasIds.length && ownCooperativaId) {
      cooperativasIds = [ownCooperativaId];
    }
    let idSingular = explicitPrincipal || cooperativasIds[0] || "";
    if (idSingular && !cooperativasIds.includes(idSingular)) {
      cooperativasIds.unshift(idSingular);
    }
    if (!idSingular && cooperativasIds.length > 0) {
      idSingular = cooperativasIds[0];
    }
    const senhaTemporaria = typeof body.senha_temporaria === "string"
      ? body.senha_temporaria.trim()
      : "";
    const forcarTrocaSenha = body.forcar_troca_senha === false ? false : true;

    if (!nome || !email) {
      return c.json({ error: "Nome e email são obrigatórios" }, 400);
    }

    if (!idSingular || cooperativasIds.length === 0) {
      return c.json({ error: "Defina ao menos uma singular para o usuário" }, 400);
    }

    for (const cooperativaId of cooperativasIds) {
      if (!isCooperativaVisible(userData, cooperativaId)) {
        return c.json(
          { error: "Acesso negado para cadastrar em uma ou mais singulares selecionadas" },
          403,
        );
      }
    }

    const existing = db.queryEntries<any>(
      `SELECT id FROM ${TBL("operadores")} WHERE email = ? LIMIT 1`,
      [email],
    )[0];
    if (existing) {
      return c.json({ error: "Operador já cadastrado" }, 409);
    }

    const now = new Date().toISOString();
    if (senhaTemporaria && senhaTemporaria.length < 8) {
      return c.json(
        { error: "A senha provisória deve ter pelo menos 8 caracteres" },
        400,
      );
    }
    try {
      db.query(
        `INSERT INTO ${
          TBL("operadores")
        } (nome, id_singular, email, telefone, whatsapp, wpp, cargo, status, created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [nome, idSingular, email, telefone, whatsapp, wpp ? 1 : 0, cargo, 1, now],
      );
    } catch (e) {
      console.error("Erro ao inserir operador:", e);
      return c.json({ error: "Erro ao criar operador" }, 500);
    }

    const derivedRole = deriveRoleForCooperativa("operador", idSingular);
    if (senhaTemporaria) {
      try {
        const passwordHash = await bcrypt.hash(senhaTemporaria);
        const mustChange = forcarTrocaSenha ? 1 : 0;
        const existingAuth = getAuthUser(email);
        if (existingAuth) {
          db.query(
            `UPDATE auth_users SET
              password_hash = ?,
              cooperativa_id = ?,
              papel = COALESCE(papel, ?),
              requested_papel = COALESCE(requested_papel, ?),
              approval_status = 'approved',
              email_confirmed_at = COALESCE(email_confirmed_at, ?),
              approved_at = COALESCE(approved_at, ?),
              module_access = COALESCE(module_access, ?),
              must_change_password = ?,
              ativo = 1
             WHERE email = ?`,
            [
              passwordHash,
              idSingular,
              derivedRole,
              derivedRole,
              now,
              now,
              moduleAccess,
              mustChange,
              email,
            ],
          );
        } else {
          db.query(
            `INSERT INTO auth_users (
              email,
              password_hash,
              nome,
              display_name,
              telefone,
              whatsapp,
              cargo,
              cooperativa_id,
              papel,
              requested_papel,
              ativo,
              data_cadastro,
              email_confirmed_at,
              approval_status,
              must_change_password,
              module_access
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
              email,
              passwordHash,
              nome,
              nome || email,
              telefone,
              whatsapp,
              cargo,
              idSingular,
              derivedRole,
              derivedRole,
              1,
              now,
              now,
              "approved",
              mustChange,
              moduleAccess,
            ],
          );
        }
      } catch (error) {
        console.warn(
          "[operadores] não foi possível registrar credenciais provisórias:",
          error,
        );
      }
    } else {
      try {
        db.query(
          `UPDATE auth_users
              SET cooperativa_id = COALESCE(?, cooperativa_id),
                  papel = COALESCE(papel, ?),
                  module_access = COALESCE(module_access, ?)
            WHERE email = ?`,
          [idSingular, derivedRole, moduleAccess, email],
        );
      } catch (e) {
        console.warn("[operadores] sincronização com auth_users falhou:", e);
      }
    }

    syncUserCooperativaAssociacoes(email, cooperativasIds, idSingular);

    const inserted = db.queryEntries<any>(
      `SELECT op.*, au.papel AS auth_papel, au.module_access AS auth_module_access FROM ${
        TBL("operadores")
      } op LEFT JOIN auth_users au ON au.email = op.email WHERE op.email = ? LIMIT 1`,
      [email],
    )[0];
    const mapped = mapOperador(inserted);
    return c.json({
      ...mapped,
      cooperativas_ids: cooperativasIds,
      cooperativa_principal_id: idSingular,
    });
  } catch (error) {
    console.error("Erro ao criar operador:", error);
    return c.json({ error: "Erro ao criar operador" }, 500);
  }
});

// ROTA PÚBLICA DE OPERADORES (campos restritos, sem contatos)
app.get("/operadores/public", async (c) => {
  try {
    const rows = db.queryEntries(
      `SELECT op.*, au.papel AS auth_papel, au.module_access AS auth_module_access FROM ${
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
    const senhaTemporaria = typeof body.senha_temporaria === "string"
      ? body.senha_temporaria.trim()
      : "";
    const forcarTrocaSenha = body.forcar_troca_senha === false ? false : true;
    const hasCooperativasPayload = (
      "cooperativas_ids" in body || "cooperativa_principal_id" in body ||
      "id_singular" in body || "cooperativa_id" in body
    );
    const allowed: Record<string, any> = {};
    const whitelist = ["nome", "telefone", "whatsapp", "cargo", "ativo"];
    whitelist.push("wpp");
    const canEditRole = isConfAdmin || userData.papel === "admin";
    if (canEditRole) {
      whitelist.push("papel");
      whitelist.push("modulos_acesso");
    }

    const canManageCredentials = !isSelf &&
      (isConfAdmin ||
        (isFederacaoAdmin && visible) ||
        (isSingularAdmin && operador.id_singular === userData.cooperativa_id));
    const canEditCooperativas = isConfAdmin ||
      (isFederacaoAdmin && visible) ||
      (isSingularAdmin && operador.id_singular === userData.cooperativa_id);

    const associacoesAtuais = getUserCooperativaAssociacoes(operador.email);
    let cooperativasIds = associacoesAtuais.length
      ? associacoesAtuais
      : (operador.id_singular ? [operador.id_singular] : []);
    let cooperativaPrincipalId = operador.id_singular || cooperativasIds[0] || "";

    if (hasCooperativasPayload) {
      if (!canEditCooperativas) {
        return c.json(
          { error: "Acesso negado para alterar singulares deste usuário" },
          403,
        );
      }
      const payloadCooperativas = normalizeCooperativaIdsInput(
        body.cooperativas_ids,
      );
      const principalSolicitada = String(
        body.cooperativa_principal_id || body.id_singular || body.cooperativa_id ||
          "",
      ).trim();

      cooperativasIds = Array.from(
        new Set(
          [
            ...(payloadCooperativas.length ? payloadCooperativas : cooperativasIds),
            principalSolicitada,
          ].filter((item) => String(item || "").trim().length > 0),
        ),
      );
      cooperativaPrincipalId = principalSolicitada || cooperativasIds[0] || "";
      if (!cooperativaPrincipalId && cooperativasIds.length > 0) {
        cooperativaPrincipalId = cooperativasIds[0];
      }
      if (cooperativaPrincipalId && !cooperativasIds.includes(cooperativaPrincipalId)) {
        cooperativasIds.unshift(cooperativaPrincipalId);
      }
      if (!cooperativasIds.length || !cooperativaPrincipalId) {
        return c.json(
          { error: "Defina ao menos uma singular para este usuário" },
          400,
        );
      }
      for (const cooperativaId of cooperativasIds) {
        if (!isCooperativaVisible(userData, cooperativaId)) {
          return c.json(
            { error: "Acesso negado para vincular uma ou mais singulares selecionadas" },
            403,
          );
        }
      }
      if (cooperativaPrincipalId !== operador.id_singular) {
        allowed.id_singular = cooperativaPrincipalId;
      }
    }

    if (senhaTemporaria) {
      if (!canManageCredentials) {
        return c.json(
          { error: "Acesso negado para definir senha para este operador" },
          403,
        );
      }
      if (senhaTemporaria.length < 8) {
        return c.json(
          { error: "A senha provisória deve ter pelo menos 8 caracteres" },
          400,
        );
      }
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
      allowed.telefone = normalizeDigitsString(allowed.telefone);
    }
    if ("whatsapp" in allowed && typeof allowed.whatsapp === "string") {
      allowed.whatsapp = normalizeDigitsString(allowed.whatsapp);
    }
    if ("wpp" in allowed) {
      allowed.wpp = normalizeBoolInt(allowed.wpp);
    }
    if ("modulos_acesso" in allowed) {
      allowed.modulos_acesso = serializeModuleAccess(allowed.modulos_acesso, ["hub"]);
    }
    if ("telefone" in allowed || "wpp" in allowed || "whatsapp" in allowed) {
      const resolvedTel = "telefone" in allowed
        ? String(allowed.telefone || "")
        : String(operador.telefone || "");
      const resolvedLegacyWhatsapp = "whatsapp" in allowed
        ? String(allowed.whatsapp || "")
        : String(operador.whatsapp || "");
      const resolvedWpp = "wpp" in allowed
        ? normalizeBoolInt(allowed.wpp) === 1
        : normalizeBoolInt((operador as any).wpp) === 1 ||
          Boolean(resolvedLegacyWhatsapp) ||
          isLikelyBrazilMobile(resolvedTel);
      allowed.telefone = resolvedTel;
      allowed.wpp = resolvedWpp ? 1 : 0;
      allowed.whatsapp = resolvedWpp ? (resolvedLegacyWhatsapp || resolvedTel) : "";
    }
    if ("papel" in allowed && !canEditRole) {
      delete allowed.papel;
      delete allowed.modulos_acesso;
    } else if ("papel" in allowed) {
      allowed.papel = deriveRoleForCooperativa(
        allowed.papel,
        cooperativaPrincipalId || operador.id_singular,
      );
    }

    if (!hasCooperativasPayload && Object.keys(allowed).length === 0) {
      const refreshed = mapOperador(
        db.queryEntries<any>(
          `SELECT op.*, au.papel AS auth_papel, au.module_access AS auth_module_access
             FROM ${TBL("operadores")} op
             LEFT JOIN auth_users au ON au.email = op.email
            WHERE op.id = ? LIMIT 1`,
          [operadorId],
        )[0],
      );
      const refreshedAssociacoes = getUserCooperativaAssociacoes(refreshed.email);
      return c.json({
        ...refreshed,
        cooperativas_ids: refreshedAssociacoes.length
          ? refreshedAssociacoes
          : (refreshed.id_singular ? [refreshed.id_singular] : []),
        cooperativa_principal_id: refreshed.id_singular || "",
      });
    }

    try {
      const cols = Object.keys(allowed).filter((c) =>
        c !== "papel" && c !== "modulos_acesso"
      );
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

    if (allowed.papel || allowed.id_singular || allowed.modulos_acesso) {
      try {
        const updates: string[] = [];
        const values: any[] = [];
        if (allowed.papel) {
          updates.push("papel = ?");
          values.push(allowed.papel);
        }
        if (allowed.id_singular) {
          updates.push("cooperativa_id = ?");
          values.push(allowed.id_singular);
        }
        if (allowed.modulos_acesso) {
          updates.push("module_access = ?");
          values.push(allowed.modulos_acesso);
        }
        if (updates.length > 0) {
          db.query(
            `UPDATE auth_users SET ${updates.join(", ")} WHERE email = ?`,
            [...values, operador.email],
          );
        }
      } catch (e) {
        console.warn(
          "[operadores] não foi possível atualizar papel/cooperativa em auth_users:",
          e,
        );
      }
    }

    if (senhaTemporaria && canManageCredentials) {
      try {
        const now = new Date().toISOString();
        const mustChange = forcarTrocaSenha ? 1 : 0;
        const passwordHash = await bcrypt.hash(senhaTemporaria);
        const authUser = getAuthUser(operador.email);
        const resolvedRole = allowed.papel ||
          authUser?.papel ||
          deriveRoleForCooperativa(
            "operador",
            cooperativaPrincipalId || operador.id_singular,
          );
        const resolvedNome = "nome" in allowed
          ? allowed.nome
          : operador.nome;
        const resolvedTelefone = "telefone" in allowed
          ? allowed.telefone
          : operador.telefone;
        const resolvedWhatsapp = "whatsapp" in allowed
          ? allowed.whatsapp
          : operador.whatsapp;
        const resolvedWpp = "wpp" in allowed
          ? normalizeBoolInt(allowed.wpp) === 1
          : normalizeBoolInt((operador as any).wpp) === 1 ||
            Boolean(resolvedWhatsapp) ||
            isLikelyBrazilMobile(normalizeDigitsString(resolvedTelefone || ""));
        const resolvedCargo = "cargo" in allowed
          ? allowed.cargo
          : operador.cargo;
        const resolvedModuleAccess = "modulos_acesso" in allowed
          ? String(allowed.modulos_acesso || serializeModuleAccess(["hub"], ["hub"]))
          : serializeModuleAccess(authUser?.module_access, ["hub"]);

        if (authUser) {
          db.query(
            `UPDATE auth_users SET
              password_hash = ?,
              must_change_password = ?,
              cooperativa_id = COALESCE(?, cooperativa_id),
              papel = COALESCE(?, papel),
              requested_papel = COALESCE(requested_papel, ?),
              module_access = COALESCE(?, module_access),
              approval_status = 'approved',
              ativo = 1,
              email_confirmed_at = COALESCE(email_confirmed_at, ?),
              approved_at = COALESCE(approved_at, ?)
             WHERE email = ?`,
            [
              passwordHash,
              mustChange,
              cooperativaPrincipalId || operador.id_singular,
              resolvedRole,
              resolvedRole,
              resolvedModuleAccess,
              now,
              now,
              operador.email,
            ],
          );
        } else {
          db.query(
            `INSERT INTO auth_users (
              email,
              password_hash,
              nome,
              display_name,
              telefone,
              whatsapp,
              cargo,
              cooperativa_id,
              papel,
              requested_papel,
              ativo,
              data_cadastro,
              email_confirmed_at,
              approval_status,
              must_change_password,
              module_access
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
              operador.email,
              passwordHash,
              resolvedNome,
              resolvedNome || operador.email,
              resolvedTelefone || "",
              resolvedWpp ? (resolvedWhatsapp || resolvedTelefone || "") : "",
              resolvedCargo || "",
              cooperativaPrincipalId || operador.id_singular,
              resolvedRole,
              resolvedRole,
              1,
              now,
              now,
              "approved",
              mustChange,
              resolvedModuleAccess,
            ],
          );
        }
      } catch (error) {
        console.warn(
          "[operadores] não foi possível definir senha provisória:",
          error,
        );
      }
    }

    if (hasCooperativasPayload) {
      syncUserCooperativaAssociacoes(
        operador.email,
        cooperativasIds,
        cooperativaPrincipalId || operador.id_singular,
      );
    }

    const updatedRow = db.queryEntries<any>(
      `SELECT op.*, au.papel AS auth_papel, au.module_access AS auth_module_access
         FROM ${TBL("operadores")} op
         LEFT JOIN auth_users au ON au.email = op.email
        WHERE op.id = ? LIMIT 1`,
      [operadorId],
    )[0];
    const updatedOperador = mapOperador(updatedRow);
    const updatedAssociacoes = getUserCooperativaAssociacoes(updatedOperador.email);
    return c.json({
      ...updatedOperador,
      cooperativas_ids: updatedAssociacoes.length
        ? updatedAssociacoes
        : (updatedOperador.id_singular ? [updatedOperador.id_singular] : []),
      cooperativa_principal_id: updatedOperador.id_singular || "",
    });
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
            (id, titulo, criado_por, criado_por_user, cooperativa_solicitante_id, cooperativa_responsavel_id, cidade_id, especialidades, quantidade, observacoes, prioridade, nivel_atual, status, data_criacao, data_ultima_alteracao, prazo_atual, motivo_categoria, beneficiarios_quantidade)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
            null,
            null,
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
        motivo_categoria: null,
        beneficiarios_quantidade: null,
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
    const motivoCategoriaRaw = typeof pedidoData.motivo_categoria === "string"
      ? pedidoData.motivo_categoria.trim()
      : "";
    const motivoCategoria = motivoCategoriaRaw
      ? motivoCategoriaRaw.slice(0, 150)
      : null;
    const beneficiariosQuantidadeRaw = Number(
      pedidoData.beneficiarios_quantidade,
    );
    const beneficiariosQuantidade = Number.isFinite(beneficiariosQuantidadeRaw)
      ? Math.max(0, Math.round(beneficiariosQuantidadeRaw))
      : null;

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
      motivo_categoria: motivoCategoria,
      beneficiarios_quantidade: beneficiariosQuantidade,
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
          (id, titulo, criado_por, criado_por_user, cooperativa_solicitante_id, cooperativa_responsavel_id, cidade_id, especialidades, quantidade, observacoes, prioridade, nivel_atual, status, data_criacao, data_ultima_alteracao, prazo_atual, motivo_categoria, beneficiarios_quantidade)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
          novoPedido.motivo_categoria || null,
          novoPedido.beneficiarios_quantidade ?? null,
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
      "motivo_categoria",
      "beneficiarios_quantidade",
      "responsavel_atual_id",
      "responsavel_atual_nome",
      "excluido",
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
      if ("motivo_categoria" in allowed) {
        const raw = typeof allowed.motivo_categoria === "string"
          ? allowed.motivo_categoria.trim()
          : "";
        allowed.motivo_categoria = raw ? raw.slice(0, 150) : null;
      }
      if ("beneficiarios_quantidade" in allowed) {
        const rawQtd = Number(allowed.beneficiarios_quantidade);
        allowed.beneficiarios_quantidade = Number.isFinite(rawQtd)
          ? Math.max(0, Math.round(rawQtd))
          : null;
      }
      const touchedResponsavel = Object.prototype.hasOwnProperty.call(
          allowed,
          "responsavel_atual_id",
        ) ||
        Object.prototype.hasOwnProperty.call(
          allowed,
          "responsavel_atual_nome",
        );
      const responsavelAssumindo = touchedResponsavel &&
        ((allowed.responsavel_atual_id ?? null) ||
          (allowed.responsavel_atual_nome ?? null));
      const responsavelLiberando = touchedResponsavel &&
        !responsavelAssumindo;
      if (touchedResponsavel && !Object.prototype.hasOwnProperty.call(allowed, "status")) {
        if (responsavelAssumindo && pedido.status === "novo") {
          allowed.status = "em_andamento";
        } else if (
          responsavelLiberando && pedido.status === "em_andamento"
        ) {
          allowed.status = "novo";
        }
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
        ORDER BY lido ASC,
          CASE
            WHEN criado_em IS NULL OR criado_em = '' THEN ''
            ELSE criado_em
          END DESC
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

const getAuthenticatedUserData = async (c: any) => {
  const authUser = c.get("user");
  const email = authUser?.email || authUser?.claims?.email || null;
  if (!authUser?.id && !email) return null;
  return getUserData(authUser?.id || email || "", email);
};

const isCentralArquivosAdminByGroup = (email?: string | null) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return false;
  try {
    const row = db.queryEntries<{ total: number }>(
      `SELECT COUNT(*) AS total
         FROM ${TBL("arquivos_grupo_membros")}
        WHERE LOWER(user_email) = LOWER(?)
          AND LOWER(grupo_id) = LOWER(?)
          AND COALESCE(ativo, 1) = 1`,
      [normalizedEmail, CENTRAL_ARQUIVOS_ADMIN_GROUP_ID],
    )[0];
    return Number(row?.total || 0) > 0;
  } catch (error) {
    console.warn("[arquivos] falha ao validar grupo central_admin:", error);
    return false;
  }
};

const canAccessUDocsModule = (userData: any) => {
  if (INSECURE_MODE || isConfederacaoSystemAdmin(userData)) return true;
  if (!userData) return false;
  const normalized = normalizeModuleAccess(
    userData?.modulos_acesso ?? userData?.module_access,
    ["hub"],
  );
  return normalized.includes("udocs");
};

const canAccessUMarketingModule = (userData: any) => {
  if (INSECURE_MODE || isConfederacaoSystemAdmin(userData)) return true;
  if (!userData) return false;
  const normalized = normalizeModuleAccess(
    userData?.modulos_acesso ?? userData?.module_access,
    ["hub"],
  );
  return normalized.includes("umarketing");
};

const parseArquivoModule = (
  value: unknown,
  fallback: ArquivoModule = "udocs",
): ArquivoModule => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "umarketing" || normalized === "marketing") {
    return "umarketing";
  }
  if (normalized === "udocs") {
    return "udocs";
  }
  return fallback;
};

const canAccessArquivosModule = (userData: any, module: ArquivoModule) => {
  return module === "umarketing"
    ? canAccessUMarketingModule(userData)
    : canAccessUDocsModule(userData);
};

const getModuloLabel = (module: ArquivoModule) =>
  module === "umarketing" ? "UMkt" : "UDocs";

const canManageArquivosAdmin = (userData: any) => {
  if (INSECURE_MODE || isConfederacaoSystemAdmin(userData)) return true;
  if (!userData) return false;
  if (!canAccessUDocsModule(userData) && !canAccessUMarketingModule(userData)) {
    return false;
  }
  const papel = String(userData?.papel || "").trim().toLowerCase();
  if (papel !== "admin") return false;
  return isCentralArquivosAdminByGroup(userData?.email);
};

const parsePositiveInt = (value: string | undefined, fallback: number, max = 1000) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.trunc(parsed), max);
};

type ArquivoShortcutRecord = {
  id: string;
  modulo: ArquivoModule;
  folder_drive_file_id: string;
  rotulo: string;
  ordem: number;
  ativo: number;
  criado_em: string | null;
  atualizado_em: string | null;
};

const normalizeShortcutLabel = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

const mapArquivoShortcutRecord = (row: Record<string, unknown>): ArquivoShortcutRecord => ({
  id: String(row.id || ""),
  modulo: parseArquivoModule(row.modulo, "udocs"),
  folder_drive_file_id: String(row.folder_drive_file_id || ""),
  rotulo: normalizeShortcutLabel(row.rotulo),
  ordem: Number(row.ordem || 0),
  ativo: Number(row.ativo ?? 1),
  criado_em: row.criado_em ? String(row.criado_em) : null,
  atualizado_em: row.atualizado_em ? String(row.atualizado_em) : null,
});

const normalizeArquivoParentId = (value: unknown) => {
  const normalized = String(value || "").trim();
  return normalized || null;
};

const ensureArquivoSiblingOrder = (
  module: ArquivoModule,
  parentDriveFileId: string | null,
) => {
  const rows = db.queryEntries<{
    drive_file_id: string;
    ordem_manual: number | null;
  }>(
    `SELECT drive_file_id, ordem_manual
       FROM ${TBL("arquivos_itens")}
      WHERE COALESCE(ativo, 1) = 1
        AND LOWER(COALESCE(modulo, 'udocs')) = LOWER(?)
        AND COALESCE(parent_drive_file_id, '') = COALESCE(?, '')
      ORDER BY
        COALESCE(ordem_manual, 2147483647) ASC,
        LOWER(COALESCE(titulo, '')) ASC`,
    [module, parentDriveFileId || ""],
  ) || [];

  let order = 10;
  for (const row of rows) {
    db.query(
      `UPDATE ${TBL("arquivos_itens")}
          SET ordem_manual = ?
        WHERE drive_file_id = ?
          AND LOWER(COALESCE(modulo, 'udocs')) = LOWER(?)`,
      [order, String(row.drive_file_id || "").trim(), module],
    );
    order += 10;
  }
};

const reorderArquivoItem = (
  module: ArquivoModule,
  itemId: string,
  direction: "up" | "down",
) => {
  const item = getArquivoById(itemId, module);
  if (!item) {
    return { moved: false, reason: "Arquivo não encontrado." };
  }
  const parentDriveFileId = normalizeArquivoParentId(item.parent_drive_file_id);
  ensureArquivoSiblingOrder(module, parentDriveFileId);

  const siblings = db.queryEntries<{
    drive_file_id: string;
    ordem_manual: number | null;
  }>(
    `SELECT drive_file_id, ordem_manual
       FROM ${TBL("arquivos_itens")}
      WHERE COALESCE(ativo, 1) = 1
        AND LOWER(COALESCE(modulo, 'udocs')) = LOWER(?)
        AND COALESCE(parent_drive_file_id, '') = COALESCE(?, '')
      ORDER BY ordem_manual ASC, LOWER(COALESCE(titulo, '')) ASC`,
    [module, parentDriveFileId || ""],
  ) || [];
  const index = siblings.findIndex((row) =>
    String(row.drive_file_id || "").trim() === item.drive_file_id
  );
  if (index < 0) {
    return { moved: false, reason: "Item não localizado na ordenação atual." };
  }

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= siblings.length) {
    return { moved: false, reason: "Item já está no limite da ordenação." };
  }

  const current = siblings[index];
  const target = siblings[targetIndex];
  const currentOrder = Number(current.ordem_manual || (index + 1) * 10);
  const targetOrder = Number(target.ordem_manual || (targetIndex + 1) * 10);

  db.query(
    `UPDATE ${TBL("arquivos_itens")}
        SET ordem_manual = CASE
          WHEN drive_file_id = ? THEN ?
          WHEN drive_file_id = ? THEN ?
          ELSE ordem_manual
        END
      WHERE LOWER(COALESCE(modulo, 'udocs')) = LOWER(?)
        AND drive_file_id IN (?, ?)`,
    [
      current.drive_file_id,
      targetOrder,
      target.drive_file_id,
      currentOrder,
      module,
      current.drive_file_id,
      target.drive_file_id,
    ],
  );

  return {
    moved: true,
    item_drive_file_id: item.drive_file_id,
    parent_drive_file_id: parentDriveFileId,
    direction,
  };
};

const buildRedirectTarget = (c: any, path: string) => {
  try {
    const url = new URL(c.req.url);
    return `${path}${url.search || ""}`;
  } catch {
    return path;
  }
};

const buildRedirectTargetWithQuery = (
  c: any,
  path: string,
  params: Record<string, string>,
) => {
  try {
    const base = new URL(c.req.url);
    const target = new URL(path, `${base.protocol}//${base.host}`);
    // Preserva query original (ex.: token, filtros e paginação) e sobrescreve apenas as chaves informadas.
    base.searchParams.forEach((value, key) => {
      target.searchParams.set(key, value);
    });
    for (const [key, value] of Object.entries(params)) {
      target.searchParams.set(key, value);
    }
    return `${target.pathname}${target.search}`;
  } catch {
    const qs = new URLSearchParams(params).toString();
    return qs ? `${path}?${qs}` : path;
  }
};

const handleArquivoStreamRequest = async (
  c: any,
  action: ArquivoPermissionAction,
  disposition: "inline" | "attachment",
) => {
  const userData = await getAuthenticatedUserData(c);
  const module = parseArquivoModule(c.req.query("module"), "udocs");
  const moduleLabel = getModuloLabel(module);
  if (!userData) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  if (!canAccessArquivosModule(userData, module)) {
    registrarAuditoriaArquivos(c, userData, action, "deny", {
      arquivoId: String(c.req.param("id") || "").trim(),
      detalhes: `Acesso negado ao módulo ${moduleLabel}.`,
    });
    return c.json({ error: `Acesso negado ao módulo ${moduleLabel}` }, 403);
  }

  const arquivoId = String(c.req.param("id") || "").trim();
  const item = getArquivoById(arquivoId, module);
  if (!item || !item.ativo) {
    registrarAuditoriaArquivos(c, userData, action, "error", {
      arquivoId,
      detalhes: `Arquivo não encontrado no módulo ${moduleLabel}.`,
    });
    return c.json({ error: "Arquivo não encontrado" }, 404);
  }

  const aclRows = getActiveArquivoAclRows();
  const accessContext = buildArquivoAccessContext(userData);
  const allowed = canAccessArquivo(item, action, userData, aclRows, accessContext);
  if (!allowed) {
    registrarAuditoriaArquivos(c, userData, action, "deny", {
      arquivoId: item.id,
      driveFileId: item.drive_file_id,
      detalhes: `Acesso negado por ACL (${moduleLabel}).`,
    });
    return c.json({ error: "Acesso negado para este arquivo" }, 403);
  }

  try {
    const rangeHeader = c.req.header("range");
    const { upstream, effectiveMimeType } = await openDriveStream(
      item,
      action,
      rangeHeader,
    );
    if (!upstream.ok) {
      const upstreamBody = await upstream.text().catch(() => "");
      registrarAuditoriaArquivos(c, userData, action, "error", {
        arquivoId: item.id,
        driveFileId: item.drive_file_id,
        detalhes: `Falha upstream (${upstream.status}): ${upstreamBody.slice(0, 300)}`,
      });
      const status = upstream.status === 404 ? 404 : 502;
      return c.json(
        { error: "Falha ao recuperar arquivo no Google Drive" },
        status,
      );
    }

    const headers = new Headers();
    for (
      const key of [
        "content-type",
        "content-length",
        "content-range",
        "accept-ranges",
        "etag",
        "last-modified",
        "cache-control",
      ]
    ) {
      const value = upstream.headers.get(key);
      if (!value) continue;
      const sanitized = sanitizeHttpHeaderValue(value);
      if (!sanitized) continue;
      headers.set(key, sanitized);
    }
    if (!headers.get("content-type") && effectiveMimeType) {
      const sanitizedMime = sanitizeHttpHeaderValue(effectiveMimeType);
      if (sanitizedMime) {
        headers.set("content-type", sanitizedMime);
      }
    }
    const contentDisposition = buildContentDispositionHeader(
      disposition,
      buildArquivoFilename(item, effectiveMimeType),
    );
    headers.set("content-disposition", contentDisposition);

    registrarAuditoriaArquivos(c, userData, action, "ok", {
      arquivoId: item.id,
      driveFileId: item.drive_file_id,
      detalhes: { disposition, status: upstream.status, module },
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    registrarAuditoriaArquivos(c, userData, action, "error", {
      arquivoId: item.id,
      driveFileId: item.drive_file_id,
      detalhes: message,
    });
    const status = /não configuradas|desativada/i.test(message) ? 400 : 500;
    return c.json(
      { error: "Erro ao processar arquivo", details: message.slice(0, 300) },
      status,
    );
  }
};

app.get("/arquivos/auditoria", requireAuth, async (c) => {
  try {
    const userData = await getAuthenticatedUserData(c);
    if (!userData) {
      return c.json({ error: "Usuário não autenticado" }, 401);
    }
    if (!canManageArquivosAdmin(userData)) {
      return c.json({ error: "Acesso negado" }, 403);
    }

    const q = String(c.req.query("q") || "").trim();
    const page = parsePositiveInt(c.req.query("page"), 1, 10000);
    const pageSize = parsePositiveInt(c.req.query("page_size"), 50, 500);
    const offset = (page - 1) * pageSize;

    const whereClauses: string[] = ["1=1"];
    const params: unknown[] = [];
    if (q) {
      const like = `%${q}%`;
      whereClauses.push(
        "(LOWER(COALESCE(a.usuario_email, '')) LIKE LOWER(?) OR LOWER(COALESCE(a.usuario_nome, '')) LIKE LOWER(?) OR LOWER(COALESCE(i.titulo, '')) LIKE LOWER(?) OR LOWER(COALESCE(a.acao, '')) LIKE LOWER(?))",
      );
      params.push(like, like, like, like);
    }

    const whereSql = whereClauses.join(" AND ");
    const countRow = db.queryEntries<{ total: number }>(
      `SELECT COUNT(*) AS total
         FROM ${TBL("arquivos_auditoria")} a
         LEFT JOIN ${TBL("arquivos_itens")} i ON i.id = a.arquivo_id
        WHERE ${whereSql}`,
      params,
    )[0];
    const total = Number(countRow?.total || 0);

    const rows = db.queryEntries<Record<string, unknown>>(
      `SELECT a.*, i.titulo AS arquivo_titulo, i.categoria AS arquivo_categoria
         FROM ${TBL("arquivos_auditoria")} a
         LEFT JOIN ${TBL("arquivos_itens")} i ON i.id = a.arquivo_id
        WHERE ${whereSql}
        ORDER BY
          CASE
            WHEN a.created_at IS NULL OR a.created_at = '' THEN ''
            ELSE a.created_at
          END DESC
        LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    ) || [];

    return c.json({
      items: rows,
      total,
      page,
      page_size: pageSize,
    });
  } catch (error) {
    console.error("[arquivos] erro ao listar auditoria:", error);
    return c.json({ error: "Erro ao listar auditoria de arquivos" }, 500);
  }
});

app.get("/arquivos/acl", requireAuth, async (c) => {
  try {
    const userData = await getAuthenticatedUserData(c);
    if (!userData) return c.json({ error: "Usuário não autenticado" }, 401);
    if (!canManageArquivosAdmin(userData)) {
      return c.json({ error: "Acesso negado" }, 403);
    }

    const rows = db.queryEntries<Record<string, unknown>>(
      `SELECT *
         FROM ${TBL("arquivos_acl")}
        WHERE COALESCE(ativo, 1) = 1
        ORDER BY scope_type ASC, scope_value ASC, principal_type ASC, principal_value ASC`,
    ) || [];

    return c.json({ items: rows });
  } catch (error) {
    console.error("[arquivos] erro ao listar ACL:", error);
    return c.json({ error: "Erro ao carregar ACL de arquivos" }, 500);
  }
});

app.put("/arquivos/acl", requireAuth, async (c) => {
  try {
    const userData = await getAuthenticatedUserData(c);
    if (!userData) return c.json({ error: "Usuário não autenticado" }, 401);
    if (!canManageArquivosAdmin(userData)) {
      return c.json({ error: "Acesso negado" }, 403);
    }

    const payload = await c.req.json().catch(() => ({} as any));
    const rulesInput = Array.isArray(payload?.rules) ? payload.rules : [];
    const replace = payload?.replace === true;
    const now = nowIso();

    if (replace) {
      db.query(`DELETE FROM ${TBL("arquivos_acl")}`);
    }

    let processed = 0;
    for (const rawRule of rulesInput as Array<Record<string, unknown>>) {
      const scopeType = String(rawRule.scope_type || "global").trim().toLowerCase();
      const principalType = String(rawRule.principal_type || "").trim().toLowerCase();
      const principalValueRaw = String(rawRule.principal_value || "").trim();
      const effect = String(rawRule.effect || "allow").trim().toLowerCase() === "deny"
        ? "deny"
        : "allow";
      const canView = rawRule.can_view === false || rawRule.can_view === 0 ? 0 : 1;
      const canDownload = rawRule.can_download === false || rawRule.can_download === 0 ? 0 : 1;
      const ativo = rawRule.ativo === false || rawRule.ativo === 0 ? 0 : 1;
      const scopeValue = (() => {
        const value = String(rawRule.scope_value || "").trim();
        if (!value) return null;
        if (scopeType === "categoria") return normalizeArquivoCategoryLabel(value);
        return value;
      })();

      if (!["global", "categoria", "arquivo"].includes(scopeType)) continue;
      if (!["all", "*", "user", "usuario", "role", "papel", "cooperativa", "singular", "grupo", "group"].includes(principalType)) {
        continue;
      }
      const principalValue = (principalType === "all" || principalType === "*")
        ? "*"
        : principalValueRaw.toLowerCase();
      if (!principalValue) continue;

      const id = String(rawRule.id || "").trim() || safeRandomId("acl");
      db.query(
        `INSERT INTO ${TBL("arquivos_acl")}
          (id, scope_type, scope_value, principal_type, principal_value, can_view, can_download, effect, ativo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           scope_type = excluded.scope_type,
           scope_value = excluded.scope_value,
           principal_type = excluded.principal_type,
           principal_value = excluded.principal_value,
           can_view = excluded.can_view,
           can_download = excluded.can_download,
           effect = excluded.effect,
           ativo = excluded.ativo,
           updated_at = excluded.updated_at`,
        [
          id,
          scopeType,
          scopeValue,
          principalType,
          principalValue,
          canView,
          canDownload,
          effect,
          ativo,
          now,
          now,
        ],
      );
      processed += 1;
    }

    registrarAuditoriaArquivos(c, userData, "acl_update", "ok", {
      detalhes: { replace, processed },
    });

    return c.json({ ok: true, processed, replace });
  } catch (error) {
    console.error("[arquivos] erro ao atualizar ACL:", error);
    return c.json({ error: "Erro ao atualizar ACL de arquivos" }, 500);
  }
});

app.get("/arquivos/grupos", requireAuth, async (c) => {
  try {
    const userData = await getAuthenticatedUserData(c);
    if (!userData) return c.json({ error: "Usuário não autenticado" }, 401);
    if (!canManageArquivosAdmin(userData)) {
      return c.json({ error: "Acesso negado" }, 403);
    }

    const rows = db.queryEntries<Record<string, unknown>>(
      `SELECT g.*,
              COALESCE(COUNT(m.user_email), 0) AS members_count
         FROM ${TBL("arquivos_grupos")} g
         LEFT JOIN ${TBL("arquivos_grupo_membros")} m
           ON m.grupo_id = g.id
          AND COALESCE(m.ativo, 1) = 1
        WHERE COALESCE(g.ativo, 1) = 1
        GROUP BY g.id, g.nome, g.descricao, g.ativo, g.created_at, g.updated_at
        ORDER BY g.nome ASC`,
    ) || [];

    return c.json({ items: rows });
  } catch (error) {
    console.error("[arquivos] erro ao listar grupos:", error);
    return c.json({ error: "Erro ao listar grupos de arquivos" }, 500);
  }
});

app.post("/arquivos/grupos", requireAuth, async (c) => {
  try {
    const userData = await getAuthenticatedUserData(c);
    if (!userData) return c.json({ error: "Usuário não autenticado" }, 401);
    if (!canManageArquivosAdmin(userData)) {
      return c.json({ error: "Acesso negado" }, 403);
    }

    const payload = await c.req.json().catch(() => ({} as any));
    const nome = String(payload?.nome || "").trim();
    if (!nome) {
      return c.json({ error: "Nome do grupo é obrigatório" }, 400);
    }

    const id = String(payload?.id || "").trim() || safeRandomId("agr");
    const descricao = String(payload?.descricao || "").trim() || null;
    const ativo = payload?.ativo === false || payload?.ativo === 0 ? 0 : 1;
    const now = nowIso();

    db.query(
      `INSERT INTO ${TBL("arquivos_grupos")}
        (id, nome, descricao, ativo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         nome = excluded.nome,
         descricao = excluded.descricao,
         ativo = excluded.ativo,
         updated_at = excluded.updated_at`,
      [id, nome, descricao, ativo, now, now],
    );

    registrarAuditoriaArquivos(c, userData, "grupo_upsert", "ok", {
      detalhes: { id, nome, ativo },
    });

    return c.json({ ok: true, id, nome, ativo });
  } catch (error) {
    console.error("[arquivos] erro ao salvar grupo:", error);
    return c.json({ error: "Erro ao salvar grupo de arquivos" }, 500);
  }
});

app.put("/arquivos/grupos/:id/membros", requireAuth, async (c) => {
  try {
    const userData = await getAuthenticatedUserData(c);
    if (!userData) return c.json({ error: "Usuário não autenticado" }, 401);
    if (!canManageArquivosAdmin(userData)) {
      return c.json({ error: "Acesso negado" }, 403);
    }

    const groupId = String(c.req.param("id") || "").trim();
    if (!groupId) {
      return c.json({ error: "Grupo inválido" }, 400);
    }

    const payload = await c.req.json().catch(() => ({} as any));
    const replace = payload?.replace !== false;
    const rawEmails = Array.isArray(payload?.emails) ? payload.emails : [];
    const emails = Array.from(
      new Set(
        rawEmails
          .map((item: unknown) => String(item || "").trim().toLowerCase())
          .filter((item: string) => item.includes("@")),
      ),
    );
    const now = nowIso();

    if (replace) {
      db.query(`DELETE FROM ${TBL("arquivos_grupo_membros")} WHERE grupo_id = ?`, [
        groupId,
      ]);
    }

    for (const email of emails) {
      db.query(
        `INSERT INTO ${TBL("arquivos_grupo_membros")}
          (grupo_id, user_email, ativo, created_at, updated_at)
         VALUES (?, ?, 1, ?, ?)
         ON CONFLICT(grupo_id, user_email) DO UPDATE SET
           ativo = 1,
           updated_at = excluded.updated_at`,
        [groupId, email, now, now],
      );
    }

    registrarAuditoriaArquivos(c, userData, "grupo_membros_update", "ok", {
      detalhes: { groupId, replace, members: emails.length },
    });

    return c.json({ ok: true, group_id: groupId, members: emails.length });
  } catch (error) {
    console.error("[arquivos] erro ao atualizar membros do grupo:", error);
    return c.json({ error: "Erro ao atualizar membros do grupo" }, 500);
  }
});

app.get("/arquivos/atalhos", requireAuth, async (c) => {
  try {
    const userData = await getAuthenticatedUserData(c);
    const module = parseArquivoModule(c.req.query("module"), "udocs");
    const moduleLabel = getModuloLabel(module);
    if (!userData) return c.json({ error: "Usuário não autenticado" }, 401);
    if (!canAccessArquivosModule(userData, module)) {
      return c.json({ error: `Acesso negado ao módulo ${moduleLabel}` }, 403);
    }

    const rows = db.queryEntries<Record<string, unknown>>(
      `SELECT a.*, i.titulo AS folder_titulo, i.categoria AS folder_categoria
         FROM ${TBL("arquivos_atalhos")} a
         LEFT JOIN ${TBL("arquivos_itens")} i
           ON i.drive_file_id = a.folder_drive_file_id
          AND LOWER(COALESCE(i.modulo, 'udocs')) = LOWER(a.modulo)
        WHERE COALESCE(a.ativo, 1) = 1
          AND LOWER(COALESCE(a.modulo, 'udocs')) = LOWER(?)
        ORDER BY a.ordem ASC, LOWER(COALESCE(a.rotulo, '')) ASC`,
      [module],
    ) || [];

    return c.json({
      items: rows.map((row) => {
        const mapped = mapArquivoShortcutRecord(row);
        return {
          id: mapped.id,
          modulo: mapped.modulo,
          folder_drive_file_id: mapped.folder_drive_file_id,
          rotulo: mapped.rotulo,
          ordem: mapped.ordem,
          folder_titulo: String(row.folder_titulo || ""),
          folder_categoria: String(row.folder_categoria || ""),
        };
      }),
      module,
    });
  } catch (error) {
    console.error("[arquivos] erro ao listar atalhos:", error);
    return c.json({ error: "Erro ao listar atalhos" }, 500);
  }
});

app.put("/arquivos/atalhos", requireAuth, async (c) => {
  try {
    const userData = await getAuthenticatedUserData(c);
    if (!userData) return c.json({ error: "Usuário não autenticado" }, 401);
    if (!canManageArquivosAdmin(userData)) {
      return c.json({ error: "Acesso negado. Apenas administradores podem gerenciar atalhos." }, 403);
    }

    const payload = await c.req.json().catch(() => ({} as any));
    const module = parseArquivoModule(payload?.module, "udocs");
    if (!canAccessArquivosModule(userData, module)) {
      return c.json({ error: `Acesso negado ao módulo ${getModuloLabel(module)}.` }, 403);
    }

    const folderDriveFileId = String(payload?.folder_drive_file_id || "").trim();
    const requestedLabel = normalizeShortcutLabel(payload?.rotulo);
    if (!folderDriveFileId) {
      return c.json({ error: "folder_drive_file_id é obrigatório." }, 400);
    }

    const folder = db.queryEntries<Record<string, unknown>>(
      `SELECT drive_file_id, titulo, item_tipo
         FROM ${TBL("arquivos_itens")}
        WHERE drive_file_id = ?
          AND LOWER(COALESCE(modulo, 'udocs')) = LOWER(?)
          AND COALESCE(ativo, 1) = 1
        LIMIT 1`,
      [folderDriveFileId, module],
    )[0];
    if (!folder) {
      return c.json({ error: "Pasta não encontrada no repositório." }, 404);
    }
    const folderTipo = String(folder.item_tipo || "").trim().toLowerCase();
    if (folderTipo !== "pasta") {
      return c.json({ error: "Somente pastas podem ser adicionadas como atalho." }, 400);
    }
    const rotulo = requestedLabel || String(folder.titulo || "Atalho");
    const now = nowIso();

    const existing = db.queryEntries<{ id: string; ordem: number }>(
      `SELECT id, ordem
         FROM ${TBL("arquivos_atalhos")}
        WHERE folder_drive_file_id = ?
          AND LOWER(COALESCE(modulo, 'udocs')) = LOWER(?)
        LIMIT 1`,
      [folderDriveFileId, module],
    )[0];

    let id = existing?.id || safeRandomId("ash");
    let ordem = Number(existing?.ordem || 0);
    if (!existing) {
      const maxRow = db.queryEntries<{ max_ordem: number }>(
        `SELECT COALESCE(MAX(ordem), 0) AS max_ordem
           FROM ${TBL("arquivos_atalhos")}
          WHERE LOWER(COALESCE(modulo, 'udocs')) = LOWER(?)`,
        [module],
      )[0];
      ordem = Number(maxRow?.max_ordem || 0) + 10;
    }

    db.query(
      `INSERT INTO ${TBL("arquivos_atalhos")}
        (id, modulo, folder_drive_file_id, rotulo, ordem, ativo, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(modulo, folder_drive_file_id) DO UPDATE SET
         rotulo = excluded.rotulo,
         ativo = 1,
         atualizado_em = excluded.atualizado_em`,
      [id, module, folderDriveFileId, rotulo, ordem, now, now],
    );

    registrarAuditoriaArquivos(c, userData, "atalho_upsert", "ok", {
      detalhes: { module, folder_drive_file_id: folderDriveFileId, rotulo },
    });

    return c.json({
      ok: true,
      id,
      module,
      folder_drive_file_id: folderDriveFileId,
      rotulo,
      ordem,
    });
  } catch (error) {
    console.error("[arquivos] erro ao salvar atalho:", error);
    return c.json({ error: "Erro ao salvar atalho" }, 500);
  }
});

app.delete("/arquivos/atalhos/:folderId", requireAuth, async (c) => {
  try {
    const userData = await getAuthenticatedUserData(c);
    if (!userData) return c.json({ error: "Usuário não autenticado" }, 401);
    if (!canManageArquivosAdmin(userData)) {
      return c.json({ error: "Acesso negado. Apenas administradores podem gerenciar atalhos." }, 403);
    }

    const module = parseArquivoModule(c.req.query("module"), "udocs");
    if (!canAccessArquivosModule(userData, module)) {
      return c.json({ error: `Acesso negado ao módulo ${getModuloLabel(module)}.` }, 403);
    }
    const folderDriveFileId = String(c.req.param("folderId") || "").trim();
    if (!folderDriveFileId) {
      return c.json({ error: "folderId inválido." }, 400);
    }

    db.query(
      `UPDATE ${TBL("arquivos_atalhos")}
          SET ativo = 0,
              atualizado_em = ?
        WHERE folder_drive_file_id = ?
          AND LOWER(COALESCE(modulo, 'udocs')) = LOWER(?)`,
      [nowIso(), folderDriveFileId, module],
    );

    registrarAuditoriaArquivos(c, userData, "atalho_remove", "ok", {
      detalhes: { module, folder_drive_file_id: folderDriveFileId },
    });

    return c.json({ ok: true, folder_drive_file_id: folderDriveFileId, module });
  } catch (error) {
    console.error("[arquivos] erro ao remover atalho:", error);
    return c.json({ error: "Erro ao remover atalho" }, 500);
  }
});

app.post("/arquivos/:id/move", requireAuth, async (c) => {
  try {
    const userData = await getAuthenticatedUserData(c);
    if (!userData) return c.json({ error: "Usuário não autenticado" }, 401);
    if (!canManageArquivosAdmin(userData)) {
      return c.json({ error: "Acesso negado. Apenas administradores podem organizar a ordem." }, 403);
    }

    const payload = await c.req.json().catch(() => ({} as any));
    const module = parseArquivoModule(payload?.module || c.req.query("module"), "udocs");
    if (!canAccessArquivosModule(userData, module)) {
      return c.json({ error: `Acesso negado ao módulo ${getModuloLabel(module)}.` }, 403);
    }

    const itemId = String(c.req.param("id") || "").trim();
    const directionRaw = String(payload?.direction || "").trim().toLowerCase();
    const direction = directionRaw === "up" || directionRaw === "down"
      ? directionRaw
      : null;
    if (!itemId || !direction) {
      return c.json({ error: "Parâmetros inválidos. Use direction=up|down." }, 400);
    }

    const result = reorderArquivoItem(module, itemId, direction);
    registrarAuditoriaArquivos(c, userData, "reorder", result.moved ? "ok" : "error", {
      arquivoId: itemId,
      detalhes: { module, ...result },
    });

    if (!result.moved) {
      return c.json({ ok: false, ...result }, 200);
    }
    return c.json({ ok: true, ...result });
  } catch (error) {
    console.error("[arquivos] erro ao reordenar item:", error);
    return c.json({ error: "Erro ao reordenar item" }, 500);
  }
});

app.get("/arquivos/search", requireAuth, async (c) => {
  try {
    const userData = await getAuthenticatedUserData(c);
    if (!userData) return c.json({ error: "Usuário não autenticado" }, 401);

    const moduleRaw = String(c.req.query("module") || "udocs").trim().toLowerCase();
    const modules: ArquivoModule[] = moduleRaw === "all"
      ? ["udocs", "umarketing"]
      : [parseArquivoModule(moduleRaw, "udocs")];
    for (const module of modules) {
      if (!canAccessArquivosModule(userData, module)) {
        return c.json({ error: `Acesso negado ao módulo ${getModuloLabel(module)}.` }, 403);
      }
    }

    const q = String(c.req.query("q") || "").trim();
    if (q.length < 2) {
      return c.json({ error: "Informe ao menos 2 caracteres para busca global." }, 400);
    }

    const categoria = normalizeArquivoCategoryLabel(c.req.query("categoria"));
    const tipo = String(c.req.query("tipo") || "").trim().toLowerCase();
    const anoInput = String(c.req.query("ano") || "").trim();
    const year = Number(anoInput);
    const page = parsePositiveInt(c.req.query("page"), 1, 10000);
    const pageSize = parsePositiveInt(c.req.query("page_size"), 20, 200);

    const modulePlaceholders = modules.map(() => "LOWER(COALESCE(modulo, 'udocs')) = LOWER(?)").join(" OR ");
    const whereClauses: string[] = [
      "COALESCE(ativo, 1) = 1",
      `(${modulePlaceholders})`,
    ];
    const params: unknown[] = [...modules];
    if (categoria) {
      whereClauses.push("LOWER(COALESCE(categoria, '')) = LOWER(?)");
      params.push(categoria);
    }
    if (tipo === "pasta" || tipo === "arquivo") {
      whereClauses.push("LOWER(COALESCE(item_tipo, 'arquivo')) = LOWER(?)");
      params.push(tipo);
    }
    if (anoInput && Number.isFinite(year) && year > 1900) {
      whereClauses.push("ano = ?");
      params.push(Math.trunc(year));
    }

    const rows = db.queryEntries<Record<string, unknown>>(
      `SELECT *
         FROM ${TBL("arquivos_itens")}
        WHERE ${whereClauses.join(" AND ")}`,
      params,
    ) || [];

    const aclRows = getActiveArquivoAclRows();
    const accessContext = buildArquivoAccessContext(userData);
    const allowedItems = rows
      .map((row) => mapArquivoItemRecord(row))
      .filter((item) => canAccessArquivo(item, "view", userData, aclRows, accessContext));

    let contentMatchedIds = new Set<string>();
    try {
      const accessToken = await getDriveAccessToken();
      const runtimeConfig = resolveCentralArquivosDriveRuntimeConfig();
      contentMatchedIds = await searchDriveFullTextIds(accessToken, q, {
        driveId: runtimeConfig.driveId,
      });
    } catch (error) {
      console.warn("[arquivos/search] busca fullText indisponível, mantendo apenas metadados:", error);
    }

    const queryTokens = tokenizeSearchQuery(q);
    const queryNormalized = normalizeArquivoComparable(q);
    const scored = allowedItems.map((item) => {
      const title = String(item.titulo || "");
      const categoriaItem = String(item.categoria || "");
      const titleNorm = normalizeArquivoComparable(title);
      const categoriaNorm = normalizeArquivoComparable(categoriaItem);
      const mimeNorm = normalizeArquivoComparable(item.mime_type || "");

      let score = 0;
      let matchSource: "titulo" | "metadado" | "conteudo" | null = null;
      if (titleNorm === queryNormalized) {
        score += 140;
        matchSource = "titulo";
      } else if (titleNorm.startsWith(queryNormalized)) {
        score += 100;
        matchSource = "titulo";
      } else if (titleNorm.includes(queryNormalized)) {
        score += 72;
        matchSource = "titulo";
      }
      if (categoriaNorm.includes(queryNormalized)) {
        score += 28;
        if (!matchSource) matchSource = "metadado";
      }
      if (mimeNorm.includes(queryNormalized)) {
        score += 10;
        if (!matchSource) matchSource = "metadado";
      }

      for (const token of queryTokens) {
        if (!token) continue;
        if (titleNorm.includes(token)) score += 12;
        if (categoriaNorm.includes(token)) score += 6;
      }

      const driveId = String(item.drive_file_id || "").trim();
      const contentHit = Boolean(driveId && contentMatchedIds.has(driveId));
      if (contentHit) {
        score += 110;
        if (!matchSource) matchSource = "conteudo";
      }

      const matches = score > 0;
      const snippet = matchSource === "conteudo" && !titleNorm.includes(queryNormalized) && !categoriaNorm.includes(queryNormalized)
        ? "Termo encontrado no conteúdo indexado do arquivo no Google Drive."
        : buildSearchSnippet(`${title} ${categoriaItem}`, queryTokens);

      return {
        ...item,
        matches,
        relevance_score: score,
        snippet,
        match_source: matchSource,
      };
    }).filter((item) => item.matches);

    scored.sort((a, b) => {
      if (b.relevance_score !== a.relevance_score) return b.relevance_score - a.relevance_score;
      const tA = new Date(a.drive_modified_at || a.sincronizado_em || a.criado_em || 0).getTime();
      const tB = new Date(b.drive_modified_at || b.sincronizado_em || b.criado_em || 0).getTime();
      return tB - tA;
    });

    const total = scored.length;
    const start = (page - 1) * pageSize;
    const pagedItems = scored.slice(start, start + pageSize);

    const categorias = Array.from(
      new Set(
        scored
          .map((item) => normalizeArquivoCategoryLabel(item.categoria))
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));

    const anos = Array.from(
      new Set(
        scored
          .map((item) => Number(item.ano))
          .filter((item) => Number.isFinite(item) && item > 1900),
      ),
    ).sort((a, b) => b - a);

    registrarAuditoriaArquivos(c, userData, "search", "ok", {
      detalhes: {
        module: moduleRaw,
        q,
        categoria: categoria || null,
        tipo: tipo || null,
        ano: anoInput || null,
        total,
        page,
        page_size: pageSize,
      },
    });

    return c.json({
      items: pagedItems.map((item) => ({
        id: item.id,
        drive_file_id: item.drive_file_id,
        titulo: item.titulo,
        categoria: item.categoria,
        ano: item.ano,
        mime_type: item.mime_type,
        item_tipo: item.item_tipo,
        parent_drive_file_id: item.parent_drive_file_id,
        ordem_manual: item.ordem_manual,
        tamanho_bytes: item.tamanho_bytes,
        criado_em: item.drive_created_at || item.criado_em || item.sincronizado_em,
        atualizado_em: item.drive_modified_at || item.sincronizado_em || item.criado_em,
        preview_url: item.preview_url,
        download_url: item.download_url,
        snippet: item.snippet,
        relevance_score: item.relevance_score,
        match_source: item.match_source,
      })),
      total,
      categorias,
      anos,
      page,
      page_size: pageSize,
      modules,
      search_mode: "global_no_ocr",
      source: "api",
    });
  } catch (error) {
    console.error("[arquivos] erro na busca global:", error);
    return c.json({ error: "Erro ao executar busca global" }, 500);
  }
});

app.get("/arquivos", requireAuth, async (c) => {
  try {
    const userData = await getAuthenticatedUserData(c);
    const module = parseArquivoModule(c.req.query("module"), "udocs");
    const moduleLabel = getModuloLabel(module);
    if (!userData) {
      return c.json({ error: "Usuário não autenticado" }, 401);
    }
    if (!canAccessArquivosModule(userData, module)) {
      registrarAuditoriaArquivos(c, userData, "list", "deny", {
        detalhes: `Acesso negado ao módulo ${moduleLabel}.`,
      });
      return c.json({ error: `Acesso negado ao módulo ${moduleLabel}` }, 403);
    }

    const q = String(c.req.query("q") || "").trim();
    const categoria = normalizeArquivoCategoryLabel(c.req.query("categoria"));
    const anoInput = String(c.req.query("ano") || "").trim();
    const year = Number(anoInput);
    const page = parsePositiveInt(c.req.query("page"), 1, 10000);
    const pageSize = parsePositiveInt(c.req.query("page_size"), 20, 2000);

    const whereClauses: string[] = [
      "COALESCE(ativo, 1) = 1",
      "LOWER(COALESCE(modulo, 'udocs')) = LOWER(?)",
    ];
    const params: unknown[] = [module];
    if (q) {
      const like = `%${q}%`;
      whereClauses.push(
        "(LOWER(COALESCE(titulo, '')) LIKE LOWER(?) OR LOWER(COALESCE(categoria, '')) LIKE LOWER(?) OR LOWER(COALESCE(mime_type, '')) LIKE LOWER(?))",
      );
      params.push(like, like, like);
    }
    if (categoria) {
      whereClauses.push("LOWER(COALESCE(categoria, '')) = LOWER(?)");
      params.push(categoria);
    }
    if (anoInput && Number.isFinite(year) && year > 1900) {
      whereClauses.push("ano = ?");
      params.push(Math.trunc(year));
    }

    const rows = db.queryEntries<Record<string, unknown>>(
      `SELECT *
         FROM ${TBL("arquivos_itens")}
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY
          COALESCE(parent_drive_file_id, '') ASC,
          COALESCE(ordem_manual, 2147483647) ASC,
          CASE WHEN LOWER(COALESCE(item_tipo, 'arquivo')) = 'pasta' THEN 0 ELSE 1 END ASC,
          LOWER(COALESCE(titulo, '')) ASC`,
      params,
    ) || [];

    const aclRows = getActiveArquivoAclRows();
    const accessContext = buildArquivoAccessContext(userData);
    const allItems = rows.map((row) => mapArquivoItemRecord(row));
    const allowedItems = allItems.filter((item) =>
      canAccessArquivo(item, "view", userData, aclRows, accessContext)
    );

    const enrichedItems = allowedItems.map((item) => {
      const parsed = extractArquivoCodeAndLabel(item.titulo);
      return {
        ...item,
        item_tipo: item.item_tipo || resolveArquivoItemTipo(item),
        pasta_codigo: parsed.code,
        pasta_nome: parsed.label,
      };
    });

    const folderByCode = new Map<string, { id: string; drive_file_id: string; pasta_nome: string }>();
    const folderByLabel = new Map<string, { id: string; drive_file_id: string; pasta_nome: string }>();
    for (const item of enrichedItems) {
      if (item.item_tipo !== "pasta") continue;
      if (item.pasta_codigo) {
        folderByCode.set(item.pasta_codigo, {
          id: item.id,
          drive_file_id: item.drive_file_id,
          pasta_nome: item.pasta_nome,
        });
      }
      const normalizedLabel = normalizeArquivoCategoryLabel(item.pasta_nome).toLowerCase();
      if (normalizedLabel) {
        folderByLabel.set(normalizedLabel, {
          id: item.id,
          drive_file_id: item.drive_file_id,
          pasta_nome: item.pasta_nome,
        });
      }
    }

    const resolvedItems = enrichedItems.map((item) => {
      if (item.item_tipo === "pasta") {
        return { ...item, parent_drive_file_id: normalizeArquivoParentId(item.parent_drive_file_id) };
      }

      let parentDriveFileId: string | null = normalizeArquivoParentId(item.parent_drive_file_id);
      // Só usa inferência por código/categoria quando não existe pai real vindo do Drive.
      if (!parentDriveFileId && item.pasta_codigo && folderByCode.has(item.pasta_codigo)) {
        parentDriveFileId = folderByCode.get(item.pasta_codigo)?.drive_file_id || null;
      } else if (!parentDriveFileId) {
        const categoriaNormalized = normalizeArquivoCategoryLabel(item.categoria).toLowerCase();
        const byCategory = categoriaNormalized ? folderByLabel.get(categoriaNormalized) : null;
        if (byCategory) {
          parentDriveFileId = byCategory.drive_file_id;
        }
      }

      return {
        ...item,
        parent_drive_file_id: parentDriveFileId,
      };
    });

    const sortedItems = [...resolvedItems].sort((a, b) => {
      const parentA = String(a.parent_drive_file_id || "").toLowerCase();
      const parentB = String(b.parent_drive_file_id || "").toLowerCase();
      if (parentA !== parentB) return parentA.localeCompare(parentB, "pt-BR");
      const orderA = Number.isFinite(Number(a.ordem_manual)) ? Number(a.ordem_manual) : Number.MAX_SAFE_INTEGER;
      const orderB = Number.isFinite(Number(b.ordem_manual)) ? Number(b.ordem_manual) : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      if (a.item_tipo !== b.item_tipo) return a.item_tipo === "pasta" ? -1 : 1;
      return String(a.titulo || "").localeCompare(String(b.titulo || ""), "pt-BR");
    });

    const total = sortedItems.length;
    const start = (page - 1) * pageSize;
    const pagedItems = sortedItems.slice(start, start + pageSize);

    const categorias = Array.from(
      new Set(
        sortedItems
          .map((item) => normalizeArquivoCategoryLabel(item.categoria))
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));

    const anos = Array.from(
      new Set(
        sortedItems
          .map((item) => Number(item.ano))
          .filter((item) => Number.isFinite(item) && item > 1900),
      ),
    ).sort((a, b) => b - a);

    registrarAuditoriaArquivos(c, userData, "list", "ok", {
      detalhes: {
        module,
        q: q || null,
        categoria: categoria || null,
        ano: anoInput || null,
        total,
        page,
        page_size: pageSize,
      },
    });

    return c.json({
      items: pagedItems.map((item) => ({
        id: item.id,
        drive_file_id: item.drive_file_id,
        titulo: item.titulo,
        categoria: item.categoria,
        ano: item.ano,
        mime_type: item.mime_type,
        item_tipo: item.item_tipo,
        pasta_codigo: item.pasta_codigo,
        pasta_nome: item.pasta_nome,
        parent_drive_file_id: item.parent_drive_file_id,
        ordem_manual: item.ordem_manual,
        tamanho_bytes: item.tamanho_bytes,
        criado_em: item.drive_created_at || item.criado_em || item.sincronizado_em,
        atualizado_em: item.drive_modified_at || item.sincronizado_em || item.criado_em,
        preview_url: item.preview_url,
        download_url: item.download_url,
      })),
      total,
      categorias,
      anos,
      page,
      page_size: pageSize,
      module,
      source: "api",
    });
  } catch (error) {
    console.error("[arquivos] erro ao listar:", error);
    return c.json({ error: "Erro ao carregar arquivos" }, 500);
  }
});

app.post("/arquivos/sync", requireAuth, async (c) => {
  const userData = await getAuthenticatedUserData(c);
  const queryModule = String(c.req.query("module") || "").trim();
  const targetModules = queryModule
    ? [parseArquivoModule(queryModule, "udocs")]
    : ["udocs" as ArquivoModule];
  if (!userData) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }
  if (!canManageArquivosAdmin(userData)) {
    registrarAuditoriaArquivos(c, userData, "sync", "deny", {
      detalhes: "Tentativa de sync sem permissão.",
    });
    return c.json({ error: "Acesso negado. Apenas administradores da Central podem sincronizar." }, 403);
  }
  for (const module of targetModules) {
    if (!canAccessArquivosModule(userData, module)) {
      return c.json({ error: `Acesso negado ao módulo ${getModuloLabel(module)}.` }, 403);
    }
  }

  try {
    const result = await syncArquivosFromGoogleDrive(targetModules);
    registrarAuditoriaArquivos(c, userData, "sync", "ok", {
      detalhes: { ...result, target_modules: targetModules },
    });
    return c.json({
      message: `Sincronização concluída com sucesso (${targetModules.map(getModuloLabel).join(", ")}).`,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const now = nowIso();
    try {
      db.query(
        `INSERT INTO ${TBL("arquivos_sync_state")}
          (provider, cursor_token, last_sync_at, last_status, last_error, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(provider) DO UPDATE SET
           last_sync_at = excluded.last_sync_at,
           last_status = excluded.last_status,
           last_error = excluded.last_error,
           updated_at = excluded.updated_at`,
        ["google_drive", null, now, "error", truncateText(message, 600), now],
      );
    } catch (syncError) {
      console.warn("[arquivos] falha ao registrar status de sync:", syncError);
    }
    registrarAuditoriaArquivos(c, userData, "sync", "error", {
      detalhes: message,
    });
    const status = /não configuradas|desativada/i.test(message) ? 400 : 500;
    return c.json({ error: "Falha ao sincronizar arquivos", details: message }, status);
  }
});

app.get("/arquivos/:id/preview", requireAuth, async (c) =>
  handleArquivoStreamRequest(c, "view", "inline")
);

app.get("/arquivos/:id/download", requireAuth, async (c) =>
  handleArquivoStreamRequest(c, "download", "attachment")
);

// Aliases canônicos da UDocs (mantém endpoints /marketing e /arquivos para retrocompatibilidade)
app.get("/udocs/auditoria", requireAuth, async (c) =>
  c.redirect(buildRedirectTarget(c, "/arquivos/auditoria"), 307)
);

app.get("/udocs/acl", requireAuth, async (c) =>
  c.redirect(buildRedirectTarget(c, "/arquivos/acl"), 307)
);

app.put("/udocs/acl", requireAuth, async (c) =>
  c.redirect(buildRedirectTarget(c, "/arquivos/acl"), 307)
);

app.get("/udocs/grupos", requireAuth, async (c) =>
  c.redirect(buildRedirectTarget(c, "/arquivos/grupos"), 307)
);

app.post("/udocs/grupos", requireAuth, async (c) =>
  c.redirect(buildRedirectTarget(c, "/arquivos/grupos"), 307)
);

app.put("/udocs/grupos/:id/membros", requireAuth, async (c) => {
  const groupId = encodeURIComponent(String(c.req.param("id") || "").trim());
  return c.redirect(
    buildRedirectTarget(c, `/arquivos/grupos/${groupId}/membros`),
    307,
  );
});

app.get("/udocs/assets", requireAuth, async (c) =>
  c.redirect(buildRedirectTargetWithQuery(c, "/arquivos", { module: "udocs" }), 307)
);

app.get("/udocs/assets/search", requireAuth, async (c) =>
  c.redirect(buildRedirectTargetWithQuery(c, "/arquivos/search", { module: "udocs" }), 307)
);

app.post("/udocs/assets/sync", requireAuth, async (c) =>
  c.redirect(buildRedirectTargetWithQuery(c, "/arquivos/sync", { module: "udocs" }), 307)
);

app.get("/udocs/assets/atalhos", requireAuth, async (c) =>
  c.redirect(buildRedirectTargetWithQuery(c, "/arquivos/atalhos", { module: "udocs" }), 307)
);

app.put("/udocs/assets/atalhos", requireAuth, async (c) =>
  c.redirect(buildRedirectTargetWithQuery(c, "/arquivos/atalhos", { module: "udocs" }), 307)
);

app.delete("/udocs/assets/atalhos/:folderId", requireAuth, async (c) => {
  const folderId = encodeURIComponent(String(c.req.param("folderId") || "").trim());
  return c.redirect(
    buildRedirectTargetWithQuery(c, `/arquivos/atalhos/${folderId}`, { module: "udocs" }),
    307,
  );
});

app.post("/udocs/assets/:id/move", requireAuth, async (c) => {
  const itemId = encodeURIComponent(String(c.req.param("id") || "").trim());
  return c.redirect(
    buildRedirectTargetWithQuery(c, `/arquivos/${itemId}/move`, { module: "udocs" }),
    307,
  );
});

app.get("/udocs/assets/:id/preview", requireAuth, async (c) => {
  const assetId = encodeURIComponent(String(c.req.param("id") || "").trim());
  return c.redirect(
    buildRedirectTargetWithQuery(c, `/arquivos/${assetId}/preview`, { module: "udocs" }),
    307,
  );
});

app.get("/udocs/assets/:id/download", requireAuth, async (c) => {
  const assetId = encodeURIComponent(String(c.req.param("id") || "").trim());
  return c.redirect(
    buildRedirectTargetWithQuery(c, `/arquivos/${assetId}/download`, { module: "udocs" }),
    307,
  );
});

// Aliases legados do namespace /marketing para a API de arquivos
app.get("/marketing/auditoria", requireAuth, async (c) =>
  c.redirect(buildRedirectTarget(c, "/arquivos/auditoria"), 307)
);

app.get("/marketing/acl", requireAuth, async (c) =>
  c.redirect(buildRedirectTarget(c, "/arquivos/acl"), 307)
);

app.put("/marketing/acl", requireAuth, async (c) =>
  c.redirect(buildRedirectTarget(c, "/arquivos/acl"), 307)
);

app.get("/marketing/grupos", requireAuth, async (c) =>
  c.redirect(buildRedirectTarget(c, "/arquivos/grupos"), 307)
);

app.post("/marketing/grupos", requireAuth, async (c) =>
  c.redirect(buildRedirectTarget(c, "/arquivos/grupos"), 307)
);

app.put("/marketing/grupos/:id/membros", requireAuth, async (c) => {
  const groupId = encodeURIComponent(String(c.req.param("id") || "").trim());
  return c.redirect(
    buildRedirectTarget(c, `/arquivos/grupos/${groupId}/membros`),
    307,
  );
});

app.get("/marketing/assets", requireAuth, async (c) =>
  c.redirect(
    buildRedirectTargetWithQuery(c, "/arquivos", { module: "umarketing" }),
    307,
  )
);

app.get("/marketing/assets/search", requireAuth, async (c) =>
  c.redirect(
    buildRedirectTargetWithQuery(c, "/arquivos/search", { module: "umarketing" }),
    307,
  )
);

app.post("/marketing/assets/sync", requireAuth, async (c) =>
  c.redirect(
    buildRedirectTargetWithQuery(c, "/arquivos/sync", { module: "umarketing" }),
    307,
  )
);

app.get("/marketing/assets/atalhos", requireAuth, async (c) =>
  c.redirect(
    buildRedirectTargetWithQuery(c, "/arquivos/atalhos", { module: "umarketing" }),
    307,
  )
);

app.put("/marketing/assets/atalhos", requireAuth, async (c) =>
  c.redirect(
    buildRedirectTargetWithQuery(c, "/arquivos/atalhos", { module: "umarketing" }),
    307,
  )
);

app.delete("/marketing/assets/atalhos/:folderId", requireAuth, async (c) => {
  const folderId = encodeURIComponent(String(c.req.param("folderId") || "").trim());
  return c.redirect(
    buildRedirectTargetWithQuery(c, `/arquivos/atalhos/${folderId}`, {
      module: "umarketing",
    }),
    307,
  );
});

app.post("/marketing/assets/:id/move", requireAuth, async (c) => {
  const itemId = encodeURIComponent(String(c.req.param("id") || "").trim());
  return c.redirect(
    buildRedirectTargetWithQuery(c, `/arquivos/${itemId}/move`, {
      module: "umarketing",
    }),
    307,
  );
});

app.get("/marketing/assets/:id/preview", requireAuth, async (c) => {
  const assetId = encodeURIComponent(String(c.req.param("id") || "").trim());
  return c.redirect(
    buildRedirectTargetWithQuery(c, `/arquivos/${assetId}/preview`, {
      module: "umarketing",
    }),
    307,
  );
});

app.get("/marketing/assets/:id/download", requireAuth, async (c) => {
  const assetId = encodeURIComponent(String(c.req.param("id") || "").trim());
  return c.redirect(
    buildRedirectTargetWithQuery(c, `/arquivos/${assetId}/download`, {
      module: "umarketing",
    }),
    307,
  );
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

app.get("/reports/overview", requireAuth, async (c) => {
  try {
    const authUser = c.get("user");
    const userData = await getUserData(
      authUser.id,
      authUser.email || authUser?.claims?.email,
    );
    if (!userData) {
      return c.json({ error: "Usuário não autenticado" }, 401);
    }

    const now = new Date();
    const defaultStart = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    const startParam = c.req.query("start");
    const endParam = c.req.query("end");
    const parsedStart = startParam ? new Date(startParam) : defaultStart;
    const parsedEnd = endParam ? new Date(endParam) : now;
    if (Number.isNaN(parsedStart.getTime())) parsedStart.setTime(defaultStart.getTime());
    if (Number.isNaN(parsedEnd.getTime())) parsedEnd.setTime(now.getTime());
    if (parsedStart.getTime() > parsedEnd.getTime()) {
      const tmp = parsedStart.getTime();
      parsedStart.setTime(parsedEnd.getTime());
      parsedEnd.setTime(tmp);
    }
    const maxRangeMs = 365 * 24 * 60 * 60 * 1000;
    if ((parsedEnd.getTime() - parsedStart.getTime()) > maxRangeMs) {
      parsedStart.setTime(parsedEnd.getTime() - maxRangeMs);
    }
    const rangeStart = new Date(parsedStart);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(parsedEnd);
    rangeEnd.setHours(23, 59, 59, 999);
    const startIso = rangeStart.toISOString();
    const endIso = rangeEnd.toISOString();

    const scope = buildCooperativaScopeClause(userData, "cooperativa_solicitante_id");
    let rowsIncludeExcluido = false;
    let rawRows: any[] = [];
    const baseParams = [startIso, endIso, ...scope.params];
    const whereClause = `data_criacao BETWEEN ? AND ? ${scope.clause ? `AND ${scope.clause}` : ""}`;
    const baseSelect = `SELECT id, data_criacao, data_ultima_alteracao, status, nivel_atual,
              cooperativa_solicitante_id, cooperativa_responsavel_id`;
    const excluidoFilter =
      "COALESCE(CAST(excluido AS TEXT), '0') NOT IN ('1','true','t','yes')";
    try {
      rawRows = db.queryEntries<any>(
        `${baseSelect}, excluido
           FROM ${TBL("pedidos")}
          WHERE ${whereClause}
            AND ${excluidoFilter}`,
        baseParams,
      ) || [];
      rowsIncludeExcluido = true;
    } catch (error) {
      if (!isMissingColumnError(error, "excluido")) throw error;
      rawRows = db.queryEntries<any>(
        `${baseSelect}
           FROM ${TBL("pedidos")}
          WHERE ${whereClause}`,
        baseParams,
      ) || [];
    }
    const rows = rowsIncludeExcluido
      ? rawRows
      : rawRows.filter((row) => row.excluido === undefined || row.excluido === null);

    const cooperativaIds = Array.from(
      new Set(
        rows
          .map((row) =>
            typeof row.cooperativa_responsavel_id === "string"
              ? row.cooperativa_responsavel_id.trim()
              : "",
          )
          .filter((value) => value.length > 0),
      ),
    );
    const cooperativaNomeMap: Record<string, string> = {};
    if (cooperativaIds.length) {
      try {
        const placeholders = cooperativaIds.map(() => "?").join(",");
        const coopRows = db.queryEntries<any>(
          `SELECT id_singular, UNIODONTO, uniodonto
             FROM ${TBL("cooperativas")}
            WHERE id_singular IN (${placeholders})`,
          cooperativaIds,
        ) || [];
        for (const coop of coopRows) {
          const id = coop.id_singular ?? coop.ID_SINGULAR;
          if (!id) continue;
          const nome = coop.UNIODONTO ?? coop.uniodonto ?? coop.nome ?? "";
          cooperativaNomeMap[id] = nome;
        }
      } catch (error) {
        console.warn("[reports] falha ao buscar nomes de cooperativas:", error);
      }
    }

    const creationMap = new Map<string, { total: number; concluidos: number }>();
    const responseMap = new Map<
      string,
      { cooperativa_id: string | null; total: number; responded: number; tempoTotalMin: number }
    >();
    const statusBreakdown: Record<string, number> = {
      novo: 0,
      em_andamento: 0,
      concluido: 0,
      cancelado: 0,
    };
    const nivelResumo: Record<string, number> = {
      singular: 0,
      federacao: 0,
      confederacao: 0,
    };
    let totalRespostaMin = 0;
    let countResposta = 0;
    let totalConclusaoMin = 0;
    let countConclusao = 0;

    const toDateKey = (value?: string | null) => {
      if (!value) return null;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return null;
      return parsed.toISOString().slice(0, 10);
    };

    const diffMinutes = (start?: string | null, end?: string | null) => {
      if (!start || !end) return null;
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
      const diff = endDate.getTime() - startDate.getTime();
      if (!Number.isFinite(diff) || diff < 0) return null;
      return diff / (1000 * 60);
    };

    for (const row of rows) {
      const dayKey = toDateKey(row.data_criacao);
      if (dayKey) {
        const entry = creationMap.get(dayKey) ?? { total: 0, concluidos: 0 };
        entry.total += 1;
        if ((row.status || "").toLowerCase() === "concluido") {
          entry.concluidos += 1;
        }
        creationMap.set(dayKey, entry);
      }

      const statusKey = (row.status || "novo").toLowerCase();
      statusBreakdown[statusKey] = (statusBreakdown[statusKey] ?? 0) + 1;

      const nivelKey = (row.nivel_atual || "singular").toLowerCase();
      nivelResumo[nivelKey] = (nivelResumo[nivelKey] ?? 0) + 1;

      const coopKey = row.cooperativa_responsavel_id || "sem_atribuicao";
      if (!responseMap.has(coopKey)) {
        responseMap.set(coopKey, {
          cooperativa_id: row.cooperativa_responsavel_id ?? null,
          total: 0,
          responded: 0,
          tempoTotalMin: 0,
        });
      }
      const responseEntry = responseMap.get(coopKey)!;
      responseEntry.total += 1;

      const deltaMin = diffMinutes(row.data_criacao, row.data_ultima_alteracao);
      if (deltaMin !== null) {
        responseEntry.responded += 1;
        responseEntry.tempoTotalMin += deltaMin;
        totalRespostaMin += deltaMin;
        countResposta += 1;
        if ((row.status || "").toLowerCase() === "concluido") {
          totalConclusaoMin += deltaMin;
          countConclusao += 1;
        }
      }
    }

    const creationSeries = Array.from(creationMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, values]) => ({
        date,
        total: values.total,
        concluidos: values.concluidos,
      }));

    const responseByCooperativa = Array.from(responseMap.values())
      .map((entry) => ({
        cooperativa_id: entry.cooperativa_id,
        cooperativa_nome: entry.cooperativa_id
          ? cooperativaNomeMap[entry.cooperativa_id] ?? null
          : null,
        total: entry.total,
        responded: entry.responded,
        tempo_medio_min: entry.responded ? entry.tempoTotalMin / entry.responded : null,
      }))
      .sort((a, b) => b.total - a.total);

    const performanceSummary = {
      totalPedidos: rows.length,
      mediaRespostaMin: countResposta ? totalRespostaMin / countResposta : null,
      mediaConclusaoMin: countConclusao ? totalConclusaoMin / countConclusao : null,
      concluido: statusBreakdown.concluido ?? 0,
      em_andamento: statusBreakdown.em_andamento ?? 0,
      novo: statusBreakdown.novo ?? 0,
      cancelado: statusBreakdown.cancelado ?? 0,
    };

    return c.json({
      range: { start: startIso, end: endIso },
      creationSeries,
      responseByCooperativa,
      statusBreakdown,
      nivelResumo,
      performanceSummary,
    });
  } catch (error) {
    console.error("Erro ao gerar relatório:", error);
    return c.json({ error: "Erro ao gerar relatório" }, 500);
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
        Deno.serve({ hostname: "0.0.0.0", port }, app.fetch);
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
