import { Archive, Shield } from 'lucide-react';

const EMBEDDED_SUBAPP_URL = '/sub_apps/central_arquivos/index.html?module=udocs';

export function UDocsHubPage() {
  return (
    <div>
      <section className="rounded-3xl border border-[#E7E4FB] bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-[#E7E4FB] px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Archive className="h-4 w-4 text-[#5A46C5]" />
            Modo integrado no Hub
          </div>
          <span className="rounded-full bg-[#EEF5FF] px-3 py-1 text-xs font-medium text-[#2956C4]">/udocs/dashboard</span>
        </div>
        <div className="flex items-center justify-between border-b border-[#F2F1FB] px-4 py-2 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1">
            <Shield className="h-3.5 w-3.5" />
            Downloads e prévias passam pelo backend para auditoria.
          </span>
        </div>
        <div className="h-[calc(100vh-310px)] min-h-[560px]">
          <iframe
            title="UDocs"
            src={EMBEDDED_SUBAPP_URL}
            className="h-full w-full rounded-b-3xl border-0"
          />
        </div>
      </section>
    </div>
  );
}

// Compatibilidade com imports antigos
export const CentralArquivosHubPage = UDocsHubPage;
