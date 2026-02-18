import { Check, X } from 'lucide-react';
import { Modality } from '../../types/propostas';

interface ModalityComparisonProps {
  modalities: Modality[];
}

export function ModalityComparison({ modalities }: ModalityComparisonProps) {
  if (modalities.length < 2) return null;

  const allIncludedItems = new Set<string>();
  const allNotIncludedItems = new Set<string>();

  modalities.forEach((modality) => {
    modality.included.forEach((item) => allIncludedItems.add(item));
    modality.notIncluded?.forEach((item) => allNotIncludedItems.add(item));
  });

  return (
    <div className="mt-12">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-semibold text-gray-900">Comparativo entre Modalidades</h2>
        <p className="mt-2 text-sm text-gray-500">Veja as diferenças entre as opções disponíveis</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E7E4FB] bg-white">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[#E7E4FB] bg-[#F7F5FF]">
              <th className="p-4 text-left text-sm font-semibold text-gray-700">Item</th>
              {modalities.map((modality) => (
                <th key={modality.id} className="p-4 text-center text-sm font-semibold text-gray-700">
                  <div className="space-y-1">
                    <div>{modality.name || 'Modalidade'}</div>
                    <div className="text-[#5A46C5]">{modality.price}</div>
                    <div className="text-xs text-gray-500">
                      {modality.billingType === 'monthly' && '/ mês'}
                      {modality.billingType === 'oneTime' && 'Pagamento único'}
                      {modality.billingType === 'custom' && 'Customizado'}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#F0EEFC] hover:bg-[#FBFAFF]">
              <td className="p-4 text-sm text-gray-700">Investimento inicial</td>
              {modalities.map((modality) => (
                <td key={modality.id} className="p-4 text-center text-sm">
                  {modality.billingType === 'monthly' ? (
                    <span className="text-[#1F7A47]">Não</span>
                  ) : (
                    <span className="text-[#B7791F]">Sim</span>
                  )}
                </td>
              ))}
            </tr>

            <tr className="border-b border-[#F0EEFC] hover:bg-[#FBFAFF]">
              <td className="p-4 text-sm text-gray-700">Pagamento</td>
              {modalities.map((modality) => (
                <td key={modality.id} className="p-4 text-center text-sm text-gray-700">
                  {modality.billingType === 'monthly' && 'Mensal'}
                  {modality.billingType === 'oneTime' && 'Único'}
                  {modality.billingType === 'custom' && 'Customizado'}
                </td>
              ))}
            </tr>

            {Array.from(allIncludedItems).map((item, index) => (
              <tr key={`included-${index}`} className="border-b border-[#F0EEFC] hover:bg-[#FBFAFF]">
                <td className="p-4 text-sm text-gray-700">{item}</td>
                {modalities.map((modality) => (
                  <td key={modality.id} className="p-4 text-center">
                    {modality.included.includes(item) ? (
                      <Check className="mx-auto h-5 w-5 text-[#1F7A47]" />
                    ) : (
                      <X className="mx-auto h-5 w-5 text-[#C53030]" />
                    )}
                  </td>
                ))}
              </tr>
            ))}

            {Array.from(allNotIncludedItems).map((item, index) => (
              <tr key={`not-included-${index}`} className="border-b border-[#F0EEFC] hover:bg-[#FBFAFF]">
                <td className="p-4 text-sm text-gray-700">{item}</td>
                {modalities.map((modality) => (
                  <td key={modality.id} className="p-4 text-center">
                    {modality.notIncluded?.includes(item) ? (
                      <X className="mx-auto h-5 w-5 text-[#C53030]" />
                    ) : (
                      <Check className="mx-auto h-5 w-5 text-[#1F7A47]" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

