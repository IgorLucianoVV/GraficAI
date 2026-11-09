import type { Book, LaudaConfig, TextStats } from './types.ts';

export const LAUDA_PRESETS: { label: string; chars: number; note: string }[] = [
  { label: '1.250', chars: 1250, note: 'Tradução e revisão (Sintra)' },
  { label: '1.400', chars: 1400, note: 'Sindicato dos Jornalistas de SP' },
  { label: '1.800', chars: 1800, note: 'Comum no mercado editorial' },
  { label: '2.100', chars: 2100, note: 'Lauda literária' },
];

function countWords(text: string): number {
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}

export function roundLaudas(raw: number, rounding: LaudaConfig['rounding']): number {
  if (rounding === 'cima') return Math.ceil(raw - 1e-9);
  if (rounding === 'meia') return Math.ceil(raw * 2 - 1e-9) / 2;
  return Math.round(raw * 100) / 100;
}

/**
 * Conta caracteres com espaços por elemento. Mantém o valor bruto (com decimais)
 * e o arredondado pela regra do contrato — evita ambiguidade na cobrança.
 */
export function countText(book: Book, config: LaudaConfig): TextStats {
  let words = 0;
  let withSpaces = 0;
  let withoutSpaces = 0;
  let paragraphs = 0;
  const byElement: TextStats['byElement'] = [];

  for (const el of book.elements) {
    let elChars = 0;
    for (const b of el.blocks) {
      if (b.type === 'nota' && !config.includeNotes) continue;
      if (b.type === 'imagem') continue;
      const t = b.text;
      const len = [...t].length;
      elChars += len;
      withSpaces += len;
      withoutSpaces += [...t.replace(/\s/g, '')].length;
      words += countWords(t);
      if (b.type === 'paragrafo' || b.type === 'citacao' || b.type === 'lista') paragraphs += 1;
    }
    byElement.push({
      id: el.id,
      title: el.title,
      charsWithSpaces: elChars,
      laudas: Math.round((elChars / config.charsPerLauda) * 100) / 100,
    });
  }

  const laudasRaw = withSpaces / config.charsPerLauda;
  return {
    words,
    charsWithSpaces: withSpaces,
    charsWithoutSpaces: withoutSpaces,
    paragraphs,
    laudasRaw,
    laudas: roundLaudas(laudasRaw, config.rounding),
    byElement,
  };
}
