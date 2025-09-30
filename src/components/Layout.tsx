import { ReactNode, useEffect, useState } from 'react';
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

interface LayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onCreatePedido?: () => void;
}

export function Layout({ children, activeTab, onTabChange, onCreatePedido }: LayoutProps) {
  const { user, logout } = useAuth();
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);
  const [isProfileDialogOpen, setProfileDialogOpen] = useState(false);

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
              <Button variant="ghost" size="icon">
                <Bell className="w-5 h-5" />
              </Button>
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
