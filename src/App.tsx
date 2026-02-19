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
import { HubHomePage } from './components/HubHomePage';
import { PessoasView } from './components/PessoasView';
import { CentralAppsPage } from './components/CentralAppsPage';
import { PropostasHubPage } from './components/PropostasHubPage';
import { EmailSignatureHubPage } from './components/EmailSignatureHubPage';
import { UDocsHubPage } from './components/CentralArquivosHubPage';
import { UMarketingHubPage } from './components/UMarketingHubPage';
import { UfastHubPage } from './components/UfastHubPage';
import { hasModuleAccess } from './utils/moduleAccess';

type AppModule = 'hub' | 'urede' | 'udocs' | 'umarketing' | 'ufast';
type AppTab =
  | 'hub_home'
  | 'central_apps'
  | 'apps_propostas'
  | 'apps_assinatura_email'
  | 'udocs_dashboard'
  | 'umarketing_dashboard'
  | 'ufast_dashboard'
  | 'cooperativas'
  | 'cidades'
  | 'configuracoes'
  | 'configuracoes_hub'
  | 'configuracoes_urede'
  | 'operadores'
  | 'pessoas'
  | 'gestao_dados'
  | 'dashboard'
  | 'pedidos'
  | 'importacao'
  | 'relatorios';

// Componente interno que usa o AuthContext
function AppContent() {
  const { isAuthenticated, isLoading, user, refreshUser } = useAuth();
  const tabPathMap: Record<AppTab, string> = {
    hub_home: '/hub',
    central_apps: '/hub/apps',
    apps_propostas: '/hub/apps/propostas',
    apps_assinatura_email: '/hub/apps/assinatura-email',
    udocs_dashboard: '/udocs/dashboard',
    umarketing_dashboard: '/umarketing/dashboard',
    ufast_dashboard: '/ufast/dashboard',
    cooperativas: '/hub/cooperativas',
    cidades: '/hub/cidades',
    configuracoes: '/hub/configuracoes',
    configuracoes_hub: '/hub/configuracoes',
    configuracoes_urede: '/urede/configuracoes',
    operadores: '/hub/usuarios',
    pessoas: '/hub/pessoas',
    gestao_dados: '/hub/gestao-dados',
    dashboard: '/urede/dashboard',
    pedidos: '/urede/pedidos',
    importacao: '/urede/importacao',
    relatorios: '/urede/relatorios',
  };

  const hubTabs = useMemo(() => new Set<AppTab>([
    'hub_home',
    'central_apps',
    'apps_propostas',
    'apps_assinatura_email',
    'cooperativas',
    'cidades',
    'configuracoes',
    'configuracoes_hub',
    'operadores',
    'pessoas',
    'gestao_dados',
  ]), []);
  const uredeTabs = useMemo(() => new Set<AppTab>([
    'dashboard',
    'pedidos',
    'importacao',
    'relatorios',
    'configuracoes_urede',
  ]), []);
  const udocsTabs = useMemo(() => new Set<AppTab>([
    'udocs_dashboard',
  ]), []);
  const umarketingTabs = useMemo(() => new Set<AppTab>([
    'umarketing_dashboard',
  ]), []);
  const ufastTabs = useMemo(() => new Set<AppTab>([
    'ufast_dashboard',
  ]), []);
  const centralAppsTabs = useMemo(() => new Set<AppTab>([
    'central_apps',
    'apps_propostas',
    'apps_assinatura_email',
  ]), []);

  const deriveModuleFromTab = useMemo(() => {
    return (tab: AppTab): AppModule => {
      if (hubTabs.has(tab)) return 'hub';
      if (uredeTabs.has(tab)) return 'urede';
      if (udocsTabs.has(tab)) return 'udocs';
      if (umarketingTabs.has(tab)) return 'umarketing';
      if (ufastTabs.has(tab)) return 'ufast';
      return 'hub';
    };
  }, [hubTabs, uredeTabs, udocsTabs, umarketingTabs, ufastTabs]);

  const deriveTabFromPath = useMemo(() => {
    return (pathname: string): AppTab => {
      const normalizedPath = pathname.replace(/\/+$/, '') || '/';

      if (normalizedPath === '/' || normalizedPath === '/hub') return 'hub_home';
      if (normalizedPath === '/udocs' || normalizedPath.startsWith('/udocs/dashboard')) return 'udocs_dashboard';
      if (normalizedPath === '/umarketing' || normalizedPath.startsWith('/umarketing/dashboard')) return 'umarketing_dashboard';
      if (normalizedPath === '/ufast' || normalizedPath.startsWith('/ufast/dashboard')) return 'ufast_dashboard';
      // Compatibilidade com rotas legadas da Central de Arquivos
      if (normalizedPath.startsWith('/hub/apps/central-arquivos')) return 'udocs_dashboard';
      if (normalizedPath.startsWith('/hub/apps/udocs')) return 'udocs_dashboard';
      if (normalizedPath.startsWith('/hub/apps/marketing')) return 'umarketing_dashboard';
      if (normalizedPath.startsWith('/hub/apps/umarketing')) return 'umarketing_dashboard';
      if (normalizedPath.startsWith('/hub/apps/ufast')) return 'ufast_dashboard';
      if (normalizedPath.startsWith('/hub/apps/assinatura-email')) return 'apps_assinatura_email';
      if (normalizedPath.startsWith('/hub/apps/propostas')) return 'apps_propostas';
      if (normalizedPath.startsWith('/hub/apps')) return 'central_apps';
      if (normalizedPath.startsWith('/hub/cooperativas') || normalizedPath.startsWith('/cooperativas')) return 'cooperativas';
      if (normalizedPath.startsWith('/hub/cidades') || normalizedPath.startsWith('/cidades')) return 'cidades';
      if (normalizedPath.startsWith('/hub/usuarios') || normalizedPath.startsWith('/operadores')) return 'operadores';
      if (normalizedPath.startsWith('/hub/pessoas') || normalizedPath.startsWith('/pessoas')) return 'pessoas';
      if (normalizedPath.startsWith('/hub/configuracoes') || normalizedPath.startsWith('/configuracoes')) return 'configuracoes_hub';
      if (normalizedPath.startsWith('/urede/configuracoes')) return 'configuracoes_urede';
      if (normalizedPath.startsWith('/hub/gestao-dados') || normalizedPath.startsWith('/gestao_dados')) return 'gestao_dados';
      if (normalizedPath.startsWith('/urede/relatorios') || normalizedPath.startsWith('/relatorios')) return 'relatorios';
      if (normalizedPath.startsWith('/urede/importacao') || normalizedPath.startsWith('/importacao')) return 'importacao';
      if (normalizedPath.startsWith('/urede/pedidos') || normalizedPath.startsWith('/pedidos')) return 'pedidos';
      if (normalizedPath.startsWith('/urede/dashboard') || normalizedPath.startsWith('/dashboard') || normalizedPath === '/urede') {
        return 'dashboard';
      }

      return 'hub_home';
    };
  }, []);

  const getInitialTab = () => {
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
    return deriveTabFromPath(pathname);
  };

  const [activeTab, setActiveTab] = useState<AppTab>(() => getInitialTab());
  const [activeModule, setActiveModule] = useState<AppModule>(() => deriveModuleFromTab(getInitialTab()));
  const [showNovoPedido, setShowNovoPedido] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [pedidosPresetFilter, setPedidosPresetFilter] = useState<PedidosFilterPreset | null>(null);
  const isMasterModuleUser = user?.papel === 'admin' || user?.papel === 'confederacao';
  const canAccessUrede = isMasterModuleUser || hasModuleAccess(user?.modulos_acesso, 'urede', ['hub']);
  const canAccessUDocs = isMasterModuleUser || hasModuleAccess(user?.modulos_acesso, 'udocs', ['hub']);
  const canAccessUMarketing = isMasterModuleUser || hasModuleAccess(user?.modulos_acesso, 'umarketing', ['hub']);
  const canAccessUfast = isMasterModuleUser || hasModuleAccess(user?.modulos_acesso, 'ufast', ['hub']);
  const canAccessCentralApps = isMasterModuleUser || hasModuleAccess(user?.modulos_acesso, 'central_apps', ['hub']);

  const navigateByTab = (tab: AppTab) => {
    const path = tabPathMap[tab];
    if (typeof window !== 'undefined' && window.location.pathname !== path) {
      window.history.pushState({ tab }, '', path);
    }
  };

  const setCurrentTab = (tab: AppTab) => {
    setActiveTab(tab);
    setActiveModule(deriveModuleFromTab(tab));
  };

  const navigateToUredeModule = () => {
    if (!canAccessUrede) {
      navigateToHubModule();
      return;
    }
    navigateByTab('dashboard');
    setCurrentTab('dashboard');
    setShowNovoPedido(false);
    setSelectedPedido(null);
    setPedidosPresetFilter(null);
  };

  const navigateToHubModule = () => {
    navigateByTab('hub_home');
    setCurrentTab('hub_home');
    setShowNovoPedido(false);
    setSelectedPedido(null);
    setPedidosPresetFilter(null);
  };

  const navigateToUDocsModule = () => {
    if (!canAccessUDocs) {
      navigateToHubModule();
      return;
    }
    navigateByTab('udocs_dashboard');
    setCurrentTab('udocs_dashboard');
    setShowNovoPedido(false);
    setSelectedPedido(null);
    setPedidosPresetFilter(null);
  };

  const navigateToUMarketingModule = () => {
    if (!canAccessUMarketing) {
      navigateToHubModule();
      return;
    }
    navigateByTab('umarketing_dashboard');
    setCurrentTab('umarketing_dashboard');
    setShowNovoPedido(false);
    setSelectedPedido(null);
    setPedidosPresetFilter(null);
  };

  const navigateToUfastModule = () => {
    if (!canAccessUfast) {
      navigateToHubModule();
      return;
    }
    navigateByTab('ufast_dashboard');
    setCurrentTab('ufast_dashboard');
    setShowNovoPedido(false);
    setSelectedPedido(null);
    setPedidosPresetFilter(null);
  };

  const openNovoPedido = () => {
    if (activeModule !== 'urede') {
      navigateToUredeModule();
    }
    setShowNovoPedido(true);
  };

  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';

  // Mini-router: permite deep links e navegação por pushState.
  useEffect(() => {
    const handle = () => {
      const nextTab = deriveTabFromPath(window.location.pathname);
      setCurrentTab(nextTab);
      setSelectedPedido(null);
      if (nextTab !== 'pedidos') {
        setPedidosPresetFilter(null);
      }
    };
    window.addEventListener('popstate', handle);
    return () => window.removeEventListener('popstate', handle);
  }, [deriveTabFromPath, deriveModuleFromTab]);

  useEffect(() => {
    if (!user || canAccessUrede) return;
    if (!uredeTabs.has(activeTab)) return;
    navigateByTab('hub_home');
    setCurrentTab('hub_home');
    setSelectedPedido(null);
    setPedidosPresetFilter(null);
  }, [activeTab, canAccessUrede, uredeTabs, user]);

  useEffect(() => {
    if (!user || canAccessUDocs) return;
    if (!udocsTabs.has(activeTab)) return;
    navigateByTab('hub_home');
    setCurrentTab('hub_home');
    setSelectedPedido(null);
    setPedidosPresetFilter(null);
  }, [activeTab, canAccessUDocs, udocsTabs, user]);

  useEffect(() => {
    if (!user || canAccessUMarketing) return;
    if (!umarketingTabs.has(activeTab)) return;
    navigateByTab('hub_home');
    setCurrentTab('hub_home');
    setSelectedPedido(null);
    setPedidosPresetFilter(null);
  }, [activeTab, canAccessUMarketing, umarketingTabs, user]);

  useEffect(() => {
    if (!user || canAccessUfast) return;
    if (!ufastTabs.has(activeTab)) return;
    navigateByTab('hub_home');
    setCurrentTab('hub_home');
    setSelectedPedido(null);
    setPedidosPresetFilter(null);
  }, [activeTab, canAccessUfast, ufastTabs, user]);

  useEffect(() => {
    if (!user || canAccessCentralApps) return;
    if (!centralAppsTabs.has(activeTab)) return;
    navigateByTab('hub_home');
    setCurrentTab('hub_home');
    setSelectedPedido(null);
    setPedidosPresetFilter(null);
  }, [activeTab, canAccessCentralApps, centralAppsTabs, user]);

  if (pathname.startsWith('/documentacao/usuarios')) {
    return <DocumentacaoUsuariosApp />;
  }
  if (pathname.startsWith('/confirm-email')) {
    return (
      <ConfirmEmailScreen
        onGoToLogin={() => {
          if (typeof window !== 'undefined') {
            window.location.assign('/hub');
          }
        }}
      />
    );
  }

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
    setSelectedPedido((prev) => {
      if (!prev || prev.id !== pedidoId) return prev;
      return { ...prev, ...updates };
    });
  };

  const handlePedidoCreated = (_pedido: Pedido) => {
    navigateByTab('pedidos');
    setCurrentTab('pedidos');
    setSelectedPedido(null);
    setShowNovoPedido(false);
  };

  const handleSidebarTabChange = (tab: string) => {
    if (!(tab in tabPathMap)) return;
    const nextTab = tab as AppTab;
    navigateByTab(nextTab);
    setShowNovoPedido(false);
    setSelectedPedido(null);
    if (nextTab !== 'pedidos') {
      setPedidosPresetFilter(null);
    }
    setCurrentTab(nextTab);
  };

  const handleModuleChange = (module: AppModule) => {
    if (module === 'hub') {
      navigateToHubModule();
      return;
    }
    if (module === 'umarketing') {
      navigateToUMarketingModule();
      return;
    }
    if (module === 'ufast') {
      navigateToUfastModule();
      return;
    }
    if (module === 'udocs') {
      navigateToUDocsModule();
      return;
    }
    if (!canAccessUrede) {
      navigateToHubModule();
      return;
    }
    navigateToUredeModule();
  };

  const navigateToPedidosWithFilter = (filter: PedidosFilterPreset) => {
    navigateByTab('pedidos');
    setCurrentTab('pedidos');
    setSelectedPedido(null);
    setPedidosPresetFilter({ ...filter, token: Date.now() });
  };

  const handleOpenImportacao = () => {
    navigateByTab('importacao');
    setCurrentTab('importacao');
    setSelectedPedido(null);
    setPedidosPresetFilter(null);
  };

  const handleOpenPedidoFromAlert = async (pedidoId: string) => {
    try {
      const pedidoDetalhado = await apiService.getPedidoById(pedidoId);
      navigateByTab('pedidos');
      setCurrentTab('pedidos');
      setSelectedPedido(pedidoDetalhado);
    } catch (error) {
      console.error('Erro ao abrir pedido via alerta:', error);
      alert('Não foi possível carregar o pedido selecionado. Tente novamente.');
    }
  };

  const renderHubHome = (isAdmin: boolean) => (
    <HubHomePage
      isAdmin={isAdmin}
      canAccessUrede={canAccessUrede}
      canAccessCentralApps={canAccessCentralApps}
      canAccessUDocs={canAccessUDocs}
      canAccessUMarketing={canAccessUMarketing}
      canAccessUfast={canAccessUfast}
      onOpenUredeModule={navigateToUredeModule}
      onOpenUDocsModule={navigateToUDocsModule}
      onOpenUMarketingModule={navigateToUMarketingModule}
      onOpenUfastModule={navigateToUfastModule}
      onOpenHubTab={(tab) => handleSidebarTabChange(tab)}
    />
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'hub_home':
        return renderHubHome(user?.papel === 'admin');
      case 'dashboard':
        if (!canAccessUrede) return renderHubHome(user?.papel === 'admin');
        return (
          <Dashboard
            onNavigateToPedidos={navigateToPedidosWithFilter}
            onViewPedido={(pedido) => {
              navigateByTab('pedidos');
              setCurrentTab('pedidos');
              setSelectedPedido(pedido);
            }}
          />
        );
      case 'pedidos':
        if (!canAccessUrede) return renderHubHome(user?.papel === 'admin');
        if (selectedPedido) {
          return (
            <PedidoDetalhes
              pedido={selectedPedido}
              inline
              onClose={() => setSelectedPedido(null)}
              onUpdatePedido={handleUpdatePedido}
            />
          );
        }
        return (
          <PedidosLista
            onViewPedido={(pedido) => setSelectedPedido(pedido)}
            presetFilter={pedidosPresetFilter}
          />
        );
      case 'importacao':
        if (!canAccessUrede) return renderHubHome(user?.papel === 'admin');
        return <PedidosImportPage onBack={() => handleSidebarTabChange('pedidos')} />;
      case 'gestao_dados':
        return user?.papel === 'admin' ? <GestaoDadosPage /> : renderHubHome(false);
      case 'central_apps':
        if (!canAccessCentralApps) return renderHubHome(user?.papel === 'admin');
        return (
          <CentralAppsPage
            onOpenPropostasModule={() => handleSidebarTabChange('apps_propostas')}
            onOpenEmailSignatureModule={() => handleSidebarTabChange('apps_assinatura_email')}
          />
        );
      case 'apps_propostas':
        if (!canAccessCentralApps) return renderHubHome(user?.papel === 'admin');
        return <PropostasHubPage />;
      case 'apps_assinatura_email':
        if (!canAccessCentralApps) return renderHubHome(user?.papel === 'admin');
        return <EmailSignatureHubPage />;
      case 'udocs_dashboard':
        if (!canAccessUDocs) return renderHubHome(user?.papel === 'admin');
        return <UDocsHubPage />;
      case 'umarketing_dashboard':
        if (!canAccessUMarketing) return renderHubHome(user?.papel === 'admin');
        return <UMarketingHubPage />;
      case 'ufast_dashboard':
        if (!canAccessUfast) return renderHubHome(user?.papel === 'admin');
        return <UfastHubPage />;
      case 'cooperativas':
        return <CooperativasView />;
      case 'operadores':
        return user?.papel === 'admin' ? <OperadoresLista /> : renderHubHome(false);
      case 'pessoas':
        return user?.papel === 'admin' ? <PessoasView /> : renderHubHome(false);
      case 'cidades':
        return <CidadesView />;
      case 'configuracoes':
      case 'configuracoes_hub':
        return <ConfiguracoesView module="hub" />;
      case 'configuracoes_urede':
        if (!canAccessUrede) return renderHubHome(user?.papel === 'admin');
        return <ConfiguracoesView module="urede" />;
      case 'relatorios':
        if (!canAccessUrede) return renderHubHome(user?.papel === 'admin');
        return <ReportsView />;
      default:
        return renderHubHome(user?.papel === 'admin');
    }
  };

  // Se autenticado, mostrar aplicação principal
  return (
    <div className="h-screen bg-gray-50 dark:bg-slate-950">
      <Layout
        activeTab={activeTab}
        activeModule={activeModule}
        canAccessUrede={canAccessUrede}
        canAccessCentralApps={canAccessCentralApps}
        canAccessUDocs={canAccessUDocs}
        canAccessUMarketing={canAccessUMarketing}
        canAccessUfast={canAccessUfast}
        onModuleChange={handleModuleChange}
        onTabChange={handleSidebarTabChange}
        onCreatePedido={activeModule === 'urede' && canAccessUrede ? openNovoPedido : undefined}
        onOpenPedido={handleOpenPedidoFromAlert}
        onOpenImportacao={activeModule === 'urede' && canAccessUrede ? handleOpenImportacao : undefined}
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
