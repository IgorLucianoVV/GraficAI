import type { Book, Diagnosis, Page, ProjectSettings } from './types.ts';
import { KIND_LABELS } from './rules.ts';
import { describePlan } from './signatures.ts';
import { PRESET_LABELS } from './opening.ts';

/**
 * Documentos de exportação como dados puros: o front só desenha. Assim o
 * conteúdo é testável e o mesmo modelo pode gerar PDF, DOCX ou IDML depois.
 */
export interface DocSection {
  title: string;
  kv?: [string, string][];
  table?: { head: string[]; rows: string[][]; widths?: number[] };
  bullets?: string[];
  paragraphs?: string[];
}

export interface ExportDoc {
  kind: 'grafica' | 'designer';
  title: string;
  subtitle: string;
  meta: [string, string][];
  sections: DocSection[];
  footnote: string;
  filename: string;
}

const n0 = (x: number) => x.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const n1 = (x: number) => x.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const n2 = (x: number) => x.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const brl = (x: number) => x.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const cm = (mm: number) => `${n1(mm / 10)} cm`;
const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'livro';
const dateBR = (d: Date) => d.toLocaleDateString('pt-BR');

const BLANK_LABEL: Record<NonNullable<Page['blankReason']>, string> = {
  abre_impar: 'abertura em página ímpar',
  verso_branco: 'verso em branco (convenção editorial)',
  fecho_caderno: 'fechamento do último caderno',
};

/** Faixas de páginas de cada caderno e os elementos que começam ou passam por ele. */
function signatureRows(book: Book, diag: Diagnosis): string[][] {
  const titles = new Map(book.elements.map((e) => [e.id, e.title]));
  let start = 1;
  return diag.plan.sizes.map((size, i) => {
    const end = start + size - 1;
    const pages = diag.layout.pages.slice(start - 1, end);
    const ids = [...new Set(pages.map((p) => p.elementId).filter(Boolean) as string[])];
    const blanks = pages.filter((p) => p.kind === 'branco').length;
    const row = [String(i + 1), `${size}`, `${start}–${end}`, [...new Set(ids.map((id) => titles.get(id)))].join('; ') || '—', blanks ? String(blanks) : '—'];
    start = end + 1;
    return row;
  });
}

/** Lista de brancos agrupada por motivo, com as páginas. */
function blankBullets(diag: Diagnosis): string[] {
  const by = new Map<string, number[]>();
  for (const p of diag.layout.pages) {
    if (p.kind !== 'branco' || !p.blankReason) continue;
    const k = BLANK_LABEL[p.blankReason];
    by.set(k, [...(by.get(k) ?? []), p.number]);
  }
  return [...by.entries()].map(([k, pages]) => `${k}: ${pages.length} ${pages.length === 1 ? 'página' : 'páginas'} (${pages.join(', ')})`);
}

function coverSize(settings: ProjectSettings, diag: Diagnosis) {
  const d = settings.design;
  const p = settings.production;
  const width = 2 * d.trimWidthMm + diag.spineMm + 2 * p.flapsMm;
  return { width, height: d.trimHeightMm, withBleedW: width + 2 * p.bleedMm, withBleedH: d.trimHeightMm + 2 * p.bleedMm };
}

/** Especificação técnica para pedir orçamento ou enviar à gráfica. */
export function printerSpecDoc(book: Book, settings: ProjectSettings, diag: Diagnosis, now = new Date()): ExportDoc {
  const d = settings.design;
  const p = settings.production;
  const pr = settings.printer;
  const cover = coverSize(settings, diag);
  const padding = diag.plan.paddingPages;

  const sections: DocSection[] = [
    {
      title: 'Produto',
      kv: [
        ['Título', book.title],
        ['Formato fechado', `${cm(d.trimWidthMm)} × ${cm(d.trimHeightMm)} (${n0(d.trimWidthMm)} × ${n0(d.trimHeightMm)} mm)`],
        ['Tiragem', `${n0(settings.run)} exemplares`],
        ['Processo', pr.process === 'offset' ? 'Offset' : 'Digital'],
        ['Acabamento', p.finishing],
      ],
    },
    {
      title: 'Miolo',
      kv: [
        ['Páginas', `${n0(diag.plan.totalPages)} (${n0(diag.layout.contentPages)} compostas + ${n0(padding)} de fechamento)`],
        ['Cadernos', `${describePlan(diag.plan)} = ${diag.plan.sizes.length} ${diag.plan.sizes.length === 1 ? 'caderno' : 'cadernos'}`],
        ['Papel', `${pr.paper.name}`],
        ['Cores', p.interiorColors],
      ],
    },
    {
      title: 'Capa',
      kv: [
        ['Especificação', p.cover],
        ['Lombada', `${n1(diag.spineMm)} mm (${pr.paper.name}, ${n2(pr.paper.mmPerPage)} mm por página)`],
        ['Orelhas', p.flapsMm > 0 ? `${n0(p.flapsMm)} mm cada` : 'sem orelhas'],
        ['Capa aberta', `${n1(cover.width)} × ${n0(cover.height)} mm`],
        ['Com sangria', `${n1(cover.withBleedW)} × ${n0(cover.withBleedH)} mm (sangria de ${n0(p.bleedMm)} mm)`],
      ],
    },
    {
      title: 'Plano de cadernos',
      table: { head: ['Caderno', 'Páginas', 'Faixa', 'Conteúdo', 'Brancos'], rows: signatureRows(book, diag), widths: [20, 18, 22, 0, 20] },
    },
  ];

  if (pr.process === 'offset' && diag.cost.items.length) {
    sections.push({
      title: 'Estimativa de referência',
      table: { head: ['Item', 'Valor'], rows: [...diag.cost.items.map((i) => [i.label, brl(i.value)]), ['Total', brl(diag.cost.total)], ['Por exemplar', brl(diag.cost.perCopy)]], widths: [0, 40] },
      paragraphs: ['Valores calculados com a tabela configurada no GraficAI, apenas para comparação. O orçamento vale o da gráfica.'],
    });
  } else if (diag.cost.items.length) {
    sections.push({ title: 'Estimativa de referência', kv: [['Total', brl(diag.cost.total)], ['Por exemplar', brl(diag.cost.perCopy)]] });
  }

  if (p.notes.trim()) sections.push({ title: 'Observações', paragraphs: [p.notes.trim()] });

  return {
    kind: 'grafica',
    title: 'Especificação para a gráfica',
    subtitle: book.title,
    meta: [['Data', dateBR(now)], ...(p.contact.trim() ? ([['Contato', p.contact.trim()]] as [string, string][]) : [])],
    sections,
    footnote: 'Gerado pelo GraficAI. Lombada e páginas estimadas a partir do texto; confirme após a composição final.',
    filename: `${slug(book.title)}-especificacao-grafica.pdf`,
  };
}

/** Brief do projeto gráfico para o designer finalizar. */
export function designerBriefDoc(book: Book, settings: ProjectSettings, diag: Diagnosis, now = new Date()): ExportDoc {
  const d = settings.design;
  const m = diag.layout.metrics;
  const o = d.chapterOpening;
  const laudas = new Map(diag.stats.byElement.map((e) => [e.id, e.laudas]));

  const capitular =
    o.dropCap.mode === 'nenhuma' ? 'Sem capitular' : `${o.dropCap.mode === 'rebaixada' ? 'Rebaixada' : 'Elevada'}, ${o.dropCap.lines} linhas, respiro de ${n1(o.dropCap.gapMm)} mm`;
  const versalete =
    o.leadIn.style === 'normal' ? 'Não' : o.leadIn.scope === 'linha' ? 'Primeira linha' : `${o.leadIn.words} primeiras ${o.leadIn.words === 1 ? 'palavra' : 'palavras'}`;
  const numeral = { nenhum: 'Sem numeral', arabico: 'Arábico (1, 2, 3)', romano: 'Romano (I, II, III)', extenso: 'Por extenso (Um, Dois)' }[o.number];
  const ornamento = { nenhum: 'Nenhum', fio: 'Fio', vinheta: 'Vinheta' }[o.ornament];
  const aplica = o.appliesTo.map((k) => KIND_LABELS[k]).join(', ');

  const structure = diag.layout.elements.map((e, i) => [
    String(i + 1),
    e.title,
    KIND_LABELS[e.kind],
    String(e.startPage),
    String(e.pages),
    laudas.has(e.id) ? n2(laudas.get(e.id)!) : '—',
  ]);

  const openings = diag.layout.elements
    .filter((e) => e.opening)
    .map((e) => {
      const op = e.opening!;
      const cap = op.cap ? `capitular “${op.hanging.trim()}${op.cap}”` : op.skipped === 'numero' ? 'sem capitular (algarismo)' : op.skipped === 'dialogo' ? 'sem capitular (diálogo)' : 'sem capitular';
      const extra = op.extraLines ? `, ${op.extraLines > 0 ? '+' : ''}${op.extraLines} ${Math.abs(op.extraLines) === 1 ? 'linha' : 'linhas'}` : '';
      return `${e.title} (p. ${e.startPage}): ${cap}${op.leadIn ? `, versalete em “${op.leadIn}”` : ''}${extra}${op.shortParagraph ? ' — parágrafo mais curto que a capitular' : ''}`;
    });

  const sections: DocSection[] = [
    {
      title: 'Formato e mancha',
      kv: [
        ['Formato', `${n0(d.trimWidthMm)} × ${n0(d.trimHeightMm)} mm`],
        ['Margens', `superior ${n1(d.marginTopMm)} · inferior ${n1(d.marginBottomMm)} · interna ${n1(d.marginInnerMm)} · externa ${n1(d.marginOuterMm)} mm`],
        ['Mancha', `${n1(m.textWidthMm)} × ${n1(m.textHeightMm)} mm`],
        ['Rendimento', `${n0(m.charsPerLine)} caracteres por linha × ${n0(m.linesPerPage)} linhas por página`],
      ],
    },
    {
      title: 'Tipografia',
      kv: [
        ['Corpo / entrelinha', `${n2(d.bodySizePt)} / ${n2(d.leadingPt)} pt (${n2(d.leadingPt / d.bodySizePt)}×)`],
        ['Espaço entre parágrafos', d.paragraphSpacingLines ? `${n2(d.paragraphSpacingLines)} linha` : 'Nenhum (só recuo)'],
        ['Largura média de referência', `${n2(d.avgCharWidthEm)} em (serifada de livro); ajuste se a fonte final for mais larga ou estreita`],
      ],
    },
    {
      title: 'Abertura de capítulo',
      kv: [
        ['Estilo', PRESET_LABELS[o.preset]],
        ['Página de abertura', d.chaptersOnOdd ? 'Sempre ímpar (direita)' : 'Qualquer página'],
        ['Afundamento', `${n0(d.chapterSink * 100)}% da altura da mancha`],
        ['Numeral', numeral],
        ['Ornamento', ornamento],
        ['Capitular', capitular],
        ['Versalete', versalete],
        ['Diálogo ou aspas no início', o.dialogue === 'pendurar' ? 'Pontuação pendurada, capitular na letra' : 'Sem capitular'],
        ['Algarismo no início', o.capOnDigits ? 'Capitular no algarismo' : 'Sem capitular'],
        ['Aplica-se a', aplica],
      ],
      bullets: openings.length ? openings : undefined,
    },
    {
      title: 'Estrutura e paginação',
      table: { head: ['#', 'Elemento', 'Tipo', 'Pág.', 'Págs.', 'Laudas'], rows: structure, widths: [8, 0, 30, 12, 12, 16] },
    },
    {
      title: 'Cadernos e páginas em branco',
      paragraphs: [`${n0(diag.plan.totalPages)} páginas em ${describePlan(diag.plan)}. Lombada estimada: ${n1(diag.spineMm)} mm (${settings.printer.paper.name}).`],
      table: { head: ['Caderno', 'Páginas', 'Faixa', 'Conteúdo', 'Brancos'], rows: signatureRows(book, diag), widths: [20, 18, 22, 0, 20] },
      bullets: blankBullets(diag),
    },
  ];

  const attention = diag.issues.map((i) => (i.suggestion ? `${i.message} ${i.suggestion}` : i.message));
  sections.push({ title: 'Pontos de atenção', bullets: attention.length ? attention : ['Nenhum problema encontrado no diagnóstico.'] });

  sections.push({
    title: 'Texto',
    kv: [
      ['Laudas', `${n2(diag.stats.laudas)} (${n0(settings.lauda.charsPerLauda)} caracteres com espaços por lauda)`],
      ['Caracteres com espaços', n0(diag.stats.charsWithSpaces)],
      ['Palavras', n0(diag.stats.words)],
    ],
  });

  return {
    kind: 'designer',
    title: 'Brief de projeto gráfico',
    subtitle: book.title,
    meta: [['Data', dateBR(now)], ['Páginas', n0(diag.plan.totalPages)], ['Cadernos', describePlan(diag.plan)]],
    sections,
    footnote: 'Gerado pelo GraficAI. A paginação é uma estimativa a partir do texto; use-a como meta e confirme na composição.',
    filename: `${slug(book.title)}-brief-designer.pdf`,
  };
}
