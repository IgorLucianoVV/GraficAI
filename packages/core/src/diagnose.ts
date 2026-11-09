import type { Book, Diagnosis, Issue, Page, ProjectSettings, DesignSpec, TextStats } from './types.ts';
import { countText } from './laudas.ts';
import { layoutBook } from './layout.ts';
import { describePlan, evenWorking, planSignatures } from './signatures.ts';
import { estimateCost, spineWidth } from './cost.ts';
import { KIND_LABELS } from './rules.ts';

/** Diagnóstico completo: texto, paginação, cadernos, custo, lombada e problemas. */
export function diagnose(book: Book, settings: ProjectSettings, designOverride?: DesignSpec, cachedStats?: TextStats): Diagnosis {
  const design = designOverride ?? settings.design;
  // A contagem de texto não depende do projeto gráfico: o otimizador reaproveita.
  const stats = cachedStats ?? countText(book, settings.lauda);
  const layout = layoutBook(book, design);
  const sizes = settings.printer.signatureSizes;
  const plan = planSignatures(layout.contentPages, sizes);

  // Páginas de fechamento do caderno entram no fim do livro.
  const pages: Page[] = [...layout.pages];
  for (let i = 0; i < plan.paddingPages; i++) {
    pages.push({ number: pages.length + 1, elementId: null, kind: 'branco', blankReason: 'fecho_caderno', fill: 0, isOpener: false, signatureIndex: 0 });
  }
  let cursor = 0;
  plan.sizes.forEach((size, idx) => {
    for (let i = 0; i < size && cursor < pages.length; i++) pages[cursor++].signatureIndex = idx;
  });

  const cost = estimateCost(plan, settings.printer, settings.run);
  const ew = evenWorking(layout.contentPages, sizes);
  const issues = findIssues(book, { ...layout, pages }, plan.paddingPages, ew, sizes, settings.printer.process);

  return {
    stats,
    layout: { ...layout, pages, blankPages: pages.filter((p) => p.kind === 'branco').length },
    plan,
    cost,
    spineMm: spineWidth(plan.totalPages, settings.printer.paper.mmPerPage),
    issues,
    evenWorking: ew,
  };
}

function findIssues(
  book: Book,
  layout: Diagnosis['layout'],
  padding: number,
  ew: Diagnosis['evenWorking'],
  sizes: number[],
  process: 'offset' | 'digital',
): Issue[] {
  const issues: Issue[] = [];
  const lpp = layout.metrics.linesPerPage;

  for (const el of layout.elements) {
    if (el.lines === 0 || el.pages < 2) continue;
    const lastPage = el.startPage + el.pages - 1;
    const label = `${KIND_LABELS[el.kind]} “${el.title}”`;
    if (el.lastPageLines <= 3) {
      const pct = Math.max(0.5, Math.round((el.lastPageLines / el.lines) * 1000) / 10);
      issues.push({
        kind: 'linhas_viuvas',
        severity: 'alerta',
        page: lastPage,
        elementId: el.id,
        message: `${label} termina com ${el.lastPageLines} ${el.lastPageLines === 1 ? 'linha' : 'linhas'} na página ${lastPage}.`,
        suggestion: `Apertar o espaçamento do trecho em cerca de ${pct}% elimina esta página.`,
      });
    } else if (el.lastPageLines / lpp < 0.25) {
      issues.push({
        kind: 'pagina_curta',
        severity: 'info',
        page: lastPage,
        elementId: el.id,
        message: `Página ${lastPage} tem ${Math.round((el.lastPageLines / lpp) * 100)}% de ocupação (fim de ${label}).`,
        suggestion: 'Avalie redistribuir o texto ou aceitar como respiro.',
      });
    }
  }

  if (process === 'offset' && padding > 0) {
    issues.push({
      kind: 'fecho_caderno',
      severity: 'alerta',
      message: `O livro tem ${layout.contentPages} páginas; faltam ${padding} para fechar o último caderno.`,
      suggestion:
        ew.pagesToCut > 0
          ? `Cortar ${ew.pagesToCut} páginas fecha em ${ew.lowerTotal}; ou use as ${padding} páginas para elementos editoriais (sobre o autor, respiro, colofão).`
          : `Use as ${padding} páginas para elementos editoriais (sobre o autor, respiro, colofão).`,
    });
  }

  const largest = Math.max(...sizes);
  const plan = planSignatures(layout.contentPages, sizes);
  const small = plan.sizes.filter((s) => s < largest);
  if (process === 'offset' && small.length > 0) {
    issues.push({
      kind: 'caderno_fracionado',
      severity: 'info',
      message: `Plano usa caderno fracionado (${describePlan(plan)}).`,
      suggestion: 'Cadernos menores custam quase o mesmo acerto que um inteiro; confira na tabela da gráfica.',
    });
  }

  for (const el of book.elements) {
    if (el.confidence === 'baixa' && el.classifiedBy !== 'usuario') {
      issues.push({
        kind: 'baixa_confianca',
        severity: 'alerta',
        elementId: el.id,
        message: `Classificação incerta: “${el.title}” foi marcado como ${KIND_LABELS[el.kind]}.`,
        suggestion: 'Revise na aba Estrutura.',
      });
    }
  }
  return issues;
}
