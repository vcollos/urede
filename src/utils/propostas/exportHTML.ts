import { ProposalData } from '../../types/propostas';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const maybe = (value?: string) => (value && value.trim() ? escapeHtml(value) : '');

const formatBilling = (type: string) => {
  if (type === 'monthly') return '/ mês';
  if (type === 'oneTime') return '(pagamento único)';
  return '';
};

export function buildProposalHTML(data: ProposalData, logoUrl?: string) {
  const modalities = data.modalities
    .map((modality, index) => `
      <section class="block">
        <div class="modality-header">
          <h2>MODALIDADE ${index + 1} — ${escapeHtml((modality.name || '').toUpperCase())}</h2>
          <p class="price">${escapeHtml(modality.price || '')} <span>${formatBilling(modality.billingType)}</span></p>
        </div>

        ${modality.included?.length ? `
          <h3>O que está incluso</h3>
          <ul>${modality.included.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        ` : ''}

        ${modality.notIncluded?.length ? `
          <h3>O que não está incluso</h3>
          <ul>${modality.notIncluded.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        ` : ''}

        ${modality.responsibilities?.provider || modality.responsibilities?.client ? `
          <h3>Responsabilidades</h3>
          <div class="grid">
            ${modality.responsibilities?.provider ? `<div><h4>Fornecedor</h4><p>${escapeHtml(modality.responsibilities.provider)}</p></div>` : ''}
            ${modality.responsibilities?.client ? `<div><h4>Cliente</h4><p>${escapeHtml(modality.responsibilities.client)}</p></div>` : ''}
          </div>
        ` : ''}

        ${modality.advantages?.length ? `
          <h3>Vantagens</h3>
          <ul>${modality.advantages.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        ` : ''}

        ${modality.detailsLink ? `<p><a class="details-link" href="${escapeHtml(modality.detailsLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml((modality.detailsLinkTitle || '').trim() || 'Ver detalhamento completo')}</a></p>` : ''}
      </section>
    `)
    .join('');

  const additionalInfo = [
    ['Formas de pagamento', maybe(data.paymentMethods)],
    ['Descontos', maybe(data.discounts)],
    ['Observações', maybe(data.observations)],
    ['Notas técnicas', maybe(data.technicalNotes)],
    ['Termos e condições', maybe(data.terms)],
  ]
    .filter(([, value]) => value)
    .map(([title, value]) => `<section class="block"><h3>${title}</h3><p>${value}</p></section>`)
    .join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(data.title)} - ${escapeHtml(data.clientName)}</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; margin: 0; padding: 32px; background: #f5f6fa; color: #111827; }
    .page { max-width: 980px; margin: 0 auto; background: #fff; padding: 40px; box-shadow: 0 12px 40px rgba(17,24,39,0.1); }
    .logo { height: 44px; margin-bottom: 20px; }
    .header { border-bottom: 2px solid #111827; padding-bottom: 20px; margin-bottom: 28px; }
    h1 { margin: 0 0 8px; font-size: 30px; }
    h2 { margin: 0; font-size: 20px; }
    h3 { font-size: 18px; margin: 22px 0 8px; }
    h4 { font-size: 15px; margin: 0 0 4px; }
    p { line-height: 1.55; white-space: pre-wrap; }
    .muted { color: #6b7280; }
    .objective { margin: 0 0 24px; }
    .block { margin-bottom: 24px; }
    .modality-header { border-radius: 10px; background: #111827; color: #fff; padding: 16px; }
    .price { margin: 8px 0 0; font-size: 24px; font-weight: 700; }
    .price span { margin-left: 8px; color: #d1d5db; font-size: 14px; font-weight: 500; }
    ul { margin: 0; padding-left: 20px; }
    li { margin: 6px 0; }
    .grid { display: grid; gap: 14px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .details-link { display: inline-block; padding: 10px 14px; border: 2px solid #111827; border-radius: 8px; text-decoration: none; color: #111827; font-weight: 600; }
    .details-link:hover { background: #111827; color: #fff; }
    .footer { margin-top: 32px; padding-top: 18px; border-top: 1px solid #d1d5db; text-align: center; color: #6b7280; font-size: 13px; }
    @media (max-width: 768px) { body { padding: 12px; } .page { padding: 20px; } .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main class="page">
    ${logoUrl ? `<img class="logo" src="${logoUrl}" alt="Logo">` : ''}
    <header class="header">
      <h1>${escapeHtml(data.title)}</h1>
      <p class="muted">${escapeHtml(data.clientName)}</p>
    </header>

    <section class="objective">
      <h3>Objetivo</h3>
      <p>${escapeHtml(data.objective)}</p>
    </section>

    ${modalities}
    ${additionalInfo}

    <footer class="footer">
      Proposta gerada em ${new Date().toLocaleDateString('pt-BR')}
    </footer>
  </main>
</body>
</html>`;
}

export function downloadProposalHTML(data: ProposalData, logoUrl?: string) {
  const html = buildProposalHTML(data, logoUrl);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const fileName = `${(data.title || 'proposta').replace(/\s+/g, '_')}.html`;
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
