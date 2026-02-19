export type ProposalBillingType = 'monthly' | 'oneTime' | 'custom';

export type Modality = {
  id: string;
  name: string;
  price: string;
  billingType: ProposalBillingType;
  included: string[];
  notIncluded?: string[];
  responsibilities?: {
    provider: string;
    client: string;
  };
  advantages?: string[];
  detailsLink?: string;
  detailsLinkTitle?: string;
};

export type ProposalData = {
  title: string;
  clientName: string;
  objective: string;
  modalities: Modality[];
  paymentMethods?: string;
  discounts?: string;
  observations?: string;
  technicalNotes?: string;
  terms?: string;
};

export type SavedProposal = {
  id: string;
  name: string;
  data: ProposalData;
  createdAt: string;
  updatedAt: string;
};
