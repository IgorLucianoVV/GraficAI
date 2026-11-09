import type { CostBreakdown, Imposition, PrinterProfile, SignaturePlan } from './types.ts';
import { sheetLabel, sheetPrice } from './impose.ts';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Custo por componente. Offset (exige imposição): fixo por caderno (chapas + acerto) + papel
 * + rodagem + acabamento. Digital: fixo por exemplar + valor por página.
 * Os valores vêm do perfil da gráfica — nada aqui é constante de mercado.
 */
export function estimateCost(plan: SignaturePlan, printer: PrinterProfile, run: number, imp: Imposition | null): CostBreakdown {
  const T = plan.totalPages;
  const items: CostBreakdown['items'] = [];

  if (printer.process === 'digital') {
    const d = printer.digital;
    items.push({ label: 'Custo fixo por exemplar', value: d.fixedPerCopy * run });
    items.push({ label: `Páginas (${T} × R$ ${d.perPage.toFixed(3)})`, value: d.perPage * T * run });
  } else if (imp) {
    const o = printer.offset;
    const full = imp.pagesPerSheet;
    const fullSetup = o.setupByFraction['1'] ?? 0;
    const setup = plan.sizes.reduce((acc, size) => acc + (o.setupByFraction[String(size / full)] ?? fullSetup * (size / full)), 0);
    // Caderno fracionado imprime em tira-e-retira: meio caderno usa meia folha por exemplar.
    const sheetsPerCopy = plan.sizes.reduce((a, size) => a + size / full, 0);
    const sheets = sheetsPerCopy * run * (1 + o.waste);
    const price = sheetPrice(imp.sheet, printer.paper.grammage, printer.paper.pricePerKg);
    items.push({ label: `Chapas e acerto (${plan.sizes.length} cadernos)`, value: setup });
    items.push({ label: `Papel (${Math.ceil(sheets).toLocaleString('pt-BR')} folhas ${sheetLabel(imp.sheet)})`, value: sheets * price });
    items.push({ label: 'Impressão (rodagem)', value: (sheets / 1000) * o.runPerThousandSheets });
    items.push({ label: 'Encadernação', value: o.bindingPerCopy * run });
    items.push({ label: 'Capa', value: o.coverPerCopy * run });
  }

  const total = items.reduce((a, i) => a + i.value, 0);
  return {
    total: round2(total),
    perCopy: run > 0 ? round2(total / run) : 0,
    items: items.map((i) => ({ ...i, value: round2(i.value) })),
  };
}

/** Largura da lombada em mm. Use o valor da gráfica para a arte final. */
export function spineWidth(totalPages: number, mmPerPage: number): number {
  return Math.round(totalPages * mmPerPage * 10) / 10;
}
