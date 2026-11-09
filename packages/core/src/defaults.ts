import type { DesignSpec, LaudaConfig, PaperProfile, PrinterProfile, ProjectSettings } from './types.ts';

export const PAPERS: PaperProfile[] = [
  { name: 'Offset 75 g', grammage: 75, mmPerPage: 0.05 },
  { name: 'Offset 90 g', grammage: 90, mmPerPage: 0.06 },
  { name: 'Pólen 80 g', grammage: 80, mmPerPage: 0.065 },
];

export const TRIMS: { label: string; w: number; h: number }[] = [
  { label: '14 × 21 cm', w: 140, h: 210 },
  { label: '16 × 23 cm', w: 160, h: 230 },
  { label: '12 × 18 cm', w: 120, h: 180 },
  { label: '21 × 28 cm', w: 210, h: 280 },
];

export const DEFAULT_DESIGN: DesignSpec = {
  trimWidthMm: 140,
  trimHeightMm: 210,
  marginTopMm: 20,
  marginBottomMm: 20,
  marginInnerMm: 23,
  marginOuterMm: 18,
  bodySizePt: 11,
  leadingPt: 14.5,
  paragraphSpacingLines: 0,
  avgCharWidthEm: 0.45,
  chapterSink: 0.33,
  chaptersOnOdd: true,
};

export const DEFAULT_LAUDA: LaudaConfig = { charsPerLauda: 2100, includeNotes: true, rounding: 'nenhum' };

/**
 * Perfis de exemplo. Os valores são ilustrativos para o MVP e devem ser
 * substituídos pela tabela real da gráfica parceira.
 */
export const PRINTERS: PrinterProfile[] = [
  {
    id: 'offset-32',
    name: 'Offset — cadernos de 32/16/8 (exemplo)',
    process: 'offset',
    signatureSizes: [32, 16, 8],
    offset: {
      setupPerSignature: { 32: 600, 16: 420, 8: 330 },
      sheetPrice: 1.1,
      pagesPerSheet: 32,
      runPerThousandSheets: 70,
      waste: 0.08,
      bindingPerCopy: 1.2,
      coverPerCopy: 1.5,
    },
    digital: { fixedPerCopy: 6.5, perPage: 0.06 },
    paper: PAPERS[0],
  },
  {
    id: 'offset-16',
    name: 'Offset — cadernos de 16/8/4 (exemplo)',
    process: 'offset',
    signatureSizes: [16, 8, 4],
    offset: {
      setupPerSignature: { 16: 380, 8: 300, 4: 260 },
      sheetPrice: 0.6,
      pagesPerSheet: 16,
      runPerThousandSheets: 60,
      waste: 0.08,
      bindingPerCopy: 1.2,
      coverPerCopy: 1.5,
    },
    digital: { fixedPerCopy: 6.5, perPage: 0.06 },
    paper: PAPERS[0],
  },
  {
    id: 'digital',
    name: 'Digital / sob demanda (exemplo)',
    process: 'digital',
    signatureSizes: [2],
    offset: {
      setupPerSignature: {},
      sheetPrice: 0,
      pagesPerSheet: 2,
      runPerThousandSheets: 0,
      waste: 0,
      bindingPerCopy: 0,
      coverPerCopy: 0,
    },
    digital: { fixedPerCopy: 6.5, perPage: 0.06 },
    paper: PAPERS[0],
  },
];

export function defaultSettings(): ProjectSettings {
  return { design: { ...DEFAULT_DESIGN }, lauda: { ...DEFAULT_LAUDA }, printer: JSON.parse(JSON.stringify(PRINTERS[0])) as PrinterProfile, run: 1000 };
}
