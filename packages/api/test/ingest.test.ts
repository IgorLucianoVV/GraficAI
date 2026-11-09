import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { classifyBlocks, countText, defaultSettings, runsToText } from '@graficai/core';
import { htmlToBlocks, ingestDocx, ingestMarkdown } from '../src/ingest.ts';

const fixture = fileURLToPath(new URL('./fixtures/notas.docx', import.meta.url));

describe('formatação e notas (DOCX)', () => {
  it('preserva itálico, negrito, subscrito e chamadas de nota', async () => {
    const { blocks } = await ingestDocx(readFileSync(fixture), 'notas.docx');
    const p = blocks.find((b) => b.tag === 'p' && b.text.startsWith('Era manhã'))!;
    expect(p.runs!.find((r) => r.italic)!.text).toBe('Esperança');
    expect(p.runs!.find((r) => r.bold)!.text).toBe('nada');
    expect(p.runs!.find((r) => r.sub)!.text).toBe('2');
    expect(p.runs!.filter((r) => r.noteRef).map((r) => r.noteRef)).toEqual(['footnote-1']);
    expect(p.text).toBe(runsToText(p.runs!));
    expect(p.text).not.toMatch(/\[1\]/);
    expect(p.text).toContain('atracou. Ninguém');
    const notes = blocks.filter((b) => b.tag === 'note');
    expect(notes.map((n) => n.noteId)).toEqual(['footnote-1', 'footnote-2']);
    expect(notes[0].text).toBe('O nome do barco vem de uma canção antiga.');
  });

  it('notas vão para o capítulo que as chama', async () => {
    const { blocks } = await ingestDocx(readFileSync(fixture), 'notas.docx');
    const book = classifyBlocks(blocks, 'Notas');
    const [c1, c2] = book.elements;
    expect(c1.blocks.filter((b) => b.type === 'nota')).toHaveLength(2);
    expect(c2.blocks.some((b) => b.type === 'nota')).toBe(false);
    // Nota logo após o parágrafo que a chama.
    expect(c1.blocks[1]).toMatchObject({ type: 'nota', noteId: 'footnote-1' });
    // Laudas continuam contando as notas.
    const stats = countText(book, defaultSettings().lauda);
    expect(stats.charsWithSpaces).toBeGreaterThan(0);
  });

  it('sup com texto é sobrescrito de verdade', () => {
    const [b] = htmlToBlocks('<p>1<sup>o</sup> lugar</p>');
    expect(b.runs).toEqual([{ text: '1' }, { text: 'o', sup: true }, { text: ' lugar' }]);
  });

  it('parágrafo todo em negrito continua candidato a título', () => {
    const [b] = htmlToBlocks('<p><strong>Interlúdio</strong></p>');
    expect(b.bold).toBe(true);
  });
});

describe('formatação e notas (Markdown)', () => {
  const src = `# Capítulo 1

Era *manhã* quando o **barco** chegou.[^a] Fim.

Outro parágrafo com _ênfase_ e snake_case_literal.

[^a]: Nota em *itálico*.

# Capítulo 2

Nada aqui.`;

  it('estilos, notas e literais', () => {
    const { blocks } = ingestMarkdown(src, 'livro.md');
    const p = blocks.find((b) => b.text.startsWith('Era'))!;
    expect(p.text).toBe('Era manhã quando o barco chegou. Fim.');
    expect(p.runs!.find((r) => r.italic)!.text).toBe('manhã');
    expect(p.runs!.find((r) => r.bold)!.text).toBe('barco');
    expect(p.runs!.some((r) => r.noteRef === 'a')).toBe(true);
    expect(blocks.find((b) => b.text.startsWith('Outro'))!.text).toContain('snake_case_literal');
    const book = classifyBlocks(blocks, 'Livro');
    expect(book.elements[0].blocks.some((b) => b.type === 'nota' && b.noteId === 'a')).toBe(true);
    expect(book.elements[1].blocks.some((b) => b.type === 'nota')).toBe(false);
  });
});
