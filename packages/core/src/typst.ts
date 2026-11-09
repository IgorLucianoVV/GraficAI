import type { Block, Book, BookElement, ProjectSettings, Run } from './types.ts';
import { ruleFor } from './rules.ts';
import { analyzeOpening, chapterEpigraphIndex, chapterNumeral, describeLeadQuote, leadQuote } from './opening.ts';
import { pageMetrics } from './layout.ts';
import { blockRuns } from './inline.ts';

/**
 * Gerador Typst: livro + projeto gráfico → fonte .typ. É texto puro e
 * determinístico; a compilação fica na API. Princípio: o arquivo é legível e
 * editável por um designer (funções nomeadas no prelúdio, conteúdo abaixo).
 */
export interface TypesetOptions {
  /** 'nenhuma' = formato final; 'sangria' = página com sangria; 'marcas' = sangria + marcas de corte. */
  trimMarks: 'nenhuma' | 'sangria' | 'marcas';
  /** Páginas em branco no fim para fechar o último caderno. */
  padPages: number;
  font: string;
}

export const DEFAULT_TYPESET: TypesetOptions = { trimMarks: 'nenhuma', padPages: 0, font: 'EB Garamond' };

const NOT_OUTLINED = new Set(['falsa_folha_rosto', 'folha_rosto', 'ficha', 'dedicatoria', 'epigrafe', 'sumario']);

/** Escapa texto para o modo de marcação do Typst. Aspas ficam livres (aspas tipográficas automáticas). */
export function escapeTypst(s: string): string {
  return s.replace(/[\\#$*_`<>@[\]~/=+-]/g, (c) => `\\${c}`).replace(/^(\d+)\./, '$1\\.');
}

const str = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const n = (x: number) => String(Math.round(x * 1000) / 1000);

function wrap(text: string, r: Run): string {
  let out = text;
  if (r.smallcaps) out = `#smallcaps[${out}]`;
  if (r.sub) out = `#sub[${out}]`;
  if (r.sup) out = `#super[${out}]`;
  if (r.bold) out = `#strong[${out}]`;
  if (r.italic) out = `#emph[${out}]`;
  return out;
}

type NoteMap = Map<string, Block>;

function noteMarkup(id: string, notes: NoteMap, used: Set<string>): string {
  const note = notes.get(id);
  if (!note) return '';
  used.add(id);
  return `#footnote[${runsMarkup(blockRuns(note), notes, used)}]`;
}

/** Trechos → marcação Typst. */
export function runsMarkup(runs: Run[], notes: NoteMap = new Map(), used = new Set<string>()): string {
  const out = runs.map((r) => (r.noteRef ? noteMarkup(r.noteRef, notes, used) : r.text ? wrap(escapeTypst(r.text), r) : '')).join('');
  return out.replace(/^(\d+)\\?\./, '$1\\.');
}

/**
 * Trechos → array Typst de palavras (cada uma com o espaço que a segue), usado
 * pela capitular e pelo versalete de primeira linha, que medem palavra a palavra.
 * As `smallWords` primeiras palavras saem em versalete.
 */
export function wordsArray(runs: Run[], notes: NoteMap, used: Set<string>, smallWords = 0): string {
  const words: string[] = [];
  let cur = '';
  let count = 0;
  const flush = () => {
    if (cur) words.push(cur);
    cur = '';
  };
  for (const r of runs) {
    if (r.noteRef) {
      cur += noteMarkup(r.noteRef, notes, used);
      continue;
    }
    // Divide mantendo o espaço junto da palavra anterior.
    for (const piece of r.text.split(/(?<= )/)) {
      if (!piece) continue;
      const sc = count < smallWords;
      cur += wrap(escapeTypst(piece), sc ? { ...r, smallcaps: true } : r);
      if (piece.endsWith(' ')) {
        flush();
        count++;
      }
    }
  }
  flush();
  return `(${words.map((w) => `[${w}]`).join(', ')}${words.length === 1 ? ',' : ''})`;
}

/** Remove numeração do título quando o numeral é desenhado à parte ("1. O cais" → "O cais"). */
export function stripNumbering(title: string): string {
  const rest = title.replace(/^(cap[ií]tulo\s+)?(\d{1,3}|[IVXLC]{1,6})\s*[.:—–-]?\s+/i, '').trim();
  return rest || title;
}

/** Separa pontuação pendurada e capitular do início dos trechos. */
function takeCap(runs: Run[], hanging: string, cap: string): Run[] {
  const out = runs.map((r) => ({ ...r }));
  let skip = hanging.length + cap.length;
  for (const r of out) {
    if (r.noteRef || skip <= 0) continue;
    const lead = r.text.length - r.text.trimStart().length;
    const cut = Math.min(r.text.length, skip + lead);
    skip -= cut - lead;
    r.text = r.text.slice(cut);
  }
  return out.filter((r) => r.noteRef || r.text);
}

const PRELUDE = String.raw`
// ---------------------------------------------------------------------------
// Prelúdio GraficAI — funções de composição. Ajuste aqui o desenho do livro.
// ---------------------------------------------------------------------------
// Página em branco: nenhum elemento começa nela e o último elemento terminou antes.
// (As páginas inseridas por pagebreak(to: "odd") são detectadas assim.)
#let gx-is-blank() = {
  let p = here().page()
  let starts = query(<gx-el>)
  if starts.any(m => m.location().page() == p) { return false }
  let s = query(selector(<gx-el>).before(here()))
  let e = query(selector(<gx-elend>).before(here()))
  if e.len() == 0 { return false }
  let ep = e.last().location().position()
  if s.len() > 0 {
    let sp = s.last().location().position()
    if (sp.page, sp.y) > (ep.page, ep.y) { return false }
  }
  ep.page < p
}

#let gx-on-page(sel) = {
  let p = here().page()
  query(sel).any(m => m.location().page() == p)
}

// Capitular rebaixada: mede palavra a palavra quantas cabem nas n linhas ao lado da letra.
#let gx-dropcap(cap, words, lines: 3, gap: 1.5mm, hang: none) = layout(size => context {
  let one = measure(block(width: size.width)[x]).height
  let pitch = measure(block(width: size.width)[x #linebreak() x]).height - one
  let ch = measure(text(top-edge: "cap-height", bottom-edge: "baseline")[H]).height
  let target = (lines - 1) * pitch + ch
  let unit = measure(text(size: 100pt, top-edge: "cap-height", bottom-edge: "baseline", cap)).height / 100pt
  let capsize = target / unit
  let capc = text(size: capsize, top-edge: "cap-height", bottom-edge: "baseline", cap)
  let cw = measure(capc).width + gap
  let w = size.width - cw
  let maxh = (lines - 1) * pitch + one
  let k = 0
  while k < words.len() {
    let h = measure(block(width: w, par(first-line-indent: 0pt, words.slice(0, k + 1).join()))).height
    if h > maxh { break }
    k += 1
  }
  let rest = words.slice(k)
  let first = words.slice(0, k).join()
  if rest.len() > 0 and first != none { first = first + linebreak(justify: true) }
  let off = 0.8em.to-absolute() - ch
  {
    set par(spacing: par.leading)
    set block(spacing: par.leading)
    grid(
      columns: (cw, w),
      block(height: maxh, place(top + left, dy: off, {
        if hang != none { place(right + top, dx: -0.02em, dy: 0pt, text(size: capsize * 0.35, hang)) }
        capc
      })),
      par(first-line-indent: 0pt, first),
    )
    if rest.len() > 0 { par(first-line-indent: 0pt, rest.join()) }
  }
})

// Capitular elevada: a letra grande apoia na primeira linha.
#let gx-raised(cap, words, lines: 3, hang: none) = context {
  let pitch = measure([x #linebreak() x]).height - measure([x]).height
  let size = ((lines - 1) * pitch + 0.65em.to-absolute()) / 0.65
  par(first-line-indent: 0pt, {
    if hang != none { text(size: size * 0.35, hang) }
    text(size: size, top-edge: "cap-height", cap)
    words.join()
  })
}

// Versalete na primeira linha: mede quantas palavras cabem nela.
#let gx-firstline(words) = layout(size => context {
  let k = 0
  while k < words.len() {
    let w = measure(smallcaps(words.slice(0, k + 1).join())).width
    if w > size.width * 0.98 { break }
    k += 1
  }
  par(first-line-indent: 0pt, smallcaps(words.slice(0, k).join()) + words.slice(k).join())
})

#let gx-opener(title, numeral: none, outlined: true, ornament: "nenhum", sink: 0.3, numstyle: "romano") = {
  v(sink * gx.mancha-h)
  if numeral != none {
    align(center, if numstyle == "extenso" { text(size: 0.95em, tracking: 0.12em, smallcaps(numeral)) } else { text(size: 2.2em, numeral) })
    v(0.4em)
  }
  heading(level: 1, outlined: outlined, title)
  if ornament == "vinheta" { align(center, text(size: 1.2em)[❦]) }
  else if ornament == "fio" { align(center, line(length: 22%, stroke: 0.4pt)) }
  v(1.6em)
}

// Epígrafe de capítulo: à direita, itálico, corpo menor.
#let gx-epigraph(body) = align(right, block(width: 62%, below: 2em, { set text(size: 0.9em, style: "italic"); set par(justify: false, first-line-indent: 0pt); align(right, body) }))

#let gx-quote(body) = pad(left: 1.6em, right: 1.6em, { set text(size: 0.92em); set par(first-line-indent: 0pt); body })

#let gx-placeholder(label, h) = block(width: 100%, height: h, stroke: 0.5pt + luma(160), inset: 6pt, align(center + horizon, text(fill: luma(120), size: 0.85em, label)))

#let gx-crop(off, bleed) = {
  let len = 6mm
  let gap = bleed + 1.5mm
  let s = 0.3pt
  for (x, y, sx, sy) in ((off, off, -1, -1), (100% - off, off, 1, -1), (off, 100% - off, -1, 1), (100% - off, 100% - off, 1, 1)) {
    place(top + left, dx: x + sx * gap - (if sx < 0 { len } else { 0pt }), dy: y, line(length: len, stroke: s))
    place(top + left, dx: x, dy: y + sy * gap - (if sy < 0 { len } else { 0pt }), line(angle: 90deg, length: len, stroke: s))
  }
}
`;

/** Gera o .typ completo do miolo. */
export function toTypst(book: Book, settings: ProjectSettings, opts: Partial<TypesetOptions> = {}): string {
  const o = { ...DEFAULT_TYPESET, ...opts };
  const d = settings.design;
  const m = pageMetrics(d);
  const bleed = o.trimMarks === 'nenhuma' ? 0 : settings.production.bleedMm;
  const off = o.trimMarks === 'marcas' ? bleed + 10 : bleed;
  const parSpace = d.paragraphSpacingLines * d.leadingPt;

  const out: string[] = [];
  out.push(`// ${book.title} — miolo gerado pelo GraficAI`);
  out.push(`// Formato ${d.trimWidthMm} × ${d.trimHeightMm} mm · corpo ${d.bodySizePt}/${d.leadingPt} pt · ${o.font}`);
  out.push(`// Compilar: typst compile --font-path <pasta com a fonte ${o.font}> livro.typ   (Typst 0.14+)`);
  out.push(
    `#let gx = (title: ${str(book.title)}, mancha-h: ${n(m.textHeightMm)}mm, off: ${n(off)}mm, bleed: ${n(bleed)}mm, marks: ${o.trimMarks === 'marcas'})`,
  );
  out.push(PRELUDE);
  out.push(`#set document(title: gx.title)
#set page(
  width: ${n(d.trimWidthMm + 2 * off)}mm,
  height: ${n(d.trimHeightMm + 2 * off)}mm,
  margin: (inside: ${n(d.marginInnerMm + off)}mm, outside: ${n(d.marginOuterMm + off)}mm, top: ${n(d.marginTopMm + off)}mm, bottom: ${n(d.marginBottomMm + off)}mm),
  header-ascent: 40%,
  footer-descent: 40%,
  background: if gx.marks { gx-crop(gx.off, gx.bleed) },
  header: context {
    let p = here().page()
    let body = query(<gx-body>)
    if body.len() > 0 and p > body.first().location().page() and not gx-is-blank() and not gx-on-page(heading.where(level: 1)) {
      set text(size: 0.82em, tracking: 0.04em)
      let label = if calc.even(p) { gx.title } else {
        let hs = query(heading.where(level: 1).before(here()))
        if hs.len() > 0 { hs.last().body } else { gx.title }
      }
      align(center, smallcaps(label))
    }
  },
  footer: context {
    let p = here().page()
    let body = query(<gx-body>)
    if body.len() > 0 and p >= body.first().location().page() and not gx-is-blank() {
      set text(size: 0.85em)
      align(center, str(p))
    }
  },
)
#set text(font: ${str(o.font)}, size: ${n(d.bodySizePt)}pt, lang: "pt", region: "br", hyphenate: true, top-edge: 0.8em, bottom-edge: -0.2em)
#set par(justify: true, leading: ${n(d.leadingPt - d.bodySizePt)}pt, spacing: ${n(d.leadingPt - d.bodySizePt + parSpace)}pt, first-line-indent: (amount: 1.2em, all: false))
#set block(spacing: ${n(d.leadingPt - d.bodySizePt)}pt)
#set footnote.entry(separator: line(length: 22%, stroke: 0.4pt), gap: 0.35em, clearance: 1em)
#show footnote.entry: set text(size: 0.8em)
#show footnote.entry: set par(first-line-indent: 0pt)
#show heading.where(level: 1): it => align(center, block(below: 0pt, text(size: 1.5em, style: "italic", weight: "regular", it.body)))
#show heading.where(level: 2): it => block(above: 1.6em, below: 1em, align(center, text(weight: "regular", smallcaps(it.body))))
#show outline.entry.where(level: 1): set block(above: 0.7em)
`);

  let chapterNo = 0;
  let bodyMarked = false;
  book.elements.forEach((el, idx) => {
    const rule = ruleFor(el.kind, d.chaptersOnOdd);
    out.push(`\n// ===== ${el.title} (${el.kind}) =====`);
    if (idx > 0) out.push(rule.opensOn === 'impar' ? '#pagebreak(weak: true, to: "odd")' : '#pagebreak(weak: true)');
    const outlined = !NOT_OUTLINED.has(el.kind);
    if (outlined && !bodyMarked) {
      out.push('#metadata("corpo") <gx-body>');
      bodyMarked = true;
    }
    out.push(`#context [#metadata((id: ${str(el.id)}, page: here().page())) <gx-el>]`);
    if (el.kind === 'capitulo') {
      chapterNo++;
      out.push('#counter(footnote).update(0)');
    }
    out.push(renderElement(el, book, settings, chapterNo, outlined));
    out.push('#metadata("fim") <gx-elend>');
    if (rule.blankVerso || rule.fixedPages === 2) out.push('#pagebreak(to: "odd")');
  });

  if (o.padPages > 0) {
    out.push(`\n// ===== Fechamento do caderno: ${o.padPages} páginas =====`);
    out.push(`#for _ in range(${o.padPages}) { pagebreak(); [#metadata("branco") <gx-pad>] }`);
  }
  out.push('#metadata("fim") <gx-end>');

  return out.join('\n') + '\n';
}

function renderElement(el: BookElement, book: Book, settings: ProjectSettings, chapterNo: number, outlined: boolean): string {
  const d = settings.design;
  const op = d.chapterOpening;
  const notes: NoteMap = new Map(el.blocks.filter((b) => b.type === 'nota' && b.noteId).map((b) => [b.noteId!, b]));
  const used = new Set<string>();
  const out: string[] = [];
  const title = escapeTypst(el.title);

  switch (el.kind) {
    case 'falsa_folha_rosto':
      return `#v(28%)\n#align(center, text(size: 1.3em, tracking: 0.08em, smallcaps[${title}]))`;
    case 'folha_rosto':
      return `#v(22%)\n#align(center, text(size: 2.1em, style: "italic")[${title}])\n#v(1fr)\n#align(center, text(size: 0.9em, tracking: 0.1em, smallcaps[Editora]))`;
    case 'ficha':
      return `#v(1fr)\n#block(width: 100%, stroke: 0.4pt, inset: 8pt, text(size: 0.8em)[Dados Internacionais de Catalogação na Publicação (CIP) #linebreak() #text(fill: luma(110))[A preencher pela bibliotecária responsável.]])`;
    case 'dedicatoria':
    case 'epigrafe': {
      const body = el.blocks.map((b) => runsMarkup(blockRuns(b), notes, used)).join(' #linebreak() ');
      return `#v(30%)\n#align(right, block(width: 62%, { set par(justify: false, first-line-indent: 0pt); align(right, emph[${body}]) }))`;
    }
    case 'sumario':
      return `#gx-opener([${title}], outlined: false, sink: ${n(d.chapterSink * 0.6)})\n#outline(title: none, target: heading.where(level: 1, outlined: true))`;
  }

  // Abertura (título, numeral, ornamento)
  const applies = op.appliesTo.includes(el.kind);
  const numeral = el.kind === 'capitulo' && applies ? chapterNumeral(chapterNo, op.number) : '';
  const shownTitle = numeral ? stripNumbering(el.title) : el.title;
  out.push(
    `#gx-opener([${escapeTypst(shownTitle)}], numeral: ${numeral ? `[${escapeTypst(numeral)}]` : 'none'}, outlined: ${outlined}, ornament: ${str(applies ? op.ornament : 'nenhum')}, sink: ${n(el.kind === 'capitulo' ? d.chapterSink : d.chapterSink * 0.6)}, numstyle: ${str(op.number)})`,
  );

  const opening = applies ? analyzeOpening(el, pageMetrics(d), d) : null;
  // A capitular é um bloco; o parágrafo seguinte precisa do recuo explícito.
  const indentNext = opening && opening.blockIndex >= 0 && el.blocks[opening.blockIndex].type === 'paragrafo' ? opening.blockIndex + 1 : -1;
  const epigraph = el.kind === 'capitulo' || applies ? chapterEpigraphIndex(el, op) : -1;
  const lq = applies ? leadQuote(el, op) : null;
  if (lq) out.unshift(`// Abertura: ${describeLeadQuote(lq, op)}`);
  let i = 0;
  while (i < el.blocks.length) {
    const b = el.blocks[i];
    if (b.type === 'nota') {
      i++;
      continue;
    }
    if (b.type === 'lista') {
      const items: string[] = [];
      while (i < el.blocks.length && el.blocks[i].type === 'lista') items.push(`[${runsMarkup(blockRuns(el.blocks[i++]), notes, used)}]`);
      out.push(el.kind === 'referencias' ? items.map((it) => `#par(hanging-indent: 1.5em, first-line-indent: 0pt)${it}`).join('\n\n') : `#list(tight: true, ${items.join(', ')})`);
      continue;
    }
    if (i === epigraph) out.push(`#gx-epigraph[${runsMarkup(blockRuns(b), notes, used)}]`);
    else if (opening && i === opening.blockIndex)
      out.push(b.type === 'citacao' ? `#gx-quote[${openingParagraph(b, opening, op, notes, used)}]` : openingParagraph(b, opening, op, notes, used));
    else if (i === indentNext && b.type === 'paragrafo' && el.kind !== 'referencias')
      out.push(`#par(first-line-indent: (amount: 1.2em, all: true))[${runsMarkup(blockRuns(b), notes, used)}]`);
    else out.push(blockMarkup(b, el, notes, used));
    i++;
  }

  // Notas sem chamada: no fim do elemento, em corpo menor.
  const orphans = el.blocks.filter((b) => b.type === 'nota' && b.noteId && !used.has(b.noteId));
  if (orphans.length) out.push(`#v(1em)\n#line(length: 22%, stroke: 0.4pt)\n#text(size: 0.8em)[${orphans.map((b) => runsMarkup(blockRuns(b), notes, used)).join(' #parbreak() ')}]`);
  return out.join('\n\n');
}

function blockMarkup(b: Block, el: BookElement, notes: NoteMap, used: Set<string>): string {
  const md = runsMarkup(blockRuns(b), notes, used);
  switch (b.type) {
    case 'paragrafo':
      return el.kind === 'referencias' ? `#par(hanging-indent: 1.5em, first-line-indent: 0pt)[${md}]` : md;
    case 'citacao':
      return `#gx-quote[${md}]`;
    case 'subtitulo':
    case 'titulo':
      return `#heading(level: 2, outlined: false)[${md}]`;
    case 'imagem':
      return `#gx-placeholder([Imagem], 30%)`;
    case 'tabela':
      return `#gx-placeholder([Tabela — revisar: ${md}], auto)`;
    default:
      return md;
  }
}

function openingParagraph(b: Block, opening: NonNullable<ReturnType<typeof analyzeOpening>>, op: ProjectSettings['design']['chapterOpening'], notes: NoteMap, used: Set<string>): string {
  const runs = blockRuns(b);
  const leadWords = opening.leadIn ? opening.leadIn.split(' ').filter(Boolean).length : 0;
  const hang = opening.hanging.trim();
  if (opening.cap) {
    const rest = takeCap(runs, opening.hanging, opening.cap);
    // Palavra de uma letra: o resto começa com espaço; a primeira "palavra" do array é vazia.
    const startsWithSpace = rest[0] && !rest[0].noteRef && rest[0].text.startsWith(' ');
    const words = wordsArray(startsWithSpace ? [{ text: ' ' }, ...rest.map((r, i) => (i === 0 ? { ...r, text: r.text.trimStart() } : r))] : rest, notes, used, leadWords + (startsWithSpace ? 1 : 0));
    const hangArg = hang ? `, hang: [${escapeTypst(hang)}]` : '';
    if (op.dropCap.mode === 'elevada') return `#gx-raised([${escapeTypst(opening.cap)}], ${words}, lines: ${op.dropCap.lines}${hangArg})`;
    return `#gx-dropcap([${escapeTypst(opening.cap)}], ${words}, lines: ${op.dropCap.lines}, gap: ${n(op.dropCap.gapMm)}mm${hangArg})`;
  }
  if (op.leadIn.style === 'versalete' && op.leadIn.scope === 'linha') return `#gx-firstline(${wordsArray(runs, notes, used)})`;
  if (leadWords) return `#par(first-line-indent: 0pt)[#{${wordsArray(runs, notes, used, leadWords)}.join()}]`;
  return runsMarkup(runs, notes, used);
}
