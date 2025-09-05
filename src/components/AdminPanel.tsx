import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import { 
  Users, 
  Settings, 
  BarChart, 
  Shield, 
  Clock, 
  Palette,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  UserX,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../utils/supabase/client';
import type { User } from '../types';

interface SystemSettings {
  sla_dias: number;
  escalation_enabled: boolean;
  cron_interval_hours: number;
  theme: {
    primary_color: string;
    secondary_color: string;
    logo_url: string;
  };
  notifications: {
    email_enabled: boolean;
    sla_warning_days: number;
  };
}

interface AdminStats {
  total_users: number;
  total_pedidos: number;
  total_cooperativas: number;
  users_by_role: Record<string, number>;
  system_health: string;
}

export const AdminPanel: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Verificar se é admin
  if (!user || user.papel !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Alert className="w-full max-w-md">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Acesso negado. Esta área é restrita para administradores.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [usersData, settingsData, statsData] = await Promise.all([
        apiRequest('/admin/users'),
        apiRequest('/admin/settings'),
        apiRequest('/admin/stats')
      ]);

      setUsers(usersData);
      setSettings(settingsData);
      setStats(statsData);
    } catch (error) {
      console.error('Erro ao carregar dados administrativos:', error);
      setMessage({ type: 'error', text: 'Erro ao carregar dados' });
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = async (userId: string, updates: Partial<User>) => {
    try {
      setSaving(true);
      const updatedUser = await apiRequest(`/admin/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });

      setUsers(users.map(u => u.id === userId ? updatedUser : u));
      setMessage({ type: 'success', text: 'Usuário atualizado com sucesso' });
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      setMessage({ type: 'error', text: 'Erro ao atualizar usuário' });
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = async (newSettings: Partial<SystemSettings>) => {
    try {
      setSaving(true);
      const updatedSettings = await apiRequest('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(newSettings),
      });

      setSettings(updatedSettings);
      setMessage({ type: 'success', text: 'Configurações salvas com sucesso' });
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      setMessage({ type: 'error', text: 'Erro ao salvar configurações' });
    } finally {
      setSaving(false);
    }
  };

  const executeEscalation = async () => {
    try {
      setSaving(true);
      await apiRequest('/admin/escalar-pedidos', {
        method: 'POST',
      });
      setMessage({ type: 'success', text: 'Escalonamento executado com sucesso' });
    } catch (error) {
      console.error('Erro ao executar escalonamento:', error);
      setMessage({ type: 'error', text: 'Erro ao executar escalonamento' });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1>Painel Administrativo</h1>
          <p className="text-gray-600">Carregando dados...</p>
        </div>
        <div className="flex justify-center">
          <RefreshCw className="w-6 h-6 animate-spin" />
        </div>
      </div>
    );
  }

  const getRoleBadgeColor = (papel: string) => {
    switch (papel) {
      case 'admin': return 'bg-red-100 text-red-800 border-red-200';
      case 'confederacao': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'federacao': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleLabel = (papel: string) => {
    switch (papel) {
      case 'admin': return 'Administrador';
      case 'confederacao': return 'Confederação';
      case 'federacao': return 'Federação';
      case 'operador': return 'Operador';
      default: return papel;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1>Painel Administrativo</h1>
        <p className="text-gray-600">Gerencie usuários, configurações e sistema</p>
      </div>

      {message && (
        <Alert className={message.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
          <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">
            <BarChart className="w-4 h-4 mr-2" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="w-4 h-4 mr-2" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="w-4 h-4 mr-2" />
            Configurações
          </TabsTrigger>
          <TabsTrigger value="system">
            <Shield className="w-4 h-4 mr-2" />
            Sistema
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">Total de Usuários</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl">{stats?.total_users || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">Total de Pedidos</CardTitle>
                <BarChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl">{stats?.total_pedidos || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">Cooperativas</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl">{stats?.total_cooperativas || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">Status do Sistema</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-sm text-green-600">Operacional</div>
              </CardContent>
            </Card>
          </div>

          {stats?.users_by_role && (
            <Card>
              <CardHeader>
                <CardTitle>Usuários por Papel</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(stats.users_by_role).map(([role, count]) => (
                    <div key={role} className="text-center">
                      <div className="text-2xl">{count}</div>
                      <div className="text-sm text-gray-600">{getRoleLabel(role)}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Gerenciamento de Usuários</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span>{user.nome}</span>
                        <Badge variant="outline" className={getRoleBadgeColor(user.papel)}>
                          {getRoleLabel(user.papel)}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{user.email}</p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Select
                        value={user.papel}
                        onValueChange={(newRole) => updateUser(user.id, { papel: newRole as any })}
                        disabled={user.id === user.id} // Não pode alterar próprio papel
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="operador">Operador</SelectItem>
                          <SelectItem value="federacao">Federação</SelectItem>
                          <SelectItem value="confederacao">Confederação</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          {settings && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Clock className="w-5 h-5 mr-2" />
                    Configurações de SLA
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sla-dias">Prazo SLA (dias)</Label>
                      <Input
                        id="sla-dias"
                        type="number"
                        min="1"
                        max="90"
                        value={settings.sla_dias}
                        onChange={(e) => setSettings({
                          ...settings,
                          sla_dias: parseInt(e.target.value) || 30
                        })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="warning-days">Aviso de vencimento (dias)</Label>
                      <Input
                        id="warning-days"
                        type="number"
                        min="1"
                        max="30"
                        value={settings.notifications.sla_warning_days}
                        onChange={(e) => setSettings({
                          ...settings,
                          notifications: {
                            ...settings.notifications,
                            sla_warning_days: parseInt(e.target.value) || 7
                          }
                        })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="escalation-enabled"
                      checked={settings.escalation_enabled}
                      onCheckedChange={(checked) => setSettings({
                        ...settings,
                        escalation_enabled: checked
                      })}
                    />
                    <Label htmlFor="escalation-enabled">Escalonamento automático habilitado</Label>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cron-interval">Intervalo de verificação (horas)</Label>
                    <Input
                      id="cron-interval"
                      type="number"
                      min="1"
                      max="24"
                      value={settings.cron_interval_hours}
                      onChange={(e) => setSettings({
                        ...settings,
                        cron_interval_hours: parseInt(e.target.value) || 1
                      })}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Palette className="w-5 h-5 mr-2" />
                    Personalização Visual
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="primary-color">Cor Primária</Label>
                      <Input
                        id="primary-color"
                        type="color"
                        value={settings.theme.primary_color}
                        onChange={(e) => setSettings({
                          ...settings,
                          theme: {
                            ...settings.theme,
                            primary_color: e.target.value
                          }
                        })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="secondary-color">Cor Secundária</Label>
                      <Input
                        id="secondary-color"
                        type="color"
                        value={settings.theme.secondary_color}
                        onChange={(e) => setSettings({
                          ...settings,
                          theme: {
                            ...settings.theme,
                            secondary_color: e.target.value
                          }
                        })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="logo-url">URL do Logo</Label>
                    <Input
                      id="logo-url"
                      type="url"
                      placeholder="https://exemplo.com/logo.png"
                      value={settings.theme.logo_url}
                      onChange={(e) => setSettings({
                        ...settings,
                        theme: {
                          ...settings.theme,
                          logo_url: e.target.value
                        }
                      })}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button 
                  onClick={() => updateSettings(settings)}
                  disabled={isSaving}
                >
                  {isSaving && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Configurações
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="system">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Operações do Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4>Executar Escalonamento Manual</h4>
                    <p className="text-sm text-gray-600">Força a verificação e escalonamento de pedidos vencidos</p>
                  </div>
                  <Button onClick={executeEscalation} disabled={isSaving}>
                    {isSaving && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                    Executar
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4>Recarregar Dados</h4>
                    <p className="text-sm text-gray-600">Atualiza estatísticas e dados do painel</p>
                  </div>
                  <Button variant="outline" onClick={loadData} disabled={isLoading}>
                    {isLoading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                    Recarregar
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status do Sistema</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>Backend</span>
                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Online
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Base de Dados</span>
                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Conectado
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Escalonamento Automático</span>
                    <Badge variant="outline" className={settings?.escalation_enabled ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-800 border-gray-200"}>
                      {settings?.escalation_enabled ? <CheckCircle className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}
                      {settings?.escalation_enabled ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};