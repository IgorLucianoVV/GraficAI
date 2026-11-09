import type { Book, Diagnosis } from './types.ts';
import { KIND_LABELS } from './rules.ts';

/** Resposta determinística para "Por que essa página existe?". */
export function explainPage(book: Book, d: Diagnosis, pageNumber: number): { title: string; lines: string[] } {
  const page = d.layout.pages[pageNumber - 1];
  if (!page) return { title: `Página ${pageNumber}`, lines: ['Página fora do livro.'] };

  const sigIdx = page.signatureIndex;
  const sigStart = d.plan.sizes.slice(0, sigIdx).reduce((a, s) => a + s, 0) + 1;
  const sigSize = d.plan.sizes[sigIdx] ?? 0;
  const sigLine = `Caderno ${sigIdx + 1} de ${d.plan.sizes.length} (${sigSize} páginas: ${sigStart}–${sigStart + sigSize - 1}).`;
  const side = pageNumber % 2 === 1 ? 'ímpar (direita)' : 'par (esquerda)';

  if (page.kind === 'branco') {
    const next = d.layout.elements.find((e) => e.startPage === pageNumber + 1);
    const prev = d.layout.elements.find((e) => e.startPage + e.pages === pageNumber);
    const lines: string[] = [];
    if (page.blankReason === 'abre_impar') {
      lines.push(
        `Branco obrigatório: ${next ? `${KIND_LABELS[next.kind]} “${next.title}”` : 'o elemento seguinte'} está configurado para abrir em página ímpar, e a página ${pageNumber} é par.`,
      );
      lines.push('Para eliminá-la: permita abertura em qualquer página, ou faça o elemento anterior terminar uma página antes/depois.');
    } else if (page.blankReason === 'verso_branco') {
      lines.push(`Branco editorial: o verso de ${prev ? `${KIND_LABELS[prev.kind]}` : 'o elemento anterior'} fica em branco por convenção.`);
    } else {
      lines.push(`Branco de fechamento: o conteúdo termina na página ${d.layout.contentPages}, e o plano de cadernos (${d.plan.sizes.join(' + ')}) exige ${d.plan.totalPages}.`);
      lines.push(`Há ${d.plan.paddingPages} páginas disponíveis para elementos editoriais, ou corte ${d.evenWorking.pagesToCut} para fechar em ${d.evenWorking.lowerTotal}.`);
    }
    lines.push(`Página ${side}. ${sigLine}`);
    return { title: `Página ${pageNumber} — em branco`, lines };
  }

  const el = book.elements.find((e) => e.id === page.elementId);
  const lay = d.layout.elements.find((e) => e.id === page.elementId);
  const lines: string[] = [];
  if (el && lay) {
    const pos = pageNumber - lay.startPage + 1;
    lines.push(`${KIND_LABELS[el.kind]} “${el.title}”, página ${pos} de ${lay.pages}.`);
    if (page.isOpener) {
      lines.push('Página de abertura do elemento.');
      const o = lay.opening;
      if (o) {
        const parts: string[] = [];
        if (o.cap) parts.push(`capitular “${o.hanging.trim()}${o.cap}”`);
        else if (o.skipped === 'numero') parts.push('sem capitular (começa com algarismo)');
        else if (o.skipped === 'dialogo') parts.push('sem capitular (começa com diálogo)');
        if (o.leadIn) parts.push(`versalete em “${o.leadIn}”`);
        if (parts.length || o.extraLines) {
          const delta = o.extraLines === 0 ? 'sem efeito na contagem' : `${o.extraLines > 0 ? '+' : ''}${o.extraLines} ${Math.abs(o.extraLines) === 1 ? 'linha' : 'linhas'} no capítulo`;
          lines.push(`Abertura: ${parts.join(', ') || 'ornamento'} — ${delta}.`);
        }
      }
    }
    lines.push(`Ocupação: ${Math.round(page.fill * 100)}%.`);
    lines.push(`Classificado por ${el.classifiedBy === 'usuario' ? 'você' : el.classifiedBy === 'llm' ? 'IA' : 'regra'}: ${el.rationale}`);
  }
  lines.push(`Página ${side}. ${sigLine}`);
  return { title: `Página ${pageNumber}`, lines };
}
