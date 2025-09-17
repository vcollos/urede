import { ReactNode } from 'react';
import { 
  Building2, 
  FileText, 
  BarChart3, 
  Settings, 
  LogOut,
  Bell,
  User
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { useAuth } from '../contexts/AuthContext';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './ui/dropdown-menu';

interface LayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  const { user, logout } = useAuth();

  if (!user) return null;
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'pedidos', label: 'Pedidos', icon: FileText },
    { id: 'cooperativas', label: 'Cooperativas', icon: Building2 },
    { id: 'operadores', label: 'Operadores', icon: User },
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

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-sm border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">Uniodonto</h1>
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
                  variant={isActive ? "default" : "ghost"}
                  className={`w-full justify-start ${
                    isActive 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                  onClick={() => onTabChange(item.id)}
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 capitalize">
              {activeTab === 'dashboard' ? 'Dashboard' : 
               activeTab === 'pedidos' ? 'Gestão de Pedidos' :
               activeTab === 'cooperativas' ? 'Cooperativas' :
               activeTab === 'operadores' ? 'Operadores' :
               'Configurações'}
            </h2>
            <div className="flex items-center space-x-4">
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
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
