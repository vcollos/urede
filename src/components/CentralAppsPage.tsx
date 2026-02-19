import { AppWindow, ExternalLink, FileText, Mail, Sparkles } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface CentralAppsPageProps {
  onOpenPropostasModule: () => void;
  onOpenEmailSignatureModule: () => void;
}

export function CentralAppsPage({
  onOpenPropostasModule,
  onOpenEmailSignatureModule,
}: CentralAppsPageProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[#E7E4FB] bg-gradient-to-r from-[#F6F3FF] via-white to-[#F2FAFF] px-6 py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#5A46C5] shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Novo bloco do Hub
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">Central de Apps</h1>
            <p className="max-w-3xl text-sm text-gray-600">
              Catálogo dos aplicativos externos conectados ao UHub. Novos apps podem ser adicionados em
              <code className="mx-1 rounded bg-white px-1.5 py-0.5 text-xs">sub_apps/</code>
              e publicados neste catálogo.
            </p>
          </div>
          <div className="hidden rounded-2xl bg-white p-3 shadow-sm md:block">
            <AppWindow className="h-6 w-6 text-[#5A46C5]" />
          </div>
        </div>
      </section>

      <section className="grid items-stretch gap-4 md:grid-cols-2">
        <Card className="h-full rounded-2xl border border-[#E7E4FB] bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[#5A46C5]">
                <FileText className="h-4 w-4" />
                <CardTitle className="text-base text-gray-900">Gerador de Propostas</CardTitle>
              </div>
              <Badge className="bg-[#E7F8EE] text-[#1F7A47] hover:bg-[#E7F8EE]">Disponível</Badge>
            </div>
            <CardDescription>
              Módulo integrado ao UHub com criação de propostas, preview e exportação (HTML/PDF/JSON).
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto flex flex-1 flex-col gap-3">
            <p className="text-xs text-gray-500">Executa dentro do layout e estilo do portal.</p>
            <Button onClick={onOpenPropostasModule} className="mt-auto w-full rounded-xl bg-[#5A46C5] hover:bg-[#4C3CB0]">
              Abrir módulo
              <ExternalLink className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card className="h-full rounded-2xl border border-[#E7E4FB] bg-white/90">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[#5A46C5]">
                <Mail className="h-4 w-4" />
                <CardTitle className="text-base text-gray-800">Assinatura de Emails</CardTitle>
              </div>
              <Badge className="bg-[#E7F8EE] text-[#1F7A47] hover:bg-[#E7F8EE]">Disponível</Badge>
            </div>
            <CardDescription>
              Gerador padronizado de assinatura para equipes e cooperativas.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto flex flex-1 flex-col gap-3">
            <p className="text-xs text-gray-500">Executa dentro do layout e estilo do portal.</p>
            <Button onClick={onOpenEmailSignatureModule} className="mt-auto w-full rounded-xl bg-[#5A46C5] hover:bg-[#4C3CB0]">
              Abrir módulo
              <ExternalLink className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

      </section>
    </div>
  );
}
