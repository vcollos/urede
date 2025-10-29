import { useState } from 'react';
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
import { apiService } from './services/apiService';

// Componente interno que usa o AuthContext
function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showNovoPedido, setShowNovoPedido] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [pedidosPresetFilter, setPedidosPresetFilter] = useState<PedidosFilterPreset | null>(null);
  const openNovoPedido = () => setShowNovoPedido(true);

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
        return <Dashboard onNavigateToPedidos={navigateToPedidosWithFilter} />;
      case 'pedidos':
        return (
          <PedidosLista
            onViewPedido={(pedido) => setSelectedPedido(pedido)}
            presetFilter={pedidosPresetFilter}
          />
        );
      case 'importacao':
        return <PedidosImportPage onBack={() => setActiveTab('pedidos')} />;
      case 'cooperativas':
        return <CooperativasView />;
      case 'operadores':
        return <OperadoresLista />;
      case 'cidades':
        return <CidadesView />;
      case 'configuracoes':
        return <ConfiguracoesView />;
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
