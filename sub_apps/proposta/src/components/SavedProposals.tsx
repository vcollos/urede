import { SavedProposal } from '../hooks/useProposals';
import { Button } from './ui/button';
import { Card } from './ui/card';
import {
  Copy,
  Download,
  Edit,
  FileText,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { useState, useRef } from 'react';

type SavedProposalsProps = {
  proposals: SavedProposal[];
  onLoad: (proposal: SavedProposal) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onExportJSON: (id: string) => void;
  onImportJSON: (file: File) => Promise<void>;
};

export function SavedProposals({
  proposals,
  onLoad,
  onDuplicate,
  onDelete,
  onExportJSON,
  onImportJSON,
}: SavedProposalsProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onImportJSON(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground">Propostas Salvas</h2>
          <p className="text-muted-foreground text-sm">
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
            onChange={handleImport}
          />
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Importar JSON
          </Button>
        </div>
      </div>

      {proposals.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
          <p className="mt-4 text-muted-foreground">
            Nenhuma proposta salva ainda
          </p>
          <p className="mt-2 text-muted-foreground text-sm">
            Crie uma proposta e salve-a para poder reutilizar no futuro
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {proposals.map((proposal) => (
            <Card key={proposal.id} className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="mb-1">{proposal.name}</h3>
                  <p className="text-muted-foreground text-sm">
                    Cliente: {proposal.data.clientName || 'Não especificado'}
                  </p>
                  <p className="text-muted-foreground text-xs mt-2">
                    Atualizado: {formatDate(proposal.updatedAt)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => onLoad(proposal)}
                  >
                    <Edit className="h-3 w-3" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDuplicate(proposal.id)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onExportJSON(proposal.id)}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteId(proposal.id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>

                {proposal.data.modalities.length > 0 && (
                  <div className="border-t border-border pt-3">
                    <p className="text-muted-foreground text-xs mb-2">
                      Modalidades:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {proposal.data.modalities.map((mod) => (
                        <span
                          key={mod.id}
                          className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs"
                        >
                          {mod.name}
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

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta proposta? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  onDelete(deleteId);
                  setDeleteId(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
