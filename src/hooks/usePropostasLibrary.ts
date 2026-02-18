import { useEffect, useState } from 'react';
import { ProposalData, SavedProposal } from '../types/propostas';

const STORAGE_KEY = 'uhub_saved_proposals_v1';

const createId = () => `proposal_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export function usePropostasLibrary() {
  const [proposals, setProposals] = useState<SavedProposal[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as SavedProposal[];
        if (Array.isArray(parsed)) {
          setProposals(parsed);
        }
      }
    } catch (error) {
      console.error('[propostas] falha ao carregar biblioteca local:', error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(proposals));
    } catch (error) {
      console.error('[propostas] falha ao salvar biblioteca local:', error);
    }
  }, [proposals]);

  const saveProposal = (data: ProposalData, name?: string) => {
    const now = new Date().toISOString();
    const id = createId();
    const proposalName = (name || data.title || 'Proposta sem título').trim();
    const proposal: SavedProposal = {
      id,
      name: proposalName || 'Proposta sem título',
      data,
      createdAt: now,
      updatedAt: now,
    };
    setProposals((prev) => [proposal, ...prev]);
    return id;
  };

  const deleteProposal = (id: string) => {
    setProposals((prev) => prev.filter((item) => item.id !== id));
  };

  const duplicateProposal = (id: string) => {
    const source = proposals.find((item) => item.id === id);
    if (!source) return null;
    const now = new Date().toISOString();
    const duplicated: SavedProposal = {
      id: createId(),
      name: `${source.name} (cópia)`,
      data: { ...source.data },
      createdAt: now,
      updatedAt: now,
    };
    setProposals((prev) => [duplicated, ...prev]);
    return duplicated.id;
  };

  const exportToJSON = (id: string) => {
    const item = proposals.find((proposal) => proposal.id === id);
    if (!item) return;
    const dataStr = JSON.stringify(item, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    const filename = `${item.name.replace(/\s+/g, '_')}.json`;
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', filename);
    link.click();
  };

  const importFromJSON = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const parsed = JSON.parse(content) as SavedProposal;
          const now = new Date().toISOString();
          const imported: SavedProposal = {
            id: createId(),
            name: `${parsed.name || 'Proposta'} (importado)`,
            data: parsed.data,
            createdAt: now,
            updatedAt: now,
          };
          setProposals((prev) => [imported, ...prev]);
          resolve(imported.id);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  };

  return {
    proposals,
    saveProposal,
    deleteProposal,
    duplicateProposal,
    exportToJSON,
    importFromJSON,
  };
}

