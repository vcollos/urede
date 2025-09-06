import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { cors, logger } from "https://deno.land/x/hono@v4.3.11/middleware.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// Configurar Supabase client
// SUPABASE_URL é fornecida automaticamente pelo ambiente do Supabase (variável reservada)
// Para a chave de serviço, priorizamos SERVICE_ROLE_KEY, com fallback para nomes comuns e, por fim, ANON para rotas públicas.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const DB_SCHEMA = Deno.env.get('DB_SCHEMA') || 'public';
// Por padrão, usamos o prefixo 'urede_' pois suas tabelas reais seguem esse padrão.
// Você pode sobrescrever via env TABLE_PREFIX se precisar mudar.
const TABLE_PREFIX = Deno.env.get('TABLE_PREFIX') || 'urede_';
const TBL = (name: string) => `${TABLE_PREFIX}${name}`;
const SERVICE_ROLE_KEY =
  Deno.env.get('SERVICE_ROLE_KEY') ||
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
  Deno.env.get('SB_SERVICE_ROLE_KEY') ||
  '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

if (!SUPABASE_URL) {
  console.error('[server] SUPABASE_URL ausente no ambiente.');
}

if (!SERVICE_ROLE_KEY) {
  console.warn('[server] SERVICE_ROLE_KEY não encontrado; usando ANON para rotas públicas. Defina SERVICE_ROLE_KEY para privilégios de serviço.');
}

const supabase = createClient(
  SUPABASE_URL || '',
  SERVICE_ROLE_KEY || SUPABASE_ANON_KEY || '',
  { db: { schema: DB_SCHEMA } }
);

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
  const agora = new Date();
  const prazo = new Date(prazoIso);
  const diffTime = prazo.getTime() - agora.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Carrega nomes de cidade e cooperativa para um conjunto de pedidos
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
        .map((p) => p.cooperativa_solicitante_id)
        .filter((v) => typeof v === 'string' && v.trim().length > 0)
    )
  );

  let cidadesMap: Record<string, any> = {};
  let coopsMap: Record<string, any> = {};

  try {
    if (cityIds.length > 0) {
      const { data: cidadesRows } = await supabase
        .from(TBL('cidades'))
        .select('CD_MUNICIPIO_7,NM_CIDADE,UF_MUNICIPIO')
        .in('CD_MUNICIPIO_7', cityIds);
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
      const { data: coopRows } = await supabase
        .from(TBL('cooperativas'))
        .select('id_singular,UNIODONTO')
        .in('id_singular', coopIds);
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
    return {
      ...p,
      cidade_nome: cidade?.nm_cidade || null,
      estado: cidade?.uf_municipio || null,
      cooperativa_solicitante_nome: coop?.uniodonto || null,
    };
  });
};

// Middleware para verificar autenticação
const requireAuth = async (c: any, next: any) => {
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  if (!accessToken) {
    return c.json({ error: 'Token de acesso não fornecido' }, 401);
  }

  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) {
    return c.json({ error: 'Token inválido ou expirado' }, 401);
  }

  c.set('user', user);
  await next();
};

// Função para obter dados do usuário somente via SQL
const getUserData = async (userId: string, userEmail?: string | null) => {
  try {
    // 1) tentar por email em <prefix>operadores
    if (userEmail) {
      const byEmail = await supabase
        .from(TBL('operadores'))
        .select('*')
        .eq('email', userEmail)
        .maybeSingle();
      if (byEmail.data) {
        const o = mapOperador(byEmail.data);
        return {
          ...o,
          cooperativa_id: o.id_singular,
          papel: 'operador',
        } as any;
      }
      if (byEmail.error && byEmail.error.code !== 'PGRST116') {
        console.warn('[getUserData] erro byEmail:', byEmail.error);
      }
    }

    // 2) fallback por id
    const byId = await supabase
      .from(TBL('operadores'))
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (byId.data) {
      const o = mapOperador(byId.data);
      return {
        ...o,
        cooperativa_id: o.id_singular,
        papel: 'operador',
      } as any;
    }
    if (byId.error && byId.error.code !== 'PGRST116') {
      console.warn('[getUserData] erro byId:', byId.error);
    }

    // 3) fallback básico a partir do auth
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
    const { data: pedidos, error } = await supabase
      .from(TBL('pedidos'))
      .select('*')
      .eq('status', 'em_andamento')
      .lt('prazo_atual', agoraIso);

    if (error) {
      console.error('Erro ao buscar pedidos para escalonamento:', error);
      return;
    }
    if (!pedidos || pedidos.length === 0) return;

    for (const pedido of pedidos as any[]) {
      let novoNivel = pedido.nivel_atual as 'singular' | 'federacao' | 'confederacao';
      let novaCooperativaResponsavel: string | null = pedido.cooperativa_responsavel_id || null;

      if (pedido.nivel_atual === 'singular') {
        // Buscar federação da cooperativa solicitante
        const { data: coopSolic, error: coopErr } = await supabase
          .from(TBL('cooperativas'))
          .select('federacao')
          .eq('id_singular', pedido.cooperativa_solicitante_id)
          .maybeSingle();
        if (coopErr) {
          console.error('Erro ao buscar cooperativa solicitante:', coopErr);
          continue;
        }
        const federacaoNome = coopSolic?.federacao;
        if (federacaoNome) {
          const { data: fed, error: fedErr } = await supabase
            .from(TBL('cooperativas'))
            .select('id_singular')
            .eq('tipo', 'FEDERAÇÃO')
            .eq('federacao', federacaoNome)
            .maybeSingle();
          if (!fedErr && fed) {
            novoNivel = 'federacao';
            novaCooperativaResponsavel = fed.id_singular as string;
          }
        }
      } else if (pedido.nivel_atual === 'federacao') {
        const { data: conf, error: confErr } = await supabase
          .from(TBL('cooperativas'))
          .select('id_singular')
          .eq('tipo', 'CONFEDERACAO')
          .maybeSingle();
        if (!confErr && conf) {
          novoNivel = 'confederacao';
          novaCooperativaResponsavel = conf.id_singular as string;
        }
      }

      if (novoNivel !== pedido.nivel_atual && novaCooperativaResponsavel) {
        const novoPrazo = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const agora = new Date().toISOString();

        const { error: upErr } = await supabase
          .from(TBL('pedidos'))
          .update({
            nivel_atual: novoNivel,
            cooperativa_responsavel_id: novaCooperativaResponsavel,
            prazo_atual: novoPrazo,
            data_ultima_alteracao: agora,
          })
          .eq('id', pedido.id);

        if (upErr) {
          console.error('Erro ao atualizar pedido no escalonamento:', upErr);
          continue;
        }

        // Registrar auditoria com autor como criador do pedido para evitar FK inválida
        const { error: audErr } = await supabase
          .from(TBL('auditoria_logs'))
          .insert([{
            id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            pedido_id: pedido.id,
            usuario_id: pedido.criado_por,
            usuario_nome: 'Sistema Automático',
            acao: `Escalamento automático para ${novoNivel}`,
            timestamp: agora,
            detalhes: `Pedido escalado automaticamente por vencimento de prazo. Novo prazo: ${novoPrazo}`
          }]);
        if (audErr) {
          console.error('Erro ao registrar auditoria de escalonamento:', audErr);
        }
      }
    }
  } catch (error) {
    console.error('Erro ao escalar pedidos:', error);
  }
};

// ROTAS DA API

// Rota de autenticação - Cadastro
app.post('/auth/register', async (c) => {
  try {
    const { email, password, nome, display_name, telefone, whatsapp, cargo, cooperativa_id, papel } = await c.req.json();

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name: nome },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
      console.error('Erro ao criar usuário:', error);
      return c.json({ error: 'Erro ao criar usuário', details: error.message }, 400);
    }

    // Apenas retorna o usuário criado no auth; não insere em tabelas locais
    return c.json({ 
      message: 'Usuário criado com sucesso',
      user: {
        id: data.user.id,
        nome,
        display_name,
        email,
        telefone,
        whatsapp,
        cargo,
        cooperativa_id,
        papel,
        ativo: true,
        data_cadastro: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Erro no cadastro:', error);
    return c.json({ error: 'Erro interno do servidor' }, 500);
  }
});

// Rota para obter dados do usuário autenticado
app.get('/auth/me', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userData = await getUserData(user.id);
    
    return c.json({ user: userData });
  } catch (error) {
    console.error('Erro ao obter dados do usuário:', error);
    return c.json({ error: 'Erro ao obter dados do usuário' }, 500);
  }
});

// ROTA PÚBLICA PARA COOPERATIVAS (para registro)
app.get('/cooperativas/public', async (c) => {
  try {
    const { data, error } = await supabase
      .from(TBL('cooperativas'))
      .select('*');
    if (error) {
      console.error('Erro ao buscar cooperativas do banco:', error);
      return c.json({ error: 'Erro ao buscar cooperativas' }, 500);
    }
    const mapped = (data || []).map(mapCooperativa);
    return c.json(mapped);
  } catch (error) {
    console.error('Erro ao buscar cooperativas públicas:', error);
    return c.json({ error: 'Erro ao buscar cooperativas' }, 500);
  }
});

// ROTAS DE COOPERATIVAS
app.get('/cooperativas', requireAuth, async (c) => {
  try {
    const { data, error } = await supabase
      .from(TBL('cooperativas'))
      .select('*');
    if (error) {
      console.error('Erro ao buscar cooperativas do banco:', error);
      return c.json({ error: 'Erro ao buscar cooperativas' }, 500);
    }
    const mapped = (data || []).map(mapCooperativa);
    return c.json(mapped);
  } catch (error) {
    console.error('Erro ao buscar cooperativas:', error);
    return c.json({ error: 'Erro ao buscar cooperativas' }, 500);
  }
});

// ROTAS DE CIDADES
app.get('/cidades', requireAuth, async (c) => {
  try {
    const { data, error } = await supabase
      .from(TBL('cidades'))
      .select('*');
    if (error) {
      console.error('Erro ao buscar cidades do banco:', error);
      return c.json({ error: 'Erro ao buscar cidades' }, 500);
    }
    const mapped = (data || []).map(mapCidade);
    return c.json(mapped);
  } catch (error) {
    console.error('Erro ao buscar cidades:', error);
    return c.json({ error: 'Erro ao buscar cidades' }, 500);
  }
});

// ROTA PÚBLICA DE CIDADES (apenas leitura)
app.get('/cidades/public', async (c) => {
  try {
    const { data, error } = await supabase
      .from(TBL('cidades'))
      .select('*');
    if (error) {
      console.error('Erro ao buscar cidades (public):', error);
      return c.json({ error: 'Erro ao buscar cidades' }, 500);
    }
    const mapped = (data || []).map(mapCidade);
    return c.json(mapped);
  } catch (error) {
    console.error('Erro ao buscar cidades públicas:', error);
    return c.json({ error: 'Erro ao buscar cidades' }, 500);
  }
});

// ROTAS DE OPERADORES
app.get('/operadores', requireAuth, async (c) => {
  try {
    const { data, error } = await supabase
      .from(TBL('operadores'))
      .select('*');
    if (error) {
      console.error('Erro ao buscar operadores do banco:', error);
      return c.json({ error: 'Erro ao buscar operadores' }, 500);
    }
    const mapped = (data || []).map(mapOperador);
    return c.json(mapped);
  } catch (error) {
    console.error('Erro ao buscar operadores:', error);
    return c.json({ error: 'Erro ao buscar operadores' }, 500);
  }
});

// ROTA PÚBLICA DE OPERADORES (campos restritos, sem contatos)
app.get('/operadores/public', async (c) => {
  try {
    const { data, error } = await supabase
      .from(TBL('operadores'))
      .select('id, nome, cargo, id_singular, status, created_at');
    if (error) {
      console.error('Erro ao buscar operadores (public):', error);
      return c.json({ error: 'Erro ao buscar operadores' }, 500);
    }
    const mapped = (data || []).map(mapOperador).map(o => ({
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
      const { count, error } = await supabase
        .from(TBL(t))
        .select('*', { count: 'exact', head: true });
      if (error) {
        console.warn(`[debug/counts] erro em ${TBL(t)}:`, error.message);
        result[TBL(t)] = null;
      } else {
        result[TBL(t)] = count ?? 0;
      }
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
    const { data, error } = await supabase
      .from(TBL('pedidos'))
      .select('id, titulo, cidade_id, prioridade, status, nivel_atual, prazo_atual');
    if (error) {
      console.error('Erro ao buscar pedidos (public):', error);
      return c.json({ error: 'Erro ao buscar pedidos' }, 500);
    }
    const base = (data || []).map((p: any) => ({
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
    
    let { data: pedidosData, error } = await supabase
      .from(TBL('pedidos'))
      .select('*');
    if (error) {
      console.error('Erro ao buscar pedidos do banco:', error);
      return c.json({ error: 'Erro ao buscar pedidos' }, 500);
    }

    // Aplicar filtros baseados no papel do usuário
    const pedidosFiltrados = (pedidosData || []).filter(pedidoData => {
      let podeVer = false;
      
      switch (userData.papel) {
        case 'admin':
        case 'confederacao':
          podeVer = true; // Vê todos os pedidos
          break;
        case 'federacao':
          // Vê pedidos escalados para federação/confederação ou da sua federação
          podeVer = pedidoData.nivel_atual === 'federacao' || 
                   pedidoData.nivel_atual === 'confederacao' ||
                   pedidoData.cooperativa_responsavel_id === userData.cooperativa_id;
          break;
        case 'operador':
          // Vê apenas pedidos da sua cooperativa ou que ele criou
          podeVer = pedidoData.cooperativa_solicitante_id === userData.cooperativa_id ||
                   pedidoData.criado_por === userData.id ||
                   pedidoData.responsavel_atual_id === userData.id;
          break;
      }
      
      return podeVer;
    });

    // Calcular dias restantes para cada pedido
    const pedidosComDias = pedidosFiltrados.map(p => ({
      ...p,
      dias_restantes: computeDiasRestantes(p.prazo_atual),
    }));

    const enriquecidos = await enrichPedidos(pedidosComDias);
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
    
    const novoPedido = {
      titulo: pedidoData.titulo,
      criado_por: userData.id,
      cooperativa_solicitante_id: userData.cooperativa_id,
      cidade_id: pedidoData.cidade_id,
      especialidades: pedidoData.especialidades,
      quantidade: pedidoData.quantidade,
      observacoes: pedidoData.observacoes,
      nivel_atual: 'singular',
      prazo_atual: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 dias
      status: 'novo',
      data_criacao: new Date().toISOString(),
      data_ultima_alteracao: new Date().toISOString(),
      cooperativa_responsavel_id: userData.cooperativa_id,
      prioridade: pedidoData.prioridade || 'media'
    };

    const { data: inserted, error: insertError } = await supabase
      .from(TBL('pedidos'))
      .insert([novoPedido])
      .select('*')
      .single();

    if (insertError) {
      console.error('Erro ao inserir pedido na tabela:', insertError);
      return c.json({ error: 'Erro ao criar pedido' }, 500);
    }

    // Registrar auditoria
    const auditoria = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      pedido_id: novoPedido.id,
      usuario_id: userData.id,
      usuario_nome: userData.nome,
      acao: 'Criação do pedido',
      timestamp: new Date().toISOString(),
      detalhes: `Pedido criado: ${pedidoData.titulo}`
    };

    const { error: auditoriaError } = await supabase
      .from(TBL('auditoria_logs'))
      .insert([auditoria]);
    if (auditoriaError) {
      console.error('Erro ao salvar auditoria:', auditoriaError);
    }

    {
      const base = [{
        ...inserted,
        dias_restantes: computeDiasRestantes(inserted.prazo_atual),
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
    const userData = await getUserData(c.get('user').id);
    const updateData = await c.req.json();

    const { data: pedido, error: getErr } = await supabase
      .from(TBL('pedidos'))
      .select('*')
      .eq('id', pedidoId)
      .maybeSingle();
    if (getErr || !pedido) {
      return c.json({ error: 'Pedido não encontrado' }, 404);
    }
    
    // Verificar permissões
    const podeEditar = userData.papel === 'admin' || 
                      pedido.cooperativa_responsavel_id === userData.cooperativa_id;
    
    if (!podeEditar) {
      return c.json({ error: 'Acesso negado para editar este pedido' }, 403);
    }

    // Sanitizar update apenas para colunas conhecidas
    const allowed: Record<string, any> = {};
    const whitelist = [
      'titulo', 'cooperativa_responsavel_id', 'cidade_id', 'especialidades', 'quantidade',
      'observacoes', 'prioridade', 'nivel_atual', 'status', 'prazo_atual',
    ];
    for (const k of whitelist) if (k in updateData) allowed[k] = updateData[k];
    allowed.data_ultima_alteracao = new Date().toISOString();

    const { error: upErr } = await supabase
      .from(TBL('pedidos'))
      .update(allowed)
      .eq('id', pedidoId);
    if (upErr) {
      console.error('Erro ao atualizar pedido:', upErr);
      return c.json({ error: 'Erro ao atualizar pedido' }, 500);
    }

    // Registrar auditoria
    const auditoria = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      pedido_id: pedidoId,
      usuario_id: userData.id,
      usuario_nome: userData.nome,
      acao: 'Atualização do pedido',
      timestamp: new Date().toISOString(),
      detalhes: `Campos atualizados: ${Object.keys(updateData).join(', ')}`
    };

    try {
      const { error: audErr } = await supabase
        .from(TBL('auditoria_logs'))
        .insert([auditoria]);
      if (audErr) {
        console.error('Erro ao salvar auditoria de atualização:', audErr);
      }
    } catch (e) {
      console.warn('Auditoria não registrada (tabela ausente?):', e);
    }

    const updated = { ...pedido, ...allowed };
    {
      const base = [{
        ...updated,
        dias_restantes: computeDiasRestantes(updated.prazo_atual),
      }];
      const [enriched] = await enrichPedidos(base);
      return c.json(enriched || base[0]);
    }
  } catch (error) {
    console.error('Erro ao atualizar pedido:', error);
    return c.json({ error: 'Erro ao atualizar pedido' }, 500);
  }
});

// Buscar auditoria de um pedido
app.get('/pedidos/:id/auditoria', requireAuth, async (c) => {
  try {
    const pedidoId = c.req.param('id');
    const { data, error } = await supabase
      .from(TBL('auditoria_logs'))
      .select('*')
      .eq('pedido_id', pedidoId)
      .order('timestamp', { ascending: false });
    if (error) {
      console.error('Erro ao buscar auditoria:', error);
      return c.json({ error: 'Erro ao buscar auditoria' }, 500);
    }
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
    
    let { data: pedidosData, error } = await supabase
      .from(TBL('pedidos'))
      .select('*');
    if (error) {
      console.error('Erro ao buscar pedidos para estatísticas:', error);
      return c.json({ error: 'Erro ao gerar estatísticas' }, 500);
    }

    const agora = new Date();
    let totalPedidos = 0;
    let pedidosVencendo = 0;
    let pedidosEmAndamento = 0;
    let pedidosConcluidos = 0;
    let slaCumprido = 0;

    for (const pedidoData of (pedidosData || [])) {
      // Aplicar filtros baseados no papel do usuário
      let podeVer = false;
      
      switch (userData.papel) {
        case 'admin':
        case 'confederacao':
          podeVer = true;
          break;
        case 'federacao':
          podeVer = pedidoData.nivel_atual === 'federacao' || 
                   pedidoData.nivel_atual === 'confederacao' ||
                   pedidoData.cooperativa_responsavel_id === userData.cooperativa_id;
          break;
        case 'operador':
          podeVer = pedidoData.cooperativa_solicitante_id === userData.cooperativa_id ||
                   pedidoData.criado_por === userData.id;
          break;
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
  const isSchedule = c.req.header('x-supabase-schedule') === 'true';
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

// Remover agendamentos/residentes: Edge Functions são stateless.
// Usar agendador do Supabase para acionar o job via POST '/'

export default app.fetch;

// Permite rodar localmente sem Docker/Edge, usando Deno diretamente.
// Mantém compatível com Edge Functions (export default app.fetch acima).
if (import.meta.main) {
  const port = Number(Deno.env.get('PORT') || '8000');
  console.log(`[server] Iniciando servidor HTTP local na porta ${port}...`);
  Deno.serve({ port }, app.fetch);
}
