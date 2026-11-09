import { describe, expect, it } from 'vitest';
import {
  planSignatures,
  evenWorking,
  countText,
  roundLaudas,
  layoutBook,
  diagnose,
  defaultSettings,
  sampleBook,
  proposeVariants,
  explainPage,
  classifyBlocks,
  estimateCost,
  PRINTERS,
  impose,
  pageMetrics,
  DEFAULT_DESIGN,
  type Book,
} from '../src/index.ts';

describe('cadernos', () => {
  it('fecha exatamente com cadernos inteiros', () => {
    expect(planSignatures(224, [32, 16, 8])).toMatchObject({ sizes: [32, 32, 32, 32, 32, 32, 32], paddingPages: 0 });
  });
  it('73 páginas → 80 (2×32 + 16), nunca página avulsa', () => {
    const p = planSignatures(73, [32, 16, 8]);
    expect(p.totalPages).toBe(80);
    expect(p.paddingPages).toBe(7);
    expect(p.sizes).toEqual([32, 32, 16]);
  });
  it('66 páginas excedem 64: faltam páginas, não sobram', () => {
    const p = planSignatures(66, [32, 16, 8]);
    expect(p.totalPages).toBe(72);
    expect(p.sizes).toEqual([32, 32, 8]);
    const ew = evenWorking(66, [32, 16, 8]);
    expect(ew).toMatchObject({ pagesToCut: 2, lowerTotal: 64, pagesToFill: 6, upperTotal: 72 });
  });
  it('208 = 6×32 + 16 (muda de cadernos em relação a 224)', () => {
    expect(planSignatures(208, [32, 16, 8]).sizes).toEqual([32, 32, 32, 32, 32, 32, 16]);
  });
  it('respeita só os tamanhos aceitos pela gráfica', () => {
    const p = planSignatures(20, [16]);
    expect(p.sizes).toEqual([16, 16]);
    expect(p.paddingPages).toBe(12);
  });
});

describe('laudas', () => {
  const book: Book = {
    title: 't',
    source: 'texto',
    elements: [
      { id: 'a', kind: 'capitulo', title: 'A', confidence: 'alta', classifiedBy: 'regra', rationale: '', blocks: [{ type: 'paragrafo', text: 'x'.repeat(2100) }, { type: 'nota', text: 'n'.repeat(210) }] },
    ],
  };
  it('conta caracteres com espaços e mantém o valor bruto', () => {
    const s = countText(book, { charsPerLauda: 2100, includeNotes: true, rounding: 'nenhum' });
    expect(s.charsWithSpaces).toBe(2310);
    expect(s.laudasRaw).toBeCloseTo(1.1);
    expect(s.laudas).toBe(1.1);
  });
  it('pode excluir notas', () => {
    expect(countText(book, { charsPerLauda: 2100, includeNotes: false, rounding: 'nenhum' }).charsWithSpaces).toBe(2100);
  });
  it('arredonda conforme contrato', () => {
    expect(roundLaudas(270.11, 'cima')).toBe(271);
    expect(roundLaudas(270.11, 'meia')).toBe(270.5);
    expect(roundLaudas(270.11, 'nenhum')).toBe(270.11);
  });
});

describe('paginação', () => {
  it('mancha de 14×21 com margens padrão', () => {
    const m = pageMetrics(DEFAULT_DESIGN);
    expect(m.textWidthMm).toBe(99);
    expect(m.linesPerPage).toBeGreaterThan(30);
    expect(m.charsPerLine).toBeGreaterThan(50);
  });
  it('capítulo abre em ímpar com branco obrigatório e motivo', () => {
    const lay = layoutBook(sampleBook(), DEFAULT_DESIGN);
    for (const el of lay.elements.filter((e) => e.kind === 'capitulo')) expect(el.startPage % 2).toBe(1);
    const blanks = lay.pages.filter((p) => p.kind === 'branco');
    expect(blanks.every((b) => b.blankReason)).toBe(true);
  });
  it('sem a regra de ímpar, capítulos não geram brancos de abertura', () => {
    const lay = layoutBook(sampleBook(), { ...DEFAULT_DESIGN, chaptersOnOdd: false });
    const chapterStarts = new Set(lay.elements.filter((e) => e.kind === 'capitulo').map((e) => e.startPage));
    expect(lay.pages.some((p) => p.blankReason === 'abre_impar' && chapterStarts.has(p.number + 1))).toBe(false);
  });
  it('corpo menor nunca aumenta o número de páginas', () => {
    const big = layoutBook(sampleBook(), { ...DEFAULT_DESIGN, bodySizePt: 11.5 }).contentPages;
    const small = layoutBook(sampleBook(), { ...DEFAULT_DESIGN, bodySizePt: 10.5 }).contentPages;
    expect(small).toBeLessThanOrEqual(big);
  });
});

describe('diagnóstico', () => {
  it('produz cadernos, custo e lombada coerentes', () => {
    const s = defaultSettings();
    const d = diagnose(sampleBook(), s);
    expect(d.plan.totalPages % 8).toBe(0);
    expect(d.layout.pages.length).toBe(d.plan.totalPages);
    expect(d.cost.total).toBeGreaterThan(0);
    expect(d.cost.perCopy).toBeCloseTo(d.cost.total / s.run, 1);
    expect(d.spineMm).toBeCloseTo(d.plan.totalPages * s.printer.paper.mmPerPage, 1);
    expect(d.layout.pages.every((p) => p.signatureIndex < d.plan.sizes.length)).toBe(true);
  });
  it('explica páginas em branco', () => {
    const book = sampleBook();
    const d = diagnose(book, defaultSettings());
    const blank = d.layout.pages.find((p) => p.kind === 'branco')!;
    const ex = explainPage(book, d, blank.number);
    expect(ex.lines.join(' ')).toMatch(/Branco/);
  });
  it('offset: menos cadernos custa menos', () => {
    const p = PRINTERS[0];
    const imp = impose(140, 210, p.offset.sheets[0], p.offset)!;
    const a = estimateCost(planSignatures(224, imp.signatureSizes), p, 1000, imp);
    const b = estimateCost(planSignatures(192, imp.signatureSizes), p, 1000, imp);
    expect(b.total).toBeLessThan(a.total);
  });
});

describe('propostas', () => {
  it('A é a mais barata e respeita limites de legibilidade', () => {
    const v = proposeVariants(sampleBook(), defaultSettings());
    expect(v.map((x) => x.id)).toEqual(['A', 'B', 'C']);
    expect(v[0].diagnosis.cost.total).toBeLessThanOrEqual(v[1].diagnosis.cost.total);
    for (const x of v) {
      expect(x.design.bodySizePt).toBeGreaterThanOrEqual(10);
      expect(x.design.leadingPt / x.design.bodySizePt).toBeGreaterThanOrEqual(1.18);
    }
    expect(v[2].design.bodySizePt).toBeGreaterThanOrEqual(defaultSettings().design.bodySizePt);
  });
});

describe('classificação por regras', () => {
  it('segmenta por títulos e reconhece elementos editoriais', () => {
    const book = classifyBlocks([
      { tag: 'p', text: 'Para minha mãe.' },
      { tag: 'h1', text: 'Prefácio' },
      { tag: 'p', text: 'Texto do prefácio.' },
      { tag: 'h1', text: 'Capítulo 1 — O início' },
      { tag: 'p', text: 'Era uma vez.' },
      { tag: 'p', text: 'III', bold: true },
      { tag: 'p', text: 'Outro capítulo.' },
      { tag: 'h1', text: 'Referências' },
      { tag: 'li', text: 'AUTOR. Obra. 2020.' },
    ]);
    expect(book.elements.map((e) => e.kind)).toEqual(['dedicatoria', 'prefacio', 'capitulo', 'capitulo', 'referencias']);
    expect(book.elements[2].confidence).toBe('alta');
  });
  it('promove H2 quando não há H1', () => {
    const book = classifyBlocks([
      { tag: 'h2', text: 'Um título qualquer' },
      { tag: 'p', text: 'abc' },
    ]);
    expect(book.elements[0]).toMatchObject({ kind: 'capitulo', confidence: 'media' });
  });
  it('não confunde palavra comum com numeral romano', () => {
    const book = classifyBlocks([{ tag: 'p', text: 'Civil', bold: false }, { tag: 'h1', text: 'X' }]);
    expect(book.elements[0].kind).not.toBe('capitulo');
  });
});
