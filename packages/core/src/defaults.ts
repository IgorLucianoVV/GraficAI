import { openingPreset } from './opening.ts';
import type { SheetFormat, ProductionSpec, DesignSpec, LaudaConfig, PaperProfile, PrinterProfile, ProjectSettings } from './types.ts';

export const PAPERS: PaperProfile[] = [
  { name: 'Offset 75 g', grammage: 75, mmPerPage: 0.05, pricePerKg: 11 },
  { name: 'Offset 90 g', grammage: 90, mmPerPage: 0.06, pricePerKg: 11 },
  { name: 'Pólen 80 g', grammage: 80, mmPerPage: 0.065, pricePerKg: 14 },
];

export const TRIMS: { label: string; w: number; h: number }[] = [
  { label: '14 × 21 cm', w: 140, h: 210 },
  { label: '13,5 × 20,5 cm', w: 135, h: 205 },
  { label: '15,5 × 23 cm', w: 155, h: 230 },
  { label: '16 × 23 cm', w: 160, h: 230 },
  { label: '12 × 18 cm', w: 120, h: 180 },
  { label: '11 × 18 cm (bolso)', w: 110, h: 180 },
  { label: '17 × 24 cm', w: 170, h: 240 },
  { label: '20 × 20 cm', w: 200, h: 200 },
  { label: '21 × 28 cm', w: 210, h: 280 },
];

/** Folhas de impressão mais comuns no Brasil. */
export const SHEETS: SheetFormat[] = [
  { id: 'bb', name: 'BB', widthMm: 660, heightMm: 960 },
  { id: 'aa', name: 'AA', widthMm: 760, heightMm: 1120 },
];

const OFFSET_SHEET_DEFAULTS = {
  sheets: SHEETS,
  sheetChoice: 'auto',
  gripperMm: 12,
  sheetMarginMm: 5,
  pageAllowanceMm: 6,
};

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
  chapterOpening: openingPreset('classica'),
};

export const DEFAULT_LAUDA: LaudaConfig = { charsPerLauda: 2100, includeNotes: true, rounding: 'nenhum' };

/**
 * Perfis de exemplo. Os valores são ilustrativos para o MVP e devem ser
 * substituídos pela tabela real da gráfica parceira.
 */
export const PRINTERS: PrinterProfile[] = [
  {
    id: 'offset-32',
    name: 'Offset — dobra até 32 pp (exemplo)',
    process: 'offset',
    signatureSizes: [32, 16, 8],
    offset: {
      ...OFFSET_SHEET_DEFAULTS,
      setupByFraction: { '1': 600, '0.5': 420, '0.25': 330 },
      maxFolding: 32,
      minSignature: 8,
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
    name: 'Offset — dobra até 16 pp (exemplo)',
    process: 'offset',
    signatureSizes: [16, 8, 4],
    offset: {
      ...OFFSET_SHEET_DEFAULTS,
      setupByFraction: { '1': 380, '0.5': 300, '0.25': 260 },
      maxFolding: 16,
      minSignature: 4,
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
      ...OFFSET_SHEET_DEFAULTS,
      setupByFraction: {},
      maxFolding: 2,
      minSignature: 2,
      runPerThousandSheets: 0,
      waste: 0,
      bindingPerCopy: 0,
      coverPerCopy: 0,
    },
    digital: { fixedPerCopy: 6.5, perPage: 0.06 },
    paper: PAPERS[0],
  },
];

export const DEFAULT_PRODUCTION: ProductionSpec = {
  interiorColors: '1 × 1 (preto)',
  cover: '4 × 0 cores em cartão 250 g, laminação fosca',
  finishing: 'Brochura, lombada quadrada, cola PUR',
  flapsMm: 0,
  bleedMm: 5,
  notes: '',
  contact: '',
};

export function defaultSettings(): ProjectSettings {
  return { design: JSON.parse(JSON.stringify(DEFAULT_DESIGN)) as DesignSpec, lauda: { ...DEFAULT_LAUDA }, printer: JSON.parse(JSON.stringify(PRINTERS[0])) as PrinterProfile, run: 1000, production: { ...DEFAULT_PRODUCTION } };
}
