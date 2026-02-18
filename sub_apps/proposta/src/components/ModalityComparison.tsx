import { Modality } from '../App';
import { Check, X } from 'lucide-react';

type ModalityComparisonProps = {
  modalities: Modality[];
};

export function ModalityComparison({ modalities }: ModalityComparisonProps) {
  if (modalities.length === 0) return null;

  // Se só tem uma modalidade, não mostra comparação
  if (modalities.length === 1) return null;

  // Coletar todos os itens únicos incluídos e não incluídos
  const allIncludedItems = new Set<string>();
  const allNotIncludedItems = new Set<string>();
  const allResponsibilitiesProvider = new Set<string>();
  const allResponsibilitiesClient = new Set<string>();

  modalities.forEach((modality) => {
    modality.included.forEach((item) => allIncludedItems.add(item));
    modality.notIncluded?.forEach((item) => allNotIncludedItems.add(item));
    if (modality.responsibilities?.provider) {
      allResponsibilitiesProvider.add(modality.responsibilities.provider);
    }
    if (modality.responsibilities?.client) {
      allResponsibilitiesClient.add(modality.responsibilities.client);
    }
  });

  const hasResponsibilities =
    allResponsibilitiesProvider.size > 0 || allResponsibilitiesClient.size > 0;

  return (
    <div className="mt-12">
      <div className="mb-8 text-center">
        <h2 className="text-foreground">Comparativo entre Modalidades</h2>
        <p className="mt-2 text-muted-foreground">
          Veja as diferenças entre as opções disponíveis
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-border">
              <th className="p-4 text-left">Item</th>
              {modalities.map((modality) => (
                <th key={modality.id} className="p-4 text-center">
                  <div className="space-y-1">
                    <div>{modality.name}</div>
                    <div className="text-primary">{modality.price}</div>
                    <div className="text-xs text-muted-foreground">
                      {modality.billingType === 'monthly' && '/ mês'}
                      {modality.billingType === 'oneTime' && 'Pagamento único'}
                      {modality.billingType === 'custom' && ''}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Investimento Inicial */}
            <tr className="border-b border-border hover:bg-muted/50">
              <td className="p-4">Investimento inicial</td>
              {modalities.map((modality) => (
                <td key={modality.id} className="p-4 text-center">
                  {modality.billingType === 'monthly' ? (
                    <span className="text-green-600 dark:text-green-400">Não</span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">Sim</span>
                  )}
                </td>
              ))}
            </tr>

            {/* Pagamento */}
            <tr className="border-b border-border hover:bg-muted/50">
              <td className="p-4">Pagamento</td>
              {modalities.map((modality) => (
                <td key={modality.id} className="p-4 text-center">
                  {modality.billingType === 'monthly' && 'Mensal'}
                  {modality.billingType === 'oneTime' && 'Único'}
                  {modality.billingType === 'custom' && 'Customizado'}
                </td>
              ))}
            </tr>

            {/* Itens incluídos */}
            {Array.from(allIncludedItems).map((item, index) => (
              <tr key={`included-${index}`} className="border-b border-border hover:bg-muted/50">
                <td className="p-4">{item}</td>
                {modalities.map((modality) => (
                  <td key={modality.id} className="p-4 text-center">
                    {modality.included.includes(item) ? (
                      <Check className="mx-auto h-5 w-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <X className="mx-auto h-5 w-5 text-red-600 dark:text-red-400" />
                    )}
                  </td>
                ))}
              </tr>
            ))}

            {/* Itens não incluídos (se existirem) */}
            {allNotIncludedItems.size > 0 && (
              Array.from(allNotIncludedItems).map((item, index) => (
                <tr key={`not-included-${index}`} className="border-b border-border hover:bg-muted/50">
                  <td className="p-4">{item}</td>
                  {modalities.map((modality) => (
                    <td key={modality.id} className="p-4 text-center">
                      {modality.notIncluded?.includes(item) ? (
                        <X className="mx-auto h-5 w-5 text-red-600 dark:text-red-400" />
                      ) : (
                        <Check className="mx-auto h-5 w-5 text-green-600 dark:text-green-400" />
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}

            {/* Gestão técnica (se houver responsabilidades) */}
            {hasResponsibilities && (
              <tr className="border-b border-border hover:bg-muted/50">
                <td className="p-4">Gestão técnica</td>
                {modalities.map((modality) => (
                  <td key={modality.id} className="p-4 text-center">
                    {modality.responsibilities?.provider ? (
                      <span className="text-sm">
                        {modality.responsibilities.provider.split(',')[0].trim()}
                      </span>
                    ) : (
                      <span className="text-sm">
                        {modality.responsibilities?.client.split(',')[0].trim() || '-'}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
