import { describe, expect, it } from 'vitest';
import { attachNotes, normalizeRuns, parseInlineMarkdown, runsToText, sampleBook, type BookElement } from '../src/index.ts';

describe('trechos com estilo', () => {
  it('normaliza espaços e junta vizinhos de mesmo estilo', () => {
    const r = normalizeRuns([{ text: '  Olá ' }, { text: ' mundo' }, { text: 'belo', italic: true }, { text: ' ' }, { text: '', noteRef: 'x' }]);
    expect(r).toEqual([{ text: 'Olá mundo' }, { text: 'belo', italic: true }, { text: '', noteRef: 'x' }]);
  });

  it('markdown aninhado e literais sem fechamento', () => {
    const r = parseInlineMarkdown('***ambos*** e 2 * 3 e x^2^');
    expect(r[0]).toEqual({ text: 'ambos', bold: true, italic: true });
    expect(runsToText(r)).toBe('ambos e 2 * 3 e x2');
    expect(r.find((x) => x.sup)!.text).toBe('2');
  });

  it('nota sem chamada fica onde estava', () => {
    const els: BookElement[] = [
      { id: 'a', kind: 'capitulo', title: 'A', confidence: 'alta', classifiedBy: 'regra', rationale: '', blocks: [{ type: 'paragrafo', text: 'x' }] },
      { id: 'b', kind: 'referencias', title: 'B', confidence: 'alta', classifiedBy: 'regra', rationale: '', blocks: [{ type: 'nota', text: 'solta', noteId: 'z' }] },
    ];
    const out = attachNotes(els);
    expect(out[1].blocks).toHaveLength(1);
    expect(out[0].blocks).toHaveLength(1);
  });

  it('livro de exemplo tem itálico e notas consistentes', () => {
    const book = sampleBook();
    const blocks = book.elements.flatMap((e) => e.blocks);
    for (const b of blocks) if (b.runs) expect(runsToText(b.runs)).toBe(b.text);
    const refs = blocks.flatMap((b) => b.runs ?? []).filter((r) => r.noteRef).map((r) => r.noteRef);
    const notes = blocks.filter((b) => b.type === 'nota').map((b) => b.noteId);
    expect(refs.length).toBeGreaterThan(10);
    expect(new Set(refs)).toEqual(new Set(notes));
    expect(blocks.some((b) => b.runs?.some((r) => r.italic))).toBe(true);
  });
});
