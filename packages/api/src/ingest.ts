import mammoth from 'mammoth';
import { parse, type HTMLElement } from 'node-html-parser';
import type { RawBlock } from '@graficai/core';

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
  const root = parse(result.value);
  const blocks: RawBlock[] = [];

  const walk = (node: HTMLElement) => {
    for (const child of node.childNodes as HTMLElement[]) {
      const tag = child.tagName?.toLowerCase();
      if (!tag) continue;
      if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
        blocks.push({ tag, text: clean(child.text) });
      } else if (tag === 'h4' || tag === 'h5' || tag === 'h6') {
        blocks.push({ tag: 'h3', text: clean(child.text) });
      } else if (tag === 'p') {
        const text = clean(child.text);
        if (!text) {
          if (child.querySelector('img')) blocks.push({ tag: 'img', text: '' });
          continue;
        }
        const strong = clean(child.querySelectorAll('strong, b').map((n) => n.text).join(' '));
        blocks.push({ tag: 'p', text, bold: strong.length > 0 && strong.length >= text.length * 0.9 });
      } else if (tag === 'blockquote') {
        blocks.push({ tag: 'blockquote', text: clean(child.text) });
      } else if (tag === 'ol' || tag === 'ul') {
        for (const li of child.querySelectorAll('li')) {
          const id = li.getAttribute('id') ?? '';
          blocks.push({ tag: /^(footnote|endnote)/.test(id) ? 'note' : 'li', text: clean(li.text.replace(/↑/g, '')) });
        }
      } else if (tag === 'table') {
        blocks.push({ tag: 'table', text: clean(child.text) });
      } else if (tag === 'img') {
        blocks.push({ tag: 'img', text: '' });
      } else {
        walk(child);
      }
    }
  };
  walk(root);

  const warnings = result.messages
    .filter((m) => m.type === 'warning')
    .slice(0, 5)
    .map((m) => m.message);
  return { blocks, title: guessTitle(blocks, filename), warnings };
}

/** Markdown simples: # título, ## subtítulo, > citação, - lista, parágrafos separados por linha em branco. */
export function ingestMarkdown(text: string, filename: string): IngestResult {
  const blocks: RawBlock[] = [];
  for (const chunk of text.replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = chunk.split('\n').filter((l) => l.trim());
    if (!lines.length) continue;
    const first = lines[0];
    if (/^#\s/.test(first)) blocks.push({ tag: 'h1', text: clean(first.slice(2)) });
    else if (/^#{2}\s/.test(first)) blocks.push({ tag: 'h2', text: clean(first.replace(/^#+/, '')) });
    else if (/^#{3,}\s/.test(first)) blocks.push({ tag: 'h3', text: clean(first.replace(/^#+/, '')) });
    else if (/^>\s?/.test(first)) blocks.push({ tag: 'blockquote', text: clean(lines.map((l) => l.replace(/^>\s?/, '')).join(' ')) });
    else if (/^([-*]|\d+\.)\s/.test(first)) for (const l of lines) blocks.push({ tag: 'li', text: clean(l.replace(/^([-*]|\d+\.)\s/, '')) });
    else {
      const t = clean(lines.join(' ').replace(/\*\*(.+?)\*\*/g, '$1'));
      blocks.push({ tag: 'p', text: t, bold: /^\*\*.+\*\*$/.test(lines.join(' ').trim()) });
    }
    // Título e corpo no mesmo bloco ("# Título\ntexto")
    if (/^#/.test(first) && lines.length > 1) blocks.push({ tag: 'p', text: clean(lines.slice(1).join(' ')) });
  }
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
