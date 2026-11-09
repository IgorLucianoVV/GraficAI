import type { Block, Book, BookElement, DesignSpec, ElementLayout, Layout, Page, PageMetrics } from './types.ts';
import { ruleFor } from './rules.ts';
import { analyzeOpening } from './opening.ts';

const PT_TO_MM = 0.352778;

/** Geometria da mancha: quantos caracteres por linha e linhas por página. */
export function pageMetrics(d: DesignSpec): PageMetrics {
  const textWidthMm = d.trimWidthMm - d.marginInnerMm - d.marginOuterMm;
  const textHeightMm = d.trimHeightMm - d.marginTopMm - d.marginBottomMm;
  const charWidthMm = d.bodySizePt * PT_TO_MM * d.avgCharWidthEm;
  const charsPerLine = Math.max(10, Math.floor(textWidthMm / charWidthMm));
  const linesPerPage = Math.max(5, Math.floor(textHeightMm / (d.leadingPt * PT_TO_MM)));
  return { textWidthMm, textHeightMm, charsPerLine, linesPerPage, charsPerPage: charsPerLine * linesPerPage };
}

/** Linhas que um bloco ocupa (castoff por bloco, mais preciso que caracteres/página). */
export function blockLines(b: Block, m: PageMetrics, d: DesignSpec): number {
  const len = b.text.length; // unidades UTF-16: aproximação suficiente e barata para o castoff
  const lines = (factor: number) => Math.max(1, Math.ceil(len / Math.floor(m.charsPerLine * factor)));
  switch (b.type) {
    case 'paragrafo':
      return lines(1) + d.paragraphSpacingLines;
    case 'citacao':
      return lines(0.85) + 1;
    case 'lista':
      return lines(0.92);
    case 'subtitulo':
      return lines(0.8) + 1.5;
    case 'titulo':
      return lines(0.6) + 1;
    case 'nota':
      // Corpo menor: ~20% mais caracteres por linha e linhas ~80% da altura.
      return lines(1.2) * 0.8;
    case 'tabela':
      return lines(0.9) + 2;
    case 'imagem':
      return Math.round(m.linesPerPage * 0.4);
  }
}

function sumarioLines(book: Book): number {
  const entries = book.elements.filter((e) => ruleFor(e.kind, true).group !== 'pre').length;
  return entries * 1.4 + 4;
}

export function layoutElement(el: BookElement, book: Book, m: PageMetrics, d: DesignSpec): Omit<ElementLayout, 'startPage'> {
  const rule = ruleFor(el.kind, d.chaptersOnOdd);
  if (rule.fixedPages) {
    return { id: el.id, title: el.title, kind: el.kind, pages: rule.fixedPages, lines: 0, lastPageLines: 0 };
  }
  let lines = el.kind === 'sumario' ? sumarioLines(book) : 0;
  for (const b of el.blocks) lines += blockLines(b, m, d);
  const opening = analyzeOpening(el, m, d) ?? undefined;
  if (opening) lines += opening.extraLines;
  lines = Math.ceil(lines);

  const sink = el.kind === 'capitulo' ? d.chapterSink : d.chapterSink * 0.6;
  const firstCapacity = Math.max(1, Math.floor(m.linesPerPage * (1 - sink)));
  let pages: number;
  let lastPageLines: number;
  if (lines <= firstCapacity) {
    pages = 1;
    lastPageLines = lines;
  } else {
    const rest = lines - firstCapacity;
    pages = 1 + Math.ceil(rest / m.linesPerPage);
    lastPageLines = rest - (pages - 2) * m.linesPerPage;
  }
  return { id: el.id, title: el.title, kind: el.kind, pages, lines, lastPageLines, opening };
}

/**
 * Monta a sequência de páginas do livro aplicando as regras de abertura
 * (página ímpar) e de verso em branco. Cada branco carrega o motivo.
 */
export function layoutBook(book: Book, d: DesignSpec): Layout {
  const m = pageMetrics(d);
  const pages: Page[] = [];
  const elements: ElementLayout[] = [];

  const pushBlank = (reason: Page['blankReason']) =>
    pages.push({ number: pages.length + 1, elementId: null, kind: 'branco', blankReason: reason, fill: 0, isOpener: false, signatureIndex: 0 });

  for (const el of book.elements) {
    const rule = ruleFor(el.kind, d.chaptersOnOdd);
    const nextNumber = pages.length + 1;
    if (rule.opensOn === 'impar' && nextNumber % 2 === 0) pushBlank('abre_impar');

    const lay = layoutElement(el, book, m, d);
    const startPage = pages.length + 1;
    for (let i = 0; i < lay.pages; i++) {
      const isLast = i === lay.pages - 1;
      const fill = rule.fixedPages ? 1 : isLast ? Math.min(1, lay.lastPageLines / m.linesPerPage) : 1;
      pages.push({ number: pages.length + 1, elementId: el.id, kind: 'conteudo', fill, isOpener: i === 0, signatureIndex: 0 });
    }
    elements.push({ ...lay, startPage });

    if (rule.blankVerso && pages.length % 2 === 1) pushBlank('verso_branco');
  }

  const contentPages = pages.length;
  const blankPages = pages.filter((p) => p.kind === 'branco').length;
  return { pages, elements, metrics: m, contentPages, blankPages };
}

const half = (x: number) => Math.round(x * 2) / 2;

/** Troca o formato; com `scaleMargins`, as margens acompanham a proporção da página. */
export function withTrim(d: DesignSpec, widthMm: number, heightMm: number, scaleMargins: boolean): DesignSpec {
  if (!scaleMargins) return { ...d, trimWidthMm: widthMm, trimHeightMm: heightMm };
  const sx = widthMm / d.trimWidthMm;
  const sy = heightMm / d.trimHeightMm;
  return {
    ...d,
    trimWidthMm: widthMm,
    trimHeightMm: heightMm,
    marginInnerMm: half(d.marginInnerMm * sx),
    marginOuterMm: half(d.marginOuterMm * sx),
    marginTopMm: half(d.marginTopMm * sy),
    marginBottomMm: half(d.marginBottomMm * sy),
  };
}
