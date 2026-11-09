import { describe, expect, it } from 'vitest';
import { defaultSettings, designerBriefDoc, diagnose, printerSpecDoc, sampleBook } from '../src/index.ts';

describe('exportação', () => {
  const book = sampleBook();
  const settings = defaultSettings();
  const diag = diagnose(book, settings);
  const kv = (doc: ReturnType<typeof printerSpecDoc>, section: string, key: string) =>
    doc.sections.find((s) => s.title === section)?.kv?.find(([k]) => k === key)?.[1] ?? '';

  it('especificação para a gráfica traz páginas, cadernos, lombada e capa aberta', () => {
    const doc = printerSpecDoc(book, settings, diag, new Date(2026, 10, 9));
    expect(kv(doc, 'Miolo', 'Páginas').startsWith(String(diag.plan.totalPages))).toBe(true);
    expect(doc.sections.find((s) => s.title === 'Plano de cadernos')!.table!.rows).toHaveLength(diag.plan.sizes.length);
    const open = 2 * settings.design.trimWidthMm + diag.spineMm;
    expect(kv(doc, 'Capa', 'Capa aberta')).toContain(open.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
    expect(doc.filename).toMatch(/^rios-de-papel-especificacao-grafica\.pdf$/);
  });

  it('orelhas e observações entram quando definidas', () => {
    const s = { ...settings, production: { ...settings.production, flapsMm: 80, notes: 'Prova de cor antes.' } };
    const doc = printerSpecDoc(book, s, diag);
    expect(kv(doc, 'Capa', 'Orelhas')).toBe('80 mm cada');
    expect(doc.sections.some((x) => x.title === 'Observações')).toBe(true);
  });

  it('brief do designer cobre estrutura, abertura e brancos', () => {
    const doc = designerBriefDoc(book, settings, diag);
    const titles = doc.sections.map((s) => s.title);
    expect(titles).toEqual(expect.arrayContaining(['Formato e mancha', 'Tipografia', 'Abertura de capítulo', 'Estrutura e paginação', 'Cadernos e páginas em branco', 'Pontos de atenção']));
    expect(doc.sections.find((s) => s.title === 'Estrutura e paginação')!.table!.rows).toHaveLength(diag.layout.elements.length);
    const blanks = diag.layout.pages.filter((p) => p.kind === 'branco').length;
    const listed = doc.sections.find((s) => s.title === 'Cadernos e páginas em branco')!.bullets!.reduce((a, b) => a + Number(b.match(/: (\d+)/)![1]), 0);
    expect(listed).toBe(blanks);
  });
});
