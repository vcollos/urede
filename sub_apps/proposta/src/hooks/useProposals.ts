import { useState, useEffect } from 'react';
import { ProposalData } from '../App';

export type SavedProposal = {
  id: string;
  name: string;
  data: ProposalData;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = 'collos_saved_proposals';

export function useProposals() {
  const [proposals, setProposals] = useState<SavedProposal[]>([]);

  // Carregar propostas do localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setProposals(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Erro ao carregar propostas:', error);
    }
  }, []);

  // Salvar propostas no localStorage sempre que mudarem
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(proposals));
    } catch (error) {
      console.error('Erro ao salvar propostas:', error);
    }
  }, [proposals]);

  const saveProposal = (data: ProposalData, name?: string) => {
    const proposalName = name || data.title || 'Proposta sem título';
    const now = new Date().toISOString();
    
    const newProposal: SavedProposal = {
      id: `proposal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: proposalName,
      data,
      createdAt: now,
      updatedAt: now,
    };

    setProposals((prev) => [newProposal, ...prev]);
    return newProposal.id;
  };

  const updateProposal = (id: string, data: ProposalData, name?: string) => {
    setProposals((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              data,
              name: name || p.name,
              updatedAt: new Date().toISOString(),
            }
          : p
      )
    );
  };

  const deleteProposal = (id: string) => {
    setProposals((prev) => prev.filter((p) => p.id !== id));
  };

  const duplicateProposal = (id: string) => {
    const proposal = proposals.find((p) => p.id === id);
    if (proposal) {
      const now = new Date().toISOString();
      const duplicated: SavedProposal = {
        id: `proposal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `${proposal.name} (cópia)`,
        data: { ...proposal.data },
        createdAt: now,
        updatedAt: now,
      };
      setProposals((prev) => [duplicated, ...prev]);
      return duplicated.id;
    }
    return null;
  };

  const exportToJSON = (id: string) => {
    const proposal = proposals.find((p) => p.id === id);
    if (proposal) {
      const dataStr = JSON.stringify(proposal, null, 2);
      const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
      
      const exportFileDefaultName = `${proposal.name.replace(/\s+/g, '_')}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    }
  };

  const importFromJSON = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const imported = JSON.parse(content) as SavedProposal;
          
          const now = new Date().toISOString();
          const newProposal: SavedProposal = {
            id: `proposal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: `${imported.name} (importado)`,
            data: imported.data,
            createdAt: now,
            updatedAt: now,
          };
          
          setProposals((prev) => [newProposal, ...prev]);
          resolve(newProposal.id);
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
    updateProposal,
    deleteProposal,
    duplicateProposal,
    exportToJSON,
    importFromJSON,
  };
}
