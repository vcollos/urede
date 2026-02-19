export type ArquivoFonte = 'api' | 'mock';
export type ArquivosModule = 'udocs' | 'umarketing';

export interface ArquivoItem {
  id: string;
  drive_file_id?: string;
  titulo: string;
  categoria: string;
  ano: number;
  mime_type: string;
  item_tipo: 'pasta' | 'arquivo';
  pasta_codigo?: string | null;
  pasta_nome?: string | null;
  parent_drive_file_id?: string | null;
  ordem_manual?: number | null;
  tamanho_bytes: number;
  criado_em?: string;
  atualizado_em: string;
  preview_url?: string;
  download_url?: string;
  snippet?: string;
  relevance_score?: number;
  match_source?: 'titulo' | 'metadado' | 'conteudo' | string | null;
  source: ArquivoFonte;
}

export interface ArquivoListResult {
  items: ArquivoItem[];
  total: number;
  categorias: string[];
  anos: number[];
  source: ArquivoFonte;
}

export interface ArquivoListFilters {
  q: string;
  categoria: string;
  ano: string;
  page: number;
  page_size: number;
}

export interface AppUser {
  email: string;
  nome: string;
  papel: 'admin' | 'operador' | 'federacao' | 'confederacao' | string;
}

export interface ArquivoShortcut {
  id: string;
  modulo: ArquivosModule;
  folder_drive_file_id: string;
  rotulo: string;
  ordem: number;
  folder_titulo?: string;
  folder_categoria?: string;
}
