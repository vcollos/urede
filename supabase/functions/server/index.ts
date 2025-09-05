import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = new Hono();

// Configurar CORS
app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization', 'apikey', 'Accept', 'X-Requested-With'],
  allowMethods: ['POST', 'GET', 'PUT', 'DELETE', 'OPTIONS'],
  maxAge: 86400,
}));

app.use('*', logger(console.log));

// Configurar Supabase client com fallback
const getSupabaseClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  
  // Tentar SERVICE_ROLE_KEY primeiro, depois fallbacks
  let serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || 
                   Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 
                   Deno.env.get('SB_SERVICE_ROLE_KEY');
  
  // Para rotas públicas, usar ANON_KEY se service key não estiver disponível
  if (!serviceKey) {
    console.warn('⚠️ SERVICE_ROLE_KEY não encontrada, usando ANON_KEY');
    serviceKey = Deno.env.get('SUPABASE_ANON_KEY');
  }
  
  if (!supabaseUrl) {
    console.error('❌ SUPABASE_URL não encontrada');
    throw new Error('SUPABASE_URL não configurada');
  }
  
  if (!serviceKey) {
    console.error('❌ Nenhuma chave de API encontrada');
    throw new Error('Chave de API não configurada');
  }
  
  console.log('✅ Criando cliente Supabase...');
  return createClient(supabaseUrl, serviceKey);
};

// Health check - SEMPRE funciona
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    time: new Date().toISOString(),
    env_check: {
      supabase_url: !!Deno.env.get('SUPABASE_URL'),
      service_role_key: !!Deno.env.get('SERVICE_ROLE_KEY'),
      anon_key: !!Deno.env.get('SUPABASE_ANON_KEY')
    }
  });
});

// Rota pública de cooperativas - sem auth
app.get('/cooperativas/public', async (c) => {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('cooperativas')
      .select('*')
      .order('uniodonto');
      
    if (error) {
      console.error('Erro ao buscar cooperativas:', error);
      return c.json({ error: 'Erro ao buscar cooperativas', details: error.message }, 500);
    }
    
    return c.json(data || []);
  } catch (error) {
    console.error('Erro crítico:', error);
    return c.json({ 
      error: 'Erro interno do servidor', 
      details: error.message,
      type: 'initialization_error'
    }, 500);
  }
});

// Middleware de autenticação
const requireAuth = async (c: any, next: any) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Token de acesso não fornecido' }, 401);
    }

    const supabase = getSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    
    if (error || !user) {
      return c.json({ error: 'Token inválido ou expirado' }, 401);
    }

    c.set('user', user);
    await next();
  } catch (error) {
    console.error('Erro na autenticação:', error);
    return c.json({ error: 'Erro interno de autenticação' }, 500);
  }
};

// Função para obter dados do usuário
const getUserData = async (userId: string) => {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('usuarios_sistema')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      // Criar usuário padrão se não existir
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

// Resto das rotas (cooperativas, pedidos, etc.) usando requireAuth...
app.get('/cooperativas', requireAuth, async (c) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('cooperativas')
      .select('*')
      .order('uniodonto');
      
    if (error) {
      console.error('Erro ao buscar cooperativas:', error);
      return c.json({ error: 'Erro ao buscar cooperativas' }, 500);
    }
    
    return c.json(data || []);
  } catch (error) {
    console.error('Erro ao buscar cooperativas:', error);
    return c.json({ error: 'Erro ao buscar cooperativas' }, 500);
  }
});

// Root handlers
app.get('/', (c) => c.json({ 
  status: 'ok', 
  name: 'server', 
  method: 'GET', 
  time: new Date().toISOString() 
}));

app.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return c.json({ 
    status: 'ok', 
    name: 'server', 
    method: 'POST', 
    body, 
    time: new Date().toISOString() 
  });
});

export default app.fetch;