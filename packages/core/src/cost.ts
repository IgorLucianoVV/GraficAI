import type { CostBreakdown, PrinterProfile, SignaturePlan } from './types.ts';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Custo por componente. Offset: custo fixo por caderno (chapas + acerto) + papel
 * + rodagem + acabamento. Digital: fixo por exemplar + valor por página.
 * Os valores vêm do perfil da gráfica — nada aqui é constante de mercado.
 */
export function estimateCost(plan: SignaturePlan, printer: PrinterProfile, run: number): CostBreakdown {
  const T = plan.totalPages;
  const items: CostBreakdown['items'] = [];

  if (printer.process === 'digital') {
    const d = printer.digital;
    items.push({ label: 'Custo fixo por exemplar', value: d.fixedPerCopy * run });
    items.push({ label: `Páginas (${T} × R$ ${d.perPage.toFixed(3)})`, value: d.perPage * T * run });
  } else {
    const o = printer.offset;
    const largest = Math.max(...printer.signatureSizes);
    const setup = plan.sizes.reduce((acc, s) => {
      const known = o.setupPerSignature[s];
      const fallback = (o.setupPerSignature[largest] ?? 0) * (s / largest);
      return acc + (known ?? fallback);
    }, 0);
    const sheetsPerCopy = T / o.pagesPerSheet;
    const sheets = sheetsPerCopy * run * (1 + o.waste);
    items.push({ label: `Chapas e acerto (${plan.sizes.length} cadernos)`, value: setup });
    items.push({ label: `Papel (${Math.ceil(sheets).toLocaleString('pt-BR')} folhas)`, value: sheets * o.sheetPrice });
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
