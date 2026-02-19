import { ProposalData } from '../App';
import { ModalityComparison } from './ModalityComparison';
import { Button } from './ui/button';
import { Download, Mail, FileCode, Save, ExternalLink } from 'lucide-react';
import { useRef, useState } from 'react';
import logo from 'figma:asset/55665678682f81e5dab672710086b014bc798337.png';
import { exportProposalToPDF } from '../utils/exportPDF';
import { downloadHTML } from '../utils/exportHTML';
import { toast } from 'sonner';

type ProposalPreviewProps = {
  data: ProposalData;
  hideActions?: boolean;
  onSave?: (name: string) => void;
};

export function ProposalPreview({ data, hideActions, onSave }: ProposalPreviewProps) {
  const proposalRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const fileName = `${data.title.replace(/\s+/g, '_')}_${data.clientName.replace(/\s+/g, '_')}.pdf`;
      await exportProposalToPDF(data, fileName);
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast.error('Erro ao exportar PDF. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportHTML = () => {
    try {
      downloadHTML(data, logo);
      toast.success('HTML exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar HTML:', error);
      toast.error('Erro ao exportar HTML. Tente novamente.');
    }
  };

  const handleSave = () => {
    if (onSave) {
      const name = data.title || 'Proposta sem título';
      onSave(name);
      toast.success('Proposta salva com sucesso!');
    }
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`Proposta: ${data.title}`);
    const body = encodeURIComponent(
      `Olá ${data.clientName},\n\nSegue a proposta comercial conforme solicitado.\n\n${data.objective}\n\nAtenciosamente.`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-8">
      {/* Actions */}
      {!hideActions && (
        <div className="flex flex-wrap justify-end gap-3">
          {onSave && (
            <Button variant="default" className="gap-2" onClick={handleSave}>
              <Save className="h-4 w-4" />
              Salvar Proposta
            </Button>
          )}
          <Button variant="outline" className="gap-2" onClick={handleEmail}>
            <Mail className="h-4 w-4" />
            Enviar por Email
          </Button>
          <Button 
            variant="outline" 
            className="gap-2" 
            onClick={handleExportHTML}
          >
            <FileCode className="h-4 w-4" />
            Exportar HTML
          </Button>
          <Button 
            onClick={handleExportPDF} 
            className="gap-2"
            disabled={isExporting}
          >
            <Download className="h-4 w-4" />
            {isExporting ? 'Gerando PDF...' : 'Exportar PDF'}
          </Button>
        </div>
      )}

      {/* Proposal Document */}
      <div
        ref={proposalRef}
        data-pdf-export
        className="mx-auto max-w-4xl bg-white p-12 shadow-lg"
        style={{ minHeight: '297mm' }}
      >
        {/* Logo */}
        <div className="mb-8">
          <img src={logo} alt="Collos" className="h-12" />
        </div>

        {/* Header */}
        <div className="mb-12 border-b-2 border-gray-900 pb-8">
          <h1 className="mb-2 text-gray-900">{data.title}</h1>
          <p className="text-gray-600 text-xl">{data.clientName}</p>
        </div>

        {/* Objective */}
        <div className="mb-12">
          <h2 className="mb-4 text-gray-900">Objetivo</h2>
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
            {data.objective}
          </p>
        </div>

        {/* Separator */}
        <div className="my-12 flex items-center">
          <div className="flex-1 border-t border-gray-300"></div>
          <div className="mx-4 text-gray-400">⸻</div>
          <div className="flex-1 border-t border-gray-300"></div>
        </div>

        {/* Modalities */}
        {data.modalities.map((modality, index) => (
          <div key={modality.id} className="mb-12">
            <div className="mb-6 rounded-lg bg-gray-900 p-6 text-white">
              <h2 className="mb-2">
                MODALIDADE {index + 1} — {modality.name.toUpperCase()}
              </h2>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl">{modality.price}</span>
                {modality.billingType === 'monthly' && (
                  <span className="text-gray-300">/ mês</span>
                )}
                {modality.billingType === 'oneTime' && (
                  <span className="text-gray-300">(pagamento único)</span>
                )}
              </div>
            </div>

            {/* O que está incluso */}
            {modality.included.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-3 text-gray-900">O que está incluso</h3>
                <ul className="space-y-2">
                  {modality.included.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-1 text-gray-900">•</span>
                      <span className="text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* O que não está incluso */}
            {modality.notIncluded && modality.notIncluded.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-3 text-gray-900">O que não está incluso</h3>
                <ul className="space-y-2">
                  {modality.notIncluded.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-1 text-gray-900">•</span>
                      <span className="text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Responsabilidades */}
            {(modality.responsibilities?.provider ||
              modality.responsibilities?.client) && (
              <div className="mb-6">
                <h3 className="mb-3 text-gray-900">Responsabilidades</h3>
                <div className="grid gap-6 md:grid-cols-2">
                  {modality.responsibilities?.provider && (
                    <div>
                      <h4 className="mb-2 text-gray-700">Fornecedor:</h4>
                      <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                        {modality.responsibilities.provider}
                      </p>
                    </div>
                  )}
                  {modality.responsibilities?.client && (
                    <div>
                      <h4 className="mb-2 text-gray-700">Cliente:</h4>
                      <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                        {modality.responsibilities.client}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Vantagens */}
            {modality.advantages && modality.advantages.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-3 text-gray-900">Vantagens</h3>
                <ul className="space-y-2">
                  {modality.advantages.map((advantage, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-1 text-gray-900">•</span>
                      <span className="text-gray-700">{advantage}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Link de Detalhamento */}
            {modality.detailsLink && (
              <div className="mb-6">
                <a
                  href={modality.detailsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border-2 border-gray-900 bg-white px-6 py-3 text-gray-900 transition-colors hover:bg-gray-900 hover:text-white"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Ver Detalhamento Completo</span>
                </a>
              </div>
            )}

            {/* Separator between modalities */}
            {index < data.modalities.length - 1 && (
              <div className="my-12 flex items-center">
                <div className="flex-1 border-t border-gray-300"></div>
                <div className="mx-4 text-gray-400">⸻</div>
                <div className="flex-1 border-t border-gray-300"></div>
              </div>
            )}
          </div>
        ))}

        {/* Comparison Table */}
        <ModalityComparison modalities={data.modalities} />

        {/* Additional Information */}
        {(data.paymentMethods ||
          data.discounts ||
          data.observations ||
          data.technicalNotes ||
          data.terms) && (
          <>
            <div className="my-12 flex items-center">
              <div className="flex-1 border-t border-gray-300"></div>
              <div className="mx-4 text-gray-400">⸻</div>
              <div className="flex-1 border-t border-gray-300"></div>
            </div>

            <div className="space-y-8">
              {data.paymentMethods && (
                <div>
                  <h3 className="mb-3 text-gray-900">Formas de Pagamento</h3>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {data.paymentMethods}
                  </p>
                </div>
              )}

              {data.discounts && (
                <div>
                  <h3 className="mb-3 text-gray-900">Descontos</h3>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {data.discounts}
                  </p>
                </div>
              )}

              {data.observations && (
                <div>
                  <h3 className="mb-3 text-gray-900">Observações</h3>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {data.observations}
                  </p>
                </div>
              )}

              {data.technicalNotes && (
                <div>
                  <h3 className="mb-3 text-gray-900">Notas Técnicas</h3>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {data.technicalNotes}
                  </p>
                </div>
              )}

              {data.terms && (
                <div>
                  <h3 className="mb-3 text-gray-900">
                    Termos e Condições
                  </h3>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {data.terms}
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="mt-16 border-t border-gray-300 pt-8 text-center">
          <p className="text-gray-500 text-sm">
            Proposta gerada em {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>
    </div>
  );
}