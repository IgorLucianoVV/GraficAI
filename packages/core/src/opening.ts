import type { BookElement, ChapterOpening, DesignSpec, ElementKind, OpeningPreset, OpeningResult, PageMetrics } from './types.ts';

const PT_TO_MM = 0.352778;
/** Altura das maiúsculas em relação ao corpo (serifadas de livro ficam entre 0,65 e 0,70). */
const CAP_HEIGHT_EM = 0.68;
/** Versalete ocupa ~15% mais largura que a caixa-baixa equivalente. */
const SMALLCAPS_WIDEN = 1.15;
const ORNAMENT_LINES: Record<ChapterOpening['ornament'], number> = { nenhum: 0, fio: 1, vinheta: 2 };

/**
 * Largura aproximada de maiúsculas serifadas, em em. Na F2 vem da métrica
 * real da fonte; aqui basta para o castoff.
 */
const CAP_WIDTH_EM: Record<string, number> = {
  I: 0.33, J: 0.38, F: 0.56, L: 0.58, E: 0.6, P: 0.58, S: 0.55, T: 0.62, Z: 0.62, B: 0.64,
  R: 0.68, K: 0.7, A: 0.72, V: 0.72, Y: 0.7, X: 0.72, H: 0.76, N: 0.76, U: 0.74,
  C: 0.7, G: 0.76, D: 0.76, O: 0.78, Q: 0.78, M: 0.9, W: 0.98,
};
const DEFAULT_CAP_EM = 0.7;

export const OPENING_PRESETS: Record<Exclude<OpeningPreset, 'personalizada'>, ChapterOpening> = {
  classica: {
    preset: 'classica',
    dropCap: { mode: 'rebaixada', lines: 3, gapMm: 1.5 },
    leadIn: { style: 'versalete', scope: 'palavras', words: 3 },
    ornament: 'nenhum',
    number: 'romano',
    dialogue: 'pendurar',
    capOnDigits: false,
    appliesTo: ['capitulo'],
  },
  moderna: {
    preset: 'moderna',
    dropCap: { mode: 'nenhuma', lines: 3, gapMm: 1.5 },
    leadIn: { style: 'versalete', scope: 'linha', words: 3 },
    ornament: 'nenhum',
    number: 'arabico',
    dialogue: 'pendurar',
    capOnDigits: false,
    appliesTo: ['capitulo'],
  },
  sobria: {
    preset: 'sobria',
    dropCap: { mode: 'nenhuma', lines: 3, gapMm: 1.5 },
    leadIn: { style: 'normal', scope: 'linha', words: 3 },
    ornament: 'nenhum',
    number: 'nenhum',
    dialogue: 'pendurar',
    capOnDigits: false,
    appliesTo: ['capitulo'],
  },
};

export const PRESET_LABELS: Record<OpeningPreset, string> = {
  classica: 'Clássica',
  moderna: 'Moderna',
  sobria: 'Sóbria',
  personalizada: 'Personalizada',
};

/** Elementos textuais que podem receber o tratamento além de capítulo. */
export const OPENING_EXTRA_KINDS: ElementKind[] = ['prefacio', 'apresentacao', 'introducao', 'conclusao', 'posfacio'];

export function openingPreset(p: Exclude<OpeningPreset, 'personalizada'>): ChapterOpening {
  return JSON.parse(JSON.stringify(OPENING_PRESETS[p]));
}

export function capWidthEm(letter: string): number {
  const base = letter.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  return CAP_WIDTH_EM[base] ?? DEFAULT_CAP_EM;
}

/** Corpo (pt) de uma capitular que ocupa `lines` linhas: topo na altura das maiúsculas da 1ª linha, base na linha n. */
export function dropCapSizePt(d: DesignSpec, lines: number): number {
  return ((lines - 1) * d.leadingPt + CAP_HEIGHT_EM * d.bodySizePt) / CAP_HEIGHT_EM;
}

/** Citação curta no início do capítulo é epígrafe; acima disso é texto e recebe a abertura. */
export const EPIGRAPH_MAX_CHARS = 300;

/** Índice do bloco de epígrafe do capítulo (citação curta antes do texto), ou -1. */
export function chapterEpigraphIndex(el: BookElement): number {
  const i = el.blocks.findIndex((b) => b.type !== 'nota');
  const b = el.blocks[i];
  return b && b.type === 'citacao' && b.text.trim().length <= EPIGRAPH_MAX_CHARS && el.blocks.some((x, j) => j > i && x.type === 'paragrafo') ? i : -1;
}

/**
 * Bloco que abre o capítulo: o primeiro bloco de texto (parágrafo ou citação
 * longa), pulando uma epígrafe curta.
 */
export function openingBlockIndex(el: BookElement): number {
  const epi = chapterEpigraphIndex(el);
  return el.blocks.findIndex((b, j) => j !== epi && (b.type === 'paragrafo' || b.type === 'citacao'));
}

const HANGING = /^[—–\-"“”«'‘’(]+\s*/;

/** Separa pontuação pendurada, capitular e versalete do início de um parágrafo. */
export function splitOpening(text: string, o: ChapterOpening): Pick<OpeningResult, 'cap' | 'hanging' | 'leadIn' | 'skipped'> & { rest: string; spaceAfterCap: boolean } {
  const s = text.trimStart();
  const hanging = s.match(HANGING)?.[0] ?? '';
  const body = s.slice(hanging.length);
  const wantsCap = o.dropCap.mode !== 'nenhuma';

  let skipped: OpeningResult['skipped'];
  if (wantsCap && hanging && o.dialogue === 'sem_capitular') skipped = 'dialogo';
  else if (wantsCap && /^\d/.test(body) && !o.capOnDigits) skipped = 'numero';

  const cap = wantsCap && !skipped && body ? body[0] : null;
  const afterCap = cap ? body.slice(1) : body;

  let leadIn = '';
  if (o.leadIn.style === 'versalete' && o.leadIn.scope === 'palavras') {
    // Conta a partir do que sobra depois da capitular. Se a 1ª palavra era de
    // uma letra só ("A", "É"), a seguinte entra inteira no versalete.
    const words = afterCap.trimStart().split(/\s+/).filter(Boolean);
    leadIn = words.slice(0, Math.max(1, o.leadIn.words)).join(' ');
  }
  const rest = afterCap.trimStart().slice(leadIn.length);
  return { cap: cap ? cap.toUpperCase() : null, hanging, leadIn, skipped, rest, spaceAfterCap: cap !== null && /^\s/.test(afterCap) };
}

/** Linhas consumidas por `len` caracteres dadas as capacidades das primeiras linhas. */
function consume(len: number, firstCaps: number[], cpl: number): number {
  let remaining = len;
  let lines = 0;
  for (const c of firstCaps) {
    if (remaining <= 0) break;
    remaining -= Math.max(1, c);
    lines++;
  }
  if (remaining > 0) lines += Math.ceil(remaining / cpl);
  return Math.max(1, lines);
}

/**
 * Efeito da abertura no castoff de um elemento. Retorna null se o elemento
 * não recebe o tratamento.
 */
export function analyzeOpening(el: BookElement, m: PageMetrics, d: DesignSpec): OpeningResult | null {
  const o = d.chapterOpening;
  if (!o || !o.appliesTo.includes(el.kind)) return null;

  const ornament = ORNAMENT_LINES[o.ornament];
  const blockIndex = openingBlockIndex(el);
  if (blockIndex < 0) {
    return { cap: null, hanging: '', leadIn: '', extraLines: ornament, blockIndex: -1, skipped: o.dropCap.mode !== 'nenhuma' ? 'sem_paragrafo' : undefined, shortParagraph: false };
  }

  const text = el.blocks[blockIndex].text;
  const split = splitOpening(text, o);
  const cpl = m.charsPerLine;
  const len = text.trim().length;
  const plain = Math.max(1, Math.ceil(len / cpl));
  const charWidthMm = d.bodySizePt * PT_TO_MM * d.avgCharWidthEm;

  const n = Math.max(2, Math.min(4, Math.round(o.dropCap.lines)));
  const capLines = split.cap ? (o.dropCap.mode === 'rebaixada' ? n : 1) : 0;
  const caps: number[] = Array.from({ length: Math.max(1, capLines) }, () => cpl);

  if (split.cap) {
    const widthMm = dropCapSizePt(d, n) * PT_TO_MM * capWidthEm(split.cap) + o.dropCap.gapMm;
    const lost = Math.ceil(widthMm / charWidthMm);
    for (let i = 0; i < capLines; i++) caps[i] = cpl - lost;
  }
  if (o.leadIn.style === 'versalete') {
    if (o.leadIn.scope === 'linha') caps[0] = Math.floor(caps[0] / SMALLCAPS_WIDEN);
    else caps[0] -= Math.ceil(split.leadIn.length * (SMALLCAPS_WIDEN - 1));
  }

  const used = consume(len - (split.cap ? 1 : 0), caps, cpl);
  const withOpening = o.dropCap.mode === 'rebaixada' && split.cap ? Math.max(n, used) : used;
  const raised = o.dropCap.mode === 'elevada' && split.cap ? n - 1 : 0;

  const { rest: _rest, spaceAfterCap: _sp, ...info } = split;
  return {
    ...info,
    extraLines: withOpening - plain + raised + ornament,
    blockIndex,
    shortParagraph: o.dropCap.mode === 'rebaixada' && !!split.cap && used < n,
  };
}

const ROMAN: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
const EXTENSO = ['', 'Um', 'Dois', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito', 'Nove', 'Dez', 'Onze', 'Doze', 'Treze', 'Catorze', 'Quinze', 'Dezesseis', 'Dezessete', 'Dezoito', 'Dezenove', 'Vinte'];

/** Numeral do capítulo conforme o estilo escolhido. */
export function chapterNumeral(n: number, style: ChapterOpening['number']): string {
  if (style === 'nenhum') return '';
  if (style === 'arabico') return String(n);
  if (style === 'extenso' && n < EXTENSO.length) return EXTENSO[n];
  let x = n;
  let out = '';
  for (const [v, s] of ROMAN) while (x >= v) { out += s; x -= v; }
  return out;
}
