import { AppWindow, ArrowRight, BarChart3, Building2, Database, MapPin, Network, Settings, Users } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

type HubShortcutTab = 'cooperativas' | 'cidades' | 'configuracoes_hub' | 'operadores' | 'gestao_dados' | 'central_apps';

interface HubHomePageProps {
  isAdmin: boolean;
  userName: string;
  onOpenUredeModule: () => void;
  onOpenHubTab: (tab: HubShortcutTab) => void;
}

export function HubHomePage({ isAdmin, userName, onOpenUredeModule, onOpenHubTab }: HubHomePageProps) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card className="h-full rounded-2xl border border-[#E7E4FB] bg-white">
          <CardHeader>
            <div className="flex items-center gap-2 text-[#5A46C5]">
              <BarChart3 className="h-4 w-4" />
              <CardTitle className="text-base text-gray-900">URede</CardTitle>
            </div>
            <CardDescription>
              Operação de pedidos, dashboard, relatórios e importações em lote.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <div className="mb-3 flex items-center justify-between gap-2">
              <Badge className="bg-[#ECE8FF] text-[#5B48C7] hover:bg-[#ECE8FF]">UHub</Badge>
            </div>
            <Button onClick={onOpenUredeModule} className="w-full rounded-xl bg-[#5A46C5] hover:bg-[#4C3CB0]">
              Entrar no módulo
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card className="h-full rounded-2xl border border-[#E7E4FB] bg-white">
          <CardHeader>
            <div className="flex items-center gap-2 text-[#5A46C5]">
              <AppWindow className="h-4 w-4" />
              <CardTitle className="text-base text-gray-900">Central de Apps</CardTitle>
            </div>
            <CardDescription>
              Catálogo de aplicativos externos integrados ao ecossistema UHub.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <Button onClick={() => onOpenHubTab('central_apps')} className="w-full rounded-xl bg-[#5A46C5] hover:bg-[#4C3CB0]">
              Entrar na central
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card className="h-full rounded-2xl border border-[#E7E4FB] bg-white/90">
          <CardHeader>
            <div className="flex items-center gap-2 text-gray-500">
              <Network className="h-4 w-4" />
              <CardTitle className="text-base text-gray-800">Marketing</CardTitle>
            </div>
            <CardDescription>Espaço reservado para campanhas e comunicação institucional.</CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <Badge variant="outline" className="text-xs">Em breve</Badge>
          </CardContent>
        </Card>

        <Card className="h-full rounded-2xl border border-[#E7E4FB] bg-white/90">
          <CardHeader>
            <div className="flex items-center gap-2 text-gray-500">
              <Network className="h-4 w-4" />
              <CardTitle className="text-base text-gray-800">Câmara de compensação / UFAST</CardTitle>
            </div>
            <CardDescription>Conectores de compensação e comunicação entre sistemas.</CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <Badge variant="outline" className="text-xs">Em breve</Badge>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9087D6] mb-3">Atalhos globais do Hub</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Button variant="outline" className="justify-start rounded-xl h-12" onClick={() => onOpenHubTab('cooperativas')}>
            <Building2 className="h-4 w-4 mr-2" />
            Cooperativas
          </Button>
          <Button variant="outline" className="justify-start rounded-xl h-12" onClick={() => onOpenHubTab('cidades')}>
            <MapPin className="h-4 w-4 mr-2" />
            Cidades
          </Button>
          {isAdmin && (
            <Button variant="outline" className="justify-start rounded-xl h-12" onClick={() => onOpenHubTab('configuracoes_hub')}>
              <Settings className="h-4 w-4 mr-2" />
              Configurações
            </Button>
          )}
          {isAdmin && (
            <Button variant="outline" className="justify-start rounded-xl h-12" onClick={() => onOpenHubTab('operadores')}>
              <Users className="h-4 w-4 mr-2" />
              Usuários
            </Button>
          )}
          {isAdmin && (
            <Button variant="outline" className="justify-start rounded-xl h-12" onClick={() => onOpenHubTab('gestao_dados')}>
              <Database className="h-4 w-4 mr-2" />
              Gestão de dados
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
