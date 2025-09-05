import { Hono } from "https://deno.land/x/hono@v4.4.12/mod.ts";
import { cors } from "https://deno.land/x/hono@v4.4.12/middleware/cors/index.ts";
import { logger } from "https://deno.land/x/hono@v4.4.12/middleware/logger/index.ts";
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
  SERVICE_ROLE_KEY || SUPABASE_ANON_KEY || ''
);

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
const getUserData = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('usuarios_sistema')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      // Usuário não encontrado: criar registro padrão
      const defaultUser = {
        id: userId,
        nome: 'Usuário',
        display_name: 'Usuário',
        email: '',
        telefone: '',
        whatsapp: '',
        cargo: '',
        cooperativa_id: '',
        papel: 'operador',
        ativo: true,
        data_cadastro: new Date().toISOString()
      };

      const { data: insertData, error: insertError } = await supabase
        .from('usuarios_sistema')
        .insert([defaultUser])
        .select()
        .single();

      if (insertError) {
        console.error('Erro ao criar usuário padrão:', insertError);
        return null;
      }
      return insertData;
    } else if (error) {
      console.error('Erro ao buscar usuário:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Erro ao obter dados do usuário:', error);
    return null;
  }
};

// Middleware para verificar permissões RBAC
const requireRole = (roles: string[]) => {
  return async (c: any, next: any) => {
    const user = c.get('user');
    const userData = await getUserData(user.id);
    
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
      .from('pedidos')
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
          .from('cooperativas')
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
            .from('cooperativas')
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
          .from('cooperativas')
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
          .from('pedidos')
          .update({
            nivel_atual: novoNivel,
            cooperativa_responsavel_id: novaCooperativaResponsavel,
            prazo_atual: novoPrazo,
            data_ultima_alteracao: agora,
            responsavel_atual_id: null,
            responsavel_atual_nome: null,
          })
          .eq('id', pedido.id);

        if (upErr) {
          console.error('Erro ao atualizar pedido no escalonamento:', upErr);
          continue;
        }

        // Registrar auditoria com autor como criador do pedido para evitar FK inválida
        const { error: audErr } = await supabase
          .from('auditoria_logs')
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

    // Salvar dados adicionais do usuário
    const userData = {
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
    };

    // Tentar salvar na tabela usuarios_sistema primeiro
    const { error: insertError } = await supabase
      .from('usuarios_sistema')
      .insert([userData]);

    if (insertError) {
      console.error('Erro ao salvar usuário na tabela:', insertError);
      return c.json({ error: 'Erro ao salvar dados do usuário' }, 500);
    }

    return c.json({ 
      message: 'Usuário criado com sucesso',
      user: userData
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
      .from('cooperativas')
      .select('*')
      .order('uniodonto');
    if (error) {
      console.error('Erro ao buscar cooperativas do banco:', error);
      return c.json({ error: 'Erro ao buscar cooperativas' }, 500);
    }
    return c.json(data || []);
  } catch (error) {
    console.error('Erro ao buscar cooperativas públicas:', error);
    return c.json({ error: 'Erro ao buscar cooperativas' }, 500);
  }
});

// ROTAS DE COOPERATIVAS
app.get('/cooperativas', requireAuth, async (c) => {
  try {
    const { data, error } = await supabase
      .from('cooperativas')
      .select('*')
      .order('uniodonto');
    if (error) {
      console.error('Erro ao buscar cooperativas do banco:', error);
      return c.json({ error: 'Erro ao buscar cooperativas' }, 500);
    }
    return c.json(data || []);
  } catch (error) {
    console.error('Erro ao buscar cooperativas:', error);
    return c.json({ error: 'Erro ao buscar cooperativas' }, 500);
  }
});

// ROTAS DE CIDADES
app.get('/cidades', requireAuth, async (c) => {
  try {
    const { data, error } = await supabase
      .from('cidades')
      .select('*')
      .order('nm_cidade');
    if (error) {
      console.error('Erro ao buscar cidades do banco:', error);
      return c.json({ error: 'Erro ao buscar cidades' }, 500);
    }
    return c.json(data || []);
  } catch (error) {
    console.error('Erro ao buscar cidades:', error);
    return c.json({ error: 'Erro ao buscar cidades' }, 500);
  }
});

// ROTAS DE OPERADORES
app.get('/operadores', requireAuth, async (c) => {
  try {
    // Verificar se existe tabela operadores, senão buscar de usuarios_sistema
    let { data, error } = await supabase
      .from('operadores')
      .select('*')
      .order('nome');

    // Se não encontrar tabela operadores, tentar usuarios_sistema
    if (error && error.code === 'PGRST116') {
      const { data: usersData, error: usersError } = await supabase
        .from('usuarios_sistema')
        .select('*')
        .order('nome');

      if (usersError) {
        console.error('Erro ao buscar operadores/usuários do banco:', usersError);
        return c.json({ error: 'Erro ao buscar operadores' }, 500);
      }

      data = usersData;
    } else if (error) {
      console.error('Erro ao buscar operadores do banco:', error);
      return c.json({ error: 'Erro ao buscar operadores' }, 500);
    }

    return c.json(data || []);
  } catch (error) {
    console.error('Erro ao buscar operadores:', error);
    return c.json({ error: 'Erro ao buscar operadores' }, 500);
  }
});

// ROTAS DE PEDIDOS
app.get('/pedidos', requireAuth, async (c) => {
  try {
    const userData = await getUserData(c.get('user').id);
    
    let { data: pedidosData, error } = await supabase
      .from('pedidos')
      .select('*')
      .order('data_criacao', { ascending: false });
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
    const pedidosComDias = pedidosFiltrados.map(pedidoData => {
      const agora = new Date();
      const prazo = new Date(pedidoData.prazo_atual);
      const diffTime = prazo.getTime() - agora.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return {
        ...pedidoData,
        dias_restantes: diffDays
      };
    });

    return c.json(pedidosComDias);
  } catch (error) {
    console.error('Erro ao buscar pedidos:', error);
    return c.json({ error: 'Erro ao buscar pedidos' }, 500);
  }
});

app.post('/pedidos', requireAuth, async (c) => {
  try {
    const userData = await getUserData(c.get('user').id);
    const pedidoData = await c.req.json();
    
    const novoPedido = {
      id: `PED_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
      dias_restantes: 30,
      prioridade: pedidoData.prioridade || 'media'
    };

    const { error: insertError } = await supabase
      .from('pedidos')
      .insert([novoPedido]);

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
      .from('auditoria_logs')
      .insert([auditoria]);
    if (auditoriaError) {
      console.error('Erro ao salvar auditoria:', auditoriaError);
    }

    return c.json(novoPedido);
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
      .from('pedidos')
      .select('*')
      .eq('id', pedidoId)
      .maybeSingle();
    if (getErr || !pedido) {
      return c.json({ error: 'Pedido não encontrado' }, 404);
    }
    
    // Verificar permissões
    const podeEditar = userData.papel === 'admin' || 
                      pedido.cooperativa_responsavel_id === userData.cooperativa_id ||
                      pedido.responsavel_atual_id === userData.id;
    
    if (!podeEditar) {
      return c.json({ error: 'Acesso negado para editar este pedido' }, 403);
    }

    // Atualizar dados
    const pedidoAtualizado = {
      ...pedido,
      ...updateData,
      data_ultima_alteracao: new Date().toISOString()
    };

    const { error: upErr } = await supabase
      .from('pedidos')
      .update(pedidoAtualizado)
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

    const { error: audErr } = await supabase
      .from('auditoria_logs')
      .insert([auditoria]);
    if (audErr) {
      console.error('Erro ao salvar auditoria de atualização:', audErr);
    }

    return c.json(pedidoAtualizado);
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
      .from('auditoria_logs')
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
    const userData = await getUserData(c.get('user').id);
    
    let { data: pedidosData, error } = await supabase
      .from('pedidos')
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
