// Modelo de dados central do GraficAI.
// Regra de ouro: tudo aqui é determinístico e testável. O LLM só produz
// rótulos de estrutura (ElementKind); números saem destes motores.

export type ElementKind =
  | 'falsa_folha_rosto'
  | 'folha_rosto'
  | 'ficha'
  | 'dedicatoria'
  | 'agradecimentos'
  | 'epigrafe'
  | 'sumario'
  | 'prefacio'
  | 'apresentacao'
  | 'introducao'
  | 'capitulo'
  | 'conclusao'
  | 'posfacio'
  | 'referencias'
  | 'glossario'
  | 'anexo'
  | 'indice'
  | 'sobre_autor'
  | 'colofao';

export type ElementGroup = 'pre' | 'texto' | 'pos';

export type BlockType = 'titulo' | 'subtitulo' | 'paragrafo' | 'citacao' | 'lista' | 'nota' | 'imagem' | 'tabela';

/** Trecho de texto com estilo. `noteRef` marca a chamada de nota (texto vazio). */
export interface Run {
  text: string;
  italic?: boolean;
  bold?: boolean;
  smallcaps?: boolean;
  sup?: boolean;
  sub?: boolean;
  noteRef?: string;
}

export interface Block {
  type: BlockType;
  /** Texto puro (contagem de laudas e castoff). Igual à concatenação de `runs`. */
  text: string;
  /** Formatação dentro do bloco. Ausente = texto sem estilo. */
  runs?: Run[];
  /** Blocos 'nota': identificador referenciado por `Run.noteRef`. */
  noteId?: string;
}

export type Confidence = 'alta' | 'media' | 'baixa';

export interface BookElement {
  id: string;
  kind: ElementKind;
  title: string;
  blocks: Block[];
  confidence: Confidence;
  classifiedBy: 'regra' | 'llm' | 'usuario';
  /** Motivo da classificação, mostrado no "Por quê?". */
  rationale: string;
}

export interface Book {
  title: string;
  elements: BookElement[];
  source: 'exemplo' | 'docx' | 'texto';
}

/** Regras editoriais por tipo de elemento (padrões configuráveis, NBR 6029 + convenção). */
export interface ElementRule {
  opensOn: 'impar' | 'qualquer';
  blankVerso: boolean;
  /** Elementos de página fixa (dedicatória, epígrafe…) ocupam exatamente N páginas. */
  fixedPages?: number;
  group: ElementGroup;
}

export interface DesignSpec {
  trimWidthMm: number;
  trimHeightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  marginInnerMm: number;
  marginOuterMm: number;
  bodySizePt: number;
  leadingPt: number;
  /** Espaço entre parágrafos, em linhas (0 = só recuo). */
  paragraphSpacingLines: number;
  /** Largura média do caractere em em (depende da fonte; Garamond ~0,45). */
  avgCharWidthEm: number;
  /** Fração da página de abertura de capítulo ocupada pelo "afundamento". */
  chapterSink: number;
  chaptersOnOdd: boolean;
  /** Tratamento tipográfico da abertura (capitular, versalete, ornamento, numeral). */
  chapterOpening: ChapterOpening;
}

export type OpeningPreset = 'classica' | 'moderna' | 'sobria' | 'personalizada';

export interface ChapterOpening {
  preset: OpeningPreset;
  dropCap: {
    mode: 'nenhuma' | 'rebaixada' | 'elevada';
    /** Altura em linhas de texto (2–4). */
    lines: number;
    /** Respiro entre a capitular e o texto, em mm. */
    gapMm: number;
  };
  leadIn: {
    style: 'normal' | 'versalete';
    scope: 'linha' | 'palavras';
    /** Quantas palavras em versalete quando scope = 'palavras'. */
    words: number;
  };
  ornament: 'nenhum' | 'vinheta' | 'fio';
  number: 'nenhum' | 'arabico' | 'romano' | 'extenso';
  /** Diálogo/aspas no início: pendura a pontuação e capitula a letra, ou não usa capitular. */
  dialogue: 'pendurar' | 'sem_capitular';
  /** Parágrafo que começa com algarismo recebe capitular? */
  capOnDigits: boolean;
  appliesTo: ElementKind[];
}

/** Resultado da análise de abertura de um elemento. */
export interface OpeningResult {
  /** Letra capitulada (null = sem capitular). */
  cap: string | null;
  /** Pontuação pendurada antes da capitular (travessão, aspas). */
  hanging: string;
  /** Palavras em versalete após a capitular. */
  leadIn: string;
  /** Linhas acrescentadas ao elemento por conta da abertura. */
  extraLines: number;
  /** Índice do bloco que recebe a capitular. */
  blockIndex: number;
  /** Motivo quando a capitular não é aplicada. */
  skipped?: 'sem_paragrafo' | 'numero' | 'dialogo';
  /** Parágrafo mais curto que a altura da capitular. */
  shortParagraph: boolean;
}

export interface LaudaConfig {
  charsPerLauda: number;
  includeNotes: boolean;
  rounding: 'nenhum' | 'cima' | 'meia';
}

export interface PaperProfile {
  name: string;
  grammage: number;
  /** Espessura de uma página (meia folha) em mm. */
  mmPerPage: number;
  /** Preço do papel em R$/kg (o preço da folha sai da área × gramatura). */
  pricePerKg: number;
}

/** Folha de impressão (formato de máquina), em mm. */
export interface SheetFormat {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
}

export interface OffsetCost {
  /**
   * Chapas + acerto por caderno, indexado pela fração da folha que o caderno
   * ocupa (1 = folha inteira, 0.5 = meia, 0.25 = quarto). Independe do formato.
   */
  setupByFraction: Record<string, number>;
  /** Formatos de folha que a gráfica imprime. */
  sheets: SheetFormat[];
  /** Folha escolhida ('auto' = a mais barata para este livro). */
  sheetChoice: string;
  /** Maior caderno que a dobradeira faz (páginas). */
  maxFolding: number;
  /** Menor caderno aceito (páginas). */
  minSignature: number;
  /** Pinça (borda de pega da máquina), em mm. */
  gripperMm: number;
  /** Margem livre nas outras bordas da folha, em mm. */
  sheetMarginMm: number;
  /** Acréscimo por página para refile e sangria, em mm (em cada dimensão). */
  pageAllowanceMm: number;
  /** Custo de rodagem por 1.000 folhas impressas (frente e verso). */
  runPerThousandSheets: number;
  /** Perda de papel em acerto e refile (fração). */
  waste: number;
  bindingPerCopy: number;
  coverPerCopy: number;
}

/** Como as páginas do livro se distribuem na folha de impressão. */
export interface Imposition {
  sheet: SheetFormat;
  /** Páginas que cabem fisicamente por lado. */
  fit: number;
  /** Páginas usadas por lado (potência de 2 para a dobra, limitada pela dobradeira). */
  pagesPerSide: number;
  /** Páginas por folha (frente e verso) = maior caderno. */
  pagesPerSheet: number;
  cols: number;
  rows: number;
  /** Área de página impressa sobre a área da folha (0–1). */
  efficiency: number;
  /** Tamanhos de caderno possíveis neste formato, do maior para o menor. */
  signatureSizes: number[];
}

export interface SheetOption {
  sheet: SheetFormat;
  imposition: Imposition | null;
  total: number | null;
  totalPages: number | null;
}

export interface DigitalCost {
  fixedPerCopy: number;
  perPage: number;
}

export interface PrinterProfile {
  id: string;
  name: string;
  process: 'offset' | 'digital';
  /** Digital: tamanhos aceitos. Offset: derivados da imposição (ver `impose`). */
  signatureSizes: number[];
  offset: OffsetCost;
  digital: DigitalCost;
  paper: PaperProfile;
}

export interface ProjectSettings {
  design: DesignSpec;
  lauda: LaudaConfig;
  printer: PrinterProfile;
  run: number;
  /** Especificações de produção que não afetam o cálculo, só a exportação. */
  production: ProductionSpec;
}

export interface ProductionSpec {
  interiorColors: string;
  cover: string;
  finishing: string;
  /** Largura de cada orelha da capa, em mm (0 = sem orelha). */
  flapsMm: number;
  bleedMm: number;
  notes: string;
  contact: string;
}

// ---------- Resultados ----------

export interface TextStats {
  words: number;
  charsWithSpaces: number;
  charsWithoutSpaces: number;
  paragraphs: number;
  laudasRaw: number;
  laudas: number;
  byElement: { id: string; title: string; charsWithSpaces: number; laudas: number }[];
}

export interface PageMetrics {
  textWidthMm: number;
  textHeightMm: number;
  charsPerLine: number;
  linesPerPage: number;
  charsPerPage: number;
}

export type BlankReason = 'abre_impar' | 'verso_branco' | 'fecho_caderno';

export interface Page {
  number: number;
  elementId: string | null;
  kind: 'conteudo' | 'branco';
  blankReason?: BlankReason;
  /** Ocupação da página (0–1). Só faz sentido para conteúdo. */
  fill: number;
  isOpener: boolean;
  signatureIndex: number;
}

export interface ElementLayout {
  id: string;
  title: string;
  kind: ElementKind;
  startPage: number;
  pages: number;
  lines: number;
  lastPageLines: number;
  opening?: OpeningResult;
}

export interface SignaturePlan {
  sizes: number[];
  totalPages: number;
  contentPages: number;
  paddingPages: number;
}

export type IssueKind = 'pagina_curta' | 'linhas_viuvas' | 'fecho_caderno' | 'caderno_fracionado' | 'baixa_confianca' | 'abertura' | 'aproveitamento' | 'formato_nao_cabe';

export interface Issue {
  kind: IssueKind;
  severity: 'info' | 'alerta' | 'erro';
  page?: number;
  elementId?: string;
  message: string;
  suggestion?: string;
}

export interface CostBreakdown {
  total: number;
  perCopy: number;
  items: { label: string; value: number }[];
}

export interface Layout {
  pages: Page[];
  elements: ElementLayout[];
  metrics: PageMetrics;
  contentPages: number;
  blankPages: number;
}

export interface Diagnosis {
  stats: TextStats;
  layout: Layout;
  plan: SignaturePlan;
  cost: CostBreakdown;
  spineMm: number;
  /** Offset: folha usada e aproveitamento; null no digital. */
  imposition: Imposition | null;
  /** Offset: comparação entre as folhas da gráfica. */
  sheetOptions: SheetOption[];
  issues: Issue[];
  /** Quanto falta ou sobra para o fechamento sem páginas extras. */
  evenWorking: { pagesToCut: number; lowerTotal: number; pagesToFill: number; upperTotal: number };
}

export interface Variant {
  id: 'A' | 'B' | 'C';
  label: string;
  description: string;
  design: DesignSpec;
  diagnosis: Diagnosis;
  /** Desvio tipográfico em relação ao projeto base (0 = igual). */
  deviation: number;
  changes: string[];
}
