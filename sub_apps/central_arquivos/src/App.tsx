import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  ArrowDown,
  ArrowUpDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Folder,
  GripVertical,
  Image as ImageIcon,
  MoreVertical,
  RefreshCw,
  Search,
  Video,
} from 'lucide-react';
import { arquivosService } from './api/arquivosService';
import type {
  AppUser,
  ArquivoItem,
  ArquivoListResult,
  ArquivoShortcut,
  ArquivosModule,
} from './types';

const FETCH_PAGE_SIZE = 2000;
const PAGE_SIZE = 15;
const MAX_PAGE_BUTTONS = 10;
const GLOBAL_SEARCH_MIN_CHARS = 2;
const SORT_STORAGE_PREFIX = 'central_arquivos.sort';

const MODULE_META: Record<
  ArquivosModule,
  {
    title: string;
    route: string;
    description: string;
    supportEmail: string;
    supportPhone: string;
  }
> = {
  udocs: {
    title: 'UDocs',
    route: '/udocs/dashboard',
    description: 'Biblioteca digital institucional com organização em pastas, prévia e download auditado.',
    supportEmail: 'uniodonto.br@uniodonto.coop.br',
    supportPhone: 'WhatsApp: +55 (11) 5572-8111',
  },
  umarketing: {
    title: 'UMkt',
    route: '/umarketing/dashboard',
    description: 'Repositório de materiais institucionais com galeria de imagens e vídeos.',
    supportEmail: 'uniodonto.br@uniodonto.coop.br',
    supportPhone: 'WhatsApp: +55 (11) 5572-8111',
  },
};

type ViewMode = 'documentos' | 'galeria';
type GalleryFilter = 'all' | 'images' | 'videos' | 'brands';
type SortColumn = 'ordem_manual' | 'titulo' | 'criado_em' | 'relevance';
type SortDirection = 'asc' | 'desc';
type ContextMenuState = {
  x: number;
  y: number;
  item: ArquivoItem;
};

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const level = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** level;
  return `${value.toFixed(value >= 10 || level === 0 ? 0 : 1)} ${units[level]}`;
};

const normalizeComparable = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const getDriveId = (item: ArquivoItem) => String(item.drive_file_id || item.id || '').trim();
const getParentDriveId = (item: ArquivoItem) => String(item.parent_drive_file_id || '').trim() || null;
const isFolder = (item: ArquivoItem) => item.item_tipo === 'pasta';

const isImageMime = (mimeType: string) => String(mimeType || '').toLowerCase().startsWith('image/');
const isVideoMime = (mimeType: string) => String(mimeType || '').toLowerCase().startsWith('video/');
const isMediaFile = (item: ArquivoItem) => !isFolder(item) && (isImageMime(item.mime_type) || isVideoMime(item.mime_type));

const isBrandLike = (item: ArquivoItem) => {
  const base = `${item.titulo} ${item.categoria}`;
  const normalized = normalizeComparable(base);
  return normalized.includes('marca') || normalized.includes('brand');
};

const formatDate = (value?: string) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('pt-BR');
};

const formatTime = (value?: string) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const formatDateTime = (value?: string) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getSearchMatchSourceLabel = (value?: string | null) => {
  const normalized = normalizeComparable(String(value || ''));
  if (normalized === 'titulo') return 'Match em título';
  if (normalized === 'metadado') return 'Match em metadados';
  if (normalized === 'conteudo') return 'Match em conteúdo';
  return 'Match geral';
};

const isValidSortColumn = (value: string): value is SortColumn =>
  value === 'ordem_manual' || value === 'titulo' || value === 'criado_em' || value === 'relevance';

const isValidSortDirection = (value: string): value is SortDirection =>
  value === 'asc' || value === 'desc';

const getPreviewMode = (mimeType: string): 'image' | 'video' | 'iframe' | 'office' | 'fallback' => {
  const normalized = String(mimeType || '').toLowerCase();
  if (!normalized) return 'fallback';
  if (normalized.startsWith('image/')) return 'image';
  if (normalized.startsWith('video/')) return 'video';
  if (normalized.startsWith('application/vnd.google-apps.')) return 'iframe';
  if (
    normalized.includes('pdf') ||
    normalized.startsWith('text/') ||
    normalized.includes('json') ||
    normalized.includes('xml')
  ) {
    return 'iframe';
  }
  if (
    normalized.includes('msword') ||
    normalized.includes('wordprocessingml') ||
    normalized.includes('ms-excel') ||
    normalized.includes('spreadsheetml') ||
    normalized.includes('ms-powerpoint') ||
    normalized.includes('presentationml') ||
    normalized.includes('opendocument')
  ) {
    return 'office';
  }
  return 'fallback';
};

const getGoogleDocsViewerUrl = (url: string) =>
  `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`;

export default function App() {
  const module = useMemo(() => arquivosService.getModule(), []);
  const moduleMeta = MODULE_META[module];

  const [sourceResult, setSourceResult] = useState<ArquivoListResult>({
    items: [],
    total: 0,
    categorias: [],
    anos: [],
    source: 'mock',
  });
  const [user, setUser] = useState<AppUser | null>(null);
  const [shortcuts, setShortcuts] = useState<ArquivoShortcut[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isGlobalSearching, setIsGlobalSearching] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('documentos');
  const [galleryFilter, setGalleryFilter] = useState<GalleryFilter>('all');

  const [query, setQuery] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [anoFiltro, setAnoFiltro] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn>('ordem_manual');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [previewing, setPreviewing] = useState<ArquivoItem | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [globalSearchResult, setGlobalSearchResult] = useState<ArquivoListResult | null>(null);

  const canManage = user?.papel === 'admin' || user?.papel === 'confederacao';
  const menuRef = useRef<HTMLDivElement | null>(null);
  const globalSearchRequestId = useRef(0);
  const isGlobalSearchActive = debouncedQuery.length >= GLOBAL_SEARCH_MIN_CHARS;
  const sortStorageKey = useMemo(() => `${SORT_STORAGE_PREFIX}.${module}`, [module]);

  const loadRepository = async () => {
    setIsLoading(true);
    try {
      const data = await arquivosService.list({
        q: '',
        categoria: '',
        ano: '',
        page: 1,
        page_size: FETCH_PAGE_SIZE,
      });
      setSourceResult(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao carregar repositório';
      setStatus({ type: 'error', message });
    } finally {
      setIsLoading(false);
    }
  };

  const loadShortcuts = async () => {
    const data = await arquivosService.listShortcuts();
    setShortcuts(data);
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = `${moduleMeta.title} | UHub`;
    }
  }, [moduleMeta.title]);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      const [currentUser] = await Promise.all([
        arquivosService.getCurrentUser(),
        loadRepository(),
      ]);
      if (mounted) setUser(currentUser);
      await loadShortcuts();
    };

    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewing(null);
        setContextMenu(null);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  useEffect(() => {
    const closeContextMenu = (event: MouseEvent) => {
      if (!contextMenu) return;
      if (menuRef.current && event.target instanceof Node && menuRef.current.contains(event.target)) return;
      setContextMenu(null);
    };
    window.addEventListener('click', closeContextMenu);
    return () => window.removeEventListener('click', closeContextMenu);
  }, [contextMenu]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem(sortStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { column?: string; direction?: string } | null;
      const parsedColumn = String(parsed?.column || '');
      const parsedDirection = String(parsed?.direction || '');
      if (isValidSortColumn(parsedColumn)) setSortColumn(parsedColumn);
      if (isValidSortDirection(parsedDirection)) setSortDirection(parsedDirection);
    } catch {
      // ignore malformed data and keep defaults
    }
  }, [sortStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(
      sortStorageKey,
      JSON.stringify({ column: sortColumn, direction: sortDirection }),
    );
  }, [sortStorageKey, sortColumn, sortDirection]);

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 260);
    return () => globalThis.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < GLOBAL_SEARCH_MIN_CHARS) {
      globalSearchRequestId.current += 1;
      setIsGlobalSearching(false);
      setGlobalSearchResult(null);
      return;
    }

    const requestId = ++globalSearchRequestId.current;
    setIsGlobalSearching(true);
    arquivosService
      .searchGlobal({
        q,
        categoria: categoriaFiltro,
        ano: anoFiltro,
        page: 1,
        page_size: FETCH_PAGE_SIZE,
      })
      .then((result) => {
        if (requestId !== globalSearchRequestId.current) return;
        setGlobalSearchResult(result);
      })
      .catch((error) => {
        if (requestId !== globalSearchRequestId.current) return;
        const message = error instanceof Error ? error.message : 'Falha na busca global';
        setStatus({ type: 'error', message });
      })
      .finally(() => {
        if (requestId === globalSearchRequestId.current) {
          setIsGlobalSearching(false);
        }
      });
  }, [debouncedQuery, categoriaFiltro, anoFiltro]);

  useEffect(() => {
    if (isGlobalSearchActive) {
      if (currentFolderId) setCurrentFolderId(null);
      if (sortColumn === 'ordem_manual') {
        setSortColumn('relevance');
        setSortDirection('desc');
      }
      return;
    }
    if (sortColumn === 'relevance') {
      setSortColumn('ordem_manual');
      setSortDirection('asc');
    }
  }, [isGlobalSearchActive, currentFolderId, sortColumn]);

  const items = useMemo(
    () =>
      isGlobalSearchActive
        ? globalSearchResult?.items || []
        : sourceResult.items || [],
    [isGlobalSearchActive, globalSearchResult?.items, sourceResult.items],
  );

  const repositoryItems = useMemo(() => sourceResult.items || [], [sourceResult.items]);

  const folderMap = useMemo(() => {
    const map = new Map<string, ArquivoItem>();
    for (const item of repositoryItems) {
      if (!isFolder(item)) continue;
      const driveId = getDriveId(item);
      if (!driveId) continue;
      map.set(driveId, item);
    }
    return map;
  }, [repositoryItems]);

  useEffect(() => {
    if (!currentFolderId) return;
    if (!folderMap.has(currentFolderId)) {
      setCurrentFolderId(null);
    }
  }, [currentFolderId, folderMap]);

  const folderHasMedia = useMemo(() => {
    const set = new Set<string>();
    for (const item of repositoryItems) {
      if (!isMediaFile(item)) continue;
      let cursor = getParentDriveId(item);
      const guard = new Set<string>();
      while (cursor && !guard.has(cursor)) {
        guard.add(cursor);
        set.add(cursor);
        const parentFolder = folderMap.get(cursor);
        cursor = parentFolder ? getParentDriveId(parentFolder) : null;
      }
    }
    return set;
  }, [repositoryItems, folderMap]);

  const availableCategorias = useMemo(() => {
    if (!isGlobalSearchActive) return sourceResult.categorias;
    return globalSearchResult?.categorias?.length ? globalSearchResult.categorias : sourceResult.categorias;
  }, [isGlobalSearchActive, globalSearchResult?.categorias, sourceResult.categorias]);

  const availableAnos = useMemo(() => {
    if (!isGlobalSearchActive) return sourceResult.anos;
    return globalSearchResult?.anos?.length ? globalSearchResult.anos : sourceResult.anos;
  }, [isGlobalSearchActive, globalSearchResult?.anos, sourceResult.anos]);

  const currentFolder = useMemo(() => {
    if (!currentFolderId) return null;
    return folderMap.get(currentFolderId) || null;
  }, [currentFolderId, folderMap]);

  const breadcrumb = useMemo(() => {
    const chain: ArquivoItem[] = [];
    if (!currentFolder) return chain;
    const seen = new Set<string>();
    let cursor: ArquivoItem | null = currentFolder;
    while (cursor) {
      const driveId = getDriveId(cursor);
      if (!driveId || seen.has(driveId)) break;
      seen.add(driveId);
      chain.unshift(cursor);
      const parentId = getParentDriveId(cursor);
      cursor = parentId ? folderMap.get(parentId) || null : null;
    }
    return chain;
  }, [currentFolder, folderMap]);

  const shortcutByFolder = useMemo(() => {
    const map = new Map<string, ArquivoShortcut>();
    shortcuts.forEach((shortcut) => {
      map.set(String(shortcut.folder_drive_file_id || '').trim(), shortcut);
    });
    return map;
  }, [shortcuts]);

  const filteredItems = useMemo(() => {
    if (isGlobalSearchActive) return items;
    const normalizedQuery = normalizeComparable(query);
    return items.filter((item) => {
      const text = `${item.titulo} ${item.categoria} ${item.mime_type}`;
      const matchesQuery = !normalizedQuery || normalizeComparable(text).includes(normalizedQuery);
      if (!matchesQuery) return false;

      if (categoriaFiltro && item.categoria !== categoriaFiltro) return false;
      if (anoFiltro && Number(item.ano) !== Number(anoFiltro)) return false;
      return true;
    });
  }, [isGlobalSearchActive, items, query, categoriaFiltro, anoFiltro]);

  const childrenInCurrentFolder = useMemo(() => {
    if (isGlobalSearchActive) return filteredItems;
    const targetParent = currentFolderId || null;
    return filteredItems.filter((item) => {
      const parent = getParentDriveId(item);
      return (parent || null) === targetParent;
    });
  }, [isGlobalSearchActive, filteredItems, currentFolderId]);

  const sortRows = (rows: ArquivoItem[]) => {
    return [...rows].sort((a, b) => {
      const getCreatedAtValue = (item: ArquivoItem) =>
        new Date(item.criado_em || item.atualizado_em || 0).getTime() || 0;
      const getManualOrderValue = (item: ArquivoItem) =>
        Number.isFinite(Number(item.ordem_manual)) ? Number(item.ordem_manual) : Number.MAX_SAFE_INTEGER;
      const getRelevanceValue = (item: ArquivoItem) =>
        Number.isFinite(Number(item.relevance_score)) ? Number(item.relevance_score) : 0;

      let comparison = 0;
      if (sortColumn === 'ordem_manual') {
        comparison = getManualOrderValue(a) - getManualOrderValue(b);
      } else if (sortColumn === 'titulo') {
        comparison = String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR');
      } else if (sortColumn === 'criado_em') {
        comparison = getCreatedAtValue(a) - getCreatedAtValue(b);
      } else if (sortColumn === 'relevance') {
        comparison = getRelevanceValue(a) - getRelevanceValue(b);
      }

      if (comparison !== 0) {
        return sortDirection === 'asc' ? comparison : -comparison;
      }
      if (a.item_tipo !== b.item_tipo) return a.item_tipo === 'pasta' ? -1 : 1;
      return String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR');
    });
  };

  const handleSort = (column: SortColumn) => {
    setCurrentPage(1);
    setSortColumn((current) => {
      if (current === column) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        return current;
      }
      setSortDirection(column === 'relevance' ? 'desc' : 'asc');
      return column;
    });
  };

  const renderSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return <ArrowUpDown size={13} />;
    return sortDirection === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />;
  };

  const getSortAria = (column: SortColumn): 'none' | 'ascending' | 'descending' =>
    sortColumn === column ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none';

  const documentRows = useMemo(() => {
    const rows = childrenInCurrentFolder.filter((item) => isFolder(item) || !isMediaFile(item));
    return sortRows(rows);
  }, [childrenInCurrentFolder, sortColumn, sortDirection]);

  const galleryRows = useMemo(() => {
    const rows = childrenInCurrentFolder.filter((item) => {
      if (isFolder(item)) return folderHasMedia.has(getDriveId(item));
      return isMediaFile(item);
    });

    const filteredByGalleryType = rows.filter((item) => {
      if (galleryFilter === 'all') return true;
      if (galleryFilter === 'brands') return isBrandLike(item);
      if (isFolder(item)) {
        return true;
      }
      if (galleryFilter === 'images') return isImageMime(item.mime_type);
      if (galleryFilter === 'videos') return isVideoMime(item.mime_type);
      return true;
    });

    return sortRows(filteredByGalleryType);
  }, [childrenInCurrentFolder, folderHasMedia, galleryFilter, sortColumn, sortDirection]);

  const activeRows = viewMode === 'documentos' ? documentRows : galleryRows;
  const totalPages = Math.max(1, Math.ceil(activeRows.length / PAGE_SIZE));
  const loadingRows = isLoading || isGlobalSearching;

  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode, query, categoriaFiltro, anoFiltro, currentFolderId, galleryFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return activeRows.slice(start, start + PAGE_SIZE);
  }, [activeRows, currentPage]);

  const pageNumbers = useMemo(() => {
    const start = Math.max(1, currentPage - Math.floor(MAX_PAGE_BUTTONS / 2));
    const end = Math.min(totalPages, start + MAX_PAGE_BUTTONS - 1);
    const adjustedStart = Math.max(1, end - MAX_PAGE_BUTTONS + 1);
    const pages: number[] = [];
    for (let value = adjustedStart; value <= end; value += 1) {
      pages.push(value);
    }
    return pages;
  }, [currentPage, totalPages]);

  const openFolder = (folder: ArquivoItem) => {
    const driveId = getDriveId(folder);
    if (!driveId) return;
    if (isGlobalSearchActive) {
      globalSearchRequestId.current += 1;
      setIsGlobalSearching(false);
      setGlobalSearchResult(null);
      setDebouncedQuery('');
      setQuery('');
      setSortColumn('ordem_manual');
      setSortDirection('asc');
    }
    setCurrentFolderId(driveId);
  };

  const openFromShortcut = (shortcut: ArquivoShortcut) => {
    const target = String(shortcut.folder_drive_file_id || '').trim();
    if (!target || !folderMap.has(target)) {
      setStatus({ type: 'error', message: `Atalho "${shortcut.rotulo}" não encontrado na sincronização atual.` });
      return;
    }
    setViewMode('documentos');
    setQuery('');
    setDebouncedQuery('');
    setGlobalSearchResult(null);
    setCategoriaFiltro('');
    setAnoFiltro('');
    setCurrentFolderId(target);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setStatus(null);
    try {
      const response = await arquivosService.triggerSync();
      await loadRepository();
      await loadShortcuts();
      setStatus({ type: 'success', message: String(response?.message || 'Sincronização concluída com sucesso.') });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao sincronizar';
      setStatus({ type: 'error', message });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReorder = async (item: ArquivoItem, direction: 'up' | 'down') => {
    setStatus(null);
    try {
      const response = await arquivosService.moveItem(item.id, direction);
      if (response?.ok === false) {
        setStatus({ type: 'error', message: String(response.reason || 'Não foi possível alterar a ordem.') });
        return;
      }
      await loadRepository();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao atualizar ordem do item';
      setStatus({ type: 'error', message });
    }
  };

  const openPreview = (item: ArquivoItem) => {
    setPreviewing(item);
  };

  const openDownload = (item: ArquivoItem) => {
    const url = arquivosService.getDownloadUrl(item);
    if (!url) {
      setStatus({ type: 'error', message: 'Arquivo sem URL de download.' });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openPreviewInNewTab = (item: ArquivoItem) => {
    const url = arquivosService.getPreviewUrl(item);
    if (!url) {
      setStatus({ type: 'error', message: 'Arquivo sem URL de prévia.' });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openFolderContextMenu = (event: ReactMouseEvent<HTMLElement>, item: ArquivoItem) => {
    if (!canManage || !isFolder(item)) return;
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      item,
    });
  };

  const handleShortcutUpsert = async (item: ArquivoItem) => {
    const folderId = getDriveId(item);
    if (!folderId) return;
    const existing = shortcutByFolder.get(folderId);
    const suggested = existing?.rotulo || item.titulo;
    const alias = window.prompt('Nome do atalho (somente o atalho será renomeado):', suggested);
    if (alias == null) {
      setContextMenu(null);
      return;
    }
    const trimmed = alias.trim();
    if (!trimmed) {
      setStatus({ type: 'error', message: 'Nome do atalho não pode ficar vazio.' });
      setContextMenu(null);
      return;
    }

    try {
      await arquivosService.upsertShortcut(folderId, trimmed);
      await loadShortcuts();
      setStatus({ type: 'success', message: `Atalho "${trimmed}" atualizado.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao salvar atalho';
      setStatus({ type: 'error', message });
    } finally {
      setContextMenu(null);
    }
  };

  const handleShortcutRemove = async (item: ArquivoItem) => {
    const folderId = getDriveId(item);
    if (!folderId) return;
    try {
      await arquivosService.removeShortcut(folderId);
      await loadShortcuts();
      setStatus({ type: 'success', message: 'Atalho removido.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao remover atalho';
      setStatus({ type: 'error', message });
    } finally {
      setContextMenu(null);
    }
  };

  return (
    <div className={`repo-page ${module === 'umarketing' ? 'theme-umarketing' : 'theme-udocs'}`}>
      <header className="repo-header">
        <div className="repo-tabs">
          <button
            type="button"
            className={viewMode === 'documentos' ? 'active' : ''}
            onClick={() => setViewMode('documentos')}
          >
            Documentos
          </button>
          <button
            type="button"
            className={viewMode === 'galeria' ? 'active' : ''}
            onClick={() => setViewMode('galeria')}
          >
            Galeria
          </button>
        </div>

        <label className="repo-search" htmlFor="udocs-search">
          <Search size={16} />
          <input
            id="udocs-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={viewMode === 'documentos'
              ? 'Busca global: documento, pasta ou conteúdo (sem OCR)'
              : 'Busca global: galeria, foto ou vídeo'}
          />
        </label>

        <div className="repo-header-actions">
          <span className="route-pill">{moduleMeta.route}</span>
          {canManage && (
            <button type="button" className="sync-btn" onClick={handleSync} disabled={isSyncing}>
              <RefreshCw size={15} className={isSyncing ? 'spin' : ''} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
          )}
        </div>
      </header>

      <section className="repository-card">
        <div className="repository-head">
          <div>
            <h1>{moduleMeta.title}</h1>
            <p>{moduleMeta.description}</p>
          </div>

          <div className="repository-filters">
            <select value={categoriaFiltro} onChange={(event) => setCategoriaFiltro(event.target.value)}>
              <option value="">Todas as categorias</option>
              {availableCategorias.map((categoria) => (
                <option key={categoria} value={categoria}>{categoria}</option>
              ))}
            </select>

            <select value={anoFiltro} onChange={(event) => setAnoFiltro(event.target.value)}>
              <option value="">Todos os anos</option>
              {availableAnos.map((ano) => (
                <option key={ano} value={String(ano)}>{ano}</option>
              ))}
            </select>
          </div>
        </div>

        {status && <div className={`status status--${status.type}`}>{status.message}</div>}

        {isGlobalSearchActive && (
          <div className="search-banner">
            <div>
              <strong>Busca global ativa</strong>
              <span>Sem OCR: título, metadados e conteúdo indexado no Google Drive.</span>
            </div>
            <em>{isGlobalSearching ? 'Buscando...' : `${globalSearchResult?.total || 0} resultado(s)`}</em>
          </div>
        )}

        {!isGlobalSearchActive && (
          <div className="folder-breadcrumb">
            <button type="button" onClick={() => setCurrentFolderId(null)} className={!currentFolderId ? 'active' : ''}>
              Raiz
            </button>
            {breadcrumb.map((item) => {
              const driveId = getDriveId(item);
              return (
                <span key={driveId}>
                  <ChevronRight size={14} />
                  <button type="button" onClick={() => setCurrentFolderId(driveId)} className={driveId === currentFolderId ? 'active' : ''}>
                    {item.titulo}
                  </button>
                </span>
              );
            })}
            {currentFolderId && (
              <button type="button" className="back-btn" onClick={() => {
                const parent = currentFolder ? getParentDriveId(currentFolder) : null;
                setCurrentFolderId(parent || null);
              }}>
                <ChevronLeft size={14} /> Voltar
              </button>
            )}
          </div>
        )}

        {viewMode === 'documentos' ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th aria-sort={getSortAria(isGlobalSearchActive ? 'relevance' : 'ordem_manual')}>
                      <button
                        type="button"
                        className={`th-sort-btn ${sortColumn === (isGlobalSearchActive ? 'relevance' : 'ordem_manual') ? 'active' : ''}`}
                        onClick={() => handleSort(isGlobalSearchActive ? 'relevance' : 'ordem_manual')}
                        aria-label={isGlobalSearchActive ? 'Ordenar por relevância' : 'Ordenar por posição'}
                      >
                        {isGlobalSearchActive ? 'Relevância' : '#'}
                        {renderSortIcon(isGlobalSearchActive ? 'relevance' : 'ordem_manual')}
                      </button>
                    </th>
                    <th aria-sort={getSortAria('titulo')}>
                      <button
                        type="button"
                        className={`th-sort-btn ${sortColumn === 'titulo' ? 'active' : ''}`}
                        onClick={() => handleSort('titulo')}
                        aria-label="Ordenar por nome"
                      >
                        Pasta / Arquivo
                        {renderSortIcon('titulo')}
                      </button>
                    </th>
                    <th aria-sort={getSortAria('criado_em')}>
                      <button
                        type="button"
                        className={`th-sort-btn ${sortColumn === 'criado_em' ? 'active' : ''}`}
                        onClick={() => handleSort('criado_em')}
                        aria-label="Ordenar por data de criação"
                      >
                        Criado em
                        {renderSortIcon('criado_em')}
                      </button>
                    </th>
                    <th>Prévia</th>
                    <th>Download</th>
                    <th>Organizar</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingRows ? (
                    <tr>
                      <td colSpan={6} className="empty-state">
                        {isGlobalSearchActive ? 'Buscando em todo o acervo...' : 'Carregando...'}
                      </td>
                    </tr>
                  ) : pagedRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="empty-state">
                        {isGlobalSearchActive
                          ? 'Nenhum resultado para essa busca global com os filtros atuais.'
                          : 'Nenhum item encontrado nesta pasta com os filtros atuais.'}
                      </td>
                    </tr>
                  ) : (
                    pagedRows.map((item, index) => {
                      const rowNumber = (currentPage - 1) * PAGE_SIZE + index + 1;
                      const relevance = Math.max(0, Math.round(Number(item.relevance_score || 0)));
                      const createdAt = item.criado_em || item.atualizado_em;
                      const isShortcut = shortcutByFolder.has(getDriveId(item));
                      return (
                        <tr
                          key={item.id}
                          onDoubleClick={() => {
                            if (isFolder(item)) openFolder(item);
                          }}
                          onContextMenu={(event) => openFolderContextMenu(event, item)}
                          className={isFolder(item) ? 'folder-row' : ''}
                        >
                          <td className="row-index">{isGlobalSearchActive ? relevance : rowNumber}</td>
                          <td>
                            <div className="name-cell">
                              {isFolder(item) ? <Folder size={17} /> : <FileText size={17} />}
                              <div>
                                <strong>{item.titulo}</strong>
                                <small>
                                  {isFolder(item) ? 'Pasta' : item.categoria}
                                  {isShortcut && ' · Atalho ativo'}
                                </small>
                                {isGlobalSearchActive && (
                                  <small className="search-meta">
                                    {getSearchMatchSourceLabel(item.match_source)} · score {relevance}
                                  </small>
                                )}
                                {isGlobalSearchActive && !isFolder(item) && item.snippet && (
                                  <small className="search-snippet">{item.snippet}</small>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="date-cell">{formatDate(createdAt)}</span>
                            <span className="time-cell">{formatTime(createdAt)}</span>
                          </td>
                          <td>
                            {isFolder(item) ? (
                              <button type="button" className="line-btn" onClick={() => openFolder(item)}>
                                Abrir pasta
                              </button>
                            ) : (
                              <button type="button" className="line-btn preview-line-btn" onClick={() => openPreview(item)} aria-label="Prévia">
                                <Eye size={15} />
                                Prévia
                              </button>
                            )}
                          </td>
                          <td>
                            {isFolder(item) ? (
                              <span className="muted">--</span>
                            ) : (
                              <button type="button" className="icon-btn download" onClick={() => openDownload(item)} aria-label="Download">
                                <Download size={14} />
                              </button>
                            )}
                          </td>
                          <td>
                            <div className="arrange-actions">
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() => handleReorder(item, 'up')}
                                disabled={!canManage}
                                aria-label="Mover para cima"
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() => handleReorder(item, 'down')}
                                disabled={!canManage}
                                aria-label="Mover para baixo"
                              >
                                <ArrowDown size={14} />
                              </button>
                              {canManage && isFolder(item) && (
                                <button
                                  type="button"
                                  className="icon-btn"
                                  onClick={(event) => openFolderContextMenu(event, item)}
                                  aria-label="Mais ações"
                                >
                                  <MoreVertical size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <footer className="table-footer">
              <span>
                {PAGE_SIZE} itens por página
                {isGlobalSearchActive ? ' · busca global' : ''}
              </span>
              <div className="pagination">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft size={14} />
                </button>
                {pageNumbers.map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={page === currentPage ? 'active' : ''}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </footer>
          </>
        ) : (
          <>
            <div className="gallery-toolbar">
              <button
                type="button"
                className={galleryFilter === 'all' ? 'active' : ''}
                onClick={() => setGalleryFilter('all')}
              >
                Todas
              </button>
              <button
                type="button"
                className={galleryFilter === 'images' ? 'active' : ''}
                onClick={() => setGalleryFilter('images')}
              >
                Fotos
              </button>
              <button
                type="button"
                className={galleryFilter === 'videos' ? 'active' : ''}
                onClick={() => setGalleryFilter('videos')}
              >
                Vídeos
              </button>
              <button
                type="button"
                className={galleryFilter === 'brands' ? 'active' : ''}
                onClick={() => setGalleryFilter('brands')}
              >
                Galerias de marcas
              </button>
            </div>

            <div className="gallery-grid">
              {loadingRows ? (
                <div className="gallery-empty">
                  {isGlobalSearchActive ? 'Buscando resultados da galeria...' : 'Carregando galeria...'}
                </div>
              ) : galleryRows.length === 0 ? (
                <div className="gallery-empty">
                  {isGlobalSearchActive
                    ? 'Nenhum item de galeria encontrado para esta busca global.'
                    : 'Sem fotos, vídeos ou pastas de galeria nesta pasta.'}
                </div>
              ) : (
                galleryRows.map((item) => {
                  const previewUrl = arquivosService.getPreviewUrl(item);
                  return (
                    <article
                      key={item.id}
                      className={`gallery-card ${isFolder(item) ? 'gallery-folder' : ''}`}
                      onDoubleClick={() => {
                        if (isFolder(item)) openFolder(item);
                      }}
                    >
                      <header>
                        <div className="gallery-title">
                          {isFolder(item) ? (
                            <Folder size={16} />
                          ) : isImageMime(item.mime_type) ? (
                            <ImageIcon size={16} />
                          ) : (
                            <Video size={16} />
                          )}
                          <strong>{item.titulo}</strong>
                        </div>
                        <span>{formatDate(item.criado_em || item.atualizado_em)}</span>
                      </header>

                      {isFolder(item) ? (
                        <div className="gallery-folder-body">
                          <p>Abra para visualizar os conteúdos da galeria.</p>
                          <button type="button" className="line-btn" onClick={() => openFolder(item)}>
                            Abrir pasta
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="gallery-thumb">
                            {isImageMime(item.mime_type) && previewUrl ? (
                              <img src={previewUrl} alt={item.titulo} loading="lazy" />
                            ) : (
                              <div className="gallery-thumb-fallback">
                                {isVideoMime(item.mime_type) ? <Video size={26} /> : <ImageIcon size={26} />}
                              </div>
                            )}
                          </div>
                          <footer>
                            <button type="button" className="icon-btn eye" onClick={() => openPreview(item)}>
                              <Eye size={15} />
                            </button>
                            <button type="button" className="line-btn" onClick={() => openDownload(item)}>
                              <Download size={14} /> Download
                            </button>
                          </footer>
                        </>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </>
        )}
      </section>

      <section className="shortcuts-card">
        <div className="shortcuts-grid">
          <div>
            <h3>Atalhos</h3>
            <ul>
              {shortcuts.length === 0 ? (
                <li className="muted">Sem atalhos configurados.</li>
              ) : (
                shortcuts.map((shortcut) => (
                  <li key={shortcut.id}>
                    <button type="button" onClick={() => openFromShortcut(shortcut)}>
                      {shortcut.rotulo}
                    </button>
                  </li>
                ))
              )}
            </ul>
            {canManage && (
              <p className="hint">
                Dica admin: clique com o botão direito em uma pasta da tabela para criar ou remover atalhos.
              </p>
            )}
          </div>

          <div>
            <h3>Apoio</h3>
            <ul>
              <li>{moduleMeta.supportEmail}</li>
              <li>{moduleMeta.supportPhone}</li>
            </ul>
          </div>
        </div>
      </section>

      {contextMenu && (
        <div
          ref={menuRef}
          className="context-menu"
          style={{ top: Math.max(16, contextMenu.y), left: Math.max(16, contextMenu.x) }}
          role="menu"
        >
          <button type="button" onClick={() => handleShortcutUpsert(contextMenu.item)}>
            <GripVertical size={14} />
            {shortcutByFolder.has(getDriveId(contextMenu.item)) ? 'Editar atalho' : 'Adicionar atalho'}
          </button>
          {shortcutByFolder.has(getDriveId(contextMenu.item)) && (
            <button type="button" onClick={() => handleShortcutRemove(contextMenu.item)}>
              <GripVertical size={14} />
              Remover atalho
            </button>
          )}
        </div>
      )}

      {previewing && (
        <div className="preview-overlay" role="dialog" aria-modal="true">
          <div className="preview-modal">
            <header>
              <div>
                <h2>{previewing.titulo}</h2>
                <p>
                  {previewing.categoria} · {formatDateTime(previewing.criado_em || previewing.atualizado_em)} · {formatBytes(previewing.tamanho_bytes)}
                </p>
              </div>
              <div className="preview-actions">
                <button type="button" onClick={() => openPreviewInNewTab(previewing)}>Abrir em nova aba</button>
                <button type="button" onClick={() => setPreviewing(null)}>Fechar</button>
              </div>
            </header>

            <div className="preview-body">
              {(() => {
                const previewMode = getPreviewMode(previewing.mime_type);
                const previewUrl = arquivosService.getPreviewUrl(previewing);
                if (!previewUrl) {
                  return (
                    <div className="preview-empty">
                      <p>Prévia indisponível para este arquivo.</p>
                      <button type="button" onClick={() => openDownload(previewing)}>
                        Download
                      </button>
                    </div>
                  );
                }

                if (previewMode === 'video') return <video controls src={previewUrl} />;
                if (previewMode === 'image') return <img src={previewUrl} alt={previewing.titulo} className="preview-image" />;
                if (previewMode === 'iframe') return <iframe title={previewing.titulo} src={previewUrl} />;
                if (previewMode === 'office') {
                  return <iframe title={previewing.titulo} src={getGoogleDocsViewerUrl(previewUrl)} />;
                }

                return (
                  <div className="preview-empty">
                    <p>Não foi possível exibir este tipo de arquivo.</p>
                    <button type="button" onClick={() => openDownload(previewing)}>
                      Abrir arquivo
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
