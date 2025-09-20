import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { PedidosLista } from './components/PedidosLista';
import { OperadoresLista } from './components/OperadoresLista';
import { NovoPedidoForm } from './components/NovoPedidoForm';
import { PedidoDetalhes } from './components/PedidoDetalhes';
import { Pedido } from './types';
import { CooperativasView } from './components/CooperativasView';
import { ConfiguracoesView } from './components/ConfiguracoesView';

// Componente interno que usa o AuthContext
function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showNovoPedido, setShowNovoPedido] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);

  // Mostrar loading durante verificação da autenticação
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'pedidos':
        return (
          <PedidosLista
            onCreatePedido={() => setShowNovoPedido(true)}
            onViewPedido={(pedido) => setSelectedPedido(pedido)}
          />
        );
      case 'cooperativas':
        return <CooperativasView />;
      case 'operadores':
        return <OperadoresLista />;
      case 'configuracoes':
        return <ConfiguracoesView />;
      default:
        return <Dashboard />;
    }
  };

  // Se autenticado, mostrar aplicação principal
  return (
    <div className="h-screen bg-gray-50">
      <Layout activeTab={activeTab} onTabChange={setActiveTab}>
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
