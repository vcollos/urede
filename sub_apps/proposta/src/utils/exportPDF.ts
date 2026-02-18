import { ProposalData } from '../App';

export async function exportToPDF(elementRef: HTMLDivElement, fileName: string) {
  try {
    // Importar jsPDF dinamicamente
    const { default: jsPDF } = await import('jspdf');

    if (!elementRef) {
      throw new Error('Elemento não encontrado');
    }

    // Obter dados da proposta do elemento
    const proposalData = getProposalDataFromElement(elementRef);
    
    if (!proposalData) {
      throw new Error('Dados da proposta não encontrados');
    }

    // Criar PDF usando jsPDF com texto nativo
    const pdf = await generateNativePDF(proposalData);
    
    // Salvar o PDF
    pdf.save(fileName);
    
    return true;
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    throw error;
  }
}

function getProposalDataFromElement(element: HTMLDivElement): ProposalData | null {
  // Tentar obter dados do elemento ou usar fallback
  try {
    const titleEl = element.querySelector('h1');
    const clientEl = element.querySelector('.text-xl');
    
    if (!titleEl || !clientEl) return null;

    // Esta função é um fallback - idealmente devemos passar os dados diretamente
    return null;
  } catch {
    return null;
  }
}

async function generateNativePDF(data: ProposalData) {
  const { default: jsPDF } = await import('jspdf');
  
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  let yPosition = 20;
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 20;
  const contentWidth = pageWidth - (2 * margin);
  const lineHeight = 7;

  // Função auxiliar para adicionar nova página se necessário
  const checkPageBreak = (requiredSpace: number = 10) => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // Logo (substituir por base64 se disponível)
  // pdf.addImage(logoBase64, 'PNG', margin, yPosition, 40, 10);
  yPosition += 25;

  // Título
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text(data.title, margin, yPosition);
  yPosition += 10;

  // Nome do cliente
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 100, 100);
  pdf.text(data.clientName, margin, yPosition);
  pdf.setTextColor(0, 0, 0);
  yPosition += 15;

  // Linha separadora
  pdf.setLineWidth(0.5);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 15;

  // Objetivo
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Objetivo', margin, yPosition);
  yPosition += 8;

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  const objectiveLines = pdf.splitTextToSize(data.objective, contentWidth);
  objectiveLines.forEach((line: string) => {
    checkPageBreak();
    pdf.text(line, margin, yPosition);
    yPosition += lineHeight;
  });
  yPosition += 10;

  // Separador
  pdf.setTextColor(150, 150, 150);
  pdf.text('⸻', pageWidth / 2, yPosition, { align: 'center' });
  pdf.setTextColor(0, 0, 0);
  yPosition += 15;

  // Modalidades
  data.modalities.forEach((modality, index) => {
    checkPageBreak(40);

    // Header da modalidade
    pdf.setFillColor(17, 24, 39);
    pdf.rect(margin, yPosition - 5, contentWidth, 25, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`MODALIDADE ${index + 1} — ${modality.name.toUpperCase()}`, margin + 5, yPosition + 3);
    
    pdf.setFontSize(16);
    const priceText = modality.billingType === 'monthly' 
      ? `${modality.price} / mês` 
      : modality.billingType === 'oneTime'
      ? `${modality.price} (pagamento único)`
      : modality.price;
    pdf.text(priceText, margin + 5, yPosition + 13);
    
    pdf.setTextColor(0, 0, 0);
    yPosition += 35;

    // O que está incluso
    if (modality.included.length > 0) {
      checkPageBreak(20);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('O que está incluso', margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      modality.included.forEach(item => {
        checkPageBreak();
        const lines = pdf.splitTextToSize(item, contentWidth - 10);
        pdf.text('•', margin, yPosition);
        pdf.text(lines, margin + 5, yPosition);
        yPosition += lines.length * lineHeight;
      });
      yPosition += 5;
    }

    // O que não está incluso
    if (modality.notIncluded && modality.notIncluded.length > 0) {
      checkPageBreak(20);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('O que não está incluso', margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      modality.notIncluded.forEach(item => {
        checkPageBreak();
        const lines = pdf.splitTextToSize(item, contentWidth - 10);
        pdf.text('•', margin, yPosition);
        pdf.text(lines, margin + 5, yPosition);
        yPosition += lines.length * lineHeight;
      });
      yPosition += 5;
    }

    // Responsabilidades
    if (modality.responsibilities?.provider || modality.responsibilities?.client) {
      checkPageBreak(30);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Responsabilidades', margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      if (modality.responsibilities?.provider) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Fornecedor:', margin, yPosition);
        yPosition += 6;
        pdf.setFont('helvetica', 'normal');
        const lines = pdf.splitTextToSize(modality.responsibilities.provider, contentWidth - 10);
        lines.forEach((line: string) => {
          checkPageBreak();
          pdf.text(line, margin + 5, yPosition);
          yPosition += lineHeight;
        });
      }

      if (modality.responsibilities?.client) {
        checkPageBreak();
        pdf.setFont('helvetica', 'bold');
        pdf.text('Cliente:', margin, yPosition);
        yPosition += 6;
        pdf.setFont('helvetica', 'normal');
        const lines = pdf.splitTextToSize(modality.responsibilities.client, contentWidth - 10);
        lines.forEach((line: string) => {
          checkPageBreak();
          pdf.text(line, margin + 5, yPosition);
          yPosition += lineHeight;
        });
      }
      yPosition += 5;
    }

    // Vantagens
    if (modality.advantages && modality.advantages.length > 0) {
      checkPageBreak(20);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Vantagens', margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      modality.advantages.forEach(advantage => {
        checkPageBreak();
        const lines = pdf.splitTextToSize(advantage, contentWidth - 10);
        pdf.text('•', margin, yPosition);
        pdf.text(lines, margin + 5, yPosition);
        yPosition += lines.length * lineHeight;
      });
      yPosition += 5;
    }

    // Link de detalhamento
    if (modality.detailsLink) {
      checkPageBreak(15);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);
      
      // Desenhar o botão com borda
      const buttonY = yPosition - 3;
      const buttonHeight = 10;
      const buttonText = 'Ver Detalhamento Completo';
      const textWidth = pdf.getTextWidth(buttonText);
      const buttonWidth = textWidth + 12;
      
      // Borda do botão
      pdf.setDrawColor(17, 24, 39);
      pdf.setLineWidth(0.5);
      pdf.rect(margin, buttonY, buttonWidth, buttonHeight, 'S');
      
      // Texto do link (clicável)
      pdf.textWithLink(buttonText, margin + 6, yPosition + 3, { url: modality.detailsLink });
      
      yPosition += 15;
    }

    // Separador entre modalidades
    if (index < data.modalities.length - 1) {
      yPosition += 10;
      checkPageBreak(15);
      pdf.setTextColor(150, 150, 150);
      pdf.text('⸻', pageWidth / 2, yPosition, { align: 'center' });
      pdf.setTextColor(0, 0, 0);
      yPosition += 15;
    }
  });

  // Tabela comparativa (se houver mais de uma modalidade)
  if (data.modalities.length > 1) {
    yPosition += 15;
    checkPageBreak(40);
    
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Comparativo entre Modalidades', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);
    pdf.text('Veja as diferenças entre as opções disponíveis', pageWidth / 2, yPosition, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
    yPosition += 15;

    // Criar tabela simplificada
    const colWidth = contentWidth / (data.modalities.length + 1);
    
    // Header
    pdf.setFillColor(17, 24, 39);
    pdf.rect(margin, yPosition - 5, contentWidth, 10, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Item', margin + 2, yPosition);
    
    data.modalities.forEach((mod, idx) => {
      pdf.text(mod.name, margin + colWidth * (idx + 1) + 2, yPosition);
    });
    pdf.setTextColor(0, 0, 0);
    yPosition += 12;

    // Linhas da tabela
    const addTableRow = (label: string, values: string[]) => {
      checkPageBreak(10);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text(label, margin + 2, yPosition);
      values.forEach((val, idx) => {
        pdf.text(val, margin + colWidth * (idx + 1) + 2, yPosition);
      });
      yPosition += 8;
      pdf.setDrawColor(220, 220, 220);
      pdf.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
    };

    addTableRow(
      'Investimento inicial',
      data.modalities.map(m => m.billingType === 'monthly' ? 'Não' : 'Sim')
    );
    
    addTableRow(
      'Pagamento',
      data.modalities.map(m => 
        m.billingType === 'monthly' ? 'Mensal' : 
        m.billingType === 'oneTime' ? 'Único' : 'Custom'
      )
    );

    yPosition += 10;
  }

  // Informações adicionais
  yPosition += 10;
  checkPageBreak(20);
  
  pdf.setTextColor(150, 150, 150);
  pdf.text('⸻', pageWidth / 2, yPosition, { align: 'center' });
  pdf.setTextColor(0, 0, 0);
  yPosition += 15;

  const addSection = (title: string, content: string) => {
    if (content) {
      checkPageBreak(20);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(title, margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const lines = pdf.splitTextToSize(content, contentWidth);
      lines.forEach((line: string) => {
        checkPageBreak();
        pdf.text(line, margin, yPosition);
        yPosition += lineHeight;
      });
      yPosition += 8;
    }
  };

  addSection('Formas de Pagamento', data.paymentMethods || '');
  addSection('Descontos', data.discounts || '');
  addSection('Observações', data.observations || '');
  addSection('Notas Técnicas', data.technicalNotes || '');
  addSection('Termos e Condições', data.terms || '');

  // Footer
  yPosition = pageHeight - 15;
  pdf.setFontSize(9);
  pdf.setTextColor(150, 150, 150);
  pdf.text(
    `Proposta gerada em ${new Date().toLocaleDateString('pt-BR')}`,
    pageWidth / 2,
    yPosition,
    { align: 'center' }
  );

  return pdf;
}

// Função melhorada que recebe os dados diretamente
export async function exportProposalToPDF(data: ProposalData, fileName: string, logoBase64?: string) {
  try {
    const pdf = await generateNativePDFWithLogo(data, logoBase64);
    pdf.save(fileName);
    return true;
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    throw error;
  }
}

async function generateNativePDFWithLogo(data: ProposalData, logoBase64?: string) {
  const pdf = await generateNativePDF(data);
  
  // Adicionar logo na primeira página se disponível
  if (logoBase64) {
    // A implementação do logo seria aqui
  }
  
  return pdf;
}