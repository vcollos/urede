import { useEffect, useMemo, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { PedidosLista, type PedidosFilterPreset } from './components/PedidosLista';
import { OperadoresLista } from './components/OperadoresLista';
import { NovoPedidoForm } from './components/NovoPedidoForm';
import { PedidoDetalhes } from './components/PedidoDetalhes';
import { Pedido } from './types';
import { CooperativasView } from './components/CooperativasView';
import { ConfiguracoesView } from './components/ConfiguracoesView';
import { CidadesView } from './components/CidadesView';
import { PedidosImportPage } from './components/PedidosImportPage';
import { ConfirmEmailScreen } from './components/ConfirmEmailScreen';
import { Button } from './components/ui/button';
import { apiService } from './services/apiService';
import { DocumentacaoUsuariosApp } from './documentacao/usuarios';
import { ReportsView } from './components/ReportsView';
import { GestaoDadosPage } from './components/GestaoDadosPage';

// Componente interno que usa o AuthContext
function AppContent() {
  const { isAuthenticated, isLoading, user, refreshUser } = useAuth();
  const deriveTabFromPath = useMemo(() => {
    return (pathname: string) => {
      if (pathname.startsWith('/cooperativas')) return 'cooperativas';
      if (pathname.startsWith('/cidades')) return 'cidades';
      if (pathname.startsWith('/operadores')) return 'operadores';
      if (pathname.startsWith('/configuracoes')) return 'configuracoes';
      if (pathname.startsWith('/relatorios')) return 'relatorios';
      if (pathname.startsWith('/importacao')) return 'importacao';
      if (pathname.startsWith('/gestao_dados')) return 'gestao_dados';
      if (pathname.startsWith('/pedidos')) return 'pedidos';
      if (pathname === '/' || pathname === '') return 'dashboard';
      return 'dashboard';
    };
  }, []);

  const [activeTab, setActiveTab] = useState(() => {
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
    return deriveTabFromPath(pathname);
  });
  const [showNovoPedido, setShowNovoPedido] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [pedidosPresetFilter, setPedidosPresetFilter] = useState<PedidosFilterPreset | null>(null);
  const openNovoPedido = () => setShowNovoPedido(true);

  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  if (pathname.startsWith('/documentacao/usuarios')) {
    return <DocumentacaoUsuariosApp />;
  }
  if (pathname.startsWith('/confirm-email')) {
    return (
      <ConfirmEmailScreen
        onGoToLogin={() => {
          if (typeof window !== 'undefined') {
            window.location.assign('/');
          }
        }}
      />
    );
  }

  // Mini-router: permite deep links (ex.: /cooperativas/001) e navegação por pushState.
  useEffect(() => {
    const handle = () => {
      setActiveTab(deriveTabFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', handle);
    return () => window.removeEventListener('popstate', handle);
  }, [deriveTabFromPath]);

  // Mostrar loading durante verificação da autenticação
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center dark:bg-slate-950">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Se não estiver autenticado, mostrar tela de login
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  if (user?.approval_status && user.approval_status !== 'approved') {
    const status = user.approval_status;
    const titleMap: Record<string, string> = {
      pending_confirmation: 'Confirmação de e-mail pendente',
      pending_approval: 'Conta aguardando aprovação',
      pending_manual: 'Aprovação manual necessária',
      rejected: 'Conta não aprovada',
    };
    const descriptionMap: Record<string, string> = {
      pending_confirmation: 'Confirme seu e-mail para prosseguir com a ativação da conta.',
      pending_approval: 'Sua confirmação foi recebida e aguarda a aprovação do responsável pela cooperativa.',
      pending_manual: 'Sua conta será analisada pela administração. Aguarde contato.',
      rejected: 'Sua solicitação foi rejeitada. Entre em contato com o suporte para mais detalhes.',
    };

    const title = titleMap[status] || 'Ativação pendente';
    const description = descriptionMap[status] || 'Estamos processando sua solicitação.';

    const handleRefresh = async () => {
      try {
        await refreshUser();
      } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
      }
    };

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center dark:bg-slate-950 p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 shadow rounded-lg p-6 space-y-4 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
          <p className="text-gray-600 dark:text-gray-300">{description}</p>
          <Button onClick={handleRefresh}>Atualizar status</Button>
        </div>
      </div>
    );
  }

  const handleUpdatePedido = (pedidoId: string, updates: Partial<Pedido>) => {
    setSelectedPedido(prev => {
      if (!prev || prev.id !== pedidoId) return prev;
      return { ...prev, ...updates };
    });
  };

  const handlePedidoCreated = (_pedido: Pedido) => {
    setActiveTab('pedidos');
    setSelectedPedido(null);
  };

  const navigateToPedidosWithFilter = (filter: PedidosFilterPreset) => {
    setActiveTab('pedidos');
    setSelectedPedido(null);
    setPedidosPresetFilter({ ...filter, token: Date.now() });
  };

  const handleOpenImportacao = () => {
    setActiveTab('importacao');
    setSelectedPedido(null);
    setPedidosPresetFilter(null);
  };

  const handleOpenPedidoFromAlert = async (pedidoId: string) => {
    try {
      const pedidoDetalhado = await apiService.getPedidoById(pedidoId);
      setActiveTab('pedidos');
      setSelectedPedido(pedidoDetalhado);
    } catch (error) {
      console.error('Erro ao abrir pedido via alerta:', error);
      alert('Não foi possível carregar o pedido selecionado. Tente novamente.');
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            onNavigateToPedidos={navigateToPedidosWithFilter}
            onViewPedido={(pedido) => setSelectedPedido(pedido)}
          />
        );
      case 'pedidos':
        return (
          <PedidosLista
            onViewPedido={(pedido) => setSelectedPedido(pedido)}
            presetFilter={pedidosPresetFilter}
          />
        );
      case 'importacao':
        return <PedidosImportPage onBack={() => setActiveTab('pedidos')} />;
      case 'gestao_dados':
        return user?.papel === 'admin' ? <GestaoDadosPage /> : <Dashboard onNavigateToPedidos={navigateToPedidosWithFilter} />;
      case 'cooperativas':
        return <CooperativasView />;
      case 'operadores':
        return user?.papel === 'admin' ? <OperadoresLista /> : <Dashboard onNavigateToPedidos={navigateToPedidosWithFilter} />;
      case 'cidades':
        return <CidadesView />;
      case 'configuracoes':
        return <ConfiguracoesView />;
      case 'relatorios':
        return <ReportsView />;
      default:
        return <Dashboard onNavigateToPedidos={navigateToPedidosWithFilter} />;
    }
  };

  // Se autenticado, mostrar aplicação principal
  return (
    <div className="h-screen bg-gray-50 dark:bg-slate-950">
      <Layout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onCreatePedido={openNovoPedido}
        onOpenPedido={handleOpenPedidoFromAlert}
        onOpenImportacao={handleOpenImportacao}
      >
        {renderContent()}
      </Layout>

      {/* Modais */}
      {showNovoPedido && (
        <NovoPedidoForm
          onClose={() => setShowNovoPedido(false)}
          onSubmit={handlePedidoCreated}
        />
      )}

      {selectedPedido && (
        <PedidoDetalhes
          pedido={selectedPedido}
          onClose={() => setSelectedPedido(null)}
          onUpdatePedido={handleUpdatePedido}
        />
      )}
    </div>
  );
}

// Componente principal que provê o contexto de autenticação
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
