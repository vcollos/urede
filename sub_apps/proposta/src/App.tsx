import { useState } from 'react';
import { ProposalForm } from './components/ProposalForm';
import { ProposalPreview } from './components/ProposalPreview';
import { SavedProposals } from './components/SavedProposals';
import { Button } from './components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from './components/ui/sheet';
import { FileText, Edit, Columns2, FolderOpen } from 'lucide-react';
import { Toaster } from './components/ui/sonner';
import logo from 'figma:asset/55665678682f81e5dab672710086b014bc798337.png';
import { useProposals } from './hooks/useProposals';
import { toast } from 'sonner@2.0.3';

export type ProposalData = {
  // Informações gerais
  title: string;
  clientName: string;
  objective: string;
  
  // Modalidades (produtos/serviços)
  modalities: Modality[];
  
  // Informações adicionais
  paymentMethods?: string;
  discounts?: string;
  observations?: string;
  technicalNotes?: string;
  terms?: string;
};

export type Modality = {
  id: string;
  name: string;
  price: string;
  billingType: 'monthly' | 'oneTime' | 'custom';
  included: string[];
  notIncluded?: string[];
  responsibilities?: {
    provider: string;
    client: string;
  };
  advantages?: string[];
  detailsLink?: string; // Link para download de mais informações
};

function App() {
  const [view, setView] = useState<'form' | 'preview' | 'split'>('form');
  const [proposalData, setProposalData] = useState<ProposalData>({
    title: '',
    clientName: '',
    objective: '',
    modalities: [],
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const {
    proposals,
    saveProposal,
    deleteProposal,
    duplicateProposal,
    exportToJSON,
    importFromJSON,
  } = useProposals();

  const handleSaveProposal = (data: ProposalData) => {
    setProposalData(data);
    if (view === 'form') {
      setView('preview');
    }
  };

  const handleUpdateProposal = (data: ProposalData) => {
    setProposalData(data);
  };

  const handleSaveToLibrary = (name: string) => {
    saveProposal(proposalData, name);
  };

  const handleSaveFromForm = (data: ProposalData) => {
    const name = data.title || 'Proposta sem título';
    saveProposal(data, name);
  };

  const handleLoadProposal = (proposal: any) => {
    setProposalData(proposal.data);
    setView('form');
    setDrawerOpen(false);
    toast.success('Proposta carregada com sucesso!');
  };

  const handleDuplicateProposal = (id: string) => {
    const newId = duplicateProposal(id);
    if (newId) {
      toast.success('Proposta duplicada com sucesso!');
    }
  };

  const handleImportJSON = async (file: File) => {
    try {
      await importFromJSON(file);
      toast.success('Proposta importada com sucesso!');
    } catch (error) {
      toast.error('Erro ao importar proposta. Verifique o arquivo.');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Collos" className="h-10" />
              <div>
                <h1 className="text-foreground">Gerador de Propostas</h1>
                <p className="text-muted-foreground text-sm">
                  Crie propostas profissionais de forma rápida e fácil
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <FolderOpen className="h-4 w-4" />
                    Propostas Salvas
                    {proposals.length > 0 && (
                      <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                        {proposals.length}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Propostas Salvas</SheetTitle>
                    <SheetDescription>
                      Gerencie suas propostas salvas aqui
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-6">
                    <SavedProposals
                      proposals={proposals}
                      onLoad={handleLoadProposal}
                      onDuplicate={handleDuplicateProposal}
                      onDelete={deleteProposal}
                      onExportJSON={exportToJSON}
                      onImportJSON={handleImportJSON}
                    />
                  </div>
                </SheetContent>
              </Sheet>

              {view === 'preview' && (
                <Button
                  variant="outline"
                  onClick={() => setView('form')}
                  className="gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Editar Proposta
                </Button>
              )}
              
              {view === 'form' && (
                <Button
                  variant="outline"
                  onClick={() => setView('split')}
                  className="gap-2"
                >
                  <Columns2 className="h-4 w-4" />
                  Preview ao Vivo
                </Button>
              )}
              
              {view === 'split' && (
                <Button
                  variant="outline"
                  onClick={() => setView('form')}
                  className="gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Modo Formulário
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className={view === 'split' ? '' : 'mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'}>
        {view === 'form' ? (
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <ProposalForm
              initialData={proposalData}
              onSave={handleSaveProposal}
              onChange={handleUpdateProposal}
              onSaveToLibrary={handleSaveFromForm}
            />
          </div>
        ) : view === 'preview' ? (
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <ProposalPreview data={proposalData} onSave={handleSaveToLibrary} />
          </div>
        ) : (
          <div className="grid h-[calc(100vh-73px)] grid-cols-2">
            {/* Left: Form */}
            <div className="overflow-y-auto border-r border-border p-8">
              <ProposalForm
                initialData={proposalData}
                onSave={handleSaveProposal}
                onChange={handleUpdateProposal}
                livePreview
              />
            </div>
            
            {/* Right: Preview */}
            <div className="overflow-y-auto bg-muted p-8">
              <div className="mx-auto max-w-3xl">
                <ProposalPreview data={proposalData} hideActions />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;