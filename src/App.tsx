import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { PedidosLista } from './components/PedidosLista';
import { OperadoresLista } from './components/OperadoresLista';
import { NovoPedidoForm } from './components/NovoPedidoForm';
import { PedidoDetalhes } from './components/PedidoDetalhes';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Building2, Settings, Users, MapPin } from 'lucide-react';
import { apiService } from './services/apiService';
import { Pedido, Operador, Cooperativa, Cidade } from './types';

// Componente interno que usa o AuthContext
function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showNovoPedido, setShowNovoPedido] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [selectedOperador, setSelectedOperador] = useState<Operador | null>(null);
  const [showNovoOperador, setShowNovoOperador] = useState(false);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

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

  const handleCreatePedido = () => {
    setShowNovoPedido(false);
    // Força refresh da lista de pedidos
    setActiveTab('pedidos');
  };

  const handleUpdatePedido = (pedidoId: string, updates: Partial<Pedido>) => {
    setPedidos(pedidos.map(p => 
      p.id === pedidoId 
        ? { ...p, ...updates }
        : p
    ));
    // Em um sistema real, isso faria uma chamada API
    console.log('Pedido atualizado:', pedidoId, updates);
  };

  const CooperativasView = () => {
    const [cooperativas, setCooperativas] = useState<Cooperativa[]>([]);
    const [operadores, setOperadores] = useState<Operador[]>([]);
    const [cidades, setCidades] = useState<Cidade[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
      const loadData = async () => {
        try {
          setIsLoading(true);
          const [cooperativasData, operadoresData, cidadesData] = await Promise.all([
            apiService.getCooperativas(),
            apiService.getOperadores(),
            apiService.getCidades()
          ]);
          
          setCooperativas(cooperativasData);
          setOperadores(operadoresData);
          setCidades(cidadesData);
        } catch (err) {
          console.error('Erro ao carregar dados:', err);
          setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
        } finally {
          setIsLoading(false);
        }
      };

      loadData();
    }, []);

    const getOperadoresCount = (idSingular: string) => {
      return operadores.filter(op => op.id_singular === idSingular && op.ativo).length;
    };

    const getCidadesCount = (idSingular: string) => {
      return cidades.filter(cidade => cidade.id_singular === idSingular).length;
    };

    if (isLoading) {
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cooperativas</h1>
            <p className="text-gray-600">Gerencie as cooperativas do sistema Uniodonto</p>
          </div>
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando cooperativas...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cooperativas</h1>
            <p className="text-gray-600">Gerencie as cooperativas do sistema Uniodonto</p>
          </div>
          <div className="text-center py-8">
            <p className="text-red-600">Erro: {error}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cooperativas</h1>
          <p className="text-gray-600">Gerencie as cooperativas do sistema Uniodonto</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cooperativas.map((coop) => (
            <Card key={coop.id_singular} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Building2 className="w-5 h-5 mr-2" />
                    <span className="truncate">{coop.uniodonto}</span>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={
                      coop.tipo === 'SINGULAR' ? 'bg-green-100 text-green-800 border-green-200' :
                      coop.tipo === 'FEDERAÇÃO' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                      'bg-red-100 text-red-800 border-red-200'
                    }
                  >
                    {coop.tipo}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-600">Razão Social:</span>
                    <p className="text-sm text-gray-900 mt-1 line-clamp-2">{coop.raz_social}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-medium text-gray-600">CNPJ:</span>
                      <p className="text-sm text-gray-900">{coop.cnpj}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Código ANS:</span>
                      <p className="text-sm text-gray-900">{coop.codigo_ans || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-medium text-gray-600">Operadores:</span>
                      <div className="flex items-center mt-1">
                        <Users className="w-4 h-4 text-gray-400 mr-1" />
                        <span className="text-sm font-medium">{getOperadoresCount(coop.id_singular)}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Cidades:</span>
                      <div className="flex items-center mt-1">
                        <MapPin className="w-4 h-4 text-gray-400 mr-1" />
                        <span className="text-sm font-medium">{getCidadesCount(coop.id_singular)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-sm font-medium text-gray-600">Software:</span>
                    <p className="text-sm text-gray-900">{coop.software || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const ConfiguracoesView = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-600">Configure o sistema</p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="w-5 h-5 mr-2" />
            Configurações do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            As configurações do sistema serão implementadas em versões futuras.
          </p>
        </CardContent>
      </Card>
    </div>
  );

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
        return (
          <OperadoresLista
            onCreateOperador={() => setShowNovoOperador(true)}
            onEditOperador={(operador) => setSelectedOperador(operador)}
          />
        );
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
