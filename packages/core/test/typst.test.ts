import { describe, expect, it } from 'vitest';
import { defaultSettings, escapeTypst, runsMarkup, sampleBook, stripNumbering, toTypst } from '../src/index.ts';

describe('gerador Typst', () => {
  it('escapa marcação', () => {
    expect(escapeTypst('a*b_c #d $e [f] // g')).toBe('a\\*b\\_c \\#d \\$e \\[f\\] \\/\\/ g');
    expect(escapeTypst('1. Item')).toBe('1\\. Item');
  });
  it('estilos e notas viram funções Typst', () => {
    const notes = new Map([['n1', { type: 'nota' as const, text: 'Nota.', noteId: 'n1' }]]);
    expect(runsMarkup([{ text: 'Era ' }, { text: 'vez', italic: true }, { text: '', noteRef: 'n1' }], notes)).toBe('Era #emph[vez]#footnote[Nota.]');
  });
  it('tira a numeração do título quando o numeral é desenhado', () => {
    expect(stripNumbering('1. O cais')).toBe('O cais');
    expect(stripNumbering('Capítulo 3 — Cidade de sal')).toBe('Cidade de sal');
    expect(stripNumbering('IV. O retorno')).toBe('O retorno');
    expect(stripNumbering('Interlúdio')).toBe('Interlúdio');
  });
  it('documento usa o projeto gráfico e marca elementos', () => {
    const src = toTypst(sampleBook(), defaultSettings(), { trimMarks: 'marcas' });
    expect(src).toContain('width: 170mm');
    expect(src).toContain('inside: 38mm');
    expect(src).toContain('#gx-dropcap(');
    expect(src.match(/<gx-el>\]/g)!.length).toBe(sampleBook().elements.length);
    expect(src).toContain('#outline(');
  });
});
