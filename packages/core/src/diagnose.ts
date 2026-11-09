import type { Book, Diagnosis, Imposition, Issue, Page, ProjectSettings, DesignSpec, SheetOption, TextStats } from './types.ts';
import { impose, sheetLabel } from './impose.ts';
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
  const printer = settings.printer;

  // Offset: avalia cada folha da gráfica; a escolha define cadernos e custo.
  let imposition: Imposition | null = null;
  let sheetOptions: SheetOption[] = [];
  const pre: Issue[] = [];
  if (printer.process === 'offset') {
    sheetOptions = printer.offset.sheets.map((sheet) => {
      const imp = impose(design.trimWidthMm, design.trimHeightMm, sheet, printer.offset);
      if (!imp) return { sheet, imposition: null, total: null, totalPages: null };
      const p = planSignatures(layout.contentPages, imp.signatureSizes);
      return { sheet, imposition: imp, total: estimateCost(p, printer, settings.run, imp).total, totalPages: p.totalPages };
    });
    const viable = sheetOptions.filter((o) => o.imposition);
    const chosen = viable.find((o) => o.sheet.id === printer.offset.sheetChoice);
    const cheapest = [...viable].sort((a, b) => a.total! - b.total! || b.imposition!.efficiency - a.imposition!.efficiency)[0];
    imposition = (chosen ?? cheapest)?.imposition ?? null;
    if (!viable.length) {
      pre.push({
        kind: 'formato_nao_cabe',
        severity: 'erro',
        message: `O formato ${design.trimWidthMm} × ${design.trimHeightMm} mm não cabe em nenhuma folha da gráfica (${printer.offset.sheets.map(sheetLabel).join(', ')}).`,
        suggestion: 'Reduza o formato ou cadastre uma folha maior no perfil da gráfica. Os números abaixo usam os cadernos padrão.',
      });
    } else if (printer.offset.sheetChoice !== 'auto' && !chosen) {
      const s = printer.offset.sheets.find((x) => x.id === printer.offset.sheetChoice);
      pre.push({
        kind: 'formato_nao_cabe',
        severity: 'alerta',
        message: `O formato não cabe na folha escolhida${s ? ` (${sheetLabel(s)})` : ''}; usando ${sheetLabel(imposition!.sheet)}.`,
      });
    }
  }
  const sizes = imposition ? imposition.signatureSizes : printer.signatureSizes;
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

  const cost = estimateCost(plan, printer, settings.run, imposition);
  const ew = evenWorking(layout.contentPages, sizes);
  const issues = [...pre, ...findIssues(book, { ...layout, pages }, plan.paddingPages, ew, sizes, printer.process), ...impositionIssues(imposition, sheetOptions, design)];

  return {
    stats,
    layout: { ...layout, pages, blankPages: pages.filter((p) => p.kind === 'branco').length },
    plan,
    cost,
    spineMm: spineWidth(plan.totalPages, printer.paper.mmPerPage),
    imposition,
    sheetOptions,
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

  for (const el of layout.elements) {
    const o = el.opening;
    if (!o) continue;
    const label = `${KIND_LABELS[el.kind]} “${el.title}”`;
    if (o.shortParagraph) {
      issues.push({
        kind: 'abertura',
        severity: 'alerta',
        page: el.startPage,
        elementId: el.id,
        message: `${label}: o primeiro parágrafo é mais curto que a capitular.`,
        suggestion: 'Reduza a capitular para 2 linhas, junte o parágrafo ao seguinte ou desligue a capitular neste capítulo.',
      });
    } else if (o.skipped === 'numero' || o.skipped === 'dialogo') {
      issues.push({
        kind: 'abertura',
        severity: 'info',
        page: el.startPage,
        elementId: el.id,
        message: `${label} abre sem capitular (${o.skipped === 'numero' ? 'começa com algarismo' : 'começa com diálogo'}).`,
        suggestion: o.skipped === 'numero' ? 'Ative “capitular em algarismos” se quiser manter o padrão.' : 'Mude a regra de diálogo para “pendurar a pontuação” se quiser capitular.',
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

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Aproveitamento da folha: avisa quando o formato desperdiça papel. */
function impositionIssues(imp: Imposition | null, options: SheetOption[], d: DesignSpec): Issue[] {
  if (!imp) return [];
  const issues: Issue[] = [];
  const label = `${d.trimWidthMm} × ${d.trimHeightMm} mm em ${sheetLabel(imp.sheet)}`;
  const better = options
    .filter((o) => o.imposition && o.sheet.id !== imp.sheet.id && o.imposition.efficiency > imp.efficiency + 0.05)
    .sort((a, b) => b.imposition!.efficiency - a.imposition!.efficiency)[0];
  if (imp.efficiency < 0.72) {
    const lost = imp.fit > imp.pagesPerSide ? ` Cabem ${imp.fit} páginas por lado, mas a dobra usa ${imp.pagesPerSide}.` : '';
    issues.push({
      kind: 'aproveitamento',
      severity: imp.efficiency < 0.6 ? 'alerta' : 'info',
      message: `Aproveitamento de papel de ${pct(imp.efficiency)} (${label}).${lost}`,
      suggestion: better
        ? `Em ${sheetLabel(better.sheet)} o aproveitamento seria ${pct(better.imposition!.efficiency)}. Ou ajuste o formato para caber mais páginas por folha.`
        : 'Um formato um pouco menor pode caber mais páginas por folha e baixar o custo de papel.',
    });
  }
  return issues;
}
