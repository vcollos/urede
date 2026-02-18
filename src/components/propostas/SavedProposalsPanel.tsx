import { Copy, Download, Edit, FileText, Trash2, Upload } from 'lucide-react';
import { useRef } from 'react';
import { SavedProposal } from '../../types/propostas';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

interface SavedProposalsPanelProps {
  proposals: SavedProposal[];
  onLoad: (proposal: SavedProposal) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onExportJSON: (id: string) => void;
  onImportJSON: (file: File) => Promise<void>;
  onNotify?: (message: string, tone?: 'success' | 'error') => void;
}

export function SavedProposalsPanel({
  proposals,
  onLoad,
  onDuplicate,
  onDelete,
  onExportJSON,
  onImportJSON,
  onNotify,
}: SavedProposalsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Propostas Salvas</h2>
          <p className="text-sm text-gray-500">
            {proposals.length} proposta{proposals.length !== 1 ? 's' : ''} salva
            {proposals.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                await onImportJSON(file);
                onNotify?.('Proposta importada com sucesso.', 'success');
              } catch (error) {
                console.error('[propostas] falha na importação JSON:', error);
                onNotify?.('Erro ao importar proposta. Verifique o arquivo.', 'error');
              } finally {
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }
            }}
          />
          <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            Importar JSON
          </Button>
        </div>
      </div>

      {proposals.length === 0 ? (
        <Card className="rounded-2xl border border-[#E7E4FB] bg-white p-10 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-3 text-gray-500">Nenhuma proposta salva ainda.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {proposals.map((proposal) => (
            <Card key={proposal.id} className="rounded-2xl border border-[#E7E4FB] bg-white p-5">
              <div className="space-y-4">
                <div>
                  <h3 className="line-clamp-2 font-semibold text-gray-900">{proposal.name}</h3>
                  <p className="text-sm text-gray-600">
                    Cliente: {proposal.data.clientName || 'Não especificado'}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">Atualizado: {formatDate(proposal.updatedAt)}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="flex-1 gap-2" onClick={() => onLoad(proposal)}>
                    <Edit className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onDuplicate(proposal.id);
                      onNotify?.('Proposta duplicada com sucesso.', 'success');
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onExportJSON(proposal.id)}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const confirmed = window.confirm('Tem certeza que deseja excluir esta proposta?');
                      if (!confirmed) return;
                      onDelete(proposal.id);
                      onNotify?.('Proposta excluída com sucesso.', 'success');
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-[#C53030]" />
                  </Button>
                </div>

                {proposal.data.modalities.length > 0 && (
                  <div className="border-t border-[#F0EEFC] pt-3">
                    <p className="mb-1 text-xs text-gray-500">Modalidades:</p>
                    <div className="flex flex-wrap gap-1">
                      {proposal.data.modalities.map((modality) => (
                        <span
                          key={modality.id}
                          className="inline-flex items-center rounded-full bg-[#F4F2FF] px-2 py-1 text-xs text-gray-700"
                        >
                          {modality.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

