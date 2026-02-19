import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { Pedido, DashboardStats } from '../types';
import type { PedidosFilterPreset } from './PedidosLista';
import { PedidosLista } from './PedidosLista';

type DashboardProps = {
  onNavigateToPedidos: (filter: PedidosFilterPreset) => void;
  onViewPedido: (pedido: Pedido) => void;
};

export function Dashboard({ onNavigateToPedidos, onViewPedido }: DashboardProps) {
  const { user } = useAuth();
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      return;
    }

    let isMounted = true;

    const loadDashboardData = async () => {
      try {
        setIsLoading(true);
        const statsData = await apiService.getDashboardStats();
        if (!isMounted) return;
        setDashboardStats(statsData);
      } catch (err) {
        console.error('Erro ao carregar dados do dashboard:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    const handler = () => { loadDashboardData(); };

    loadDashboardData();
    window.addEventListener('pedido:created', handler);
    window.addEventListener('pedido:updated', handler);
    window.addEventListener('pedido:deleted', handler);

    return () => {
      isMounted = false;
      window.removeEventListener('pedido:created', handler);
      window.removeEventListener('pedido:updated', handler);
      window.removeEventListener('pedido:deleted', handler);
    };
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

  const stats: Array<{
    title: string;
    value: string;
    description: string;
    icon: typeof FileText;
    color: string;
    bgColor: string;
    filter: PedidosFilterPreset;
  }> = [
    {
      title: "Total de Pedidos",
      value: dashboardStats.total_pedidos.toString(),
      description: "Pedidos sob sua responsabilidade",
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      filter: { status: 'todos', custom: null }
    },
    {
      title: "Vencendo em 7 dias",
      value: dashboardStats.pedidos_vencendo.toString(),
      description: "Requer atenção urgente",
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-100",
      filter: { status: 'todos', custom: 'vencendo' }
    },
    {
      title: "Em Andamento",
      value: dashboardStats.pedidos_em_andamento.toString(),
      description: "Sendo processados",
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
      filter: { status: 'em_andamento', custom: null }
    },
    {
      title: "Concluídos",
      value: dashboardStats.pedidos_concluidos.toString(),
      description: "Finalizados com sucesso",
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100",
      filter: { status: 'concluido', custom: null }
    }
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.title}
              role="button"
              tabIndex={0}
              className="transition transform hover:-translate-y-1 hover:shadow-lg cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
              onClick={() => onNavigateToPedidos(stat.filter)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onNavigateToPedidos(stat.filter);
                }
              }}
            >
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

      <PedidosLista
        embedded
        defaultViewMode="kanban"
        showScopeFilter
        defaultScopeFilter="me"
        excludeCreatedOutsideCoop
        onViewPedido={onViewPedido}
      />
    </div>
  );
}
