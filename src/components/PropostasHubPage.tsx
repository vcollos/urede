import { Columns2, Edit, FolderOpen } from 'lucide-react';
import { useState } from 'react';
import { usePropostasLibrary } from '../hooks/usePropostasLibrary';
import { ProposalData, SavedProposal } from '../types/propostas';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';
import { ProposalForm } from './propostas/ProposalForm';
import { ProposalPreview } from './propostas/ProposalPreview';
import { SavedProposalsPanel } from './propostas/SavedProposalsPanel';

type PageView = 'form' | 'preview' | 'split';

const EMPTY_PROPOSAL: ProposalData = {
  title: '',
  clientName: '',
  objective: '',
  modalities: [],
};

export function PropostasHubPage() {
  const [view, setView] = useState<PageView>('form');
  const [proposalData, setProposalData] = useState<ProposalData>(EMPTY_PROPOSAL);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const {
    proposals,
    saveProposal,
    deleteProposal,
    duplicateProposal,
    exportToJSON,
    importFromJSON,
  } = usePropostasLibrary();

  const notify = (message: string, tone: 'success' | 'error' = 'success') => {
    setNotice({ tone, message });
    window.setTimeout(() => {
      setNotice((current) => (current?.message === message ? null : current));
    }, 3500);
  };

  const loadSavedProposal = (proposal: SavedProposal) => {
    setProposalData(proposal.data);
    setView('form');
    setLibraryOpen(false);
    notify('Proposta carregada com sucesso.', 'success');
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[#E7E4FB] bg-gradient-to-r from-[#F6F3FF] via-white to-[#F2FAFF] px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Gerador de Propostas</h1>
            <p className="mt-1 text-sm text-gray-600">
              Módulo integrado ao UHub para criar propostas comerciais e exportar em PDF/HTML.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Sheet open={libraryOpen} onOpenChange={setLibraryOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Propostas Salvas
                  {proposals.length > 0 && (
                    <span className="rounded-full bg-[#EDE8FF] px-2 py-0.5 text-xs text-[#5A46C5]">
                      {proposals.length}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Propostas Salvas</SheetTitle>
                  <SheetDescription>Gerencie suas propostas salvas no navegador.</SheetDescription>
                </SheetHeader>
                <div className="mt-6">
                  <SavedProposalsPanel
                    proposals={proposals}
                    onLoad={loadSavedProposal}
                    onDuplicate={duplicateProposal}
                    onDelete={deleteProposal}
                    onExportJSON={exportToJSON}
                    onImportJSON={importFromJSON}
                    onNotify={notify}
                  />
                </div>
              </SheetContent>
            </Sheet>

            {view === 'preview' && (
              <Button variant="outline" className="gap-2" onClick={() => setView('form')}>
                <Edit className="h-4 w-4" />
                Editar Proposta
              </Button>
            )}
            {view === 'form' && (
              <Button variant="outline" className="gap-2" onClick={() => setView('split')}>
                <Columns2 className="h-4 w-4" />
                Preview ao Vivo
              </Button>
            )}
            {view === 'split' && (
              <Button variant="outline" className="gap-2" onClick={() => setView('form')}>
                <Edit className="h-4 w-4" />
                Modo Formulário
              </Button>
            )}
          </div>
        </div>
      </section>

      {notice && (
        <Alert variant={notice.tone === 'error' ? 'destructive' : 'default'} className="border-[#E7E4FB]">
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      )}

      {view === 'form' && (
        <ProposalForm
          initialData={proposalData}
          onSave={(data) => {
            setProposalData(data);
            setView('preview');
          }}
          onChange={setProposalData}
          onSaveToLibrary={(data) => {
            if (!data.title || !data.clientName) {
              notify('Preencha título e cliente antes de salvar.', 'error');
              return;
            }
            saveProposal(data, data.title);
            notify('Proposta salva na biblioteca.', 'success');
          }}
        />
      )}

      {view === 'preview' && (
        <ProposalPreview
          data={proposalData}
          onSave={(name) => saveProposal(proposalData, name)}
          onNotify={notify}
        />
      )}

      {view === 'split' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="max-h-[calc(100vh-220px)] overflow-y-auto rounded-2xl border border-[#E7E4FB] bg-white p-6">
            <ProposalForm
              initialData={proposalData}
              onSave={(data) => setProposalData(data)}
              onChange={setProposalData}
              livePreview
            />
          </div>
          <div className="max-h-[calc(100vh-220px)] overflow-y-auto rounded-2xl border border-[#E7E4FB] bg-[#FAF9FF] p-6">
            <ProposalPreview data={proposalData} hideActions />
          </div>
        </div>
      )}
    </div>
  );
}

