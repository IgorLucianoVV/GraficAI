import type { Block, BookElement, Run } from './types.ts';

type Marks = Omit<Run, 'text' | 'noteRef'>;
const MARKS: (keyof Marks)[] = ['italic', 'bold', 'smallcaps', 'sup', 'sub'];

const sameMarks = (a: Run, b: Run) => MARKS.every((k) => !!a[k] === !!b[k]);
const hasMarks = (r: Run) => MARKS.some((k) => r[k]);

/**
 * Normaliza trechos: colapsa espaços (também entre trechos), apara as pontas,
 * junta vizinhos de mesmo estilo e remove marcas falsas (false/undefined).
 */
export function normalizeRuns(input: Run[]): Run[] {
  const out: Run[] = [];
  let prevSpace = true; // apara o início
  for (const r of input) {
    if (r.noteRef) {
      out.push({ text: '', noteRef: r.noteRef });
      continue;
    }
    let text = r.text.replace(/\s+/g, ' ');
    if (prevSpace) text = text.replace(/^ /, '');
    if (!text) continue;
    prevSpace = text.endsWith(' ');
    const run: Run = { text };
    for (const k of MARKS) if (r[k]) run[k] = true;
    const last = out[out.length - 1];
    if (last && !last.noteRef && sameMarks(last, run)) last.text += text;
    else out.push(run);
  }
  // Apara o fim e descarta espaço solto que sobrar no último trecho com texto.
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].noteRef) continue;
    out[i].text = out[i].text.replace(/ $/, '');
    if (!out[i].text) {
      out.splice(i, 1);
      continue;
    }
    break;
  }
  // Espaço antes de chamada de nota não faz sentido tipográfico.
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1];
    if (out[i].noteRef && !prev.noteRef) prev.text = prev.text.replace(/ $/, '');
  }
  return out.filter((r) => r.noteRef || r.text);
}

export const runsToText = (runs: Run[]) => runs.map((r) => r.text).join('');

/** Trechos de um bloco (texto puro vira um trecho sem estilo). */
export const blockRuns = (b: Block): Run[] => (b.runs?.length ? b.runs : [{ text: b.text }]);

/** Só guarda `runs` quando há estilo ou nota — mantém o modelo enxuto. */
export function compactRuns(runs: Run[]): Run[] | undefined {
  return runs.some((r) => r.noteRef || hasMarks(r)) ? runs : undefined;
}

/**
 * Markdown em linha: *itálico* / _itálico_, **negrito**, ***ambos***,
 * `^sobrescrito^`, `~subscrito~` e chamadas de nota [^id].
 */
export function parseInlineMarkdown(src: string): Run[] {
  const runs: Run[] = [];
  const re = /(\*\*\*|\*\*|\*|_|\^|~)|\[\^([^\]\s]+)\]/g;
  const stack: string[] = [];
  let last = 0;
  const marks = (): Marks => ({
    bold: stack.includes('**') || stack.includes('***') || undefined,
    italic: stack.includes('*') || stack.includes('_') || stack.includes('***') || undefined,
    sup: stack.includes('^') || undefined,
    sub: stack.includes('~') || undefined,
  });
  const push = (text: string) => text && runs.push({ text, ...marks() });

  for (let m = re.exec(src); m; m = re.exec(src)) {
    const before = src.slice(last, m.index);
    last = re.lastIndex;
    if (m[2]) {
      push(before);
      runs.push({ text: '', noteRef: m[2] });
      continue;
    }
    const tok = m[1];
    // `_` dentro de palavra (snake_case) é literal.
    if (tok === '_' && /\w/.test(src[m.index - 1] ?? '') && /\w/.test(src[re.lastIndex] ?? '')) {
      push(before + tok);
      continue;
    }
    push(before);
    const at = stack.lastIndexOf(tok);
    if (at >= 0) stack.splice(at, 1);
    else if (src.indexOf(tok, re.lastIndex) >= 0) stack.push(tok);
    else push(tok); // sem fechamento: literal
  }
  push(src.slice(last));
  return normalizeRuns(runs);
}

/**
 * Notas soltas no fim do documento (como o DOCX entrega) vão para o elemento
 * que as chama, logo após o bloco da chamada.
 */
export function attachNotes(elements: BookElement[]): BookElement[] {
  const notes = new Map<string, Block>();
  const els = elements.map((e) => ({
    ...e,
    blocks: e.blocks.filter((b) => {
      if (b.type === 'nota' && b.noteId) {
        notes.set(b.noteId, b);
        return false;
      }
      return true;
    }),
  }));
  if (!notes.size) return elements;

  const placed = new Set<string>();
  for (const e of els) {
    const out: Block[] = [];
    for (const b of e.blocks) {
      out.push(b);
      for (const r of b.runs ?? []) {
        if (r.noteRef && notes.has(r.noteRef) && !placed.has(r.noteRef)) {
          out.push(notes.get(r.noteRef)!);
          placed.add(r.noteRef);
        }
      }
    }
    e.blocks = out;
  }
  // Notas sem chamada voltam para onde estavam.
  return els.map((e, i) => {
    const orphans = elements[i].blocks.filter((b) => b.type === 'nota' && b.noteId && !placed.has(b.noteId));
    return orphans.length ? { ...e, blocks: [...e.blocks, ...orphans] } : e;
  });
}

/** Contagem de estilos para a tela de revisão. */
export function inlineStats(el: BookElement): { italic: number; bold: number; notes: number } {
  let italic = 0;
  let bold = 0;
  let notes = 0;
  for (const b of el.blocks) {
    if (b.type === 'nota') notes++;
    for (const r of b.runs ?? []) {
      if (r.italic) italic++;
      if (r.bold) bold++;
    }
  }
  return { italic, bold, notes };
}
