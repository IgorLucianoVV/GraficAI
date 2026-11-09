import { describe, expect, it } from 'vitest';
import {
  analyzeOpening,
  chapterNumeral,
  chapterEpigraphIndex,
  defaultSettings,
  diagnose,
  explainPage,
  openingPreset,
  pageMetrics,
  sampleBook,
  splitOpening,
  type BookElement,
  type DesignSpec,
} from '../src/index.ts';

const chapter = (text: string, extra: string[] = []): BookElement => ({
  id: 'c1',
  kind: 'capitulo',
  title: 'Capítulo 1',
  blocks: [{ type: 'paragrafo', text }, ...extra.map((t) => ({ type: 'paragrafo' as const, text: t }))],
  confidence: 'alta',
  classifiedBy: 'regra',
  rationale: '',
});

const design = (preset: 'classica' | 'moderna' | 'sobria'): DesignSpec => ({ ...defaultSettings().design, chapterOpening: openingPreset(preset) });
const LONG = 'Era uma vez um livro que precisava de cadernos fechados e de uma abertura digna. '.repeat(8);

describe('abertura de capítulo', () => {
  it('separa capitular, pontuação pendurada e versalete', () => {
    const o = openingPreset('classica');
    expect(splitOpening('Era uma vez um reino', o)).toMatchObject({ cap: 'E', hanging: '', leadIn: 'ra uma vez' });
    expect(splitOpening('— Venha cá, disse ela', o)).toMatchObject({ cap: 'V', hanging: '— ' });
    expect(splitOpening('“Nunca mais”, pensou', o)).toMatchObject({ cap: 'N', hanging: '“' });
    // Palavra de uma letra: a seguinte entra inteira no versalete.
    expect(splitOpening('A cidade dormia cedo', o).leadIn.startsWith('cidade')).toBe(true);
    expect(splitOpening('é tarde', o).cap).toBe('É');
  });

  it('respeita regras de algarismo e diálogo', () => {
    const o = openingPreset('classica');
    expect(splitOpening('1922 foi um ano', o)).toMatchObject({ cap: null, skipped: 'numero' });
    expect(splitOpening('1922 foi um ano', { ...o, capOnDigits: true }).cap).toBe('1');
    expect(splitOpening('— Venha', { ...o, dialogue: 'sem_capitular' })).toMatchObject({ cap: null, skipped: 'dialogo' });
  });

  it('capitular rebaixada consome linhas; sóbria não muda nada', () => {
    const el = chapter(LONG);
    const dC = design('classica');
    const dS = design('sobria');
    const classic = analyzeOpening(el, pageMetrics(dC), dC)!;
    const sober = analyzeOpening(el, pageMetrics(dS), dS)!;
    expect(sober.extraLines).toBe(0);
    expect(classic.extraLines).toBeGreaterThanOrEqual(0);
    expect(classic.extraLines).toBeLessThanOrEqual(3);
    // Por parágrafo o efeito é 0 ou 1 linha (depende de onde cai a última linha);
    // somado sobre vários tamanhos, a perda média fica perto de meia linha.
    let total = 0;
    let n = 0;
    for (let len = 300; len < 1500; len += 7, n++) {
      total += analyzeOpening(chapter(LONG.repeat(3).slice(0, len)), pageMetrics(dC), dC)!.extraLines;
    }
    expect(total / n).toBeGreaterThan(0.2);
    expect(total / n).toBeLessThan(1.2);
  });

  it('capitular maior ocupa mais', () => {
    const el = chapter(LONG);
    const base = design('classica');
    const at = (lines: number) => {
      const d = { ...base, chapterOpening: { ...base.chapterOpening, dropCap: { ...base.chapterOpening.dropCap, lines } } };
      return analyzeOpening(el, pageMetrics(d), d)!.extraLines;
    };
    expect(at(4)).toBeGreaterThanOrEqual(at(2));
  });

  it('parágrafo curto: força a altura da capitular e gera aviso', () => {
    const d = design('classica');
    const r = analyzeOpening(chapter('Sim.', [LONG]), pageMetrics(d), d)!;
    expect(r.shortParagraph).toBe(true);
    expect(r.extraLines).toBe(2); // 1 linha vira 3
  });

  it('elevada e ornamento somam altura', () => {
    const base = design('sobria');
    const d: DesignSpec = { ...base, chapterOpening: { ...base.chapterOpening, dropCap: { mode: 'elevada', lines: 3, gapMm: 1 }, ornament: 'vinheta' } };
    expect(analyzeOpening(chapter(LONG), pageMetrics(d), d)!.extraLines).toBeGreaterThanOrEqual(2 + 2);
  });

  it('só se aplica aos tipos escolhidos', () => {
    const d = design('classica');
    expect(analyzeOpening({ ...chapter(LONG), kind: 'prefacio' }, pageMetrics(d), d)).toBeNull();
    const d2 = { ...d, chapterOpening: { ...d.chapterOpening, appliesTo: ['capitulo', 'prefacio'] as DesignSpec['chapterOpening']['appliesTo'] } };
    expect(analyzeOpening({ ...chapter(LONG), kind: 'prefacio' }, pageMetrics(d2), d2)).not.toBeNull();
  });

  it('entra no diagnóstico sem quebrar a consistência', () => {
    const book = sampleBook();
    const s = defaultSettings();
    const classic = diagnose(book, { ...s, design: design('classica') });
    const sober = diagnose(book, { ...s, design: design('sobria') });
    const sum = (d: typeof classic) => d.layout.elements.reduce((a, e) => a + e.lines, 0);
    expect(sum(classic)).toBeGreaterThan(sum(sober));
    expect(classic.layout.elements.filter((e) => e.kind === 'capitulo').every((e) => e.opening)).toBe(true);
    const first = classic.layout.elements.find((e) => e.kind === 'capitulo')!;
    expect(explainPage(book, classic, first.startPage).lines.some((l) => l.startsWith('Abertura: capitular'))).toBe(true);
  });

  it('abertura vai no primeiro bloco de texto; epígrafe curta é pulada', () => {
    const d = design('classica');
    const m = pageMetrics(d);
    const withQuote = (q: string): BookElement => ({ ...chapter(LONG), blocks: [{ type: 'citacao', text: q }, { type: 'paragrafo', text: LONG }] });
    // Citação longa abre o capítulo: a capitular vai nela.
    const long = analyzeOpening(withQuote('Começa uma citação longa. '.repeat(20)), m, d)!;
    expect(long.blockIndex).toBe(0);
    expect(long.cap).toBe('C');
    // Citação curta é epígrafe: a capitular vai no parágrafo seguinte.
    const short = withQuote('Todo rio guarda a memória do caminho.');
    expect(chapterEpigraphIndex(short)).toBe(0);
    expect(analyzeOpening(short, m, d)!.blockIndex).toBe(1);
  });

  it('numerais', () => {
    expect(chapterNumeral(14, 'romano')).toBe('XIV');
    expect(chapterNumeral(3, 'extenso')).toBe('Três');
    expect(chapterNumeral(7, 'arabico')).toBe('7');
    expect(chapterNumeral(7, 'nenhum')).toBe('');
  });
});
