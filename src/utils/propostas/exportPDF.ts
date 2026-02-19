import { ProposalData } from '../../types/propostas';

export async function exportProposalToPDF(data: ProposalData, fileName: string) {
  const { default: jsPDF } = await import('jspdf');

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  let y = 20;
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const lineHeight = 6;

  const ensureSpace = (needed = 10) => {
    if (y + needed <= pageHeight - margin) return;
    pdf.addPage();
    y = margin;
  };

  const writeTextBlock = (text: string, indent = 0) => {
    const lines = pdf.splitTextToSize(text || '', contentWidth - indent);
    lines.forEach((line: string) => {
      ensureSpace();
      pdf.text(line, margin + indent, y);
      y += lineHeight;
    });
  };

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.text(data.title || 'Proposta', margin, y);
  y += 10;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(13);
  pdf.setTextColor(95, 99, 115);
  pdf.text(data.clientName || '', margin, y);
  pdf.setTextColor(0, 0, 0);
  y += 10;

  pdf.setDrawColor(210, 214, 224);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 10;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text('Objetivo', margin, y);
  y += 8;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  writeTextBlock(data.objective || '');
  y += 4;

  data.modalities.forEach((modality, index) => {
    ensureSpace(28);
    pdf.setFillColor(17, 24, 39);
    pdf.rect(margin, y - 5, contentWidth, 20, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text(`MODALIDADE ${index + 1} — ${(modality.name || '').toUpperCase()}`, margin + 4, y + 2);

    const billingLabel =
      modality.billingType === 'monthly'
        ? '/ mês'
        : modality.billingType === 'oneTime'
        ? '(pagamento único)'
        : '';
    pdf.setFontSize(14);
    pdf.text(`${modality.price || ''} ${billingLabel}`, margin + 4, y + 10);
    pdf.setTextColor(0, 0, 0);
    y += 22;

    if (modality.included.length > 0) {
      ensureSpace(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text('O que está incluso', margin, y);
      y += 7;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      modality.included.forEach((item) => {
        ensureSpace();
        pdf.text('•', margin, y);
        writeTextBlock(item, 4);
      });
      y += 2;
    }

    if (modality.notIncluded?.length) {
      ensureSpace(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text('O que não está incluso', margin, y);
      y += 7;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      modality.notIncluded.forEach((item) => {
        ensureSpace();
        pdf.text('•', margin, y);
        writeTextBlock(item, 4);
      });
      y += 2;
    }

    if (modality.responsibilities?.provider || modality.responsibilities?.client) {
      ensureSpace(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text('Responsabilidades', margin, y);
      y += 7;
      pdf.setFontSize(10);
      if (modality.responsibilities?.provider) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Fornecedor:', margin, y);
        y += 6;
        pdf.setFont('helvetica', 'normal');
        writeTextBlock(modality.responsibilities.provider, 2);
      }
      if (modality.responsibilities?.client) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Cliente:', margin, y);
        y += 6;
        pdf.setFont('helvetica', 'normal');
        writeTextBlock(modality.responsibilities.client, 2);
      }
      y += 2;
    }

    if (modality.advantages?.length) {
      ensureSpace(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text('Vantagens', margin, y);
      y += 7;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      modality.advantages.forEach((item) => {
        ensureSpace();
        pdf.text('•', margin, y);
        writeTextBlock(item, 4);
      });
      y += 2;
    }

    if (modality.detailsLink) {
      ensureSpace(12);
      const label = modality.detailsLinkTitle?.trim() || 'Ver detalhamento completo';
      const textWidth = pdf.getTextWidth(label);
      const buttonWidth = textWidth + 10;
      const buttonY = y - 4;
      pdf.setDrawColor(17, 24, 39);
      pdf.rect(margin, buttonY, buttonWidth, 8, 'S');
      pdf.textWithLink(label, margin + 5, y + 1, { url: modality.detailsLink });
      y += 10;
    }

    y += 4;
  });

  const sections: Array<[string, string | undefined]> = [
    ['Formas de pagamento', data.paymentMethods],
    ['Descontos', data.discounts],
    ['Observações', data.observations],
    ['Notas técnicas', data.technicalNotes],
    ['Termos e condições', data.terms],
  ];

  sections.forEach(([title, content]) => {
    if (!content?.trim()) return;
    ensureSpace(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text(title, margin, y);
    y += 7;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    writeTextBlock(content);
    y += 2;
  });

  const footerText = `Proposta gerada em ${new Date().toLocaleDateString('pt-BR')}`;
  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(140, 146, 158);
    pdf.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
  }

  pdf.save(fileName);
}
