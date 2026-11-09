import type { Block, Book, BookElement, ElementKind, Run } from './types.ts';
import { normalizeRuns } from './inline.ts';

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

/**
 * Acrescenta itálico (um termo por parágrafo, às vezes) e chamadas de nota,
 * com gerador próprio para não alterar o texto do exemplo.
 */
function decorate(b: Block, r: () => number, note: string | null): Block[] {
  if (b.type !== 'paragrafo') return [b];
  const words = b.text.split(' ');
  const runs: Run[] = [];
  if (r() < 0.35 && words.length > 6) {
    const i = 2 + Math.floor(r() * (words.length - 4));
    runs.push({ text: words.slice(0, i).join(' ') + ' ' }, { text: words[i].replace(/[.?]$/, ''), italic: true }, { text: words[i].match(/[.?]$/)?.[0] ?? '' }, { text: ' ' + words.slice(i + 1).join(' ') });
  } else runs.push({ text: b.text });
  if (!note) {
    const n = normalizeRuns(runs);
    return [n.length > 1 ? { ...b, runs: n } : b];
  }
  // Chamada de nota no fim da primeira frase.
  const out: Run[] = [];
  let done = false;
  for (const run of runs) {
    const at = done || run.italic ? -1 : run.text.search(/[.?]( |$)/);
    if (at < 0) out.push(run);
    else {
      out.push({ ...run, text: run.text.slice(0, at + 1) }, { text: '', noteRef: note }, { ...run, text: run.text.slice(at + 1) });
      done = true;
    }
  }
  const n = normalizeRuns(out);
  return [{ ...b, runs: n }, { type: 'nota', noteId: note, text: `Nota do exemplo: ${b.text.split(' ').slice(0, 9).join(' ').replace(/[.?]$/, '')}.` }];
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
    const deco = rng(7 + i);
    let paras = 0;
    const styled = blocks.flatMap((b) => decorate(b, deco, b.type === 'paragrafo' && ++paras % 9 === 0 ? `n${i + 1}-${paras / 9}` : null));
    return el(`cap-${i + 1}`, 'capitulo', `${i + 1}. ${t}`, styled);
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
