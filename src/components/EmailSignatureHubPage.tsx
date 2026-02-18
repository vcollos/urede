import { ExternalLink, Mail } from 'lucide-react';
import { Button } from './ui/button';

const EMBEDDED_SUBAPP_URL = '/sub_apps/email_signature/index.html';
const STANDALONE_SUBAPP_URL = import.meta.env.VITE_SUBAPP_EMAIL_SIGNATURE_URL || 'http://127.0.0.1:3502';

export function EmailSignatureHubPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[#E7E4FB] bg-gradient-to-r from-[#F6F3FF] via-white to-[#F2FAFF] px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Assinatura de Email</h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-600">
              Gerador com wizard de 4 etapas, preview em tempo real e exportacao de assinatura em HTML e texto simples.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => window.open(STANDALONE_SUBAPP_URL, '_blank', 'noopener,noreferrer')}
          >
            Abrir standalone
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <section className="rounded-3xl border border-[#E7E4FB] bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-[#E7E4FB] px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Mail className="h-4 w-4 text-[#5A46C5]" />
            Modo integrado no Hub
          </div>
          <span className="rounded-full bg-[#EEF5FF] px-3 py-1 text-xs font-medium text-[#2956C4]">/hub/apps/assinatura-email</span>
        </div>
        <div className="h-[calc(100vh-280px)] min-h-[560px]">
          <iframe
            title="Gerador de Assinaturas de Email"
            src={EMBEDDED_SUBAPP_URL}
            className="h-full w-full rounded-b-3xl border-0"
          />
        </div>
      </section>
    </div>
  );
}
