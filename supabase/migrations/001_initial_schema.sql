-- Uniodonto - Schema inicial (tabelas + índices)

-- Tabela de cooperativas
CREATE TABLE IF NOT EXISTS public.cooperativas (
    id_singular VARCHAR PRIMARY KEY,
    uniodonto VARCHAR NOT NULL,
    cnpj VARCHAR,
    cro_operadora VARCHAR,
    data_fundacao DATE,
    raz_social VARCHAR,
    codigo_ans VARCHAR,
    federacao VARCHAR,
    software VARCHAR,
    tipo VARCHAR CHECK (tipo IN ('SINGULAR', 'FEDERAÇÃO', 'CONFEDERACAO')),
    op_pr VARCHAR,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de cidades
CREATE TABLE IF NOT EXISTS public.cidades (
    cd_municipio_7 VARCHAR PRIMARY KEY,
    cd_municipio VARCHAR,
    regional_saude VARCHAR,
    nm_cidade VARCHAR NOT NULL,
    uf_municipio VARCHAR(2),
    nm_regiao VARCHAR,
    cidades_habitantes INTEGER,
    id_singular VARCHAR REFERENCES public.cooperativas(id_singular),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de usuários do sistema
CREATE TABLE IF NOT EXISTS public.usuarios_sistema (
    id UUID PRIMARY KEY,
    nome VARCHAR NOT NULL,
    display_name VARCHAR,
    email VARCHAR UNIQUE NOT NULL,
    telefone VARCHAR,
    whatsapp VARCHAR,
    cargo VARCHAR,
    cooperativa_id VARCHAR REFERENCES public.cooperativas(id_singular),
    papel VARCHAR CHECK (papel IN ('admin', 'operador', 'federacao', 'confederacao')),
    ativo BOOLEAN DEFAULT true,
    data_cadastro TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de pedidos
CREATE TABLE IF NOT EXISTS public.pedidos (
    id VARCHAR PRIMARY KEY,
    titulo VARCHAR NOT NULL,
    criado_por UUID REFERENCES public.usuarios_sistema(id),
    cooperativa_solicitante_id VARCHAR REFERENCES public.cooperativas(id_singular),
    cooperativa_responsavel_id VARCHAR REFERENCES public.cooperativas(id_singular),
    cidade_id VARCHAR REFERENCES public.cidades(cd_municipio_7),
    especialidades JSONB,
    quantidade INTEGER,
    observacoes TEXT,
    nivel_atual VARCHAR CHECK (nivel_atual IN ('singular', 'federacao', 'confederacao')),
    prazo_atual TIMESTAMP,
    status VARCHAR CHECK (status IN ('novo', 'em_andamento', 'concluido', 'cancelado')),
    prioridade VARCHAR CHECK (prioridade IN ('baixa', 'media', 'alta', 'urgente')),
    responsavel_atual_id UUID REFERENCES public.usuarios_sistema(id),
    responsavel_atual_nome VARCHAR,
    data_criacao TIMESTAMP DEFAULT NOW(),
    data_ultima_alteracao TIMESTAMP DEFAULT NOW()
);

-- Tabela de auditoria
CREATE TABLE IF NOT EXISTS public.auditoria_logs (
    id VARCHAR PRIMARY KEY,
    pedido_id VARCHAR REFERENCES public.pedidos(id),
    usuario_id UUID REFERENCES public.usuarios_sistema(id),
    usuario_nome VARCHAR,
    acao VARCHAR NOT NULL,
    detalhes TEXT,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON public.pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_nivel ON public.pedidos(nivel_atual);
CREATE INDEX IF NOT EXISTS idx_pedidos_cooperativa ON public.pedidos(cooperativa_responsavel_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_pedido ON public.auditoria_logs(pedido_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON public.auditoria_logs(usuario_id);
CREATE INDEX IF NOT EXISTS idx_cidades_singular ON public.cidades(id_singular);

-- KV store (opcional; não usado em produção agora)
-- CREATE TABLE IF NOT EXISTS public.kv_store_96c6e32f (
--   key TEXT NOT NULL PRIMARY KEY,
--   value JSONB NOT NULL
-- );

