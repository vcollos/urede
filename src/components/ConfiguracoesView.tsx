import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Check, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { apiService } from '../services/apiService';
import type { CentralArquivosGoogleDriveCredentialStatus, CooperativaConfig, SystemSettings } from '../types';
import { useAuth } from '../contexts/AuthContext';

type ConfiguracoesModule = 'hub' | 'urede';
type HubCadastroKey = keyof SystemSettings['hub_cadastros'];

interface ConfiguracoesViewProps {
  module: ConfiguracoesModule;
}

const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  theme: 'light',
  deadlines: {
    singularToFederacao: 30,
    federacaoToConfederacao: 30,
  },
  requireApproval: true,
  autoNotifyManagers: true,
  enableSelfRegistration: true,
  pedido_motivos: [],
  hub_cadastros: {
    tipos_endereco: ['Sede', 'Filial', 'Núcleo', 'Clínica', 'Ponto de Venda', 'Plantão de Urgência & Emergência', 'Atendimento'],
    tipos_conselho: ['Fiscal', 'Administrativo', 'Técnico'],
    tipos_contato: ['E-mail', 'Telefone', 'Website', 'Rede social', 'Outro'],
    subtipos_contato: [
      'LGPD',
      'Plantão',
      'Geral',
      'Emergência',
      'Divulgação',
      'Comercial PF',
      'Comercial PJ',
      'Institucional',
      'Portal do Prestador',
      'Portal do Cliente',
      'Portal da Empresa',
      'Portal do Corretor',
      'E-Commerce',
      'Portal do Cooperado',
    ],
    redes_sociais: ['Instagram', 'Facebook', 'LinkedIn', 'YouTube', 'TikTok', 'X'],
    departamentos: ['INTERCÂMBIO', 'COMERCIAL', 'ATENDIMENTO', 'FINANCEIRO'],
  },
};

const HUB_CADASTRO_SECTIONS: Array<{
  key: HubCadastroKey;
  title: string;
  description: string;
  placeholder: string;
}> = [
  {
    key: 'tipos_endereco',
    title: 'Tipos de endereço',
    description: 'Lista usada no cadastro de Endereços das cooperativas e no fluxo de urgência/emergência.',
    placeholder: 'Ex.: Sede',
  },
  {
    key: 'tipos_conselho',
    title: 'Tipos de conselho',
    description: 'Lista usada no cadastro de Conselhos.',
    placeholder: 'Ex.: Consultivo',
  },
  {
    key: 'tipos_contato',
    title: 'Tipos de contato',
    description: 'Lista usada no cadastro de Contatos.',
    placeholder: 'Ex.: WhatsApp',
  },
  {
    key: 'subtipos_contato',
    title: 'Subtipos de contato',
    description: 'Lista usada para organizar contatos por finalidade (LGPD, plantão, divulgação etc.).',
    placeholder: 'Ex.: Comercial PF',
  },
  {
    key: 'redes_sociais',
    title: 'Redes sociais',
    description: 'Lista usada para seleção da rede social no cadastro de contatos (usuário informa só a URL).',
    placeholder: 'Ex.: Instagram',
  },
  {
    key: 'departamentos',
    title: 'Departamentos',
    description: 'Lista usada no cadastro de Colaboradores (campo Departamento(s)).',
    placeholder: 'Ex.: INTERCÂMBIO',
  },
];

const createEmptyHubInputs = (): Record<HubCadastroKey, string> => ({
  tipos_endereco: '',
  tipos_conselho: '',
  tipos_contato: '',
  subtipos_contato: '',
  redes_sociais: '',
  departamentos: '',
});

const sanitizeList = (value: unknown, maxLength = 120): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const list: string[] = [];
  for (const item of value) {
    const normalized = String(item ?? '').replace(/\s+/g, ' ').trim();
    if (!normalized) continue;
    const safe = normalized.slice(0, maxLength);
    const key = safe.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(safe);
  }
  return list;
};

const parseHubCatalogInput = (value: unknown) =>
  String(value ?? '')
    .split(/[;,\n]/g)
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter((item) => item.length > 0);

const mergeCatalogValues = (current: string[], incoming: string[]) => {
  const merged = [...current];
  const seen = new Set(current.map((item) => item.toLowerCase()));
  for (const item of incoming) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
};

const cloneHubCadastros = (hubCadastros: SystemSettings['hub_cadastros']): SystemSettings['hub_cadastros'] => ({
  tipos_endereco: [...hubCadastros.tipos_endereco],
  tipos_conselho: [...hubCadastros.tipos_conselho],
  tipos_contato: [...hubCadastros.tipos_contato],
  subtipos_contato: [...hubCadastros.subtipos_contato],
  redes_sociais: [...hubCadastros.redes_sociais],
  departamentos: [...hubCadastros.departamentos],
});

const applyEditingHubItem = (
  target: SystemSettings['hub_cadastros'],
  editingHubItem: { key: HubCadastroKey; original: string; value: string } | null,
) => {
  if (!editingHubItem) return;
  const key = editingHubItem.key;
  const original = editingHubItem.original;
  const nextValue = editingHubItem.value.replace(/\s+/g, ' ').trim();
  const withoutOriginal = target[key].filter((item) => item !== original);

  if (!nextValue) {
    target[key] = withoutOriginal;
    return;
  }

  const duplicated = withoutOriginal.some((item) => item.toLowerCase() === nextValue.toLowerCase());
  target[key] = duplicated ? withoutOriginal : [...withoutOriginal, nextValue];
};

const buildHubCadastrosWithPendingInputs = (
  base: SystemSettings['hub_cadastros'],
  pendingInputs: Record<HubCadastroKey, string>,
  editingHubItem: { key: HubCadastroKey; original: string; value: string } | null,
): SystemSettings['hub_cadastros'] => {
  const nextHubCadastros = cloneHubCadastros(base);
  applyEditingHubItem(nextHubCadastros, editingHubItem);

  (Object.keys(pendingInputs) as HubCadastroKey[]).forEach((key) => {
    const tokens = parseHubCatalogInput(pendingInputs[key]);
    if (!tokens.length) return;
    nextHubCadastros[key] = mergeCatalogValues(nextHubCadastros[key], tokens);
  });

  return {
    tipos_endereco: sanitizeList(nextHubCadastros.tipos_endereco),
    tipos_conselho: sanitizeList(nextHubCadastros.tipos_conselho),
    tipos_contato: sanitizeList(nextHubCadastros.tipos_contato),
    subtipos_contato: sanitizeList(nextHubCadastros.subtipos_contato),
    redes_sociais: sanitizeList(nextHubCadastros.redes_sociais),
    departamentos: sanitizeList(nextHubCadastros.departamentos),
  };
};

const normalizeSystemSettings = (settings?: SystemSettings | null): SystemSettings => {
  const source = settings ?? DEFAULT_SYSTEM_SETTINGS;
  const hub = source.hub_cadastros ?? DEFAULT_SYSTEM_SETTINGS.hub_cadastros;

  const normalizedHub = {
    tipos_endereco: sanitizeList(hub.tipos_endereco).length
      ? sanitizeList(hub.tipos_endereco)
      : [...DEFAULT_SYSTEM_SETTINGS.hub_cadastros.tipos_endereco],
    tipos_conselho: sanitizeList(hub.tipos_conselho).length
      ? sanitizeList(hub.tipos_conselho)
      : [...DEFAULT_SYSTEM_SETTINGS.hub_cadastros.tipos_conselho],
    tipos_contato: sanitizeList(hub.tipos_contato).length
      ? sanitizeList(hub.tipos_contato)
      : [...DEFAULT_SYSTEM_SETTINGS.hub_cadastros.tipos_contato],
    subtipos_contato: sanitizeList(hub.subtipos_contato).length
      ? sanitizeList(hub.subtipos_contato)
      : [...DEFAULT_SYSTEM_SETTINGS.hub_cadastros.subtipos_contato],
    redes_sociais: sanitizeList(hub.redes_sociais).length
      ? sanitizeList(hub.redes_sociais)
      : [...DEFAULT_SYSTEM_SETTINGS.hub_cadastros.redes_sociais],
    departamentos: sanitizeList(hub.departamentos).length
      ? sanitizeList(hub.departamentos)
      : [...DEFAULT_SYSTEM_SETTINGS.hub_cadastros.departamentos],
  };

  return {
    theme: source.theme ?? DEFAULT_SYSTEM_SETTINGS.theme,
    deadlines: {
      singularToFederacao: Math.max(1, Number(source.deadlines?.singularToFederacao ?? DEFAULT_SYSTEM_SETTINGS.deadlines.singularToFederacao) || DEFAULT_SYSTEM_SETTINGS.deadlines.singularToFederacao),
      federacaoToConfederacao: Math.max(1, Number(source.deadlines?.federacaoToConfederacao ?? DEFAULT_SYSTEM_SETTINGS.deadlines.federacaoToConfederacao) || DEFAULT_SYSTEM_SETTINGS.deadlines.federacaoToConfederacao),
    },
    requireApproval: Boolean(source.requireApproval ?? DEFAULT_SYSTEM_SETTINGS.requireApproval),
    autoNotifyManagers: Boolean(source.autoNotifyManagers ?? DEFAULT_SYSTEM_SETTINGS.autoNotifyManagers),
    enableSelfRegistration: Boolean(source.enableSelfRegistration ?? DEFAULT_SYSTEM_SETTINGS.enableSelfRegistration),
    pedido_motivos: sanitizeList(source.pedido_motivos, 150),
    hub_cadastros: normalizedHub,
  };
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'não informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

const buildDriveFoldersForm = (
  status?: CentralArquivosGoogleDriveCredentialStatus | null,
) => ({
  drive_id: status?.drive?.drive_id ?? '',
  udocs_root_folder_id: status?.drive?.udocs_root_folder_id ?? 'root',
  umarketing_root_folder_id: status?.drive?.umarketing_root_folder_id ?? '',
});

export function ConfiguracoesView({ module }: ConfiguracoesViewProps) {
  const { user } = useAuth();

  const [theme, setTheme] = useState<SystemSettings['theme']>('light');
  const [deadlines, setDeadlines] = useState({
    singularToFederacao: '30',
    federacaoToConfederacao: '30',
  });
  const [requireApproval, setRequireApproval] = useState(true);
  const [autoNotifyManagers, setAutoNotifyManagers] = useState(true);
  const [enableSelfRegistration, setEnableSelfRegistration] = useState(true);
  const [pedidoMotivos, setPedidoMotivos] = useState<string[]>([]);
  const [novoMotivo, setNovoMotivo] = useState('');
  const [hubCadastros, setHubCadastros] = useState<SystemSettings['hub_cadastros']>(DEFAULT_SYSTEM_SETTINGS.hub_cadastros);
  const [hubInputs, setHubInputs] = useState<Record<HubCadastroKey, string>>(createEmptyHubInputs());
  const [editingHubItem, setEditingHubItem] = useState<{ key: HubCadastroKey; original: string; value: string } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [cooperativaConfig, setCooperativaConfig] = useState<CooperativaConfig | null>(null);
  const [isLoadingPermission, setIsLoadingPermission] = useState(false);
  const [driveCredentialStatus, setDriveCredentialStatus] = useState<CentralArquivosGoogleDriveCredentialStatus | null>(null);
  const [isLoadingDriveCredential, setIsLoadingDriveCredential] = useState(false);
  const [driveCredentialFeedback, setDriveCredentialFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [driveFoldersFeedback, setDriveFoldersFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedServiceAccount, setSelectedServiceAccount] = useState<Record<string, unknown> | null>(null);
  const [selectedServiceAccountFileName, setSelectedServiceAccountFileName] = useState('');
  const [serviceAccountInputKey, setServiceAccountInputKey] = useState(0);
  const [driveFoldersForm, setDriveFoldersForm] = useState(() => buildDriveFoldersForm());
  const [isSavingDriveCredential, setIsSavingDriveCredential] = useState(false);
  const [isDeletingDriveCredential, setIsDeletingDriveCredential] = useState(false);
  const [isSavingDriveFolders, setIsSavingDriveFolders] = useState(false);

  const moduleTitle = module === 'hub' ? 'Configurações do Hub' : 'Configurações do URede';
  const moduleDescription = module === 'hub'
    ? 'Cadastros globais reutilizáveis nos dados cadastrais do sistema.'
    : 'Parâmetros operacionais específicos do módulo URede.';

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        setStatus(null);
        const settings = normalizeSystemSettings(await apiService.getSystemSettings());
        setTheme(settings.theme);
        setDeadlines({
          singularToFederacao: settings.deadlines.singularToFederacao.toString(),
          federacaoToConfederacao: settings.deadlines.federacaoToConfederacao.toString(),
        });
        setRequireApproval(settings.requireApproval);
        setAutoNotifyManagers(settings.autoNotifyManagers);
        setEnableSelfRegistration(settings.enableSelfRegistration);
        setPedidoMotivos(settings.pedido_motivos ?? []);
        setHubCadastros(settings.hub_cadastros ?? DEFAULT_SYSTEM_SETTINGS.hub_cadastros);
      } catch (error) {
        console.error('Erro ao carregar configurações:', error);
        setStatus({ type: 'error', message: 'Não foi possível carregar as configurações atuais.' });
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    const canCheck = user?.papel === 'admin' && Boolean(user?.cooperativa_id);
    if (!canCheck || !user?.cooperativa_id) {
      setCooperativaConfig(null);
      setIsLoadingPermission(false);
      return;
    }

    let active = true;
    const run = async () => {
      try {
        setIsLoadingPermission(true);
        const config = await apiService.getCooperativaConfig(user.cooperativa_id);
        if (active) {
          setCooperativaConfig(config);
        }
      } catch (error) {
        console.error('Erro ao validar permissões de configuração:', error);
        if (active) {
          setCooperativaConfig(null);
        }
      } finally {
        if (active) {
          setIsLoadingPermission(false);
        }
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [user?.cooperativa_id, user?.papel]);

  useEffect(() => {
    if (module !== 'hub') {
      setDriveCredentialStatus(null);
      setDriveCredentialFeedback(null);
      setDriveFoldersFeedback(null);
      setSelectedServiceAccount(null);
      setSelectedServiceAccountFileName('');
      setDriveFoldersForm(buildDriveFoldersForm());
      setIsLoadingDriveCredential(false);
      return;
    }

    let active = true;
    const run = async () => {
      try {
        setIsLoadingDriveCredential(true);
        const response = await apiService.getCentralArquivosGoogleDriveCredentialStatus();
        if (active) {
          setDriveCredentialStatus(response);
          setDriveFoldersForm(buildDriveFoldersForm(response));
        }
      } catch (error) {
        if (!active) return;
        const errorStatus = typeof (error as { status?: unknown })?.status === 'number'
          ? Number((error as { status?: unknown }).status)
          : null;

        if (errorStatus === 403) {
          setDriveCredentialStatus(null);
          setDriveCredentialFeedback(null);
          setDriveFoldersFeedback(null);
          setDriveFoldersForm(buildDriveFoldersForm());
          return;
        }

        const message = error instanceof Error ? error.message : 'Não foi possível carregar as configurações do Google Drive.';
        setDriveCredentialFeedback({ type: 'error', message });
      } finally {
        if (active) {
          setIsLoadingDriveCredential(false);
        }
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [module, user?.email]);

  const isConfederacaoAdmin = Boolean(user?.papel === 'admin' && cooperativaConfig?.tipo === 'CONFEDERACAO');
  const awaitingPermissionCheck = Boolean(user?.papel === 'admin' && user?.cooperativa_id && isLoadingPermission && !cooperativaConfig);
  const canManageCentralArquivosCredential = Boolean(driveCredentialStatus?.can_manage) || isConfederacaoAdmin;
  const canAccessModuleSettings = module === 'hub'
    ? (isConfederacaoAdmin || canManageCentralArquivosCredential)
    : isConfederacaoAdmin;
  const awaitingHubPermissionCheck = module === 'hub'
    ? (!isConfederacaoAdmin && isLoadingDriveCredential)
    : false;

  const handleAddMotivo = () => {
    const trimmed = novoMotivo.trim();
    if (!trimmed) return;
    const exists = pedidoMotivos.some((motivo) => motivo.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setNovoMotivo('');
      return;
    }
    setPedidoMotivos((prev) => [...prev, trimmed]);
    setNovoMotivo('');
  };

  const handleRemoveMotivo = (motivo: string) => {
    setPedidoMotivos((prev) => prev.filter((item) => item !== motivo));
  };

  const handleAddHubCadastro = (key: HubCadastroKey) => {
    const tokens = parseHubCatalogInput(hubInputs[key]);
    if (!tokens.length) return;

    setHubCadastros((prev) => {
      return {
        ...prev,
        [key]: mergeCatalogValues(prev[key], tokens),
      };
    });

    setHubInputs((prev) => ({
      ...prev,
      [key]: '',
    }));
  };

  const handleRemoveHubCadastro = (key: HubCadastroKey, value: string) => {
    setHubCadastros((prev) => ({
      ...prev,
      [key]: prev[key].filter((item) => item !== value),
    }));
    if (editingHubItem && editingHubItem.key === key && editingHubItem.original === value) {
      setEditingHubItem(null);
    }
  };

  const handleStartEditHubCadastro = (key: HubCadastroKey, value: string) => {
    if (isSaving) return;
    setEditingHubItem({ key, original: value, value });
  };

  const handleCancelEditHubCadastro = () => {
    setEditingHubItem(null);
  };

  const handleSaveEditHubCadastro = () => {
    if (!editingHubItem) return;

    const key = editingHubItem.key;
    const original = editingHubItem.original;
    const nextValue = editingHubItem.value.replace(/\s+/g, ' ').trim();

    if (!nextValue) {
      handleRemoveHubCadastro(key, original);
      setEditingHubItem(null);
      return;
    }

    const unchanged = nextValue.toLowerCase() === original.toLowerCase();
    if (unchanged) {
      setEditingHubItem(null);
      return;
    }

    let duplicated = false;
    setHubCadastros((prev) => {
      const list = prev[key] ?? [];
      duplicated = list.some((item) => item.toLowerCase() === nextValue.toLowerCase() && item !== original);
      if (duplicated) return prev;
      return {
        ...prev,
        [key]: list.map((item) => (item === original ? nextValue : item)),
      };
    });

    if (duplicated) {
      setStatus({ type: 'error', message: 'Já existe um item com este nome nesta lista.' });
      return;
    }

    setEditingHubItem(null);
  };

  const handleServiceAccountFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Arquivo JSON inválido.');
      }
      setSelectedServiceAccount(parsed as Record<string, unknown>);
      setSelectedServiceAccountFileName(file.name);
      setDriveCredentialFeedback({
        type: 'success',
        message: 'Arquivo carregado. Clique em "Salvar credencial" para aplicar.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível ler o arquivo JSON.';
      setSelectedServiceAccount(null);
      setSelectedServiceAccountFileName('');
      setDriveCredentialFeedback({ type: 'error', message });
    }
  };

  const handleSaveDriveCredential = async () => {
    if (!selectedServiceAccount) {
      setDriveCredentialFeedback({
        type: 'error',
        message: 'Selecione um arquivo JSON de Service Account antes de salvar.',
      });
      return;
    }

    try {
      setIsSavingDriveCredential(true);
      setDriveCredentialFeedback(null);
      const response = await apiService.updateCentralArquivosGoogleDriveCredential(selectedServiceAccount);
      setDriveCredentialStatus(response);
      setDriveFoldersForm(buildDriveFoldersForm(response));
      setSelectedServiceAccount(null);
      setSelectedServiceAccountFileName('');
      setServiceAccountInputKey((prev) => prev + 1);
      setDriveCredentialFeedback({ type: 'success', message: 'Credencial salva com sucesso.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar a credencial.';
      setDriveCredentialFeedback({ type: 'error', message });
    } finally {
      setIsSavingDriveCredential(false);
    }
  };

  const handleDeleteDriveCredential = async () => {
    try {
      setIsDeletingDriveCredential(true);
      setDriveCredentialFeedback(null);
      const response = await apiService.deleteCentralArquivosGoogleDriveCredential();
      setDriveCredentialStatus(response);
      setDriveFoldersForm(buildDriveFoldersForm(response));
      setSelectedServiceAccount(null);
      setSelectedServiceAccountFileName('');
      setServiceAccountInputKey((prev) => prev + 1);
      setDriveCredentialFeedback({ type: 'success', message: 'Credencial removida com sucesso.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível remover a credencial.';
      setDriveCredentialFeedback({ type: 'error', message });
    } finally {
      setIsDeletingDriveCredential(false);
    }
  };

  const handleSaveDriveFolders = async () => {
    const driveId = driveFoldersForm.drive_id.trim();
    const udocsRootFolderId = driveFoldersForm.udocs_root_folder_id.trim();
    const umarketingRootFolderId = driveFoldersForm.umarketing_root_folder_id.trim();
    if (!driveId) {
      setDriveFoldersFeedback({
        type: 'error',
        message: 'Informe o Shared Drive ID (U-Hub).',
      });
      return;
    }
    if (!udocsRootFolderId) {
      setDriveFoldersFeedback({
        type: 'error',
        message: 'Informe a pasta raiz do UDocs.',
      });
      return;
    }
    if (!umarketingRootFolderId) {
      setDriveFoldersFeedback({
        type: 'error',
        message: 'Informe a pasta raiz do UMkt.',
      });
      return;
    }

    try {
      setIsSavingDriveFolders(true);
      setDriveFoldersFeedback(null);
      const response = await apiService.updateCentralArquivosGoogleDriveFolders({
        drive_id: driveId,
        udocs_root_folder_id: udocsRootFolderId,
        umarketing_root_folder_id: umarketingRootFolderId,
      });
      setDriveCredentialStatus(response);
      setDriveFoldersForm(buildDriveFoldersForm(response));
      setDriveFoldersFeedback({ type: 'success', message: 'Estrutura de pastas validada e salva com sucesso.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar a estrutura de pastas.';
      setDriveFoldersFeedback({ type: 'error', message });
    } finally {
      setIsSavingDriveFolders(false);
    }
  };

  const handleSave = async () => {
    if (!isConfederacaoAdmin) return;

    try {
      setIsSaving(true);
      setStatus(null);

      const nextHubCadastros = buildHubCadastrosWithPendingInputs(hubCadastros, hubInputs, editingHubItem);

      setHubCadastros(nextHubCadastros);
      setHubInputs(createEmptyHubInputs());
      setEditingHubItem(null);

      const payload: SystemSettings = {
        theme,
        deadlines: {
          singularToFederacao: Math.max(1, Number(deadlines.singularToFederacao) || 1),
          federacaoToConfederacao: Math.max(1, Number(deadlines.federacaoToConfederacao) || 1),
        },
        requireApproval,
        autoNotifyManagers,
        enableSelfRegistration,
        pedido_motivos: sanitizeList(pedidoMotivos, 150),
        hub_cadastros: nextHubCadastros,
      };

      const saved = normalizeSystemSettings(await apiService.updateSystemSettings(payload));
      setTheme(saved.theme);
      setDeadlines({
        singularToFederacao: saved.deadlines.singularToFederacao.toString(),
        federacaoToConfederacao: saved.deadlines.federacaoToConfederacao.toString(),
      });
      setRequireApproval(saved.requireApproval);
      setAutoNotifyManagers(saved.autoNotifyManagers);
      setEnableSelfRegistration(saved.enableSelfRegistration);
      setPedidoMotivos(saved.pedido_motivos ?? []);
      setHubCadastros(saved.hub_cadastros ?? DEFAULT_SYSTEM_SETTINGS.hub_cadastros);

      setStatus({ type: 'success', message: 'Preferências salvas com sucesso.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar as preferências';
      setStatus({ type: 'error', message });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{moduleTitle}</h1>
        <p className="text-gray-600 dark:text-slate-400">Carregando preferências atuais...</p>
      </div>
    );
  }

  if (awaitingPermissionCheck || awaitingHubPermissionCheck) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{moduleTitle}</h1>
          <p className="text-gray-600 dark:text-slate-400">{moduleDescription}</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Verificando permissões</CardTitle>
            <CardDescription>
              Aguarde um instante enquanto confirmamos os acessos disponíveis.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!canAccessModuleSettings) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{moduleTitle}</h1>
          <p className="text-gray-600 dark:text-slate-400">{moduleDescription}</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
            <CardDescription>
              {module === 'hub'
                ? 'Estas configurações podem ser acessadas apenas por Administradores da Confederação ou Administradores da Central.'
                : 'Estas configurações podem ser acessadas apenas por Administradores da Confederação.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{moduleTitle}</h1>
        <p className="text-gray-600 dark:text-slate-400">{moduleDescription}</p>
      </div>

      {module === 'urede' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Fluxo de aprovação</CardTitle>
              <CardDescription>Configure prazos e regras para movimentação entre níveis.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-slate-200" htmlFor="prazo-singular">
                    Singular → Federação (dias)
                  </label>
                  <Input
                    id="prazo-singular"
                    value={deadlines.singularToFederacao}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    onChange={(event) => setDeadlines((prev) => ({ ...prev, singularToFederacao: event.target.value }))}
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-slate-200" htmlFor="prazo-federacao">
                    Federação → Confederação (dias)
                  </label>
                  <Input
                    id="prazo-federacao"
                    value={deadlines.federacaoToConfederacao}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    onChange={(event) => setDeadlines((prev) => ({ ...prev, federacaoToConfederacao: event.target.value }))}
                    disabled={isSaving}
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900/60">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
                    checked={requireApproval}
                    onChange={(event) => setRequireApproval(event.target.checked)}
                    disabled={isSaving}
                  />
                  Exigir aprovação manual antes de liberar novos usuários
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
                    checked={autoNotifyManagers}
                    onChange={(event) => setAutoNotifyManagers(event.target.checked)}
                    disabled={isSaving}
                  />
                  Notificar automaticamente os responsáveis quando houver solicitações pendentes
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
                    checked={enableSelfRegistration}
                    onChange={(event) => setEnableSelfRegistration(event.target.checked)}
                    disabled={isSaving}
                  />
                  Permitir que novos usuários criem conta antes da aprovação
                </label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Categorias de pedidos</CardTitle>
              <CardDescription>Defina os motivos exibidos ao solicitar um novo pedido.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={novoMotivo}
                  onChange={(event) => setNovoMotivo(event.target.value)}
                  placeholder="Adicionar nova categoria"
                  className="flex-1"
                  disabled={isSaving}
                />
                <Button
                  type="button"
                  onClick={handleAddMotivo}
                  disabled={isSaving || !novoMotivo.trim()}
                >
                  Adicionar
                </Button>
              </div>
              {pedidoMotivos.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  Nenhuma categoria cadastrada. Inclua aqui os motivos que os solicitantes poderão escolher.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {pedidoMotivos.map((motivo) => (
                    <Badge key={motivo} variant="secondary" className="flex items-center gap-2">
                      {motivo}
                      <button
                        type="button"
                        className="text-xs text-gray-500 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400"
                        onClick={() => handleRemoveMotivo(motivo)}
                        disabled={isSaving}
                        aria-label={`Remover categoria ${motivo}`}
                      >
                        remover
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500 dark:text-slate-500">
                Alterações nesta lista ficam disponíveis imediatamente para os solicitantes ao criar um pedido.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {module === 'hub' && isConfederacaoAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Cadastros globais de dados cadastrais</CardTitle>
            <CardDescription>
              Mantenha aqui as listas reutilizáveis do Hub. Essas categorias ficam disponíveis para todas as singulares.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {HUB_CADASTRO_SECTIONS.map((section) => {
              const values = hubCadastros[section.key] ?? [];
              return (
                <div key={section.key} className="space-y-3 rounded-xl border border-gray-200 p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{section.title}</h3>
                    <p className="text-sm text-gray-600">{section.description}</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={hubInputs[section.key]}
                      onChange={(event) => {
                        const value = event.target.value;
                        setHubInputs((prev) => ({ ...prev, [section.key]: value }));
                      }}
                      placeholder={section.placeholder}
                      className="flex-1"
                      disabled={isSaving}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleAddHubCadastro(section.key);
                        }
                      }}
                    />
                    <Button
                      type="button"
                      onClick={() => handleAddHubCadastro(section.key)}
                      disabled={isSaving || !String(hubInputs[section.key] ?? '').trim()}
                    >
                      Adicionar
                    </Button>
                  </div>

                  {values.length === 0 ? (
                    <p className="text-sm text-gray-600">Nenhum item cadastrado.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {values.map((value) => (
                        editingHubItem &&
                        editingHubItem.key === section.key &&
                        editingHubItem.original === value ? (
                          <div
                            key={`${section.key}:${value}`}
                            className="inline-flex items-center gap-1 rounded-full border border-[#CFC7FF] bg-white px-2 py-1 shadow-sm"
                          >
                            <Input
                              autoFocus
                              value={editingHubItem.value}
                              onChange={(event) => {
                                const next = event.target.value;
                                setEditingHubItem((prev) => (prev ? { ...prev, value: next } : prev));
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  handleSaveEditHubCadastro();
                                } else if (event.key === 'Escape') {
                                  event.preventDefault();
                                  handleCancelEditHubCadastro();
                                }
                              }}
                              onBlur={handleSaveEditHubCadastro}
                              className="h-6 w-[160px] border-0 bg-transparent px-1 text-xs font-medium text-gray-900 shadow-none focus-visible:ring-0"
                              disabled={isSaving}
                            />
                            <button
                              type="button"
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-emerald-600 hover:bg-emerald-50"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={handleSaveEditHubCadastro}
                              disabled={isSaving}
                              aria-label={`Salvar edição de ${value}`}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-red-600"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={handleCancelEditHubCadastro}
                              disabled={isSaving}
                              aria-label={`Cancelar edição de ${value}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <Badge
                            key={`${section.key}:${value}`}
                            variant="secondary"
                            className="group inline-flex items-center rounded-full border border-[#D9DEEF] bg-[#F3F6FF] px-3 py-1 text-xs font-medium text-[#25314D] hover:bg-[#EAF0FF]"
                            title="Duplo clique para editar"
                            onDoubleClick={() => handleStartEditHubCadastro(section.key, value)}
                          >
                            <span className="select-none">{value}</span>
                            <button
                              type="button"
                              className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full text-[#68789C] hover:bg-white hover:text-red-600"
                              onClick={() => handleRemoveHubCadastro(section.key, value)}
                              disabled={isSaving}
                              aria-label={`Remover ${value}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        )
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {module === 'hub' && canManageCentralArquivosCredential && (
        <Card>
          <CardHeader>
            <CardTitle>Google Drive · UDocs e UMkt</CardTitle>
            <CardDescription>
              Configure a credencial de acesso e as pastas raiz de cada módulo da Central.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoadingDriveCredential ? (
              <p className="text-sm text-gray-600 dark:text-slate-400">Carregando configuração do Google Drive...</p>
            ) : (
              <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900/60">
                <p>
                  <strong>Status da credencial:</strong>{' '}
                  {driveCredentialStatus?.configured ? 'configurado' : 'não configurado'}
                </p>
                <p>
                  <strong>Origem da credencial:</strong>{' '}
                  {driveCredentialStatus?.source === 'secure_store'
                    ? 'Configuração criptografada no sistema'
                    : driveCredentialStatus?.source === 'env'
                      ? 'Variável de ambiente (fallback)'
                      : 'Nenhuma'}
                </p>
                <p>
                  <strong>E-mail da service account:</strong>{' '}
                  {driveCredentialStatus?.credential?.client_email_masked || 'não informado'}
                </p>
                <p>
                  <strong>Projeto:</strong>{' '}
                  {driveCredentialStatus?.credential?.project_id || 'não informado'}
                </p>
                <p>
                  <strong>Atualizado em:</strong>{' '}
                  {formatDateTime(driveCredentialStatus?.credential?.updated_at)}
                </p>
                <p>
                  <strong>Atualizado por:</strong>{' '}
                  {driveCredentialStatus?.credential?.updated_by || 'não informado'}
                </p>
                <hr className="border-gray-200 dark:border-slate-700" />
                <p>
                  <strong>Origem da estrutura:</strong>{' '}
                  {driveCredentialStatus?.drive?.source === 'secure_store'
                    ? 'Configuração salva no sistema'
                    : 'Variável de ambiente (fallback)'}
                </p>
                <p>
                  <strong>Shared Drive ID:</strong>{' '}
                  {driveCredentialStatus?.drive?.drive_id || 'não informado'}
                </p>
                <p>
                  <strong>Pasta raiz UDocs:</strong>{' '}
                  {driveCredentialStatus?.drive?.udocs_root_folder_id || 'não informado'}
                </p>
                <p>
                  <strong>Pasta raiz UMkt:</strong>{' '}
                  {driveCredentialStatus?.drive?.umarketing_root_folder_id || 'não informado'}
                </p>
                <p>
                  <strong>Validação Google Drive:</strong>{' '}
                  {driveCredentialStatus?.drive?.validation?.status === 'valid'
                    ? 'válida'
                    : 'pendente'}
                </p>
                {driveCredentialStatus?.drive?.validation?.status === 'valid' && (
                  <>
                    <p>
                      <strong>Nome do Shared Drive:</strong>{' '}
                      {driveCredentialStatus?.drive?.validation?.drive_name || 'não informado'}
                    </p>
                    <p>
                      <strong>Nome da pasta UDocs:</strong>{' '}
                      {driveCredentialStatus?.drive?.validation?.udocs_folder_name || 'não informado'}
                    </p>
                    <p>
                      <strong>Nome da pasta UMkt:</strong>{' '}
                      {driveCredentialStatus?.drive?.validation?.umarketing_folder_name || 'não informado'}
                    </p>
                    <p>
                      <strong>Validação em:</strong>{' '}
                      {formatDateTime(driveCredentialStatus?.drive?.validation?.checked_at)}
                    </p>
                  </>
                )}
                <p>
                  <strong>Estrutura atualizada em:</strong>{' '}
                  {formatDateTime(driveCredentialStatus?.drive?.updated_at)}
                </p>
                <p>
                  <strong>Estrutura atualizada por:</strong>{' '}
                  {driveCredentialStatus?.drive?.updated_by || 'não informado'}
                </p>
              </div>
            )}

            <div className="space-y-4 rounded-md border border-gray-200 p-4 dark:border-slate-800">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Credencial da Service Account</h3>
                <p className="text-xs text-gray-600 dark:text-slate-400">
                  Use o arquivo JSON da conta de serviço com acesso ao Shared Drive.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-slate-200" htmlFor="service-account-json">
                  Arquivo JSON da Service Account
                </label>
                <Input
                  key={serviceAccountInputKey}
                  id="service-account-json"
                  type="file"
                  accept=".json,application/json"
                  onChange={handleServiceAccountFileChange}
                  disabled={isSavingDriveCredential || isDeletingDriveCredential}
                />
                {selectedServiceAccountFileName && (
                  <p className="text-xs text-gray-600 dark:text-slate-400">
                    Arquivo selecionado: {selectedServiceAccountFileName}
                  </p>
                )}
              </div>

              {driveCredentialFeedback && (
                <p className={`text-sm ${driveCredentialFeedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {driveCredentialFeedback.message}
                </p>
              )}

              {!driveCredentialStatus?.encryption_enabled && (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Defina <code>CENTRAL_ARQUIVOS_ENCRYPTION_KEY</code> no servidor para habilitar o armazenamento criptografado do JSON.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={handleSaveDriveCredential}
                  disabled={!selectedServiceAccount || isSavingDriveCredential || isDeletingDriveCredential}
                >
                  {isSavingDriveCredential ? 'Salvando credencial...' : 'Salvar credencial'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDeleteDriveCredential}
                  disabled={
                    isSavingDriveCredential ||
                    isDeletingDriveCredential ||
                    !driveCredentialStatus?.configured ||
                    driveCredentialStatus?.source !== 'secure_store'
                  }
                >
                  {isDeletingDriveCredential ? 'Removendo...' : 'Remover credencial salva'}
                </Button>
              </div>
            </div>

            <div className="space-y-4 rounded-md border border-gray-200 p-4 dark:border-slate-800">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Estrutura de pastas por módulo</h3>
                <p className="text-xs text-gray-600 dark:text-slate-400">
                  Defina os IDs usados para leitura no Google Drive para UDocs e UMkt.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-slate-200" htmlFor="drive-id">
                    Shared Drive ID (U-Hub)
                  </label>
                  <Input
                    id="drive-id"
                    value={driveFoldersForm.drive_id}
                    onChange={(event) =>
                      setDriveFoldersForm((prev) => ({ ...prev, drive_id: event.target.value }))
                    }
                    placeholder="Ex.: 0AxxxxxxxxxxxxxxPVA"
                    disabled={isSavingDriveFolders}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-slate-200" htmlFor="udocs-root-folder-id">
                    Pasta raiz do UDocs
                  </label>
                  <Input
                    id="udocs-root-folder-id"
                    value={driveFoldersForm.udocs_root_folder_id}
                    onChange={(event) =>
                      setDriveFoldersForm((prev) => ({ ...prev, udocs_root_folder_id: event.target.value }))
                    }
                    placeholder="Ex.: 1AbCdEfGhIjKlMn"
                    disabled={isSavingDriveFolders}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-slate-200" htmlFor="umarketing-root-folder-id">
                    Pasta raiz do UMkt
                  </label>
                  <Input
                    id="umarketing-root-folder-id"
                    value={driveFoldersForm.umarketing_root_folder_id}
                    onChange={(event) =>
                      setDriveFoldersForm((prev) => ({ ...prev, umarketing_root_folder_id: event.target.value }))
                    }
                    placeholder="Ex.: 1ZyXwVuTsRqPoNm"
                    disabled={isSavingDriveFolders}
                  />
                </div>
              </div>

              {driveFoldersFeedback && (
                <p className={`text-sm ${driveFoldersFeedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {driveFoldersFeedback.message}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={handleSaveDriveFolders}
                  disabled={isSavingDriveFolders}
                >
                  {isSavingDriveFolders ? 'Salvando estrutura...' : 'Salvar estrutura de pastas'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isConfederacaoAdmin && (
        <div className="flex items-center justify-between">
          {status && (
            <p className={`text-sm ${status.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {status.message}
            </p>
          )}
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar preferências'}
          </Button>
        </div>
      )}
    </div>
  );
}
