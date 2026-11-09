import type { ExportDoc } from '@graficai/core';

const INK: [number, number, number] = [28, 30, 34];
const MUTED: [number, number, number] = [110, 112, 118];
const ACCENT: [number, number, number] = [37, 89, 191];
const RULE: [number, number, number] = [214, 216, 222];

/** As fontes padrão do PDF usam WinAnsi; troca o que ficaria fora dela. */
function clean(s: string): string {
  return s.replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->').replace(/❦/g, '').replace(/[  ]/g, ' ');
}

/** Desenha um ExportDoc em A4 e devolve o PDF como Blob. jsPDF é carregado sob demanda. */
export async function renderPdf(doc: ExportDoc): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 18;
  const contentW = W - 2 * M;
  let y = M;

  const ensure = (h: number) => {
    if (y + h > H - M - 8) {
      pdf.addPage();
      y = M;
    }
  };
  const lastY = () => (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // Cabeçalho
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(...ACCENT);
  pdf.text('GRAFICAI', M, y);
  y += 7;
  pdf.setFontSize(18);
  pdf.setTextColor(...INK);
  pdf.text(clean(doc.title), M, y);
  y += 7;
  pdf.setFont('times', 'italic');
  pdf.setFontSize(13);
  for (const line of pdf.splitTextToSize(clean(doc.subtitle), contentW)) {
    pdf.text(line, M, y);
    y += 5.5;
  }
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(...MUTED);
  pdf.text(clean(doc.meta.map(([k, v]) => `${k}: ${v}`).join('   ·   ')), M, y + 1);
  y += 5;
  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(0.3);
  pdf.line(M, y, W - M, y);
  y += 7;

  const base = { margin: { left: M, right: M, top: M, bottom: M + 8 }, styles: { font: 'helvetica', fontSize: 8.8, textColor: INK, cellPadding: { top: 1.4, bottom: 1.4, left: 2, right: 2 }, lineColor: RULE } };

  for (const s of doc.sections) {
    ensure(18);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10.5);
    pdf.setTextColor(...ACCENT);
    pdf.text(clean(s.title), M, y);
    y += 3;

    if (s.kv?.length) {
      autoTable(pdf, {
        ...base,
        startY: y,
        theme: 'plain',
        body: s.kv.map(([k, v]) => [clean(k), clean(v)]),
        columnStyles: { 0: { cellWidth: 46, textColor: MUTED }, 1: {} },
        didDrawCell: (c) => {
          if (c.section === 'body' && c.column.index === 1) {
            pdf.setDrawColor(...RULE);
            pdf.setLineWidth(0.15);
            pdf.line(M, c.cell.y + c.cell.height, W - M, c.cell.y + c.cell.height);
          }
        },
      });
      y = lastY() + 3;
    }

    if (s.paragraphs?.length) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(...INK);
      for (const para of s.paragraphs) {
        for (const line of pdf.splitTextToSize(clean(para), contentW)) {
          ensure(5);
          pdf.text(line, M, y + 3);
          y += 4.4;
        }
        y += 1.5;
      }
    }

    if (s.table) {
      const widths = s.table.widths ?? [];
      // Tabelas curtas não se partem entre páginas.
      if (s.table.rows.length <= 12) ensure(10 + s.table.rows.length * 7);
      autoTable(pdf, {
        ...base,
        startY: y,
        theme: 'striped',
        head: [s.table.head.map(clean)],
        body: s.table.rows.map((r) => r.map(clean)),
        headStyles: { fillColor: [236, 239, 245], textColor: INK, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [249, 250, 252] },
        columnStyles: Object.fromEntries(widths.map((w, i) => [i, w ? { cellWidth: w } : {}])),
      });
      y = lastY() + 3;
    }

    if (s.bullets?.length) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(...INK);
      for (const b of s.bullets) {
        const lines = pdf.splitTextToSize(clean(b), contentW - 5);
        ensure(lines.length * 4.4 + 1);
        pdf.text('•', M + 1, y + 3);
        lines.forEach((line: string, i: number) => pdf.text(line, M + 5, y + 3 + i * 4.4));
        y += lines.length * 4.4 + 1.4;
      }
    }
    y += 5;
  }

  // Rodapé em todas as páginas
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    pdf.text(clean(doc.footnote), M, H - 10, { maxWidth: contentW - 20 });
    pdf.text(`${i}/${total}`, W - M, H - 10, { align: 'right' });
  }

  pdf.setProperties({ title: `${doc.title} — ${doc.subtitle}`, creator: 'GraficAI' });
  return pdf.output('blob');
}

export function saveBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
