import { apiRequest, API_BASE_URL, getAuthToken } from './client';
import { MOCK_ARQUIVOS } from '../data/mock';
import type {
  AppUser,
  ArquivoItem,
  ArquivoListFilters,
  ArquivoListResult,
  ArquivoShortcut,
  ArquivosModule,
} from '../types';

const MODULE_QUERY_KEY = 'module';
const MODULE_DEFAULT: ArquivosModule = 'udocs';
const API_BASE_BY_MODULE: Record<ArquivosModule, string> = {
  udocs: '/udocs/assets',
  umarketing: '/marketing/assets',
};

const normalizeString = (value: unknown) => String(value ?? '').trim();

const resolveArquivosModule = (): ArquivosModule => {
  try {
    if (typeof window === 'undefined') return MODULE_DEFAULT;
    const value = new URLSearchParams(window.location.search).get(MODULE_QUERY_KEY);
    if (String(value || '').trim().toLowerCase() === 'umarketing') {
      return 'umarketing';
    }
    return 'udocs';
  } catch {
    return MODULE_DEFAULT;
  }
};

const getModuleApiBase = () => API_BASE_BY_MODULE[resolveArquivosModule()];

const inferItemTipo = (titulo: string, mimeType: string): 'pasta' | 'arquivo' => {
  const mime = String(mimeType || '').toLowerCase();
  if (mime === 'application/vnd.google-apps.folder' || mime.includes('folder')) {
    return 'pasta';
  }
  if (mime && mime !== 'application/octet-stream') {
    return 'arquivo';
  }
  const normalizedTitle = String(titulo || '').trim();
  if (!/^\[(\d+)\]\s+/i.test(normalizedTitle)) return 'arquivo';
  if (/\.[a-z0-9]{2,5}$/i.test(normalizedTitle)) return 'arquivo';
  return 'pasta';
};

const parseApiItem = (row: Record<string, unknown>): ArquivoItem => {
  const id = normalizeString(row.id || row.arquivo_id || row.drive_file_id);
  const driveFileId = normalizeString(row.drive_file_id || row.id || row.arquivo_id || id);
  const categoria = normalizeString(row.categoria || row.categoria_nome || 'Sem categoria');
  const titulo = normalizeString(row.titulo || row.name || row.nome || id);
  const anoRaw = Number(row.ano || row.ano_ref || new Date().getFullYear());
  const atualizado = normalizeString(row.atualizado_em || row.updated_at || row.modified_time || new Date().toISOString());
  const mimeType = normalizeString(row.mime_type || row.mimeType || 'application/octet-stream');
  const itemTipoRaw = normalizeString(row.item_tipo || row.tipo_item || '');
  return {
    id,
    drive_file_id: driveFileId || id,
    titulo,
    categoria,
    ano: Number.isFinite(anoRaw) ? anoRaw : new Date().getFullYear(),
    mime_type: mimeType,
    item_tipo: itemTipoRaw === 'pasta' || itemTipoRaw === 'arquivo' ? itemTipoRaw : inferItemTipo(titulo, mimeType),
    pasta_codigo: normalizeString(row.pasta_codigo || row.folder_code || '') || null,
    pasta_nome: normalizeString(row.pasta_nome || row.folder_name || '') || null,
    parent_drive_file_id: normalizeString(row.parent_drive_file_id || row.parent_id || '') || null,
    ordem_manual: Number(row.ordem_manual ?? row.order ?? 0) || null,
    tamanho_bytes: Number(row.tamanho_bytes || row.size || 0),
    criado_em: normalizeString(row.criado_em || row.created_at || row.drive_created_at || ''),
    atualizado_em: atualizado,
    preview_url: normalizeString(row.preview_url || row.web_view_link || ''),
    download_url: normalizeString(row.download_url || row.web_content_link || ''),
    snippet: normalizeString(row.snippet || ''),
    relevance_score: Number(row.relevance_score || 0) || 0,
    match_source: normalizeString(row.match_source || '') || null,
    source: 'api',
  };
};

const parseShortcutItem = (row: Record<string, unknown>): ArquivoShortcut => {
  const id = normalizeString(row.id || row.folder_drive_file_id);
  const module = resolveArquivosModule();
  return {
    id,
    modulo: module,
    folder_drive_file_id: normalizeString(row.folder_drive_file_id),
    rotulo: normalizeString(row.rotulo || row.label || row.folder_titulo || 'Atalho'),
    ordem: Number(row.ordem || 0),
    folder_titulo: normalizeString(row.folder_titulo || ''),
    folder_categoria: normalizeString(row.folder_categoria || ''),
  };
};

const applyMockFilters = (allItems: ArquivoItem[], filters: ArquivoListFilters) => {
  const q = filters.q.trim().toLowerCase();
  const yearNum = Number(filters.ano);

  let filtered = allItems;

  if (q) {
    filtered = filtered.filter((item) => {
      return (
        item.titulo.toLowerCase().includes(q) ||
        item.categoria.toLowerCase().includes(q) ||
        item.mime_type.toLowerCase().includes(q)
      );
    });
  }

  if (filters.categoria) {
    filtered = filtered.filter((item) => item.categoria === filters.categoria);
  }

  if (filters.ano && Number.isFinite(yearNum)) {
    filtered = filtered.filter((item) => item.ano === yearNum);
  }

  const total = filtered.length;
  const start = Math.max(0, (filters.page - 1) * filters.page_size);
  const paged = filtered.slice(start, start + filters.page_size);

  return {
    items: paged,
    total,
  };
};

const buildMockResult = (filters: ArquivoListFilters): ArquivoListResult => {
  const categories = Array.from(new Set(MOCK_ARQUIVOS.map((item) => item.categoria))).sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  );
  const years = Array.from(new Set(MOCK_ARQUIVOS.map((item) => item.ano))).sort((a, b) => b - a);
  const filtered = applyMockFilters(MOCK_ARQUIVOS, filters);

  return {
    ...filtered,
    categorias: categories,
    anos: years,
    source: 'mock',
  };
};

const getApiArquivoUrl = (
  arquivoId: string,
  mode: 'preview' | 'download',
) => {
  const token = getAuthToken();
  const query = new URLSearchParams();
  if (token) query.set('token', token);
  query.set(MODULE_QUERY_KEY, resolveArquivosModule());
  const base = getModuleApiBase();
  return `${API_BASE_URL}${base}/${encodeURIComponent(arquivoId)}/${mode}?${query.toString()}`;
};

const getMimeLabel = (mime: string) => {
  if (!mime) return 'Arquivo';
  if (mime.includes('pdf')) return 'PDF';
  if (mime.includes('video')) return 'Video';
  if (mime.includes('image')) return 'Imagem';
  if (mime.includes('presentation')) return 'Apresentacao';
  if (mime.includes('spreadsheet')) return 'Planilha';
  if (mime.includes('word') || mime.includes('document')) return 'Documento';
  return 'Arquivo';
};

export const arquivosService = {
  getModule(): ArquivosModule {
    return resolveArquivosModule();
  },

  async getCurrentUser(): Promise<AppUser | null> {
    try {
      const response = await apiRequest<{ user?: Record<string, unknown> }>('/auth/me');
      const user = response?.user;
      if (!user) return null;
      return {
        email: normalizeString(user.email),
        nome: normalizeString(user.nome || user.display_name || user.email),
        papel: normalizeString(user.papel || 'operador'),
      };
    } catch {
      return null;
    }
  },

  async list(filters: ArquivoListFilters): Promise<ArquivoListResult> {
    try {
      const params = new URLSearchParams();
      if (filters.q.trim()) params.set('q', filters.q.trim());
      if (filters.categoria) params.set('categoria', filters.categoria);
      if (filters.ano) params.set('ano', filters.ano);
      params.set('page', String(filters.page));
      params.set('page_size', String(filters.page_size));
      params.set(MODULE_QUERY_KEY, resolveArquivosModule());

      const query = params.toString();
      const response = await apiRequest<Record<string, unknown>>(
        `${getModuleApiBase()}${query ? `?${query}` : ''}`,
      );

      const rowsRaw = Array.isArray(response.items)
        ? response.items
        : Array.isArray(response.arquivos)
          ? response.arquivos
          : [];

      const items = rowsRaw
        .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'))
        .map((row) => parseApiItem(row));

      const total = Number(response.total || items.length);
      const categorias = Array.isArray(response.categorias)
        ? response.categorias.map((item) => normalizeString(item)).filter(Boolean)
        : Array.from(new Set(items.map((item) => item.categoria)));
      const anos = Array.isArray(response.anos)
        ? response.anos.map((item) => Number(item)).filter((item) => Number.isFinite(item))
        : Array.from(new Set(items.map((item) => item.ano)));

      return {
        items,
        total,
        categorias: categorias.sort((a, b) => a.localeCompare(b, 'pt-BR')),
        anos: anos.sort((a, b) => b - a),
        source: 'api',
      };
    } catch {
      return buildMockResult(filters);
    }
  },

  async searchGlobal(filters: ArquivoListFilters): Promise<ArquivoListResult> {
    try {
      const params = new URLSearchParams();
      if (filters.q.trim()) params.set('q', filters.q.trim());
      if (filters.categoria) params.set('categoria', filters.categoria);
      if (filters.ano) params.set('ano', filters.ano);
      params.set('page', String(filters.page));
      params.set('page_size', String(filters.page_size));
      params.set(MODULE_QUERY_KEY, resolveArquivosModule());

      const query = params.toString();
      const response = await apiRequest<Record<string, unknown>>(
        `${getModuleApiBase()}/search${query ? `?${query}` : ''}`,
      );

      const rowsRaw = Array.isArray(response.items)
        ? response.items
        : Array.isArray(response.arquivos)
          ? response.arquivos
          : [];

      const items = rowsRaw
        .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'))
        .map((row) => parseApiItem(row));

      const total = Number(response.total || items.length);
      const categorias = Array.isArray(response.categorias)
        ? response.categorias.map((item) => normalizeString(item)).filter(Boolean)
        : Array.from(new Set(items.map((item) => item.categoria)));
      const anos = Array.isArray(response.anos)
        ? response.anos.map((item) => Number(item)).filter((item) => Number.isFinite(item))
        : Array.from(new Set(items.map((item) => item.ano)));

      return {
        items,
        total,
        categorias: categorias.sort((a, b) => a.localeCompare(b, 'pt-BR')),
        anos: anos.sort((a, b) => b - a),
        source: 'api',
      };
    } catch {
      return buildMockResult(filters);
    }
  },

  async listShortcuts(): Promise<ArquivoShortcut[]> {
    try {
      const module = resolveArquivosModule();
      const response = await apiRequest<Record<string, unknown>>(
        `${getModuleApiBase()}/atalhos?${MODULE_QUERY_KEY}=${module}`,
      );
      const rowsRaw = Array.isArray(response.items) ? response.items : [];
      return rowsRaw
        .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'))
        .map((row) => parseShortcutItem(row))
        .sort((a, b) => a.ordem - b.ordem);
    } catch {
      return [];
    }
  },

  async upsertShortcut(folderDriveFileId: string, rotulo: string) {
    const module = resolveArquivosModule();
    return apiRequest<Record<string, unknown>>(
      `${getModuleApiBase()}/atalhos?${MODULE_QUERY_KEY}=${module}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          module,
          folder_drive_file_id: folderDriveFileId,
          rotulo,
        }),
      },
    );
  },

  async removeShortcut(folderDriveFileId: string) {
    const module = resolveArquivosModule();
    return apiRequest<Record<string, unknown>>(
      `${getModuleApiBase()}/atalhos/${encodeURIComponent(folderDriveFileId)}?${MODULE_QUERY_KEY}=${module}`,
      { method: 'DELETE' },
    );
  },

  async moveItem(itemId: string, direction: 'up' | 'down') {
    const module = resolveArquivosModule();
    return apiRequest<Record<string, unknown>>(
      `${getModuleApiBase()}/${encodeURIComponent(itemId)}/move?${MODULE_QUERY_KEY}=${module}`,
      {
        method: 'POST',
        body: JSON.stringify({ module, direction }),
      },
    );
  },

  getPreviewUrl(item: ArquivoItem) {
    if (item.source === 'mock') {
      return item.preview_url || item.download_url || '';
    }
    return getApiArquivoUrl(item.id, 'preview');
  },

  getDownloadUrl(item: ArquivoItem) {
    if (item.source === 'mock') {
      return item.download_url || item.preview_url || '';
    }
    return getApiArquivoUrl(item.id, 'download');
  },

  async triggerSync() {
    return apiRequest<{ message?: string }>(
      `${getModuleApiBase()}/sync?${MODULE_QUERY_KEY}=${resolveArquivosModule()}`,
      {
        method: 'POST',
      },
    );
  },

  getMimeLabel,
};
