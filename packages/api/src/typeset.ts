import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeCompiler } from '@myriaddreamin/typst-ts-node-compiler';
import { diagnose, planSignatures, toTypst, type Book, type ProjectSettings, type TypesetOptions } from '@graficai/core';

const here = path.dirname(fileURLToPath(import.meta.url));
export const FONT_DIR = path.resolve(here, '../fonts');

let compiler: NodeCompiler | null = null;
/** Compilador único: carregar fontes custa mais que compilar. */
function getCompiler(): NodeCompiler {
  compiler ??= NodeCompiler.create({ workspace: here, fontArgs: [{ fontPaths: [FONT_DIR] }] });
  return compiler;
}

export class TypesetError extends Error {
  constructor(public diagnostics: string[]) {
    super(diagnostics[0] ?? 'Falha na composição');
  }
}

export interface ElementStart {
  id: string;
  page: number;
}

export interface TypesetResult {
  source: string;
  pdf: Buffer | null;
  pages: number;
  padding: number;
  starts: ElementStart[];
  warnings: string[];
}

function compile(source: string) {
  const c = getCompiler();
  const doc = c.compile({ mainFileContent: source });
  const read = (e: ReturnType<typeof doc.takeDiagnostics>) => ((e ? c.fetchDiagnostics(e) : []) ?? []) as { message: string }[];
  if (doc.hasError() || !doc.result) throw new TypesetError(read(doc.takeDiagnostics()).map((d) => d.message));
  const result = doc.result;
  return { c, result, warnings: read(doc.takeWarnings()).map((d) => d.message) };
}

/**
 * Compõe o livro. Com `padToSignatures`, compõe uma vez para saber as páginas
 * reais, calcula o plano de cadernos e recompõe com os brancos de fechamento.
 */
export function typeset(
  book: Book,
  settings: ProjectSettings,
  opts: Partial<Omit<TypesetOptions, 'padPages'>> & { padToSignatures?: boolean; pdf?: boolean } = {},
): TypesetResult {
  let source = toTypst(book, settings, opts);
  let { c, result, warnings } = compile(source);
  let pages = result.numOfPages as number;
  let padding = 0;

  if (opts.padToSignatures) {
    const diag = diagnose(book, settings);
    const sizes = diag.imposition?.signatureSizes ?? settings.printer.signatureSizes;
    padding = planSignatures(pages, sizes).paddingPages;
    if (padding > 0) {
      source = toTypst(book, settings, { ...opts, padPages: padding });
      ({ c, result, warnings } = compile(source));
      pages = result.numOfPages as number;
    }
  }

  const starts = (c.query(result, { selector: '<gx-el>' }) as { value: ElementStart }[]).map((m) => m.value);
  return { source, pdf: opts.pdf === false ? null : c.pdf(result), pages, padding, starts, warnings };
}
