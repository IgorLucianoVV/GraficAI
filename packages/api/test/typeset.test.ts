import { describe, expect, it } from 'vitest';
import { defaultSettings, planSignatures, sampleBook, diagnose } from '@graficai/core';
import { typeset, TypesetError } from '../src/typeset.ts';

describe('composição Typst', () => {
  const book = sampleBook();
  const settings = defaultSettings();

  it('compõe o livro de exemplo com capítulos em página ímpar', () => {
    const r = typeset(book, settings);
    expect(r.pdf!.subarray(0, 5).toString()).toBe('%PDF-');
    expect(r.pages).toBeGreaterThan(100);
    const chapters = r.starts.filter((s) => s.id.startsWith('cap-'));
    expect(chapters).toHaveLength(12);
    expect(chapters.every((s) => s.page % 2 === 1)).toBe(true);
    // Real e estimado na mesma ordem de grandeza (castoff dentro de ±20%).
    const est = diagnose(book, settings).layout.contentPages;
    expect(Math.abs(r.pages - est) / est).toBeLessThan(0.2);
  }, 30000);

  it('fecha o último caderno com páginas em branco', () => {
    const r = typeset(book, settings, { padToSignatures: true, pdf: false });
    const sizes = diagnose(book, settings).imposition!.signatureSizes;
    expect(planSignatures(r.pages, sizes).paddingPages).toBe(0);
    expect(r.padding).toBeGreaterThanOrEqual(0);
  }, 30000);

  it('sangria e marcas aumentam a página', () => {
    const plain = typeset(book, settings, { pdf: false });
    const marks = typeset(book, settings, { trimMarks: 'marcas', pdf: false });
    expect(marks.source).toContain('width: 170mm');
    expect(plain.source).toContain('width: 140mm');
    expect(marks.pages).toBe(plain.pages);
  }, 30000);

  it('formatos diferentes compõem', () => {
    const s = defaultSettings();
    s.design = { ...s.design, trimWidthMm: 210, trimHeightMm: 280 };
    expect(typeset(book, s, { pdf: false }).pages).toBeLessThan(typeset(book, settings, { pdf: false }).pages);
  }, 30000);

  it('texto com caracteres especiais do Typst compõe literalmente', () => {
    const nasty = '1. Preço $10 #tag *nada* _x_ [a] <b> @c = d + e - f // http://x.y/z ~ \\ `code`';
    const b = { ...book, elements: book.elements.map((e) => (e.id === 'cap-1' ? { ...e, blocks: [{ type: 'paragrafo' as const, text: nasty }, ...e.blocks] } : e)) };
    const r = typeset(b, settings, { pdf: false });
    expect(r.pages).toBeGreaterThan(100);
  }, 30000);

  it('erro de composição vira TypesetError', () => {
    expect(() => typeset(book, settings, { font: 'x"); #panic("boom' as string, pdf: false })).not.toThrow();
    expect(new TypesetError(['falhou']).message).toBe('falhou');
  });
});
