import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  TrendingUp,
  Users
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { Pedido, DashboardStats } from '../types';

export function Dashboard() {
  const { user } = useAuth();
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true);
        const [statsData, pedidosData] = await Promise.all([
          apiService.getDashboardStats(),
          apiService.getPedidos()
        ]);
        
        setDashboardStats(statsData);
        setPedidos(pedidosData);
      } catch (err) {
        console.error('Erro ao carregar dados do dashboard:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      loadDashboardData();
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Erro: {error}</p>
      </div>
    );
  }

  if (!dashboardStats || !user) {
    return null;
  }

  const pedidosVencendo = pedidos.filter(p => p.dias_restantes <= 7 && p.status !== 'concluido');
  const pedidosEmAndamento = pedidos.filter(p => p.status === 'em_andamento');
  const pedidosConcluidos = pedidos.filter(p => p.status === 'concluido');

  const stats = [
    {
      title: "Total de Pedidos",
      value: dashboardStats.total_pedidos.toString(),
      description: "Pedidos sob sua responsabilidade",
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-100"
    },
    {
      title: "Vencendo em 7 dias",
      value: dashboardStats.pedidos_vencendo.toString(),
      description: "Requer atenção urgente",
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-100"
    },
    {
      title: "Em Andamento",
      value: dashboardStats.pedidos_em_andamento.toString(),
      description: "Sendo processados",
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100"
    },
    {
      title: "Concluídos",
      value: dashboardStats.pedidos_concluidos.toString(),
      description: "Finalizados com sucesso",
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100"
    }
  ];

  const getNivelBadgeColor = (nivel: string) => {
    switch (nivel) {
      case 'singular': return 'bg-green-100 text-green-800 border-green-200';
      case 'federacao': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'confederacao': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'novo': return 'bg-blue-100 text-blue-800';
      case 'em_andamento': return 'bg-yellow-100 text-yellow-800';
      case 'concluido': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (diasRestantes: number) => {
    if (diasRestantes <= 3) return 'text-red-600';
    if (diasRestantes <= 7) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
                  </div>
                  <div className={`w-12 h-12 ${stat.bgColor} rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pedidos Urgentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
              Pedidos Urgentes
            </CardTitle>
            <CardDescription>
              Pedidos que vencem em até 7 dias
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pedidosVencendo.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  Nenhum pedido vencendo nos próximos 7 dias
                </p>
              ) : (
                pedidosVencendo.map((pedido) => (
                  <div key={pedido.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {pedido.titulo}
                      </p>
                      <p className="text-sm text-gray-600">
                        {pedido.cidade_nome || 'Cidade'}, {pedido.estado || 'UF'}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant="outline" className={getNivelBadgeColor(pedido.nivel_atual)}>
                          {pedido.nivel_atual}
                        </Badge>
                        <Badge variant="outline" className={getStatusBadgeColor(pedido.status)}>
                          {pedido.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className={`font-medium ${getPriorityColor(pedido.dias_restantes)}`}>
                        {pedido.dias_restantes} dias
                      </p>
                      <p className="text-xs text-gray-500">restantes</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Resumo de Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="w-5 h-5 text-green-600 mr-2" />
              Performance SLA
            </CardTitle>
            <CardDescription>
              Cumprimento de prazos nos últimos 30 dias
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Cumprimento Geral</span>
                  <span className="text-sm font-bold text-green-600">{dashboardStats.sla_cumprido}%</span>
                </div>
                <Progress value={dashboardStats.sla_cumprido} className="h-2" />
              </div>
              
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {dashboardStats.pedidos_concluidos}
                  </p>
                  <p className="text-xs text-gray-500">Concluídos</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-600">
                    {dashboardStats.pedidos_em_andamento}
                  </p>
                  <p className="text-xs text-gray-500">Em Andamento</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {dashboardStats.pedidos_vencendo}
                  </p>
                  <p className="text-xs text-gray-500">Vencendo</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Atividade Recente */}
      <Card>
        <CardHeader>
          <CardTitle>Atividade Recente</CardTitle>
          <CardDescription>
            Últimas movimentações em seus pedidos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pedidos.slice(0, 5).map((pedido) => (
              <div key={pedido.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <div>
                    <p className="font-medium text-gray-900">{pedido.titulo}</p>
                    <p className="text-sm text-gray-600">
                      {pedido.cidade_nome || 'Cidade'}, {pedido.estado || 'UF'} • {pedido.especialidades.join(', ')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className={getNivelBadgeColor(pedido.nivel_atual)}>
                    {pedido.nivel_atual}
                  </Badge>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(pedido.data_ultima_alteracao).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}