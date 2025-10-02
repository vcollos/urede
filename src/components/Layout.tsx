import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  Building2,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  Bell,
  User,
  Menu,
  Map,
  Plus
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { useAuth } from '../contexts/AuthContext';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { UserProfileDialog } from './UserProfileDialog';
import brandWordmark from '../logo/urede_positivo.svg';
import brandSymbol from '../logo/simbolo_uniodonto.svg';
import { apiService } from '../services/apiService';
import type { Alerta } from '../types';

interface LayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onCreatePedido?: () => void;
  onOpenPedido?: (pedidoId: string) => void;
}

export function Layout({ children, activeTab, onTabChange, onCreatePedido, onOpenPedido }: LayoutProps) {
  const { user, logout } = useAuth();
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);
  const [isProfileDialogOpen, setProfileDialogOpen] = useState(false);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [isLoadingAlertas, setIsLoadingAlertas] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
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

  if (!user) return null;
  const canCreatePedido = ['operador', 'admin', 'confederacao'].includes(user.papel);
  const showQuickCreatePedido = activeTab === 'pedidos' && canCreatePedido && typeof onCreatePedido === 'function';
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'pedidos', label: 'Pedidos', icon: FileText },
    { id: 'cooperativas', label: 'Cooperativas', icon: Building2 },
    { id: 'operadores', label: 'Operadores', icon: User },
    { id: 'cidades', label: 'Cidades', icon: Map },
    { id: 'configuracoes', label: 'Configurações', icon: Settings },
  ];

  const getRoleBadgeColor = (papel: string) => {
    switch (papel) {
      case 'confederacao': return 'bg-red-100 text-red-800 border-red-200';
      case 'federacao': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'admin': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  const getRoleLabel = (papel: string) => {
    switch (papel) {
      case 'confederacao': return 'Confederação';
      case 'federacao': return 'Federação';
      case 'admin': return 'Administrador';
      case 'operador': return 'Operador';
      default: return papel;
    }
  };

  const handleTabChange = (tab: string) => {
    onTabChange(tab);
    setMobileNavOpen(false);
  };

  const SidebarNav = (
    <div className="flex flex-col h-full">
      {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 bg-purple-100 rounded-xl flex items-center justify-center shadow-sm ring-1 ring-purple-200">
              <img src={brandSymbol} alt="Símbolo Uniodonto" className="h-6 w-6" />
            </div>
            <div>
              <img src={brandWordmark} alt="Uniodonto" className="h-6 w-auto" />
              <p className="text-xs text-gray-500">Sistema de Credenciamento</p>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-blue-100 text-blue-600">
                {user.nome.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.nome}
              </p>
              <Badge 
                variant="outline" 
                className={`text-xs ${getRoleBadgeColor(user.papel)}`}
              >
                {getRoleLabel(user.papel)}
              </Badge>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <Button
                  key={item.id}
                  variant={isActive ? 'default' : 'ghost'}
                  className={`w-full justify-start ${
                    isActive
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                  onClick={() => handleTabChange(item.id)}
                >
                  <Icon className="w-4 h-4 mr-3" />
                  {item.label}
                </Button>
              );
            })}
          </div>
        </nav>

      {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-700"
            onClick={logout}
          >
            <LogOut className="w-4 h-4 mr-3" />
            Sair
          </Button>
        </div>
      </div>
  );

  return (
    <div className="min-h-dvh flex bg-gray-50">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex lg:w-64 bg-white shadow-sm border-r border-gray-200">
        {SidebarNav}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={brandWordmark} alt="Uniodonto" className="h-7 w-auto hidden sm:block" />
              <h2 className="text-xl font-semibold text-gray-900 capitalize">
                {activeTab === 'dashboard' ? 'Dashboard' : 
                 activeTab === 'pedidos' ? 'Gestão de Pedidos' :
                 activeTab === 'cooperativas' ? 'Cooperativas' :
                 activeTab === 'operadores' ? 'Operadores' :
                 activeTab === 'cidades' ? 'Cidades' :
                 'Configurações'}
              </h2>
            </div>
            <div className="flex items-center space-x-4">
              {showQuickCreatePedido && (
                <button
                  type="button"
                  className="quick-action-button"
                  onClick={onCreatePedido}
                >
                  <Plus />
                  <span className="hidden sm:inline">Novo Pedido</span>
                  <span className="sm:hidden">Novo</span>
                </button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Abrir menu"
              >
                <Menu className="w-5 h-5" />
              </Button>
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
                    className={`relative ${unreadCount > 0 ? 'text-red-500 hover:text-red-600 focus-visible:text-red-600' : ''}`}
                  >
                    <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-red-500' : ''}`} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[320px] p-0">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Alertas</p>
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
                  <div className="max-h-80 overflow-y-auto">
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
                            className={`w-full px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${
                              alerta.lido
                                ? 'bg-white hover:bg-gray-50'
                                : 'bg-purple-50 hover:bg-purple-100'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-gray-900 line-clamp-1">
                                {alerta.pedido_titulo || alerta.pedido_id}
                              </p>
                              <Badge
                                variant={alerta.lido ? 'outline' : 'secondary'}
                                className="text-[10px] uppercase tracking-wide"
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
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button variant="ghost" size="icon" aria-label="Perfil">
                    <User className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setProfileDialogOpen(true)}>
                    Perfil do usuário
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { logout(); }}>
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="px-4 py-6 sm:p-6">
            {children}
          </div>
        </main>
      </div>

      <Dialog open={isMobileNavOpen} onOpenChange={setMobileNavOpen}>
        <DialogContent className="w-full max-w-[min(320px,calc(100dvw-2rem))] h-full max-h-[100dvh] top-0 right-0 left-auto translate-x-0 translate-y-0 p-0 overflow-hidden bg-transparent border-none shadow-none">
          <div className="h-full w-full max-w-xs bg-white shadow-xl border border-gray-200 rounded-lg flex flex-col">
            <DialogHeader className="p-6 border-b border-gray-200">
              <DialogTitle className="text-base font-semibold text-gray-900 flex items-center gap-3">
                <img src={brandWordmark} alt="Uniodonto" className="h-6 w-auto" />
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
                  <Badge variant="outline" className={`text-xs ${getRoleBadgeColor(user.papel)}`}>
                    {getRoleLabel(user.papel)}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <Button
                      key={`mobile-${item.id}`}
                      variant={isActive ? 'default' : 'ghost'}
                      className={`w-full justify-start ${
                        isActive
                          ? 'bg-purple-600 text-white hover:bg-purple-700'
                          : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                      onClick={() => {
                        handleTabChange(item.id);
                        setMobileNavOpen(false);
                      }}
                    >
                      <Icon className="w-4 h-4 mr-3" />
                      {item.label}
                    </Button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-gray-200">
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
