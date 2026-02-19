import { ArrowUpRight, Network } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

const UFAST_PORTAL_URL = 'https://portal.uniodonto.com.br/login.aspx?ReturnUrl=%2fdefault.aspx';

export function UfastHubPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[#E7E4FB] bg-gradient-to-r from-[#EEF5FF] via-white to-[#F6F3FF] px-6 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Ufast</h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-600">
              Módulo da Câmara de Compensação para conectividade e operação entre sistemas.
            </p>
          </div>
          <span className="rounded-full bg-[#EEF5FF] px-3 py-1 text-xs font-medium text-[#2956C4]">/ufast/dashboard</span>
        </div>
      </section>

      <Card className="rounded-2xl border border-[#E7E4FB] bg-white">
        <CardHeader>
          <div className="flex items-center gap-2 text-[#2F4EA5]">
            <Network className="h-4 w-4" />
            <CardTitle className="text-base text-gray-900">Acesso à Câmara</CardTitle>
          </div>
          <CardDescription>
            O acesso operacional é feito no portal oficial da Câmara de Compensação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="rounded-xl bg-[#5A46C5] hover:bg-[#4C3CB0]">
            <a href={UFAST_PORTAL_URL} target="_blank" rel="noopener noreferrer">
              Acessar Portal da Câmara
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

