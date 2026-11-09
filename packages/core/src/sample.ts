import type { Block, Book, BookElement, ElementKind } from './types.ts';

// Gerador determinístico de um livro de exemplo (texto fictício, sem direitos de terceiros).
const WORDS = (
  'o rio a cidade porto papel tinta casa noite luz vento mar barco cais memória tempo voz janela rua praça ' +
  'caderno página letra mão carta caminho silêncio madrugada chuva sol sombra pedra ponte mapa viagem ' +
  'de da do em com para entre sobre sem pelo pela quando onde como ainda sempre nunca já depois antes ' +
  'era foi ficou disse viu sabia queria olhava lembrava escrevia seguia voltava chegou partiu abriu ' +
  'longo breve antigo novo claro escuro leve pesado lento largo estreito calmo inquieto'
).split(' ');

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function sentence(r: () => number): string {
  const n = 8 + Math.floor(r() * 14);
  const w: string[] = [];
  for (let i = 0; i < n; i++) w.push(WORDS[Math.floor(r() * WORDS.length)]);
  const s = w.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1) + (r() < 0.15 ? '?' : '.');
}

function paragraph(r: () => number): string {
  const n = 3 + Math.floor(r() * 6);
  return Array.from({ length: n }, () => sentence(r)).join(' ');
}

const el = (id: string, kind: ElementKind, title: string, blocks: Block[]): BookElement => ({
  id,
  kind,
  title,
  blocks,
  confidence: 'alta',
  classifiedBy: 'regra',
  rationale: 'livro de exemplo gerado pelo sistema.',
});

export function sampleBook(): Book {
  const r = rng(42);
  const chapterTitles = ['O cais', 'A primeira carta', 'Mapa de chuva', 'O porto', 'Tinta e sal', 'A ponte', 'Madrugada', 'O caderno azul', 'Ventos do sul', 'A volta', 'Página em branco', 'O rio'];
  // Tamanhos em parágrafos, variados para gerar finais de capítulo diferentes.
  const sizes = [38, 52, 31, 60, 44, 27, 49, 55, 36, 42, 23, 47];

  const chapters = chapterTitles.map((t, i) => {
    const blocks: Block[] = [];
    for (let p = 0; p < sizes[i]; p++) {
      if (p > 0 && p % 18 === 0) blocks.push({ type: 'subtitulo', text: `Parte ${p / 18 + 1}` });
      blocks.push({ type: r() < 0.06 ? 'citacao' : 'paragrafo', text: paragraph(r) });
    }
    return el(`cap-${i + 1}`, 'capitulo', `${i + 1}. ${t}`, blocks);
  });

  return {
    title: 'Rios de Papel',
    source: 'exemplo',
    elements: [
      el('falsa', 'falsa_folha_rosto', 'Rios de Papel', []),
      el('rosto', 'folha_rosto', 'Rios de Papel', []),
      el('ficha', 'ficha', 'Ficha catalográfica', []),
      el('ded', 'dedicatoria', 'Dedicatória', [{ type: 'paragrafo', text: 'Para quem ainda escreve cartas.' }]),
      el('epi', 'epigrafe', 'Epígrafe', [{ type: 'citacao', text: 'Todo rio guarda a memória do caminho. — Autor fictício' }]),
      el('sum', 'sumario', 'Sumário', []),
      el('pref', 'prefacio', 'Prefácio', Array.from({ length: 9 }, () => ({ type: 'paragrafo' as const, text: paragraph(r) }))),
      ...chapters,
      el('ref', 'referencias', 'Referências', Array.from({ length: 22 }, () => ({ type: 'lista' as const, text: sentence(r) }))),
      el('autor', 'sobre_autor', 'Sobre o autor', [{ type: 'paragrafo', text: paragraph(r) }]),
    ],
  };
}
