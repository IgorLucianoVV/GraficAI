import type { Imposition, OffsetCost, SheetFormat } from './types.ts';

const pow2Floor = (n: number) => (n < 1 ? 0 : 2 ** Math.floor(Math.log2(n)));

/**
 * Imposição: quantas páginas do formato cabem na folha de impressão.
 * Testa as duas orientações; a pinça fica numa borda longa da folha. As
 * páginas usadas por lado viram potência de 2 (esquema de dobra) e respeitam
 * a dobradeira. Retorna null se não couberem 2 páginas por lado (caderno de 4).
 */
export function impose(trimW: number, trimH: number, sheet: SheetFormat, o: OffsetCost): Imposition | null {
  const cellW = trimW + o.pageAllowanceMm;
  const cellH = trimH + o.pageAllowanceMm;
  const long = Math.max(sheet.widthMm, sheet.heightMm);
  const short = Math.min(sheet.widthMm, sheet.heightMm);
  // Pinça ao longo da borda longa: tira da dimensão curta.
  const usableLong = long - 2 * o.sheetMarginMm;
  const usableShort = short - o.gripperMm - o.sheetMarginMm;

  let best = { fit: 0, cols: 0, rows: 0 };
  for (const [w, h] of [[cellW, cellH], [cellH, cellW]]) {
    const cols = Math.floor(usableLong / w);
    const rows = Math.floor(usableShort / h);
    if (cols * rows > best.fit) best = { fit: cols * rows, cols, rows };
  }

  const pagesPerSide = Math.min(pow2Floor(best.fit), o.maxFolding / 2);
  if (pagesPerSide < 2) return null;
  const pagesPerSheet = pagesPerSide * 2;

  const signatureSizes = [1, 0.5, 0.25]
    .map((f) => pagesPerSheet * f)
    .filter((s) => Number.isInteger(s) && s >= Math.max(4, o.minSignature) && s % 4 === 0);

  return {
    sheet,
    fit: best.fit,
    pagesPerSide,
    pagesPerSheet,
    cols: best.cols,
    rows: best.rows,
    efficiency: (pagesPerSide * trimW * trimH) / (sheet.widthMm * sheet.heightMm),
    signatureSizes,
  };
}

/** Preço de uma folha a partir de área, gramatura e R$/kg. */
export function sheetPrice(sheet: SheetFormat, grammage: number, pricePerKg: number): number {
  return ((sheet.widthMm * sheet.heightMm) / 1e6) * (grammage / 1000) * pricePerKg;
}

export const sheetLabel = (s: SheetFormat) => `${s.widthMm / 10} × ${s.heightMm / 10} cm`;
