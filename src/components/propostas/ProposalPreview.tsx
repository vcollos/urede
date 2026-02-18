import { Download, ExternalLink, FileCode, Mail, Save } from 'lucide-react';
import { useState } from 'react';
import { ProposalData } from '../../types/propostas';
import { downloadProposalHTML } from '../../utils/propostas/exportHTML';
import { exportProposalToPDF } from '../../utils/propostas/exportPDF';
import { Button } from '../ui/button';
import { ModalityComparison } from './ModalityComparison';

interface ProposalPreviewProps {
  data: ProposalData;
  hideActions?: boolean;
  onSave?: (name: string) => void;
  onNotify?: (message: string, tone?: 'success' | 'error') => void;
}

export function ProposalPreview({ data, hideActions, onSave, onNotify }: ProposalPreviewProps) {
  const [isExporting, setIsExporting] = useState(false);

  const notify = (message: string, tone: 'success' | 'error' = 'success') => {
    onNotify?.(message, tone);
  };

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      const fileName = `${(data.title || 'proposta').replace(/\s+/g, '_')}_${(data.clientName || 'cliente').replace(/\s+/g, '_')}.pdf`;
      await exportProposalToPDF(data, fileName);
      notify('PDF exportado com sucesso.', 'success');
    } catch (error) {
      console.error('[propostas] erro ao exportar PDF:', error);
      notify('Erro ao exportar PDF. Tente novamente.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportHTML = () => {
    try {
      downloadProposalHTML(data);
      notify('HTML exportado com sucesso.', 'success');
    } catch (error) {
      console.error('[propostas] erro ao exportar HTML:', error);
      notify('Erro ao exportar HTML. Tente novamente.', 'error');
    }
  };

  return (
    <div className="space-y-8">
      {!hideActions && (
        <div className="flex flex-wrap justify-end gap-3">
          {onSave && (
            <Button
              type="button"
              className="gap-2"
              onClick={() => {
                const name = data.title || 'Proposta sem título';
                onSave(name);
                notify('Proposta salva com sucesso.', 'success');
              }}
            >
              <Save className="h-4 w-4" />
              Salvar Proposta
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => {
              const subject = encodeURIComponent(`Proposta: ${data.title}`);
              const body = encodeURIComponent(
                `Olá ${data.clientName},\n\nSegue a proposta do Plano Odontológico Uniodonto conforme solicitado.\n\n${data.objective}\n\nAtenciosamente.`
              );
              window.location.href = `mailto:?subject=${subject}&body=${body}`;
            }}
          >
            <Mail className="h-4 w-4" />
            Enviar por Email
          </Button>

          <Button type="button" variant="outline" className="gap-2" onClick={handleExportHTML}>
            <FileCode className="h-4 w-4" />
            Exportar HTML
          </Button>

          <Button type="button" className="gap-2" onClick={handleExportPDF} disabled={isExporting}>
            <Download className="h-4 w-4" />
            {isExporting ? 'Gerando PDF...' : 'Exportar PDF'}
          </Button>
        </div>
      )}

      <div className="mx-auto max-w-5xl rounded-2xl border border-[#E7E4FB] bg-white p-8 shadow-sm md:p-12">
        <div className="mb-10 border-b-2 border-gray-900 pb-7">
          <h1 className="mb-2 text-3xl font-semibold text-gray-900">{data.title}</h1>
          <p className="text-xl text-gray-600">{data.clientName}</p>
        </div>

        <section className="mb-10">
          <h2 className="mb-3 text-2xl font-semibold text-gray-900">Objetivo</h2>
          <p className="whitespace-pre-wrap leading-relaxed text-gray-700">{data.objective}</p>
        </section>

        {data.modalities.map((modality, index) => (
          <section key={modality.id} className="mb-10">
            <div className="mb-6 rounded-xl bg-gray-900 p-6 text-white">
              <h2 className="mb-2 text-lg font-semibold">
                MODALIDADE {index + 1} — {(modality.name || '').toUpperCase()}
              </h2>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold">{modality.price}</span>
                {modality.billingType === 'monthly' && <span className="text-gray-300">/ mês</span>}
                {modality.billingType === 'oneTime' && <span className="text-gray-300">(pagamento único)</span>}
              </div>
            </div>

            {modality.included.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-2 text-lg font-semibold text-gray-900">O que está incluso</h3>
                <ul className="space-y-2">
                  {modality.included.map((item, itemIndex) => (
                    <li key={`${modality.id}-inc-${itemIndex}`} className="flex items-start gap-3">
                      <span className="mt-1 text-gray-900">•</span>
                      <span className="text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {modality.notIncluded?.length ? (
              <div className="mb-6">
                <h3 className="mb-2 text-lg font-semibold text-gray-900">O que não está incluso</h3>
                <ul className="space-y-2">
                  {modality.notIncluded.map((item, itemIndex) => (
                    <li key={`${modality.id}-ninc-${itemIndex}`} className="flex items-start gap-3">
                      <span className="mt-1 text-gray-900">•</span>
                      <span className="text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {(modality.responsibilities?.provider || modality.responsibilities?.client) && (
              <div className="mb-6">
                <h3 className="mb-2 text-lg font-semibold text-gray-900">Responsabilidades</h3>
                <div className="grid gap-6 md:grid-cols-2">
                  {modality.responsibilities?.provider && (
                    <div>
                      <h4 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-600">Fornecedor</h4>
                      <p className="whitespace-pre-wrap leading-relaxed text-gray-700">
                        {modality.responsibilities.provider}
                      </p>
                    </div>
                  )}
                  {modality.responsibilities?.client && (
                    <div>
                      <h4 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-600">Cliente</h4>
                      <p className="whitespace-pre-wrap leading-relaxed text-gray-700">
                        {modality.responsibilities.client}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {modality.advantages?.length ? (
              <div className="mb-6">
                <h3 className="mb-2 text-lg font-semibold text-gray-900">Vantagens</h3>
                <ul className="space-y-2">
                  {modality.advantages.map((item, itemIndex) => (
                    <li key={`${modality.id}-adv-${itemIndex}`} className="flex items-start gap-3">
                      <span className="mt-1 text-gray-900">•</span>
                      <span className="text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {modality.detailsLink ? (
              <a
                href={modality.detailsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border-2 border-gray-900 px-4 py-2 font-semibold text-gray-900 transition hover:bg-gray-900 hover:text-white"
              >
                <ExternalLink className="h-4 w-4" />
                {modality.detailsLinkTitle?.trim() || 'Ver detalhamento completo'}
              </a>
            ) : null}
          </section>
        ))}

        <ModalityComparison modalities={data.modalities} />

        {(data.paymentMethods ||
          data.discounts ||
          data.observations ||
          data.technicalNotes ||
          data.terms) && (
          <section className="mt-12 space-y-8">
            {data.paymentMethods && (
              <div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">Formas de Pagamento</h3>
                <p className="whitespace-pre-wrap leading-relaxed text-gray-700">{data.paymentMethods}</p>
              </div>
            )}

            {data.discounts && (
              <div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">Descontos</h3>
                <p className="whitespace-pre-wrap leading-relaxed text-gray-700">{data.discounts}</p>
              </div>
            )}

            {data.observations && (
              <div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">Observações</h3>
                <p className="whitespace-pre-wrap leading-relaxed text-gray-700">{data.observations}</p>
              </div>
            )}

            {data.technicalNotes && (
              <div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">Notas Técnicas</h3>
                <p className="whitespace-pre-wrap leading-relaxed text-gray-700">{data.technicalNotes}</p>
              </div>
            )}

            {data.terms && (
              <div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">Termos e Condições</h3>
                <p className="whitespace-pre-wrap leading-relaxed text-gray-700">{data.terms}</p>
              </div>
            )}
          </section>
        )}

        <footer className="mt-12 border-t border-gray-200 pt-6 text-center text-sm text-gray-500">
          Proposta gerada em {new Date().toLocaleDateString('pt-BR')}
        </footer>
      </div>
    </div>
  );
}
