import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  Building2,
  FileText,
  BarChart3,
  Settings,
  Home,
  LogOut,
  Bell,
  User,
  Users,
  Menu,
  Map,
  Plus,
  UploadCloud,
  PieChart,
  Database,
  ChevronDown,
  AppWindow,
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { useAuth } from '../contexts/AuthContext';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from './ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { UserProfileDialog } from './UserProfileDialog';
import { cn } from './ui/utils';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import brandWordmark from '../logo/urede_positivo.svg';
import hubWordmark from '../logo/uhub_logo.svg';
import sidebarBrandSymbol from '../logo/roxo.svg';
import { apiService } from '../services/apiService';
import type { Alerta, CooperativaConfig } from '../types';

type LayoutModule = 'hub' | 'urede';

interface LayoutProps {
  children: ReactNode;
  activeTab: string;
  activeModule: LayoutModule;
  canAccessUrede?: boolean;
  onModuleChange?: (module: LayoutModule) => void;
  onTabChange: (tab: string) => void;
  onCreatePedido?: () => void;
  onOpenPedido?: (pedidoId: string) => void;
  onOpenImportacao?: () => void;
}

export function Layout({
  children,
  activeTab,
  activeModule,
  canAccessUrede = true,
  onModuleChange,
  onTabChange,
  onCreatePedido,
  onOpenPedido,
  onOpenImportacao
}: LayoutProps) {
  const { user, logout } = useAuth();
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);
  const [isProfileDialogOpen, setProfileDialogOpen] = useState(false);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [isLoadingAlertas, setIsLoadingAlertas] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [cooperativaTipo, setCooperativaTipo] = useState<CooperativaConfig['tipo'] | null>(null);
  const [isConfigMenuExpanded, setConfigMenuExpanded] = useState(false);
  const isMountedRef = useRef(true);
  const lastAlertIdsRef = useRef<Set<string>>(new Set());
  const hasRequestedNotificationRef = useRef(false);
  const notificationsSupported = typeof window !== 'undefined' && 'Notification' in window;

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const unreadCount = alertas.reduce((count, alerta) => (alerta.lido ? count : count + 1), 0);

  const formatAlertDate = useCallback((value: string) => {
    if (!value) return '';
    try {
      return new Date(value).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return value;
    }
  }, []);

  const getAlertTypeLabel = useCallback((tipo: Alerta['tipo']) => {
    switch (tipo) {
      case 'novo':
        return 'Novo pedido';
      case 'comentario':
        return 'Comentário';
      case 'status':
        return 'Status';
      case 'nivel':
        return 'Escalonamento';
      case 'responsavel':
        return 'Responsável';
      default:
        return 'Atualização';
    }
  }, []);

  const triggerNotifications = useCallback((novos: Alerta[]) => {
    if (!notificationsSupported || novos.length === 0) return;

    const apresentar = () => {
      novos.forEach((alerta) => {
        const title = alerta.pedido_titulo || 'Atualização no pedido';
        const bodyParts = [getAlertTypeLabel(alerta.tipo), alerta.mensagem]
          .filter(Boolean)
          .join(' • ');
        try {
          const notification = new Notification(title, {
            body: bodyParts || 'Há novidades em um pedido.',
            tag: alerta.id,
          });
          notification.onclick = () => {
            window.focus();
            setAlertsOpen(true);
            if (alerta.pedido_id) {
              onOpenPedido?.(alerta.pedido_id);
            }
            notification.close();
          };
        } catch (error) {
          console.warn('[alertas] falha ao disparar notificação do navegador:', error);
        }
      });
    };

    const permission = Notification.permission;
    if (permission === 'granted') {
      apresentar();
    } else if (permission === 'default' && !hasRequestedNotificationRef.current) {
      hasRequestedNotificationRef.current = true;
      Notification.requestPermission().then((result) => {
        if (result === 'granted') {
          apresentar();
        }
      }).catch(() => {
        /* silencioso */
      });
    }
  }, [notificationsSupported, getAlertTypeLabel, onOpenPedido]);

  const refreshAlertas = useCallback(async () => {
    if (!user) {
      if (isMountedRef.current) {
        setAlertas([]);
        lastAlertIdsRef.current = new Set();
      }
      return [] as Alerta[];
    }
    try {
      const data = await apiService.getAlertas(50);
      if (isMountedRef.current) {
        const previousIds = lastAlertIdsRef.current;
        const newUnread = notificationsSupported
          ? data.filter((alerta) => !alerta.lido && !previousIds.has(alerta.id))
          : [];
        lastAlertIdsRef.current = new Set(data.map((alerta) => alerta.id));
        setAlertas(data);
        if (newUnread.length > 0) {
          triggerNotifications(newUnread);
        }
      }
      return data;
    } catch (error) {
      console.error('Erro ao buscar alertas:', error);
      return [] as Alerta[];
    }
  }, [user, notificationsSupported, triggerNotifications]);

  useEffect(() => {
    if (!user) {
      setAlertas([]);
      lastAlertIdsRef.current = new Set();
      setIsLoadingAlertas(false);
      return;
    }

    let active = true;

    const run = async () => {
      if (!active) return;
      setIsLoadingAlertas(true);
      try {
        await refreshAlertas();
      } finally {
        if (active && isMountedRef.current) {
          setIsLoadingAlertas(false);
        }
      }
    };

    run();
    const intervalId = window.setInterval(run, 60000);
    const handleRefresh = () => { void run(); };
    window.addEventListener('pedido:updated', handleRefresh);
    window.addEventListener('pedido:deleted', handleRefresh);
    window.addEventListener('pedido:created', handleRefresh);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('pedido:updated', handleRefresh);
      window.removeEventListener('pedido:deleted', handleRefresh);
      window.removeEventListener('pedido:created', handleRefresh);
    };
  }, [user, refreshAlertas]);

  const handleAlertClick = useCallback(async (alerta: Alerta) => {
    try {
      if (!alerta.lido) {
        await apiService.marcarAlertaComoLido(alerta.id, true);
        if (isMountedRef.current) {
          setAlertas((prev) => prev.map((item) =>
            item.id === alerta.id ? { ...item, lido: true } : item
          ));
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar alerta:', error);
    } finally {
      setAlertsOpen(false);
      onOpenPedido?.(alerta.pedido_id);
    }
  }, [onOpenPedido]);

  const handleMarkAllAlertas = useCallback(async () => {
    try {
      await apiService.marcarTodosAlertasComoLidos();
      if (isMountedRef.current) {
        setAlertas((prev) => prev.map((alerta) => ({ ...alerta, lido: true })));
      }
    } catch (error) {
      console.error('Erro ao marcar alertas como lidos:', error);
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (!user?.cooperativa_id) {
      setCooperativaTipo(null);
      return;
    }

    const loadCooperativa = async () => {
      try {
        const config = await apiService.getCooperativaConfig(user.cooperativa_id);
        if (active) {
          setCooperativaTipo(config?.tipo ?? null);
        }
      } catch (error) {
        console.error('Erro ao carregar dados da cooperativa do usuário:', error);
        if (active) {
          setCooperativaTipo(null);
        }
      }
    };

    loadCooperativa();

    return () => {
      active = false;
    };
  }, [user?.cooperativa_id]);

  if (!user) return null;
  const canCreatePedido = ['operador', 'admin', 'confederacao'].includes(user.papel);
  const isAdmin = user.papel === 'admin';
  const hubMenuItems = [
    { id: 'hub_home', label: 'Homepage', icon: Home },
    { id: 'central_apps', label: 'Central de Apps', icon: AppWindow },
    { id: 'cooperativas', label: 'Cooperativas', icon: Building2 },
    { id: 'cidades', label: 'Cidades', icon: Map },
    ...(isAdmin ? [{ id: 'configuracoes_hub', label: 'Configurações', icon: Settings }] : []),
  ];
  const sharedMenuItems = [
    { id: 'cooperativas', label: 'Cooperativas', icon: Building2 },
    { id: 'cidades', label: 'Cidades', icon: Map },
    ...(isAdmin ? [{ id: 'configuracoes_urede', label: 'Configurações', icon: Settings }] : []),
  ];
  const uredeMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'relatorios', label: 'Relatórios', icon: PieChart },
    { id: 'pedidos', label: 'Pedidos', icon: FileText },
    ...(canCreatePedido ? [{ id: 'importacao', label: 'Pedidos em lote', icon: UploadCloud }] : []),
  ];
  const menuItems = activeModule === 'hub'
    ? hubMenuItems
    : [...uredeMenuItems, ...sharedMenuItems];
  const configuracoesSubItems = isAdmin && activeModule === 'hub'
    ? [
      { id: 'operadores', label: 'Usuários', icon: User },
      { id: 'pessoas', label: 'Pessoas', icon: Users },
      { id: 'gestao_dados', label: 'Gestão de dados', icon: Database },
    ]
    : [];
  const isConfigTab = (tabId: string) => tabId === 'configuracoes_hub' || tabId === 'configuracoes_urede';
  const isConfigSubTab = (tabId: string) => configuracoesSubItems.some((sub) => sub.id === tabId);
  const showUredeActions = activeModule === 'urede' && canAccessUrede;
  const moduleHomeTab = activeModule === 'hub' ? 'hub_home' : 'dashboard';
  const currentBrandWordmark = activeModule === 'hub' ? hubWordmark : brandWordmark;
  const currentBrandAlt = activeModule === 'hub' ? 'Portal UHub' : 'Portal URede';

  useEffect(() => {
    if (activeModule !== 'hub' || configuracoesSubItems.length === 0) {
      setConfigMenuExpanded(false);
      return;
    }
    if (isConfigTab(activeTab) || isConfigSubTab(activeTab)) {
      setConfigMenuExpanded(true);
    }
  }, [activeModule, activeTab, configuracoesSubItems.length]);

  const cooperativaScopeLabel = (() => {
    switch (cooperativaTipo) {
      case 'CONFEDERACAO':
        return 'Confederação';
      case 'FEDERACAO':
        return 'Federação';
      case 'SINGULAR':
        return 'Singular';
      default:
        return null;
    }
  })();

  const baseRoleLabel = user.papel === 'admin' ? 'Administrador' : 'Responsável';
  const roleDisplayLabel = cooperativaScopeLabel
    ? `${baseRoleLabel} • ${cooperativaScopeLabel}`
    : baseRoleLabel;

  const roleBadgeClass = (() => {
    switch (cooperativaTipo) {
      case 'CONFEDERACAO':
        return 'bg-[#FFE4F2] text-[#C23A82] border-transparent shadow-[0_10px_20px_-18px_rgba(194,58,130,0.6)]';
      case 'FEDERACAO':
        return 'bg-[#E6EEFF] text-[#2956C4] border-transparent shadow-[0_10px_20px_-18px_rgba(41,86,196,0.55)]';
      case 'SINGULAR':
        return 'bg-[#E6F8EE] text-[#1F7A47] border-transparent shadow-[0_10px_20px_-18px_rgba(31,122,71,0.55)]';
      default:
        return user.papel === 'admin'
          ? 'bg-[#F0E9FF] text-[#6C55D9] border-transparent shadow-[0_10px_20px_-18px_rgba(108,85,217,0.6)]'
          : 'bg-[#E6F8EE] text-[#1F7A47] border-transparent shadow-[0_10px_20px_-18px_rgba(31,122,71,0.55)]';
    }
  })();

  const handleTabChange = (tab: string, options?: { closeMobile?: boolean }) => {
    const shouldCloseMobile = options?.closeMobile ?? true;

    if (!isConfigTab(tab) && !isConfigSubTab(tab)) {
      setConfigMenuExpanded(false);
    }

    if (isConfigSubTab(tab)) {
      setConfigMenuExpanded(true);
    }

    if (tab === 'cooperativas' && activeTab === 'cooperativas') {
      window.dispatchEvent(new CustomEvent('cooperativas:go-list'));
    }
    onTabChange(tab);
    if (shouldCloseMobile) {
      setMobileNavOpen(false);
    }
  };

  const handleModuleChange = (module: LayoutModule) => {
    onModuleChange?.(module);
    setMobileNavOpen(false);
  };

  const renderAlertsDropdown = (triggerClass?: string) => {
    const hasUnread = unreadCount > 0;
    return (
    <DropdownMenu
      open={alertsOpen}
      onOpenChange={(open) => {
        setAlertsOpen(open);
        if (open) {
          setIsLoadingAlertas(true);
          void refreshAlertas().finally(() => {
            if (isMountedRef.current) {
              setIsLoadingAlertas(false);
            }
          });
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Abrir alertas"
          className={cn(
            'alerts-trigger relative rounded-full bg-white/10 hover:bg-white/20 text-white',
            triggerClass,
            hasUnread ? 'alerts-trigger--has-unread' : ''
          )}
        >
          <Bell className="alerts-trigger__icon w-5 h-5 transition-colors duration-150" />
          {hasUnread && (
            <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#FF6B6B] px-1 text-[11px] font-semibold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[320px] p-0 rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-[#EEE9FF] to-[#F7F4FF]">
          <div>
            <p className="text-sm font-semibold text-gray-900">Alertas</p>
            <p className="text-xs text-gray-500">
              {unreadCount > 0
                ? `${unreadCount} alerta${unreadCount > 1 ? 's' : ''} pendente${unreadCount > 1 ? 's' : ''}`
                : 'Tudo em dia'}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleMarkAllAlertas}
            disabled={unreadCount === 0}
          >
            Marcar como lidos
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto bg-white">
          {isLoadingAlertas ? (
            <div className="px-4 py-6 text-sm text-gray-500">Carregando alertas...</div>
          ) : alertas.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-500">Nenhum alerta por aqui.</div>
          ) : (
            alertas.map((alerta) => {
              const message = (alerta.mensagem && alerta.mensagem.trim())
                || (alerta.detalhes && alerta.detalhes.trim())
                || 'Atualização registrada.';
              return (
                <button
                  key={alerta.id}
                  type="button"
                  onClick={() => handleAlertClick(alerta)}
                  className={cn(
                    'w-full px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400',
                    alerta.lido ? 'bg-white hover:bg-gray-50' : 'bg-[#F4EDFF] hover:bg-[#e8dfff]'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 line-clamp-1">
                      {alerta.pedido_titulo || alerta.pedido_id}
                    </p>
                    <Badge
                      variant={alerta.lido ? 'outline' : 'secondary'}
                      className="text-[10px] uppercase tracking-wide bg-white/60 border border-white text-[#6C55D9]"
                    >
                      {getAlertTypeLabel(alerta.tipo)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-gray-600 line-clamp-3">
                    {message}
                  </p>
                  <div className="mt-2 text-[11px] text-gray-400">
                    {formatAlertDate(alerta.criado_em)}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  };

  return (
    <div className="min-h-screen w-full bg-[#FBFBFD] flex text-gray-900">
      {/* Navigation panel */}
      <aside className="hidden lg:flex w-72 flex-col bg-white/70 backdrop-blur border-r border-white/60">
        <div className="p-6 border-b border-white/60">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#EDE7FF] to-[#FCEBFF] flex items-center justify-center shadow-inner">
                <img src={sidebarBrandSymbol} alt="Símbolo UHub" className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Bem-vindo(a)</p>
                <p className="text-base font-semibold text-gray-900 line-clamp-1">
                  {user.nome}
                </p>
              </div>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              'mt-4 w-fit rounded-full border-0 bg-[#F4EDFF] text-[#6C55D9] px-3 py-1 text-xs font-medium',
              roleBadgeClass
            )}
          >
            {roleDisplayLabel}
          </Badge>
          <div className={cn('mt-4 rounded-2xl bg-[#F3F1FF] p-1 gap-1 grid', canAccessUrede ? 'grid-cols-2' : 'grid-cols-1')}>
            <button
              type="button"
              onClick={() => handleModuleChange('hub')}
              className={cn(
                'rounded-xl px-3 py-2 text-xs font-semibold transition',
                activeModule === 'hub'
                  ? 'bg-white text-[#5B46C8] shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              UHub
            </button>
            {canAccessUrede && (
              <button
                type="button"
                onClick={() => handleModuleChange('urede')}
                className={cn(
                  'rounded-xl px-3 py-2 text-xs font-semibold transition',
                  activeModule === 'urede'
                    ? 'bg-white text-[#5B46C8] shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                URede
              </button>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9A91D9] mb-3">
              {activeModule === 'hub' ? 'Navegação Hub' : 'Navegação URede'}
            </p>
            <div className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isConfigGroup = isConfigTab(item.id);
                const isActive = isConfigGroup
                  ? isConfigTab(activeTab) || configuracoesSubItems.some((sub) => sub.id === activeTab)
                  : activeTab === item.id;
                return (
                  <div key={item.id} className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (isConfigGroup && configuracoesSubItems.length > 0) {
                          setConfigMenuExpanded((prev) => !prev);
                        }
                        handleTabChange(item.id);
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition',
                        isActive
                          ? 'bg-gradient-to-r from-[#7B6EF6] to-[#A77BFF] text-white shadow-[0_18px_35px_-20px_rgba(123,110,246,0.6)]'
                          : 'bg-white/80 text-gray-600 hover:text-gray-900 hover:bg-white shadow-sm border border-white/40'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {isConfigGroup && configuracoesSubItems.length > 0 && (
                        <ChevronDown className={cn('h-4 w-4 transition-transform', isConfigMenuExpanded ? 'rotate-180' : '')} />
                      )}
                    </button>
                    {isConfigGroup && configuracoesSubItems.length > 0 && isConfigMenuExpanded && (
                      <div className="pl-3 space-y-1">
                        {configuracoesSubItems.map((sub) => {
                          const SubIcon = sub.icon;
                          const isSubActive = activeTab === sub.id;
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => handleTabChange(sub.id)}
                              className={cn(
                                'w-full flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition',
                                isSubActive
                                  ? 'bg-white text-[#5B46C8] border border-[#D8D1FF]'
                                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/80'
                              )}
                            >
                              <SubIcon className="w-4 h-4" />
                              {sub.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {showUredeActions && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9A91D9] mb-3">
                Acesso rápido
              </p>
              <div className="space-y-2">
                <div className="rounded-2xl bg-gradient-to-r from-[#FFE5F1] to-[#FFF4E4] p-4 shadow-[0_18px_35px_-25px_rgba(255,139,182,0.7)]">
                  <p className="text-sm font-semibold text-gray-800">Relatórios instantâneos</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Visualize métricas chaves em um clique.
                  </p>
                </div>
                <div className="rounded-2xl bg-[#F3F6FF] p-4 border border-white shadow-inner">
                  <p className="text-sm font-semibold text-gray-800">Atalhos</p>
                  <div className="mt-3 space-y-2">
                    {typeof onCreatePedido === 'function' && (
                      <Button
                        type="button"
                        className="w-full justify-start gap-2 rounded-xl bg-white text-[#6C55D9] hover:bg-white/90"
                        onClick={onCreatePedido}
                      >
                        <Plus className="h-4 w-4" />
                        Novo pedido
                      </Button>
                    )}
                    {typeof onOpenImportacao === 'function' && (
                      <Button
                        type="button"
                        className="w-full justify-start gap-2 rounded-xl border border-[#DBE3FF] bg-[#EEF2FF] text-[#3552C5] hover:bg-[#e1e7ff]"
                        onClick={onOpenImportacao}
                      >
                        <UploadCloud className="h-4 w-4" />
                        Importar pedidos
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </nav>

        <div className="px-6 py-5 border-t border-white/60">
          <div className="space-y-3">
            <Button
              type="button"
              onClick={() => setProfileDialogOpen(true)}
              className="w-full justify-center gap-2 rounded-full border border-[#DBE0FF] bg-white text-[#4C3FB3] font-semibold shadow-sm hover:bg-white/95"
            >
              <User className="w-4 h-4" />
              Meu perfil
            </Button>
            <button
              type="button"
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-[#1C1E3A] text-white py-3 font-semibold shadow-lg hover:bg-[#24264d]"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="px-4 sm:px-6 pt-6 pb-4">
          <div className="rounded-3xl bg-white shadow-[0_24px_60px_-32px_rgba(107,86,217,0.35)] border border-white/70 px-6 py-4 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => handleTabChange(moduleHomeTab)}
              className="flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7B6EF6]"
              aria-label={activeModule === 'hub' ? 'Ir para a homepage do UHub' : 'Ir para o dashboard do URede'}
            >
              <img src={currentBrandWordmark} alt={currentBrandAlt} className="h-10 w-auto" />
            </button>
            <div className="flex items-center gap-2">
              {showUredeActions && typeof onCreatePedido === 'function' && (
                <Button
                  type="button"
                  onClick={onCreatePedido}
                  className="hidden md:inline-flex items-center gap-2 rounded-full bg-[#6C55D9] text-white shadow-md hover:bg-[#5843C4]"
                >
                  <Plus className="h-4 w-4" />
                  Novo pedido
                </Button>
              )}
              {showUredeActions && typeof onOpenImportacao === 'function' && (
                <Button
                  type="button"
                  onClick={onOpenImportacao}
                  className="hidden lg:inline-flex items-center gap-2 rounded-full border border-[#D9DEFF] bg-[#EEF1FF] text-[#3145C4] hover:bg-[#E0E6FF]"
                >
                  <UploadCloud className="h-4 w-4" />
                  Importar pedidos
                </Button>
              )}
              {renderAlertsDropdown('!bg-[#F2F0FB] !text-[#6C55D9] border border-[#E4E0F9] hover:!bg-[#E7E2FF]')}
              <Button
                variant="ghost"
                size="icon"
                className="bg-[#F2F0FB] rounded-full lg:hidden"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Abrir menu"
              >
                <Menu className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 pb-10">
          {user?.must_change_password && (
            <Alert className="mb-6 border-amber-200 bg-amber-50/80">
              <AlertTitle>Altere sua senha provisória</AlertTitle>
              <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm">
                <span>
                  Você entrou com uma senha temporária. Atualize-a para continuar usando o portal com segurança.
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => setProfileDialogOpen(true)}
                >
                  Atualizar senha
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {children}
        </main>
        <footer className="px-4 sm:px-6 pb-8 text-sm text-gray-500">
          <div className="rounded-2xl border border-[#ECEBFF] bg-white/80 px-4 py-3 shadow-[0_10px_30px_-24px_rgba(108,85,217,0.8)] flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-medium text-gray-600">Precisa de orientação?</span>
            <a
              href="/documentacao/usuarios"
              className="inline-flex items-center text-[#6C55D9] font-semibold hover:text-[#5644c3]"
            >
              Acesse a documentação do sistema
            </a>
          </div>
        </footer>
      </div>

      <Dialog open={isMobileNavOpen} onOpenChange={setMobileNavOpen}>
        <DialogContent className="w-full max-w-[min(320px,calc(100dvw-2rem))] h-full max-h-[100dvh] top-0 right-0 left-auto translate-x-0 translate-y-0 p-0 overflow-hidden bg-transparent border-none shadow-none">
          <div className="h-full w-full max-w-xs bg-white shadow-xl border border-gray-200 rounded-lg flex flex-col">
            <DialogHeader className="p-6 border-b border-gray-200">
              <DialogTitle className="text-base font-semibold text-gray-900 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    handleTabChange(moduleHomeTab);
                    setMobileNavOpen(false);
                  }}
                  className="flex items-center gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                  aria-label={activeModule === 'hub' ? 'Ir para a homepage do UHub' : 'Ir para o dashboard do URede'}
                >
                  <img src={currentBrandWordmark} alt={currentBrandAlt} className="h-6 w-auto" />
                </button>
                Menu
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex items-center space-x-3">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-purple-100 text-purple-600">
                    {user.nome.split(' ').map((n) => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user.nome}</p>
                <Badge variant="outline" className={`text-xs ${roleBadgeClass}`}>
                  {roleDisplayLabel}
                </Badge>
              </div>
            </div>

              <div className={cn('rounded-xl bg-[#F3F1FF] p-1 gap-1 grid', canAccessUrede ? 'grid-cols-2' : 'grid-cols-1')}>
                <button
                  type="button"
                  onClick={() => handleModuleChange('hub')}
                  className={cn(
                    'rounded-lg px-3 py-2 text-xs font-semibold transition',
                    activeModule === 'hub'
                      ? 'bg-white text-[#5B46C8] shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  UHub
                </button>
                {canAccessUrede && (
                  <button
                    type="button"
                    onClick={() => handleModuleChange('urede')}
                    className={cn(
                      'rounded-lg px-3 py-2 text-xs font-semibold transition',
                      activeModule === 'urede'
                        ? 'bg-white text-[#5B46C8] shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    )}
                  >
                    URede
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isConfigGroup = isConfigTab(item.id);
                  const isActive = isConfigGroup
                    ? isConfigTab(activeTab) || configuracoesSubItems.some((sub) => sub.id === activeTab)
                    : activeTab === item.id;

                  return (
                    <div key={`mobile-${item.id}`} className="space-y-2">
                      <Button
                        variant={isActive ? 'default' : 'ghost'}
                        className={`w-full justify-start ${
                          isActive
                            ? 'bg-purple-600 text-white hover:bg-purple-700'
                            : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                        onClick={() => {
                          if (isConfigGroup && configuracoesSubItems.length > 0) {
                            setConfigMenuExpanded((prev) => !prev);
                            handleTabChange(item.id, { closeMobile: false });
                            return;
                          }
                          handleTabChange(item.id);
                        }}
                      >
                        <Icon className="w-4 h-4 mr-3" />
                        <span className="flex-1 text-left">{item.label}</span>
                        {isConfigGroup && configuracoesSubItems.length > 0 && (
                          <ChevronDown className={cn('h-4 w-4 transition-transform', isConfigMenuExpanded ? 'rotate-180' : '')} />
                        )}
                      </Button>
                      {isConfigGroup && configuracoesSubItems.length > 0 && isConfigMenuExpanded && (
                        <div className="pl-4 space-y-1">
                          {configuracoesSubItems.map((sub) => {
                            const SubIcon = sub.icon;
                            const isSubActive = activeTab === sub.id;
                            return (
                              <Button
                                key={`mobile-sub-${sub.id}`}
                                variant={isSubActive ? 'default' : 'ghost'}
                                className={`w-full justify-start ${
                                  isSubActive
                                    ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                                }`}
                                onClick={() => handleTabChange(sub.id)}
                              >
                                <SubIcon className="w-4 h-4 mr-3" />
                                {sub.label}
                              </Button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {showUredeActions && (
                <div className="space-y-2">
                  {typeof onCreatePedido === 'function' && (
                    <Button
                      className="w-full justify-start"
                      onClick={() => {
                        onCreatePedido();
                        setMobileNavOpen(false);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-3" />
                      Novo pedido
                    </Button>
                  )}
                  {typeof onOpenImportacao === 'function' && (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        onOpenImportacao();
                        setMobileNavOpen(false);
                      }}
                    >
                      <UploadCloud className="w-4 h-4 mr-3" />
                      Importar pedidos
                    </Button>
                  )}
                </div>
              )}

              <div className="pt-2 border-t border-gray-200 space-y-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-gray-700"
                  onClick={() => {
                    setProfileDialogOpen(true);
                    setMobileNavOpen(false);
                  }}
                >
                  <User className="w-4 h-4 mr-3" />
                  Meu perfil
                </Button>
                <Button variant="ghost" className="w-full justify-start text-gray-700" onClick={logout}>
                  <LogOut className="w-4 h-4 mr-3" />
                  Sair
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <UserProfileDialog open={isProfileDialogOpen} onOpenChange={setProfileDialogOpen} />
    </div>
  );
}
