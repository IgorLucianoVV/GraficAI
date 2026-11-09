import mammoth from 'mammoth';
import { parse, type HTMLElement, type Node } from 'node-html-parser';
import { normalizeRuns, parseInlineMarkdown, runsToText, type RawBlock, type Run } from '@graficai/core';

export interface IngestResult {
  blocks: RawBlock[];
  title: string;
  warnings: string[];
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** DOCX → HTML semântico (mammoth) → blocos brutos. Notas de rodapé viram blocos 'note'. */
export async function ingestDocx(buffer: Buffer, filename: string): Promise<IngestResult> {
  const result = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Título'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
        "p[style-name='Quote'] => blockquote:fresh",
        "p[style-name='Citação'] => blockquote:fresh",
      ],
    },
  );
  const blocks = htmlToBlocks(result.value);
  const warnings = result.messages
    .filter((m) => m.type === 'warning')
    .slice(0, 5)
    .map((m) => m.message);
  return { blocks, title: guessTitle(blocks, filename), warnings };
}

type Marks = Omit<Run, 'text' | 'noteRef'>;
const NOTE_HREF = /^#((?:footnote|endnote)-[\w-]+)$/;

/** Trechos com estilo de um nó HTML do mammoth (em/strong/sup/sub, chamadas de nota). */
export function inlineRuns(node: Node, marks: Marks = {}): Run[] {
  const out: Run[] = [];
  for (const child of node.childNodes) {
    if (child.nodeType === 3) {
      out.push({ text: child.text, ...marks });
      continue;
    }
    const el = child as HTMLElement;
    const tag = el.tagName?.toLowerCase();
    if (!tag) continue;
    if (tag === 'br') {
      out.push({ text: ' ', ...marks });
      continue;
    }
    if (tag === 'a') {
      const href = el.getAttribute('href') ?? '';
      const ref = href.match(NOTE_HREF);
      if (ref && !/-ref-/.test(ref[1])) {
        out.push({ text: '', noteRef: ref[1] });
        continue;
      }
      if (/^#(footnote|endnote)-ref-/.test(href)) continue; // seta de volta dentro da nota
    }
    const next: Marks = { ...marks };
    if (tag === 'em' || tag === 'i') next.italic = true;
    if (tag === 'strong' || tag === 'b') next.bold = true;
    if (tag === 'sub') next.sub = true;
    if (tag === 'sup') {
      // <sup> que só envolve a chamada de nota não é sobrescrito de texto.
      const onlyNote = el.querySelectorAll('a').some((a) => NOTE_HREF.test(a.getAttribute('href') ?? '')) && !el.childNodes.some((c) => c.nodeType === 3 && c.text.trim());
      if (!onlyNote) next.sup = true;
    }
    out.push(...inlineRuns(el, next));
  }
  return out;
}

const textBlock = (tag: RawBlock['tag'], node: Node, extra: Partial<RawBlock> = {}): RawBlock | null => {
  const runs = normalizeRuns(inlineRuns(node));
  const text = runsToText(runs);
  if (!text && !runs.some((r) => r.noteRef)) return null;
  const boldChars = runs.filter((r) => r.bold).reduce((a, r) => a + r.text.length, 0);
  return { tag, text, runs, bold: text.length > 0 && boldChars >= text.length * 0.9, ...extra };
};

/** HTML do mammoth → blocos brutos com formatação e notas ligadas por id. */
export function htmlToBlocks(html: string): RawBlock[] {
  const root = parse(html);
  const blocks: RawBlock[] = [];
  const push = (b: RawBlock | null) => b && blocks.push(b);

  const walk = (node: HTMLElement) => {
    for (const child of node.childNodes as HTMLElement[]) {
      const tag = child.tagName?.toLowerCase();
      if (!tag) continue;
      if (tag === 'h1' || tag === 'h2' || tag === 'h3') blocks.push({ tag, text: clean(child.text) });
      else if (tag === 'h4' || tag === 'h5' || tag === 'h6') blocks.push({ tag: 'h3', text: clean(child.text) });
      else if (tag === 'p') {
        const b = textBlock('p', child);
        if (b) push(b);
        else if (child.querySelector('img')) blocks.push({ tag: 'img', text: '' });
      } else if (tag === 'blockquote') push(textBlock('blockquote', child));
      else if (tag === 'ol' || tag === 'ul') {
        for (const li of child.querySelectorAll('li')) {
          const id = li.getAttribute('id') ?? '';
          const isNote = /^(footnote|endnote)-/.test(id);
          push(textBlock(isNote ? 'note' : 'li', li, isNote ? { noteId: id, bold: false } : {}));
        }
      } else if (tag === 'table') blocks.push({ tag: 'table', text: clean(child.text) });
      else if (tag === 'img') blocks.push({ tag: 'img', text: '' });
      else walk(child);
    }
  };
  walk(root);
  return blocks;
}

/** Markdown simples: # título, ## subtítulo, > citação, - lista, parágrafos separados por linha em branco. */
export function ingestMarkdown(text: string, filename: string): IngestResult {
  const blocks: RawBlock[] = [];
  const md = (tag: RawBlock['tag'], src: string, extra: Partial<RawBlock> = {}): RawBlock => {
    const runs = parseInlineMarkdown(src);
    return { tag, text: runsToText(runs), runs, ...extra };
  };
  const notes: RawBlock[] = [];
  const body = text.replace(/\r/g, '').replace(/^\[\^([^\]\s]+)\]:\s*(.+(?:\n(?: {2,}|\t).+)*)/gm, (_m, id: string, def: string) => {
    notes.push(md('note', def.replace(/\n\s+/g, ' '), { noteId: id }));
    return '';
  });
  for (const chunk of body.split(/\n\s*\n/)) {
    const lines = chunk.split('\n').filter((l) => l.trim());
    if (!lines.length) continue;
    const first = lines[0];
    if (/^#\s/.test(first)) blocks.push({ tag: 'h1', text: clean(first.slice(2)) });
    else if (/^#{2}\s/.test(first)) blocks.push({ tag: 'h2', text: clean(first.replace(/^#+/, '')) });
    else if (/^#{3,}\s/.test(first)) blocks.push({ tag: 'h3', text: clean(first.replace(/^#+/, '')) });
    else if (/^>\s?/.test(first)) blocks.push(md('blockquote', lines.map((l) => l.replace(/^>\s?/, '')).join(' ')));
    else if (/^([-*]|\d+\.)\s/.test(first)) for (const l of lines) blocks.push(md('li', l.replace(/^([-*]|\d+\.)\s/, '')));
    else blocks.push(md('p', lines.join(' '), { bold: /^\*\*[^*]+\*\*$/.test(lines.join(' ').trim()) }));
    // Título e corpo no mesmo bloco ("# Título\ntexto")
    if (/^#/.test(first) && lines.length > 1) blocks.push(md('p', lines.slice(1).join(' ')));
  }
  blocks.push(...notes);
  return { blocks, title: guessTitle(blocks, filename), warnings: [] };
}

/** Texto puro: linhas curtas em CAIXA ALTA são tratadas como títulos em negrito. */
export function ingestText(text: string, filename: string): IngestResult {
  const blocks: RawBlock[] = text
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((c) => clean(c))
    .filter(Boolean)
    .map((t) => ({ tag: 'p' as const, text: t, bold: t.length <= 70 && t === t.toUpperCase() && /[A-ZÀ-Ú]/.test(t) }));
  return { blocks, title: guessTitle(blocks, filename), warnings: [] };
}

function guessTitle(_blocks: RawBlock[], filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Livro sem título';
}
