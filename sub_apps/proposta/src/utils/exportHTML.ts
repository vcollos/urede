import { ProposalData } from '../App';

export function exportToHTML(data: ProposalData, logoBase64?: string) {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title} - ${data.clientName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background-color: #f9fafb;
      padding: 2rem;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      background-color: #ffffff;
      padding: 3rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .logo {
      height: 3rem;
      margin-bottom: 2rem;
    }

    .header {
      border-bottom: 2px solid #111827;
      padding-bottom: 2rem;
      margin-bottom: 3rem;
    }

    h1 {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      color: #111827;
    }

    .client-name {
      font-size: 1.25rem;
      color: #4b5563;
    }

    h2 {
      font-size: 1.875rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: #111827;
    }

    h3 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
      color: #111827;
    }

    h4 {
      font-size: 1rem;
      font-weight: 500;
      margin-bottom: 0.5rem;
      color: #374151;
    }

    .section {
      margin-bottom: 3rem;
    }

    .objective {
      color: #374151;
      white-space: pre-wrap;
    }

    .separator {
      display: flex;
      align-items: center;
      margin: 3rem 0;
    }

    .separator-line {
      flex: 1;
      border-top: 1px solid #d1d5db;
    }

    .separator-symbol {
      margin: 0 1rem;
      color: #9ca3af;
    }

    .modality {
      margin-bottom: 3rem;
    }

    .modality-header {
      background-color: #111827;
      color: white;
      padding: 1.5rem;
      border-radius: 0.5rem;
      margin-bottom: 1.5rem;
    }

    .modality-title {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .modality-price {
      font-size: 1.875rem;
      font-weight: 700;
    }

    .modality-billing {
      color: #d1d5db;
      margin-left: 0.5rem;
    }

    ul {
      list-style: none;
      padding: 0;
    }

    li {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
      color: #374151;
    }

    li::before {
      content: "•";
      color: #111827;
      font-weight: bold;
      margin-top: 0.25rem;
    }

    .responsibilities {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      margin-top: 0.5rem;
    }

    .responsibility-text {
      color: #4b5563;
      white-space: pre-wrap;
    }

    .details-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      border: 2px solid #111827;
      background-color: #ffffff;
      color: #111827;
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      text-decoration: none;
      transition: all 0.2s;
      margin-top: 1rem;
    }

    .details-link:hover {
      background-color: #111827;
      color: #ffffff;
    }

    .details-link-icon {
      width: 1rem;
      height: 1rem;
    }

    .comparison-table {
      width: 100%;
      border-collapse: collapse;
      margin: 2rem 0;
      overflow-x: auto;
    }

    .comparison-table th,
    .comparison-table td {
      border: 1px solid #e5e7eb;
      padding: 1rem;
      text-align: left;
    }

    .comparison-table th {
      background-color: #111827;
      font-weight: 600;
      color: #ffffff;
      text-align: center;
    }

    .comparison-table th:first-child {
      text-align: left;
    }

    .comparison-table td {
      color: #374151;
    }

    .comparison-table td:not(:first-child) {
      text-align: center;
    }

    .comparison-table tbody tr:hover {
      background-color: #f9fafb;
    }

    .comparison-header-content {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .comparison-price {
      color: #3b82f6;
      font-weight: 600;
    }

    .comparison-billing {
      font-size: 0.75rem;
      color: #d1d5db;
      font-weight: 400;
    }

    .check-icon {
      color: #16a34a;
      font-size: 1.25rem;
    }

    .x-icon {
      color: #dc2626;
      font-size: 1.25rem;
    }

    .text-green {
      color: #16a34a;
    }

    .text-amber {
      color: #f59e0b;
    }

    .comparison-section-title {
      text-align: center;
      margin-bottom: 2rem;
    }

    .comparison-subtitle {
      color: #6b7280;
      margin-top: 0.5rem;
    }

    .footer {
      margin-top: 4rem;
      padding-top: 2rem;
      border-top: 1px solid #d1d5db;
      text-align: center;
      color: #6b7280;
      font-size: 0.875rem;
    }

    @media print {
      body {
        padding: 0;
        background-color: white;
      }
      
      .container {
        box-shadow: none;
        padding: 1.5rem;
      }
    }

    @media (max-width: 768px) {
      body {
        padding: 1rem;
      }

      .container {
        padding: 1.5rem;
      }

      h1 {
        font-size: 2rem;
      }

      .responsibilities {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" class="logo">` : ''}
    
    <div class="header">
      <h1>${escapeHtml(data.title)}</h1>
      <p class="client-name">${escapeHtml(data.clientName)}</p>
    </div>

    <div class="section">
      <h2>Objetivo</h2>
      <p class="objective">${escapeHtml(data.objective)}</p>
    </div>

    <div class="separator">
      <div class="separator-line"></div>
      <div class="separator-symbol">⸻</div>
      <div class="separator-line"></div>
    </div>

    ${data.modalities
      .map(
        (modality, index) => `
      <div class="modality">
        <div class="modality-header">
          <div class="modality-title">
            MODALIDADE ${index + 1} — ${escapeHtml(modality.name.toUpperCase())}
          </div>
          <div class="modality-price">
            ${escapeHtml(modality.price)}
            <span class="modality-billing">
              ${
                modality.billingType === 'monthly'
                  ? '/ mês'
                  : modality.billingType === 'oneTime'
                  ? '(pagamento único)'
                  : ''
              }
            </span>
          </div>
        </div>

        ${
          modality.included.length > 0
            ? `
        <div class="section">
          <h3>O que está incluso</h3>
          <ul>
            ${modality.included.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </div>
        `
            : ''
        }

        ${
          modality.notIncluded && modality.notIncluded.length > 0
            ? `
        <div class="section">
          <h3>O que não está incluso</h3>
          <ul>
            ${modality.notIncluded.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </div>
        `
            : ''
        }

        ${
          modality.responsibilities?.provider || modality.responsibilities?.client
            ? `
        <div class="section">
          <h3>Responsabilidades</h3>
          <div class="responsibilities">
            ${
              modality.responsibilities?.provider
                ? `
            <div>
              <h4>Fornecedor:</h4>
              <p class="responsibility-text">${escapeHtml(modality.responsibilities.provider)}</p>
            </div>
            `
                : ''
            }
            ${
              modality.responsibilities?.client
                ? `
            <div>
              <h4>Cliente:</h4>
              <p class="responsibility-text">${escapeHtml(modality.responsibilities.client)}</p>
            </div>
            `
                : ''
            }
          </div>
        </div>
        `
            : ''
        }

        ${
          modality.advantages && modality.advantages.length > 0
            ? `
        <div class="section">
          <h3>Vantagens</h3>
          <ul>
            ${modality.advantages.map((advantage) => `<li>${escapeHtml(advantage)}</li>`).join('')}
          </ul>
        </div>
        `
            : ''
        }

        ${
          modality.detailsLink
            ? `
        <div class="section">
          <a href="${escapeHtml(modality.detailsLink)}" target="_blank" rel="noopener noreferrer" class="details-link">
            <svg class="details-link-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span>Ver Detalhamento Completo</span>
          </a>
        </div>
        `
            : ''
        }

        ${
          index < data.modalities.length - 1
            ? `
        <div class="separator">
          <div class="separator-line"></div>
          <div class="separator-symbol">⸻</div>
          <div class="separator-line"></div>
        </div>
        `
            : ''
        }
      </div>
    `
      )
      .join('')}

    ${
      data.modalities.length > 1
        ? `
    <div class="separator">
      <div class="separator-line"></div>
      <div class="separator-symbol">⸻</div>
      <div class="separator-line"></div>
    </div>

    <div class="section">
      <div class="comparison-section-title">
        <h2>Comparativo entre Modalidades</h2>
        <p class="comparison-subtitle">Veja as diferenças entre as opções disponíveis</p>
      </div>
      ${generateComparisonTable(data.modalities)}
    </div>
    `
        : ''
    }

    ${
      data.paymentMethods ||
      data.discounts ||
      data.observations ||
      data.technicalNotes ||
      data.terms
        ? `
    <div class="separator">
      <div class="separator-line"></div>
      <div class="separator-symbol">⸻</div>
      <div class="separator-line"></div>
    </div>
    `
        : ''
    }

    ${
      data.paymentMethods
        ? `
    <div class="section">
      <h3>Formas de Pagamento</h3>
      <p class="objective">${escapeHtml(data.paymentMethods)}</p>
    </div>
    `
        : ''
    }

    ${
      data.discounts
        ? `
    <div class="section">
      <h3>Descontos</h3>
      <p class="objective">${escapeHtml(data.discounts)}</p>
    </div>
    `
        : ''
    }

    ${
      data.observations
        ? `
    <div class="section">
      <h3>Observações</h3>
      <p class="objective">${escapeHtml(data.observations)}</p>
    </div>
    `
        : ''
    }

    ${
      data.technicalNotes
        ? `
    <div class="section">
      <h3>Notas Técnicas</h3>
      <p class="objective">${escapeHtml(data.technicalNotes)}</p>
    </div>
    `
        : ''
    }

    ${
      data.terms
        ? `
    <div class="section">
      <h3>Termos e Condições</h3>
      <p class="objective">${escapeHtml(data.terms)}</p>
    </div>
    `
        : ''
    }

    <div class="footer">
      <p>Proposta gerada em ${new Date().toLocaleDateString('pt-BR')}</p>
    </div>
  </div>
</body>
</html>`;

  return html;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function downloadHTML(data: ProposalData, logoUrl?: string) {
  // Converter logo para base64 se disponível
  if (logoUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      const logoBase64 = canvas.toDataURL('image/png');
      
      const html = exportToHTML(data, logoBase64);
      downloadFile(html, data);
    };
    img.onerror = () => {
      // Se falhar, gerar sem logo
      const html = exportToHTML(data);
      downloadFile(html, data);
    };
    img.src = logoUrl;
  } else {
    const html = exportToHTML(data);
    downloadFile(html, data);
  }
}

function downloadFile(html: string, data: ProposalData) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${data.title.replace(/\s+/g, '_')}_${data.clientName.replace(/\s+/g, '_')}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function generateComparisonTable(modalities: any[]) {
  // Coletar todos os itens únicos incluídos e não incluídos
  const allIncludedItems = new Set<string>();
  const allNotIncludedItems = new Set<string>();
  const allResponsibilitiesProvider = new Set<string>();
  const allResponsibilitiesClient = new Set<string>();

  modalities.forEach((modality) => {
    modality.included.forEach((item: string) => allIncludedItems.add(item));
    modality.notIncluded?.forEach((item: string) => allNotIncludedItems.add(item));
    if (modality.responsibilities?.provider) {
      allResponsibilitiesProvider.add(modality.responsibilities.provider);
    }
    if (modality.responsibilities?.client) {
      allResponsibilitiesClient.add(modality.responsibilities.client);
    }
  });

  const hasResponsibilities =
    allResponsibilitiesProvider.size > 0 || allResponsibilitiesClient.size > 0;

  return `
  <table class=\"comparison-table\">
    <thead>
      <tr>
        <th>Item</th>
        ${modalities.map((modality) => `
        <th>
          <div class=\"comparison-header-content\">
            <div>${escapeHtml(modality.name)}</div>
            <div class=\"comparison-price\">${escapeHtml(modality.price)}</div>
            <div class=\"comparison-billing\">
              ${
                modality.billingType === 'monthly'
                  ? '/ mês'
                  : modality.billingType === 'oneTime'
                  ? 'Pagamento único'
                  : ''
              }
            </div>
          </div>
        </th>
        `).join('')}
      </tr>
    </thead>
    <tbody>
      <!-- Investimento Inicial -->
      <tr>
        <td>Investimento inicial</td>
        ${modalities.map((modality) => `
        <td>
          ${
            modality.billingType === 'monthly'
              ? '<span class="text-green">Não</span>'
              : '<span class="text-amber">Sim</span>'
          }
        </td>
        `).join('')}
      </tr>

      <!-- Pagamento -->
      <tr>
        <td>Pagamento</td>
        ${modalities.map((modality) => `
        <td>
          ${
            modality.billingType === 'monthly'
              ? 'Mensal'
              : modality.billingType === 'oneTime'
              ? 'Único'
              : 'Customizado'
          }
        </td>
        `).join('')}
      </tr>

      <!-- Itens incluídos -->
      ${Array.from(allIncludedItems).map((item) => `
      <tr>
        <td>${escapeHtml(item)}</td>
        ${modalities.map((modality) => `
        <td>
          ${
            modality.included.includes(item)
              ? '<span class="check-icon">✓</span>'
              : '<span class="x-icon">✗</span>'
          }
        </td>
        `).join('')}
      </tr>
      `).join('')}

      <!-- Itens não incluídos (se existirem) -->
      ${allNotIncludedItems.size > 0 ? Array.from(allNotIncludedItems).map((item) => `
      <tr>
        <td>${escapeHtml(item)}</td>
        ${modalities.map((modality) => `
        <td>
          ${
            modality.notIncluded?.includes(item)
              ? '<span class="x-icon">✗</span>'
              : '<span class="check-icon">✓</span>'
          }
        </td>
        `).join('')}
      </tr>
      `).join('') : ''}

      <!-- Gestão técnica (se houver responsabilidades) -->
      ${hasResponsibilities ? `
      <tr>
        <td>Gestão técnica</td>
        ${modalities.map((modality) => `
        <td>
          <span style="font-size: 0.875rem;">
            ${
              modality.responsibilities?.provider
                ? escapeHtml(modality.responsibilities.provider.split(',')[0].trim())
                : modality.responsibilities?.client
                ? escapeHtml(modality.responsibilities.client.split(',')[0].trim())
                : '-'
            }
          </span>
        </td>
        `).join('')}
      </tr>
      ` : ''}
    </tbody>
  </table>
  `;
}