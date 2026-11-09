import { describe, expect, it } from 'vitest';
import { PRINTERS, SHEETS, defaultSettings, diagnose, impose, sampleBook, sheetPrice, withTrim } from '../src/index.ts';

const o32 = PRINTERS[0].offset;
const o16 = PRINTERS[1].offset;
const [BB, AA] = SHEETS;

describe('imposição', () => {
  it('14 × 21 em 66 × 96: 16 por lado, caderno de 32', () => {
    const imp = impose(140, 210, BB, o32)!;
    expect(imp.pagesPerSide).toBe(16);
    expect(imp.pagesPerSheet).toBe(32);
    expect(imp.signatureSizes).toEqual([32, 16, 8]);
    expect(imp.efficiency).toBeGreaterThan(0.7);
  });

  it('21 × 28 em 66 × 96: caderno de 16', () => {
    const imp = impose(210, 280, BB, o32)!;
    expect(imp.pagesPerSheet).toBe(16);
    expect(imp.signatureSizes).toEqual([16, 8]);
  });

  it('15,5 × 23: cabe mal em 66 × 96, melhor em 76 × 112', () => {
    const bb = impose(155, 230, BB, o32)!;
    const aa = impose(155, 230, AA, o32)!;
    expect(bb.fit).toBeGreaterThan(bb.pagesPerSide); // sobra espaço que a dobra não usa
    expect(aa.pagesPerSheet).toBeGreaterThan(bb.pagesPerSheet);
    expect(aa.efficiency).toBeGreaterThan(bb.efficiency);
  });

  it('dobradeira limita o caderno', () => {
    expect(impose(140, 210, BB, o16)!.pagesPerSheet).toBe(16);
    expect(impose(140, 210, BB, o16)!.signatureSizes).toEqual([16, 8, 4]);
  });

  it('formato gigante não cabe', () => {
    expect(impose(500, 700, BB, o32)).toBeNull();
  });

  it('preço da folha sai de área × gramatura × R$/kg', () => {
    expect(sheetPrice(BB, 75, 11)).toBeCloseTo(0.66 * 0.96 * 0.075 * 11, 6);
  });
});

describe('diagnóstico com folha', () => {
  const book = sampleBook();

  it('escolhe a folha mais barata e usa os cadernos dela', () => {
    const d = diagnose(book, defaultSettings());
    expect(d.imposition).not.toBeNull();
    const totals = d.sheetOptions.filter((o) => o.total !== null).map((o) => o.total!);
    expect(d.cost.total).toBeCloseTo(Math.min(...totals), 2);
    expect(d.plan.sizes.every((s) => d.imposition!.signatureSizes.includes(s))).toBe(true);
  });

  it('formato grande muda o plano de cadernos', () => {
    const s = defaultSettings();
    const big = diagnose(book, { ...s, design: withTrim(s.design, 210, 280, true) });
    expect(Math.max(...big.plan.sizes)).toBeLessThanOrEqual(16);
  });

  it('folha fixa é respeitada', () => {
    const s = defaultSettings();
    s.printer.offset.sheetChoice = 'aa';
    expect(diagnose(book, s).imposition!.sheet.id).toBe('aa');
  });

  it('formato que não cabe gera erro e cai nos cadernos padrão', () => {
    const s = defaultSettings();
    const d = diagnose(book, { ...s, design: withTrim(s.design, 600, 900, false) });
    expect(d.imposition).toBeNull();
    expect(d.issues.some((i) => i.kind === 'formato_nao_cabe' && i.severity === 'erro')).toBe(true);
  });

  it('digital ignora folha', () => {
    const s = defaultSettings();
    const d = diagnose(book, { ...s, printer: JSON.parse(JSON.stringify(PRINTERS[2])) });
    expect(d.imposition).toBeNull();
    expect(d.sheetOptions).toEqual([]);
  });

  it('margens acompanham o formato quando pedido', () => {
    const d = withTrim(defaultSettings().design, 210, 280, true);
    expect(d.marginInnerMm).toBeCloseTo(23 * 1.5, 0);
    expect(withTrim(defaultSettings().design, 210, 280, false).marginInnerMm).toBe(23);
  });
});
