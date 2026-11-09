import type { Block, BlockType, Book, BookElement, Confidence, ElementKind, Run } from './types.ts';
import { attachNotes, compactRuns } from './inline.ts';

/** Bloco bruto vindo do conversor de DOCX (mammoth → HTML). */
export interface RawBlock {
  tag: 'h1' | 'h2' | 'h3' | 'p' | 'blockquote' | 'li' | 'table' | 'img' | 'note';
  text: string;
  bold?: boolean;
  runs?: Run[];
  noteId?: string;
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const KEYWORDS: [RegExp, ElementKind][] = [
  [/^dedicatoria$/, 'dedicatoria'],
  [/^agradecimentos?$/, 'agradecimentos'],
  [/^epigrafe$/, 'epigrafe'],
  [/^(sumario|indice geral|conteudo)$/, 'sumario'],
  [/^prefacio\b/, 'prefacio'],
  [/^(apresentacao|nota (do autor|da editora|previa))\b/, 'apresentacao'],
  [/^introducao\b/, 'introducao'],
  [/^(conclusao|consideracoes finais|epilogo)\b/, 'conclusao'],
  [/^posfacio\b/, 'posfacio'],
  [/^(referencias|referencias bibliograficas|bibliografia|notas)$/, 'referencias'],
  [/^glossario$/, 'glossario'],
  [/^(anexo|apendice)\b/, 'anexo'],
  [/^(indice|indice remissivo|indice onomastico)$/, 'indice'],
  [/^sobre (o|a) autor(a)?$|^(o|a) autor(a)?$/, 'sobre_autor'],
  [/^colofao$/, 'colofao'],
];

const CHAPTER = /^(capitulo|cap|parte|livro)\b|^\d{1,3}(\s|$)/;
// Numerais romanos só em maiúsculas no texto original ("III — O porto"), para não confundir com palavras.
const ROMAN = /^[IVXLC]{1,6}(\s|\.|$)/;

export function kindFromTitle(title: string): { kind: ElementKind; matched: 'palavra' | 'capitulo' | null } {
  const n = norm(title);
  for (const [re, kind] of KEYWORDS) if (re.test(n)) return { kind, matched: 'palavra' };
  if (CHAPTER.test(n) || ROMAN.test(title.trim())) return { kind: 'capitulo', matched: 'capitulo' };
  return { kind: 'capitulo', matched: null };
}

const BLOCK_TYPE: Record<RawBlock['tag'], BlockType> = {
  h1: 'titulo',
  h2: 'subtitulo',
  h3: 'subtitulo',
  p: 'paragrafo',
  blockquote: 'citacao',
  li: 'lista',
  table: 'tabela',
  img: 'imagem',
  note: 'nota',
};

/** Parágrafo curto e isolado, todo em negrito ou com palavra-chave: candidato a título. */
function looksLikeHeading(b: RawBlock): boolean {
  if (b.tag === 'h1') return true;
  const t = b.text.trim();
  if (!t || t.length > 70 || /[.;:]$/.test(t)) return false;
  if (b.tag === 'p' && kindFromTitle(t).matched === 'palavra') return true;
  if (b.tag === 'p' && kindFromTitle(t).matched === 'capitulo' && t.split(' ').length <= 8) return true;
  return b.tag === 'p' && !!b.bold && t.split(' ').length <= 8;
}

let seq = 0;
const newId = () => `el-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/**
 * Segmenta o manuscrito em elementos por regras. Cada elemento traz a confiança
 * e o motivo — a tela de revisão começa pelos de baixa confiança.
 */
export function classifyBlocks(raw: RawBlock[], title = 'Livro sem título'): Book {
  // Se o documento não usa H1 mas usa H2 como título de capítulo, promove H2.
  const hasH1 = raw.some((b) => b.tag === 'h1');
  const blocks = hasH1 ? raw : raw.map((b) => (b.tag === 'h2' ? { ...b, tag: 'h1' as const } : b));

  const elements: BookElement[] = [];
  let current: BookElement | null = null;
  const preface: RawBlock[] = [];

  for (const b of blocks) {
    if (!b.text.trim() && b.tag !== 'img') continue;
    if (looksLikeHeading(b)) {
      const t = b.text.trim();
      const { kind, matched } = kindFromTitle(t);
      let confidence: Confidence;
      let rationale: string;
      if (matched === 'palavra') {
        confidence = b.tag === 'h1' ? 'alta' : 'media';
        rationale = `título “${t}” corresponde a um elemento editorial conhecido${b.tag === 'h1' ? ' e usa estilo de título' : ''}.`;
      } else if (matched === 'capitulo') {
        confidence = 'alta';
        rationale = `título “${t}” segue o padrão de capítulo (número ou “Capítulo”).`;
      } else {
        confidence = b.tag === 'h1' ? 'media' : 'baixa';
        rationale = b.tag === 'h1' ? 'título com estilo Título 1 sem palavra-chave; assumido como capítulo.' : 'parágrafo curto em negrito; pode ser título de capítulo ou destaque.';
      }
      current = { id: newId(), kind, title: t, blocks: [], confidence, classifiedBy: 'regra', rationale };
      elements.push(current);
      continue;
    }
    const block = toBlock(b);
    if (current) current.blocks.push(block);
    else preface.push(b);
  }

  // Texto antes do primeiro título: dedicatória, epígrafe ou apresentação sem título.
  if (preface.length) {
    const text = preface.map((b) => b.text.trim()).join(' ');
    let kind: ElementKind = 'apresentacao';
    let confidence: Confidence = 'baixa';
    let rationale = 'texto antes do primeiro título, sem pistas claras.';
    if (text.length < 300 && /^(para|a meu|a minha|aos|as|ao|à|em memoria)/i.test(norm(text))) {
      kind = 'dedicatoria';
      confidence = 'media';
      rationale = 'texto curto antes do primeiro título começando com “Para…/A meu…”.';
    } else if (text.length < 400 && /(—|–|-)\s*[A-ZÁÉÍÓÚ][^\n]{2,60}$/.test(text)) {
      kind = 'epigrafe';
      confidence = 'media';
      rationale = 'citação curta com atribuição de autor antes do primeiro título.';
    }
    elements.unshift({
      id: newId(),
      kind,
      title: kind === 'dedicatoria' ? 'Dedicatória' : kind === 'epigrafe' ? 'Epígrafe' : 'Texto inicial',
      blocks: preface.map(toBlock),
      confidence,
      classifiedBy: 'regra',
      rationale,
    });
  }

  return { title, elements: attachNotes(elements), source: 'docx' };
}

function toBlock(b: RawBlock): Block {
  const block: Block = { type: BLOCK_TYPE[b.tag], text: b.text.trim() };
  const runs = b.runs && compactRuns(b.runs);
  if (runs) block.runs = runs;
  if (b.noteId) block.noteId = b.noteId;
  return block;
}

/** Adiciona falsa folha de rosto, folha de rosto e ficha quando faltarem. */
export function ensureFrontMatter(book: Book): Book {
  const has = (k: ElementKind) => book.elements.some((e) => e.kind === k);
  const add: BookElement[] = [];
  const mk = (kind: ElementKind, title: string): BookElement => ({
    id: newId(),
    kind,
    title,
    blocks: [],
    confidence: 'alta',
    classifiedBy: 'regra',
    rationale: 'elemento pré-textual padrão adicionado pelo sistema (NBR 6029).',
  });
  if (!has('falsa_folha_rosto')) add.push(mk('falsa_folha_rosto', book.title));
  if (!has('folha_rosto')) add.push(mk('folha_rosto', book.title));
  if (!has('ficha')) add.push(mk('ficha', 'Ficha catalográfica'));
  return add.length ? { ...book, elements: [...add, ...book.elements] } : book;
}

/** Ordena elementos na sequência canônica pré → texto → pós, preservando a ordem interna. */
export function canonicalOrder(book: Book, groupOf: (k: ElementKind) => 'pre' | 'texto' | 'pos'): Book {
  const rank = { pre: 0, texto: 1, pos: 2 } as const;
  const elements = book.elements
    .map((e, i) => ({ e, i }))
    .sort((a, b) => rank[groupOf(a.e.kind)] - rank[groupOf(b.e.kind)] || a.i - b.i)
    .map((x) => x.e);
  return { ...book, elements };
}
