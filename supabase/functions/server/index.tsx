import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { cors, logger } from "https://deno.land/x/hono@v4.3.11/middleware.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { signJwt, verifyJwt } from "./lib/jwt.ts";
import { getDb } from "./lib/sqlite.ts";

const app = new Hono();

// Configurar CORS controlado por ambiente
// ALLOWED_ORIGINS pode ser uma lista separada por vírgula (ex.: "https://app.vercel.app,https://admin.vercel.app")
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const isOriginAllowed = (origin?: string | null): boolean => {
  if (!origin) return true; // permitir chamadas server-to-server e curl
  if (ALLOWED_ORIGINS.includes('*')) return true;
  // suporta curingas simples do tipo "*.dominio.com"
  for (const rule of ALLOWED_ORIGINS) {
    if (rule === origin) return true;
    if (rule.startsWith('*.') && origin.endsWith(rule.slice(1))) return true;
  }
  return false;
};

app.use('*', cors({
  origin: (origin) => (isOriginAllowed(origin) ? origin ?? '*' : ''),
  allowHeaders: ['Content-Type', 'Authorization', 'apikey', 'Accept', 'X-Requested-With'],
  allowMethods: ['POST', 'GET', 'PUT', 'DELETE', 'OPTIONS'],
  maxAge: 86400,
}));

app.use('*', logger(console.log));

 // Configurações gerais
const DB_SCHEMA = Deno.env.get('DB_SCHEMA') || 'public';
const TABLE_PREFIX = Deno.env.get('TABLE_PREFIX') || 'urede_';
const TBL = (name: string) => `${TABLE_PREFIX}${name}`;

// Auth / DB local
const AUTH_PROVIDER = 'local';
const JWT_SECRET = Deno.env.get('JWT_SECRET') || 'dev-secret-change-me';
const SQLITE_PATH_RAW = Deno.env.get('SQLITE_PATH') || './data/urede.db';
// Resolver caminho absoluto do DB relativo à raiz do projeto (três níveis acima deste arquivo)
let SQLITE_PATH = SQLITE_PATH_RAW;
try {
  if (!/^(?:\w+:)?\//.test(SQLITE_PATH_RAW)) {
    const root = new URL('../../../', import.meta.url);
    SQLITE_PATH = new URL(SQLITE_PATH_RAW.replace(/^\.\//, ''), root).pathname;
  }
} catch {}
const DB_DRIVER = (Deno.env.get('DB_DRIVER') || 'sqlite').toLowerCase(); // sqlite

// Modo inseguro para desenvolvimento local: quando true, pulamos checagens de autenticação e permissões.
// Defina INSECURE_MODE=true no arquivo supabase/functions/server/.env para habilitar.
const INSECURE_MODE = (Deno.env.get('INSECURE_MODE') || '').toLowerCase() === 'true';

// Operação 100% local (SQLite)

// Helpers de mapeamento para o formato esperado pelo frontend
const mapCooperativa = (row: any) => ({
  id_singular: row.id_singular ?? row.ID_SINGULAR,
  uniodonto: row.UNIODONTO ?? row.uniodonto ?? '',
  cnpj: row.CNPJ ?? row.cnpj ?? '',
  cro_operadora: row.CRO_OPERAORA ?? row.CRO_OPERADORA ?? row.cro_operadora ?? '',
  data_fundacao: row.DATA_FUNDACAO ?? row.data_fundacao ?? '',
  raz_social: row.RAZ_SOCIAL ?? row.raz_social ?? '',
  codigo_ans: row.CODIGO_ANS ?? row.codigo_ans ?? '',
  federacao: row.FEDERACAO ?? row.federacao ?? '',
  software: row.SOFTWARE ?? row.software ?? '',
  tipo: row.TIPO ?? row.tipo ?? '',
  op_pr: row.OP_PR ?? row.op_pr ?? '',
});

const mapCidade = (row: any) => ({
  cd_municipio_7: row.CD_MUNICIPIO_7 ?? row.cd_municipio_7,
  cd_municipio: row.CD_MUNICIPIO ?? row.cd_municipio,
  regional_saude: row.REGIONAL_SAUDE ?? row.regional_saude,
  nm_cidade: row.NM_CIDADE ?? row.nm_cidade,
  uf_municipio: row.UF_MUNICIPIO ?? row.uf_municipio,
  nm_regiao: row.NM_REGIAO ?? row.nm_regiao,
  cidades_habitantes: row.CIDADES_HABITANTES ?? row.cidades_habitantes,
  id_singular: row.ID_SINGULAR ?? row.id_singular,
});

const mapOperador = (row: any) => ({
  id: (row.id ?? '').toString(),
  nome: row.nome ?? '',
  email: row.email ?? '',
  telefone: row.telefone ?? '',
  whatsapp: row.whatsapp ?? '',
  cargo: row.cargo ?? '',
  id_singular: row.id_singular ?? '',
  ativo: (row.status ?? true) as boolean,
  data_cadastro: row.created_at ?? new Date().toISOString(),
});

const computeDiasRestantes = (prazoIso: string) => {
  const prazo = new Date(prazoIso);
  const agora = new Date();
  if (Number.isNaN(prazo.getTime())) return 0;

  const msPorDia = 24 * 60 * 60 * 1000;
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const inicioPrazo = new Date(prazo.getFullYear(), prazo.getMonth(), prazo.getDate());
  const diffTime = inicioPrazo.getTime() - inicioHoje.getTime();

  return Math.max(0, Math.floor(diffTime / msPorDia));
};

// Carrega nomes de cidade e cooperativa para um conjunto de pedidos
console.log(`[sqlite] abrindo banco em: ${SQLITE_PATH}`);
const db = getDb(SQLITE_PATH);

const ensurePedidoSchema = () => {
  const alters = [
    `ALTER TABLE ${TBL('pedidos')} ADD COLUMN responsavel_atual_id TEXT`,
    `ALTER TABLE ${TBL('pedidos')} ADD COLUMN responsavel_atual_nome TEXT`,
    `ALTER TABLE ${TBL('pedidos')} ADD COLUMN criado_por_user TEXT`,
    `ALTER TABLE ${TBL('pedidos')} ADD COLUMN data_conclusao TEXT`
  ];
  for (const stmt of alters) {
    try {
      db.query(stmt);
    } catch (e) {
      const message = (e && typeof e.message === 'string') ? e.message : String(e);
      if (!/duplicate column name/i.test(message)) {
        console.warn('[schema] alteração falhou:', message);
      }
    }
  }
};

ensurePedidoSchema();

const ensureAuditoriaSchema = () => {
  try {
    db.query(`ALTER TABLE ${TBL('auditoria_logs')} ADD COLUMN usuario_display_nome TEXT`);
  } catch (e) {
    const message = (e && typeof e.message === 'string') ? e.message : String(e);
    if (!/duplicate column name/i.test(message)) {
      console.warn('[schema] auditoria alter falhou:', message);
    }
  }
};

ensureAuditoriaSchema();

const enrichPedidos = async (pedidos: any[]) => {
  if (!pedidos || pedidos.length === 0) return [] as any[];

  const cityIds = Array.from(
    new Set(
      pedidos
        .map((p) => p.cidade_id)
        .filter((v) => typeof v === 'string' && v.trim().length > 0)
    )
  );
  const coopIds = Array.from(
    new Set(
      pedidos
        .flatMap((p) => [p.cooperativa_solicitante_id, p.cooperativa_responsavel_id])
        .filter((v) => typeof v === 'string' && v.trim().length > 0)
    )
  );

  let cidadesMap: Record<string, any> = {};
  let coopsMap: Record<string, any> = {};

  try {
    if (cityIds.length > 0) {
      const placeholders = cityIds.map(() => '?').join(',');
      const cidadesRows = db.queryEntries(`SELECT CD_MUNICIPIO_7, NM_CIDADE, UF_MUNICIPIO FROM ${TBL('cidades')} WHERE CD_MUNICIPIO_7 IN (${placeholders})`, cityIds as any);
      for (const r of cidadesRows || []) {
        const c = mapCidade(r);
        cidadesMap[c.cd_municipio_7] = c;
      }
    }
  } catch (e) {
    console.warn('[enrichPedidos] cidades lookup falhou:', e);
  }

  try {
    if (coopIds.length > 0) {
      const placeholders = coopIds.map(() => '?').join(',');
      const coopRows = db.queryEntries(`SELECT id_singular, UNIODONTO, FEDERACAO FROM ${TBL('cooperativas')} WHERE id_singular IN (${placeholders})`, coopIds as any);
      for (const r of coopRows || []) {
        const c = mapCooperativa(r);
        coopsMap[c.id_singular] = c;
      }
    }
  } catch (e) {
    console.warn('[enrichPedidos] cooperativas lookup falhou:', e);
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
    c.set('user', { id: 'insecure', email: 'insecure@local', claims: {} });
    return await next();
  }

  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : undefined;
  if (!token) return c.json({ error: 'Token de acesso não fornecido' }, 401);

  if (AUTH_PROVIDER === 'local') {
    try {
      const payload = await verifyJwt(JWT_SECRET, token);
      c.set('user', { id: payload.sub, email: payload.email, claims: payload });
      return await next();
    } catch {
      return c.json({ error: 'Token inválido ou expirado' }, 401);
    }
  }

  // Nenhum fallback extra: apenas JWT local
  return c.json({ error: 'Token inválido ou expirado' }, 401);
};

// Função para obter dados do usuário somente via SQL
const getUserData = async (userId: string, userEmail?: string | null) => {
  // Se INSECURE_MODE estiver ativo, retornar usuário com papel 'confederacao'
  // para permitir criar/editar/excluir localmente sem checagens de RBAC.
  if (INSECURE_MODE) {
    return {
      id: 'insecure',
      nome: 'Insecure',
      display_name: 'Insecure',
      email: 'insecure@local',
      telefone: '',
      whatsapp: '',
      cargo: '',
      cooperativa_id: '',
      papel: 'confederacao',
      ativo: true,
      data_cadastro: new Date().toISOString(),
    } as any;
  }

  try {
    // Se provider local, primeiro tentar em auth_users (SQLite)
    if (AUTH_PROVIDER === 'local') {
      try {
        const db = getDb(SQLITE_PATH);
        if (userEmail) {
          const row = db.queryEntries<{
            email: string; nome: string; display_name: string | null; telefone: string | null; whatsapp: string | null;
            cargo: string | null; cooperativa_id: string | null; papel: string | null; ativo: number | null; data_cadastro: string | null;
          }>(`SELECT email, nome, COALESCE(display_name, nome) as display_name, telefone, whatsapp, cargo, cooperativa_id, papel, COALESCE(ativo,1) as ativo, COALESCE(data_cadastro, CURRENT_TIMESTAMP) as data_cadastro FROM auth_users WHERE email = ?`, [userEmail])[0];
          if (row) {
            return {
              id: userEmail,
              nome: row.nome || 'Usuário',
              display_name: row.display_name || 'Usuário',
              email: userEmail,
              telefone: row.telefone || '',
              whatsapp: row.whatsapp || '',
              cargo: row.cargo || '',
              cooperativa_id: row.cooperativa_id || '',
              papel: (row.papel as any) || 'operador',
              ativo: !!row.ativo,
              data_cadastro: row.data_cadastro,
            } as any;
          }
        }
      } catch (e) {
        console.warn('[getUserData] sqlite auth_users lookup falhou:', e);
      }
    }

    // Tentar por email em operadores (SQLite)
    if (userEmail) {
      const byEmail = db.queryEntries(`SELECT * FROM ${TBL('operadores')} WHERE email = ? LIMIT 1`, [userEmail])[0];
      if (byEmail) {
        const o = mapOperador(byEmail);
        return { ...o, cooperativa_id: o.id_singular, papel: 'operador' } as any;
      }
    }

    // Fallback básico
    return {
      id: userId,
      nome: 'Usuário',
      display_name: 'Usuário',
      email: userEmail || '',
      telefone: '',
      whatsapp: '',
      cargo: '',
      cooperativa_id: '',
      papel: 'operador',
      ativo: true,
      data_cadastro: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Erro ao obter dados do usuário:', error);
    return null;
  }
};

// Middleware para verificar permissões RBAC
const requireRole = (roles: string[]) => {
  return async (c: any, next: any) => {
    const user = c.get('user');
    const userData = await getUserData(user.id, user.email);
    
    if (!roles.includes(userData.papel)) {
      return c.json({ error: 'Acesso negado' }, 403);
    }
    
    c.set('userData', userData);
    await next();
  };
};

// Inicialização desativada (dados reais via SQL)
const initializeData = async () => {};

// Função para escalonar pedidos automaticamente
const escalarPedidos = async () => {
  try {
    const agoraIso = new Date().toISOString();
    const pedidos = db.queryEntries<any>(`SELECT * FROM ${TBL('pedidos')} WHERE status = 'em_andamento' AND prazo_atual < ?`, [agoraIso]);
    if (!pedidos || pedidos.length === 0) return;

    for (const pedido of pedidos as any[]) {
      let novoNivel = pedido.nivel_atual as 'singular' | 'federacao' | 'confederacao';
      let novaCooperativaResponsavel: string | null = pedido.cooperativa_responsavel_id || null;

      if (pedido.nivel_atual === 'singular') {
        // Buscar federação da cooperativa solicitante
        const coopSolic = db.queryEntries<any>(`SELECT FEDERACAO FROM ${TBL('cooperativas')} WHERE id_singular = ? LIMIT 1`, [pedido.cooperativa_solicitante_id])[0];
        const federacaoNome = coopSolic?.FEDERACAO;
        if (federacaoNome) {
          const fed = db.queryEntries<any>(`SELECT id_singular FROM ${TBL('cooperativas')} WHERE TIPO = 'FEDERAÇÃO' AND FEDERACAO = ? LIMIT 1`, [federacaoNome])[0];
          if (fed) {
            novoNivel = 'federacao';
            novaCooperativaResponsavel = fed.id_singular as string;
          }
        }
      } else if (pedido.nivel_atual === 'federacao') {
        const conf = db.queryEntries<any>(`SELECT id_singular FROM ${TBL('cooperativas')} WHERE TIPO = 'CONFEDERACAO' LIMIT 1`)[0];
        if (conf) {
          novoNivel = 'confederacao';
          novaCooperativaResponsavel = conf.id_singular as string;
        }
      }

      if (novoNivel !== pedido.nivel_atual && novaCooperativaResponsavel) {
        const novoPrazo = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const agora = new Date().toISOString();

        try {
          db.query(
            `UPDATE ${TBL('pedidos')} SET nivel_atual = ?, cooperativa_responsavel_id = ?, prazo_atual = ?, data_ultima_alteracao = ? WHERE id = ?`,
            [novoNivel, novaCooperativaResponsavel, novoPrazo, agora, pedido.id]
          );
        } catch (e) {
          console.error('Erro ao atualizar pedido no escalonamento:', e);
          continue;
        }

        // Registrar auditoria com autor como criador do pedido para evitar FK inválida
        try {
          const id = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          db.query(`INSERT INTO ${TBL('auditoria_logs')} (id, pedido_id, usuario_id, usuario_nome, usuario_display_nome, acao, timestamp, detalhes) VALUES (?,?,?,?,?,?,?,?)`,
            [id, pedido.id, pedido.criado_por, 'Sistema Automático', 'Sistema Automático', `Escalamento automático para ${novoNivel}`, agora, `Pedido escalado automaticamente por vencimento de prazo. Novo prazo: ${novoPrazo}`]
          );
        } catch (e) {
          console.error('Erro ao registrar auditoria de escalonamento:', e);
        }
      }
    }
  } catch (error) {
    console.error('Erro ao escalar pedidos:', error);
  }
};

// ROTAS DA API

// Rota de autenticação - Cadastro (JWT local)
app.post('/auth/register', async (c) => {
  try {
    const { email, password, nome, display_name, telefone, whatsapp, cargo, cooperativa_id, papel } = await c.req.json();

    if (AUTH_PROVIDER !== 'local') return c.json({ error: 'Cadastro local desabilitado' }, 400);
    if (!email || !password) return c.json({ error: 'Email e senha são obrigatórios' }, 400);

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

    const already = db.queryEntries<{email: string}>(`SELECT email FROM auth_users WHERE email = ?`, [email])[0];
    if (already) return c.json({ error: 'Email já registrado' }, 400);

    // Verificar se há Authorization: se sim, aplicar regras de criação por papéis
    let requester: any = null;
    const authHeader = c.req.header('Authorization');
    const authzToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
    if (authzToken) {
      try {
        const payload = await verifyJwt(JWT_SECRET, authzToken);
        requester = await getUserData(payload.sub as string, payload.email as string);
      } catch {}
    }

    // Regras:
    // - Sem Authorization (auto-registro): força papel 'operador' e exige cooperativa_id
    // - Com Authorization:
    //   * confederacao: pode criar para qualquer cooperativa, qualquer papel
    //   * federacao: pode criar para sua federação e singulares da sua federação
    //   * admin (singular): pode criar apenas para sua cooperativa
    let finalPapel = (papel as any) || 'operador';
    let finalCoop = cooperativa_id || '';

    if (!requester) {
      // Auto-registro público
      finalPapel = 'operador';
      if (!finalCoop) return c.json({ error: 'cooperativa_id é obrigatório' }, 400);
    } else {
      if (requester.papel === 'confederacao') {
        // Sem restrições
      } else if (requester.papel === 'federacao') {
        // Verificar se destino pertence à sua federação ou é a própria federação
        if (!finalCoop) return c.json({ error: 'cooperativa_id é obrigatório' }, 400);
        try {
          const dest = db.queryEntries<any>(`SELECT id_singular, FEDERACAO FROM ${TBL('cooperativas')} WHERE id_singular = ? LIMIT 1`, [finalCoop])[0];
          const reqCoop = db.queryEntries<any>(`SELECT id_singular, UNIODONTO, FEDERACAO, TIPO FROM ${TBL('cooperativas')} WHERE id_singular = ? LIMIT 1`, [requester.cooperativa_id])[0];
          const sameFed = dest && reqCoop && (dest.FEDERACAO === reqCoop.UNIODONTO || dest.FEDERACAO === reqCoop.FEDERACAO);
          const isSelf = dest && reqCoop && dest.id_singular === reqCoop.id_singular;
          if (!sameFed && !isSelf) return c.json({ error: 'Sem permissão para criar usuário nesta cooperativa' }, 403);
        } catch {
          return c.json({ error: 'Falha ao validar federação' }, 400);
        }
      } else if (requester.papel === 'admin') {
        if (!finalCoop || finalCoop !== requester.cooperativa_id) {
          return c.json({ error: 'Admin de singular só cria usuários da sua operadora' }, 403);
        }
      } else if (requester.papel === 'operador') {
        return c.json({ error: 'Operador não pode criar usuários' }, 403);
      }
    }

    const hash = await bcrypt.hash(password);
    db.query(`INSERT INTO auth_users (email, password_hash, nome, display_name, telefone, whatsapp, cargo, cooperativa_id, papel, ativo) VALUES (?,?,?,?,?,?,?,?,?,1)`, [
      email, hash, nome || '', display_name || nome || '', telefone || '', whatsapp || '', cargo || '', finalCoop, finalPapel
    ]);

    // Emitir token após cadastro
    const token = await signJwt(JWT_SECRET, { sub: email, email, nome: nome || '', cooperativa_id: cooperativa_id || '', papel: papel || 'operador' });
    return c.json({
      message: 'Usuário criado com sucesso',
      token,
      user: {
        id: email,
        nome: nome || '',
        display_name: display_name || nome || '',
        email,
        telefone: telefone || '',
        whatsapp: whatsapp || '',
        cargo: cargo || '',
        cooperativa_id: cooperativa_id || '',
        papel: (papel || 'operador'),
        ativo: true,
        data_cadastro: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Erro no cadastro:', error);
    return c.json({ error: 'Erro interno do servidor' }, 500);
  }
});

// Rota de autenticação - Login (JWT local)
app.post('/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json();
    if (AUTH_PROVIDER !== 'local') return c.json({ error: 'Login local desabilitado' }, 400);
    if (!email || !password) return c.json({ error: 'Email e senha são obrigatórios' }, 400);

    const db = getDb(SQLITE_PATH);
    const row = db.queryEntries<{ email: string; password_hash: string; nome: string | null; display_name: string | null; cooperativa_id: string | null; papel: string | null }>(
      `SELECT email, password_hash, nome, display_name, cooperativa_id, papel FROM auth_users WHERE email = ?`,
      [email]
    )[0];
    if (!row) return c.json({ error: 'Credenciais inválidas' }, 401);
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return c.json({ error: 'Credenciais inválidas' }, 401);

    const token = await signJwt(JWT_SECRET, {
      sub: email,
      email,
      nome: row.nome || undefined,
      cooperativa_id: row.cooperativa_id || undefined,
      papel: (row.papel as any) || 'operador'
    });

    return c.json({ token });
  } catch (error) {
    console.error('Erro no login:', error);
    return c.json({ error: 'Erro interno do servidor' }, 500);
  }
});

// Rota para obter dados do usuário autenticado
app.get('/auth/me', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userData = await getUserData(user.id, user.email || user?.claims?.email);
    
    return c.json({ user: userData });
  } catch (error) {
    console.error('Erro ao obter dados do usuário:', error);
    return c.json({ error: 'Erro ao obter dados do usuário' }, 500);
  }
});

// ROTA PÚBLICA PARA COOPERATIVAS (para registro)
app.get('/cooperativas/public', async (c) => {
  try {
    const rows = db.queryEntries(`SELECT * FROM ${TBL('cooperativas')}`);
    const mapped = (rows || []).map(mapCooperativa);
    return c.json(mapped);
  } catch (error) {
    console.error('Erro ao buscar cooperativas públicas:', error);
    return c.json({ error: 'Erro ao buscar cooperativas' }, 500);
  }
});

// ROTAS DE COOPERATIVAS
app.get('/cooperativas', requireAuth, async (c) => {
  try {
    const rows = db.queryEntries(`SELECT * FROM ${TBL('cooperativas')}`);
    const mapped = (rows || []).map(mapCooperativa);
    return c.json(mapped);
  } catch (error) {
    console.error('Erro ao buscar cooperativas:', error);
    return c.json({ error: 'Erro ao buscar cooperativas' }, 500);
  }
});

// ROTAS DE CIDADES
app.get('/cidades', requireAuth, async (c) => {
  try {
    const rows = db.queryEntries(`SELECT * FROM ${TBL('cidades')}`);
    const mapped = (rows || []).map(mapCidade);
    return c.json(mapped);
  } catch (error) {
    console.error('Erro ao buscar cidades:', error);
    return c.json({ error: 'Erro ao buscar cidades' }, 500);
  }
});

// ROTA PÚBLICA DE CIDADES (apenas leitura)
app.get('/cidades/public', async (c) => {
  try {
    const rows = db.queryEntries(`SELECT * FROM ${TBL('cidades')}`);
    const mapped = (rows || []).map(mapCidade);
    return c.json(mapped);
  } catch (error) {
    console.error('Erro ao buscar cidades públicas:', error);
    return c.json({ error: 'Erro ao buscar cidades' }, 500);
  }
});

// ROTAS DE OPERADORES
app.get('/operadores', requireAuth, async (c) => {
  try {
    const rows = db.queryEntries(`SELECT * FROM ${TBL('operadores')}`);
    const mapped = (rows || []).map(mapOperador);
    return c.json(mapped);
  } catch (error) {
    console.error('Erro ao buscar operadores:', error);
    return c.json({ error: 'Erro ao buscar operadores' }, 500);
  }
});

// ROTA PÚBLICA DE OPERADORES (campos restritos, sem contatos)
app.get('/operadores/public', async (c) => {
  try {
    const rows = db.queryEntries(`SELECT id, nome, cargo, id_singular, status, created_at FROM ${TBL('operadores')}`);
    const mapped = (rows || []).map(mapOperador).map(o => ({
      id: o.id,
      nome: o.nome,
      cargo: o.cargo,
      id_singular: o.id_singular,
      ativo: o.ativo,
      data_cadastro: o.data_cadastro,
    }));
    return c.json(mapped);
  } catch (error) {
    console.error('Erro ao buscar operadores públicos:', error);
    return c.json({ error: 'Erro ao buscar operadores' }, 500);
  }
});

// ROTA DE DEBUG: contagem de registros por tabela
app.get('/debug/counts', async (c) => {
  try {
    const tables = ['cooperativas', 'cidades', 'operadores', 'pedidos'];
    const result: Record<string, number | null> = {};
    for (const t of tables) {
      const row = db.queryEntries<{ c: number }>(`SELECT COUNT(*) AS c FROM ${TBL(t)}`)[0];
      result[TBL(t)] = row?.c ?? 0;
    }
    return c.json({ tables: result, prefix: TABLE_PREFIX, schema: DB_SCHEMA });
  } catch (e) {
    console.error('Erro em /debug/counts:', e);
    return c.json({ error: 'Erro ao obter contagens' }, 500);
  }
});

// ROTA PÚBLICA DE PEDIDOS (opcional via env PUBLIC_PEDIDOS=true)
app.get('/pedidos/public', async (c) => {
  const enabledEnv = (Deno.env.get('PUBLIC_PEDIDOS') || '').toLowerCase();
  const enabled = enabledEnv === 'true' || enabledEnv === '';
  if (!enabled) {
    return c.json({ error: 'Endpoint desabilitado' }, 403);
  }
  try {
    const rows = db.queryEntries<any>(
      `SELECT id, titulo, cidade_id, prioridade, status, nivel_atual, prazo_atual, cooperativa_solicitante_id FROM ${TBL('pedidos')}`
    );
    const base = (rows || []).map((p: any) => ({
      id: p.id,
      titulo: p.titulo,
      cidade_id: p.cidade_id,
      prioridade: p.prioridade,
      status: p.status,
      nivel_atual: p.nivel_atual,
      prazo_atual: p.prazo_atual,
      dias_restantes: computeDiasRestantes(p.prazo_atual),
      cooperativa_solicitante_id: p.cooperativa_solicitante_id,
    }));
    const enriched = await enrichPedidos(base);
    const sanitized = enriched.map(({ cooperativa_solicitante_id, ...rest }) => rest);
    return c.json(sanitized);
  } catch (error) {
    console.error('Erro ao buscar pedidos públicos:', error);
    return c.json({ error: 'Erro ao buscar pedidos' }, 500);
  }
});

// ROTAS DE PEDIDOS
app.get('/pedidos', requireAuth, async (c) => {
  try {
    const authUser = c.get('user');
    const userData = await getUserData(authUser.id, authUser.email);
    
    const pedidosRows = db.queryEntries<any>(`SELECT * FROM ${TBL('pedidos')}`);
    const pedidosData = (pedidosRows || []).map((r) => ({
      ...r,
      especialidades: Array.isArray(r.especialidades)
        ? r.especialidades
        : (() => { try { return JSON.parse(r.especialidades || '[]'); } catch { return []; } })(),
    }));

    // Preparar mapas de cooperativas para federacao e nomes
    const coopIds = Array.from(new Set((pedidosData || []).flatMap(p => [p.cooperativa_solicitante_id, p.cooperativa_responsavel_id]).filter(Boolean)));
    const coops = coopIds.length
      ? db.queryEntries<any>(`SELECT id_singular, UNIODONTO, FEDERACAO FROM ${TBL('cooperativas')} WHERE id_singular IN (${coopIds.map(()=>'?').join(',')})`, coopIds as any)
      : [];
    const coopsMap: Record<string, any> = {};
    for (const r of coops) {
      const c = mapCooperativa(r);
      coopsMap[c.id_singular] = c;
    }
    const userFed = (userData?.cooperativa_id
      ? (coopsMap[userData.cooperativa_id]?.federacao || db.queryEntries<any>(`SELECT FEDERACAO FROM ${TBL('cooperativas')} WHERE id_singular = ? LIMIT 1`, [userData.cooperativa_id])[0]?.FEDERACAO)
      : null) as string | null;

    // Aplicar filtros baseados no papel do usuário (regras de negócio)
    const pedidosFiltrados = (pedidosData || []).filter(p => {
      if (userData.papel === 'admin' || userData.papel === 'confederacao') return true;
    if (userData.papel === 'operador') {
        return p.cooperativa_solicitante_id === userData.cooperativa_id || p.cooperativa_responsavel_id === userData.cooperativa_id || p.criado_por_user === userData.email;
      }
      if (userData.papel === 'federacao') {
        const fedSolic = coopsMap[p.cooperativa_solicitante_id]?.federacao;
        const fedResp = coopsMap[p.cooperativa_responsavel_id]?.federacao;
        return !!userFed && (fedSolic === userFed || fedResp === userFed);
      }
      return false;
    });

    // Calcular dias restantes para cada pedido
    const pedidosComDias = pedidosFiltrados.map(p => ({
      ...p,
      dias_restantes: computeDiasRestantes(p.prazo_atual),
    }));

    const enriquecidosBase = await enrichPedidos(pedidosComDias);
    // Computar ponto_de_vista para o viewer
    const viewerCoop = userData?.cooperativa_id || null;
    const enriquecidos = enriquecidosBase.map((p: any) => {
      let ponto: 'feita' | 'recebida' | 'acompanhamento' | 'interna' = 'acompanhamento';
      if (viewerCoop) {
        const isSolic = p.cooperativa_solicitante_id === viewerCoop;
        const isResp = p.cooperativa_responsavel_id === viewerCoop;
        if (isSolic && isResp) ponto = 'interna';
        else if (isSolic) ponto = 'feita';
        else if (isResp) ponto = 'recebida';
        else ponto = 'acompanhamento';
      }
      return { ...p, ponto_de_vista: ponto };
    });
    return c.json(enriquecidos);
  } catch (error) {
    console.error('Erro ao buscar pedidos:', error);
    return c.json({ error: 'Erro ao buscar pedidos' }, 500);
  }
});

app.post('/pedidos', requireAuth, async (c) => {
  try {
    const authUser = c.get('user');
    const userData = await getUserData(authUser.id, authUser.email);
    const pedidoData = await c.req.json();
    
    // Permissão para criar: operador/admin da solicitante, ou confederação (mestre).
    if (!(userData.papel === 'operador' || userData.papel === 'admin' || userData.papel === 'confederacao')) {
      return c.json({ error: 'Sem permissão para criar pedidos' }, 403);
    }
    
    const id = `ped_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const novoPedido = {
      id,
      titulo: pedidoData.titulo,
      // Em SQLite, criado_por referencia urede_operadores(id). Mantemos NULL (auth local)
      criado_por: null as any,
      criado_por_user: (authUser?.email || null) as any,
      cooperativa_solicitante_id: userData.cooperativa_id,
      cidade_id: pedidoData.cidade_id,
      especialidades: Array.isArray(pedidoData.especialidades) ? JSON.stringify(pedidoData.especialidades) : (pedidoData.especialidades || '[]'),
      quantidade: pedidoData.quantidade,
      observacoes: pedidoData.observacoes,
      nivel_atual: 'singular',
      prazo_atual: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 dias
      status: 'novo',
      data_criacao: new Date().toISOString(),
      data_ultima_alteracao: new Date().toISOString(),
      cooperativa_responsavel_id: undefined as any, // será resolvido pela cidade
      prioridade: pedidoData.prioridade || 'media'
    };

    // Resolver cooperativa responsável pela cidade
    try {
      const row = db.queryEntries<any>(`SELECT ID_SINGULAR FROM ${TBL('cidades')} WHERE CD_MUNICIPIO_7 = ? LIMIT 1`, [novoPedido.cidade_id])[0];
      console.log('[POST /pedidos] recebido cidade_id =', novoPedido.cidade_id, 'lookup row =', row);
      if (!row || !row.ID_SINGULAR) {
        console.warn('[POST /pedidos] cidade não encontrada ou sem ID_SINGULAR:', novoPedido.cidade_id);
        return c.json({ error: 'Cidade não cadastrada ou sem cooperativa responsável' }, 400);
      }
      novoPedido.cooperativa_responsavel_id = row.ID_SINGULAR as string;
    } catch (e) {
      console.error('Erro ao resolver cooperativa responsável:', e);
      return c.json({ error: 'Erro ao determinar cooperativa responsável' }, 500);
    }

    try {
      db.query(
        `INSERT INTO ${TBL('pedidos')} 
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
        ]
      );
    } catch (e) {
      console.error('Erro ao inserir pedido na tabela:', e);
      return c.json({ error: 'Erro ao criar pedido' }, 500);
    }

    // Registrar auditoria
    const auditoria = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      pedido_id: novoPedido.id,
      usuario_id: userData.id,
      usuario_nome: userData.nome,
      usuario_display_nome: userData.display_name || userData.nome,
      acao: 'Criação do pedido',
      timestamp: new Date().toISOString(),
      detalhes: `Pedido criado: ${pedidoData.titulo}`
    };

    try {
      db.query(
        `INSERT INTO ${TBL('auditoria_logs')} (id, pedido_id, usuario_id, usuario_nome, usuario_display_nome, acao, timestamp, detalhes)
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
        ]
      );
    } catch (e) {
      console.warn('Erro ao salvar auditoria:', e);
    }

    {
      const base = [{
        ...novoPedido,
        especialidades: Array.isArray(pedidoData.especialidades)
          ? pedidoData.especialidades
          : (() => { try { return JSON.parse(novoPedido.especialidades || '[]'); } catch { return []; } })(),
        dias_restantes: computeDiasRestantes(novoPedido.prazo_atual),
      }];
      const [enriched] = await enrichPedidos(base);
      return c.json(enriched || base[0]);
    }
  } catch (error) {
    console.error('Erro ao criar pedido:', error);
    return c.json({ error: 'Erro ao criar pedido' }, 500);
  }
});

// Atualizar pedido
app.put('/pedidos/:id', requireAuth, async (c) => {
  try {
    const pedidoId = c.req.param('id');
    const authUser = c.get('user');
    const userData = await getUserData(authUser.id, authUser.email);
    const updateData = await c.req.json();
    const comentarioAtual = typeof updateData.comentario_atual === 'string'
      ? updateData.comentario_atual.trim()
      : '';
    delete updateData.comentario_atual;

    const pedido = db.queryEntries<any>(`SELECT * FROM ${TBL('pedidos')} WHERE id = ? LIMIT 1`, [pedidoId])[0];
    if (!pedido) {
      return c.json({ error: 'Pedido não encontrado' }, 404);
    }
    
    // Verificar permissões conforme regras
    let podeEditar = false;
    if (userData.papel === 'confederacao') {
      podeEditar = true;
    } else if (userData.papel === 'admin' && pedido.cooperativa_solicitante_id === userData.cooperativa_id) {
      // Admin da solicitante pode editar tudo
      podeEditar = true;
    } else if (pedido.cooperativa_responsavel_id === userData.cooperativa_id) {
      // Usuários da responsável podem editar parcialmente
      podeEditar = true;
    } else if (userData.papel === 'operador' && pedido.criado_por_user === userData.email) {
      // Operador que criou pode editar tudo
      podeEditar = true;
    }
    
    if (!podeEditar) {
      return c.json({ error: 'Acesso negado para editar este pedido' }, 403);
    }

    // Sanitizar update com base no perfil
    const allowed: Record<string, any> = {};
    const whitelistAdminSolic = [
      'titulo', 'cooperativa_responsavel_id', 'cidade_id', 'especialidades', 'quantidade',
      'observacoes', 'prioridade', 'nivel_atual', 'status', 'prazo_atual',
    ];
    const whitelistResponsavel = [
      'status', 'observacoes', 'prioridade', 'responsavel_atual_id', 'responsavel_atual_nome', 'prazo_atual'
    ];

    const effectiveWhitelist = (userData.papel === 'confederacao' || (userData.papel === 'admin' && pedido.cooperativa_solicitante_id === userData.cooperativa_id) || (userData.papel === 'operador' && pedido.criado_por_user === userData.email))
      ? whitelistAdminSolic
      : whitelistResponsavel;

    for (const k of effectiveWhitelist) if (k in updateData) allowed[k] = updateData[k];
    allowed.data_ultima_alteracao = new Date().toISOString();

    try {
      // Normalizar campos especiais
      if (Array.isArray(allowed.especialidades)) {
        allowed.especialidades = JSON.stringify(allowed.especialidades);
      }
      const cols = Object.keys(allowed);
      const placeholders = cols.map((c) => `${c} = ?`).join(', ');
      const values = cols.map((c) => (allowed as any)[c]);
      db.query(`UPDATE ${TBL('pedidos')} SET ${placeholders} WHERE id = ?`, [...values, pedidoId]);
    } catch (e) {
      console.error('Erro ao atualizar pedido:', e);
      return c.json({ error: 'Erro ao atualizar pedido' }, 500);
    }

    // Registrar auditoria
    const camposAlterados = Object.keys(allowed).filter((k) => k !== 'data_ultima_alteracao');
    const detalhesPartes: string[] = [];

    const toHumanLabel = (key: string) => {
      switch (key) {
        case 'status':
          return `Status: ${String(allowed.status || '').replace(/_/g, ' ')}`;
        case 'prioridade':
          return `Prioridade: ${allowed.prioridade}`;
        case 'nivel_atual':
          return `Nível atual: ${allowed.nivel_atual}`;
        case 'cooperativa_responsavel_id':
          return `Cooperativa responsável: ${allowed.cooperativa_responsavel_id}`;
        case 'responsavel_atual_nome':
          return 'responsavel_atual_nome';
        case 'observacoes':
          return comentarioAtual ? '' : 'Observações atualizadas';
        case 'responsavel_atual_id':
          return '';
        default:
          return '';
      }
    };

    for (const key of camposAlterados) {
      const label = toHumanLabel(key);
      if (label && label !== 'responsavel_atual_nome') {
        detalhesPartes.push(label);
      }
    }

    if ('responsavel_atual_nome' in allowed) {
      let responsavelLabel = 'Responsável liberado';
      if (allowed.responsavel_atual_nome) {
        let coopNome = '';
        if (userData.cooperativa_id) {
          try {
            const coopRow = db.queryEntries<any>(`SELECT UNIODONTO FROM ${TBL('cooperativas')} WHERE id_singular = ? LIMIT 1`, [userData.cooperativa_id])[0];
            coopNome = coopRow?.UNIODONTO || '';
          } catch (e) {
            console.warn('[auditoria] falha ao buscar nome da cooperativa do responsável:', e);
          }
        }
        responsavelLabel = `Responsável atual: ${allowed.responsavel_atual_nome}${coopNome ? `, ${coopNome}` : ''}`;
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
      acao: 'Atualização do pedido',
      timestamp: new Date().toISOString(),
      detalhes: detalhesPartes.join(' | ') || null
    };

    try {
      db.query(
        `INSERT INTO ${TBL('auditoria_logs')} (id, pedido_id, usuario_id, usuario_nome, usuario_display_nome, acao, timestamp, detalhes)
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
        ]
      );
    } catch (e) {
      console.warn('Auditoria não registrada (tabela ausente?):', e);
    }

  let dataConclusao = pedido.data_conclusao as string | null | undefined;

  const statusOriginal = pedido.status as Pedido['status'];
  const statusAtualizado = (allowed.status ?? pedido.status) as Pedido['status'];

  if (statusOriginal !== 'concluido' && statusAtualizado === 'concluido') {
    dataConclusao = new Date().toISOString();
    allowed.data_conclusao = dataConclusao;
  } else if (statusOriginal === 'concluido' && statusAtualizado !== 'concluido') {
    dataConclusao = null;
    allowed.data_conclusao = null;
  }

  const updated = { ...pedido, ...allowed, data_conclusao: dataConclusao } as any;
    // Normalizar especialidades no retorno
    updated.especialidades = Array.isArray(updated.especialidades)
      ? updated.especialidades
      : (() => { try { return JSON.parse(updated.especialidades || '[]'); } catch { return []; } })();
    {
      const base = [{
        ...updated,
        dias_restantes: computeDiasRestantes(updated.prazo_atual),
      }];
      const [enriched] = await enrichPedidos(base);
      const result = enriched || base[0];
      if (result && dataConclusao) {
        result.data_conclusao = dataConclusao;
        const dataInicio = result.data_criacao ? new Date(result.data_criacao) : null;
        const dataFinal = new Date(dataConclusao);
        if (dataInicio && !Number.isNaN(dataInicio.getTime())) {
          const diff = dataFinal.getTime() - dataInicio.getTime();
          (result as any).dias_para_concluir = Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
        }
      }
      return c.json(result);
    }
  } catch (error) {
    console.error('Erro ao atualizar pedido:', error);
    return c.json({ error: 'Erro ao atualizar pedido' }, 500);
  }
});

// Excluir pedido
app.delete('/pedidos/:id', requireAuth, async (c) => {
  try {
    const pedidoId = c.req.param('id');
    const authUser = c.get('user');
    const userData = await getUserData(authUser.id, authUser.email);
    const pedido = db.queryEntries<any>(`SELECT id, cooperativa_solicitante_id FROM ${TBL('pedidos')} WHERE id = ? LIMIT 1`, [pedidoId])[0];
    if (!pedido) return c.json({ error: 'Pedido não encontrado' }, 404);

    // Tentar obter quem criou o pedido; em instalações antigas a coluna `criado_por_user`
    // pode não existir — executar em try/catch para compatibilidade.
    let createdBy: any = {};
    try {
      createdBy = db.queryEntries<any>(`SELECT criado_por_user, cooperativa_solicitante_id FROM ${TBL('pedidos')} WHERE id = ?`, [pedidoId])[0] || {};
    } catch (e) {
      console.warn('[deletePedido] coluna criado_por_user ausente ou query falhou, fallback:', e);
      try {
        createdBy = db.queryEntries<any>(`SELECT cooperativa_solicitante_id FROM ${TBL('pedidos')} WHERE id = ?`, [pedidoId])[0] || {};
      } catch (e2) {
        console.warn('[deletePedido] fallback também falhou:', e2);
        createdBy = {};
      }
    }

    const podeApagar = userData.papel === 'confederacao' ||
      (userData.papel === 'admin' && pedido.cooperativa_solicitante_id === userData.cooperativa_id) ||
      (userData.papel === 'operador' && (createdBy?.criado_por_user === userData.email || (!createdBy?.criado_por_user && createdBy?.cooperativa_solicitante_id === userData.cooperativa_id)));
    if (!podeApagar) return c.json({ error: 'Acesso negado para apagar este pedido' }, 403);

    try {
      db.query(`DELETE FROM ${TBL('auditoria_logs')} WHERE pedido_id = ?`, [pedidoId]);
      db.query(`DELETE FROM ${TBL('pedidos')} WHERE id = ?`, [pedidoId]);
    } catch (e) {
      console.error('Erro ao excluir pedido:', e);
      return c.json({ error: 'Erro ao excluir pedido' }, 500);
    }
    return c.json({ ok: true });
  } catch (error) {
    console.error('Erro no delete de pedido:', error);
    return c.json({ error: 'Erro ao excluir pedido' }, 500);
  }
});

// Buscar auditoria de um pedido
app.get('/pedidos/:id/auditoria', requireAuth, async (c) => {
  try {
    const pedidoId = c.req.param('id');
    const data = db.queryEntries<any>(
      `SELECT * FROM ${TBL('auditoria_logs')} WHERE pedido_id = ? ORDER BY timestamp DESC`,
      [pedidoId]
    );
    return c.json(data || []);
  } catch (error) {
    console.error('Erro ao buscar auditoria do pedido:', error);
    return c.json({ error: 'Erro ao buscar auditoria do pedido' }, 500);
  }
});

// Dashboard - Estatísticas
app.get('/dashboard/stats', requireAuth, async (c) => {
  try {
    const authUser = c.get('user');
    const userData = await getUserData(authUser.id, authUser.email);
    
    const pedidosData = db.queryEntries<any>(`SELECT * FROM ${TBL('pedidos')}`);

    // Preparar mapa de federações por cooperativa
    const coopIds = Array.from(new Set((pedidosData || []).flatMap(p => [p.cooperativa_solicitante_id, p.cooperativa_responsavel_id]).filter(Boolean)));
    const coops = coopIds.length
      ? db.queryEntries<any>(`SELECT id_singular, FEDERACAO FROM ${TBL('cooperativas')} WHERE id_singular IN (${coopIds.map(()=>'?').join(',')})`, coopIds as any)
      : [];
    const coopsFed: Record<string, string | null> = {};
    for (const r of coops) {
      coopsFed[r.id_singular] = r.FEDERACAO || null;
    }
    const userFed = userData?.cooperativa_id
      ? (coopsFed[userData.cooperativa_id] || db.queryEntries<any>(`SELECT FEDERACAO FROM ${TBL('cooperativas')} WHERE id_singular = ? LIMIT 1`, [userData.cooperativa_id])[0]?.FEDERACAO || null)
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
      if (userData.papel === 'admin' || userData.papel === 'confederacao') {
        podeVer = true;
      } else if (userData.papel === 'operador') {
        podeVer = pedidoData.cooperativa_solicitante_id === userData.cooperativa_id ||
                  pedidoData.cooperativa_responsavel_id === userData.cooperativa_id;
      } else if (userData.papel === 'federacao') {
        const fedSolic = coopsFed[pedidoData.cooperativa_solicitante_id] || null;
        const fedResp = coopsFed[pedidoData.cooperativa_responsavel_id] || null;
        podeVer = !!userFed && (fedSolic === userFed || fedResp === userFed);
      }
      
      if (podeVer) {
        totalPedidos++;
        
        if (pedidoData.status === 'concluido') {
          pedidosConcluidos++;
          // Verificar se foi concluído dentro do prazo
          if (new Date(pedidoData.data_ultima_alteracao) <= new Date(pedidoData.prazo_atual)) {
            slaCumprido++;
          }
        } else if (pedidoData.status === 'em_andamento') {
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

    const slaPercentual = pedidosConcluidos > 0 ? Math.round((slaCumprido / pedidosConcluidos) * 100) : 0;

    return c.json({
      total_pedidos: totalPedidos,
      pedidos_vencendo: pedidosVencendo,
      pedidos_em_andamento: pedidosEmAndamento,
      pedidos_concluidos: pedidosConcluidos,
      sla_cumprido: slaPercentual
    });
  } catch (error) {
    console.error('Erro ao gerar estatísticas:', error);
    return c.json({ error: 'Erro ao gerar estatísticas' }, 500);
  }
});

// Rota para executar escalonamento manual (admin only)
app.post('/admin/escalar-pedidos', requireAuth, requireRole(['admin']), async (c) => {
  try {
    await escalarPedidos();
    return c.json({ message: 'Escalonamento executado com sucesso' });
  } catch (error) {
    console.error('Erro no escalonamento manual:', error);
    return c.json({ error: 'Erro no escalonamento' }, 500);
  }
});

// Inicializar dados e configurar cron job para escalonamento
const initServer = async () => {
  await initializeData();
  
  // Configurar cron job para escalonamento (executar a cada hora)
  setInterval(async () => {
    console.log('Executando escalonamento automático...');
    await escalarPedidos();
  }, 60 * 60 * 1000); // 1 hora
};

// Inicializar servidor
// Health check simples da função
app.get('/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }));

// Rotas raiz (úteis para testes rápidos: GET/POST /)
app.get('/', (c) => c.json({ status: 'ok', name: 'server', method: 'GET', time: new Date().toISOString() }));
app.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const isSchedule = c.req.header('x-cron') === 'true';
  if (isSchedule || body?.task === 'escalar') {
    try {
      await escalarPedidos();
      return c.json({ status: 'ok', job: 'escalar', time: new Date().toISOString() });
    } catch (e) {
      console.error('Erro no job escalonar:', e);
      return c.json({ status: 'error', message: 'cron failed' }, 500);
    }
  }
  return c.json({ status: 'ok', name: 'server', method: 'POST', body, time: new Date().toISOString() });
});

// Observação: para jobs cron externos, envie header 'x-cron: true' e body {"task":"escalar"}

export default app.fetch;

// Permite rodar localmente sem Docker/Edge, usando Deno diretamente.
// Mantém compatível com Edge Functions (export default app.fetch acima).
if (import.meta.main) {
  const port = Number(Deno.env.get('PORT') || '8000');
  console.log(`[server] Iniciando servidor HTTP local na porta ${port}...`);
  Deno.serve({ port }, app.fetch);
}
