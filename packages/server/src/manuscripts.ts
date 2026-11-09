import path from 'node:path';
import { canonicalOrder, classifyBlocks, ELEMENT_RULES, ensureFrontMatter, type Book } from '@graficai/core';
import { ingestDocx, ingestMarkdown, ingestText } from './ingest.ts';
import { llmAvailable, refineWithLLM } from './llm.ts';
import { HttpError } from './errors.ts';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Arquivo → livro estruturado (regras, refinamento opcional com Claude, ordem canônica). */
export async function readManuscript(buffer: Buffer, filename: string, opts: { ai?: boolean } = {}): Promise<{ book: Book; warnings: string[]; llmUsed: boolean }> {
  if (buffer.length > MAX_UPLOAD_BYTES) throw new HttpError(413, 'Arquivo maior que 25 MB.');
  const ext = path.extname(filename).toLowerCase();
  let ingest;
  if (ext === '.docx') ingest = await ingestDocx(buffer, filename);
  else if (ext === '.md' || ext === '.markdown') ingest = ingestMarkdown(buffer.toString('utf8'), filename);
  else if (ext === '.txt') ingest = ingestText(buffer.toString('utf8'), filename);
  else throw new HttpError(415, `Formato ${ext || 'desconhecido'} ainda não suportado. Use .docx, .md ou .txt.`);
  if (!ingest.blocks.length) throw new HttpError(422, 'Não encontrei texto no arquivo.');

  let book = classifyBlocks(ingest.blocks, ingest.title);
  let llmUsed = false;
  const warnings = [...ingest.warnings];
  if (llmAvailable() && opts.ai !== false) {
    try {
      book = (await refineWithLLM(book)).book;
      llmUsed = true;
    } catch (e) {
      warnings.push(`IA indisponível, usando só regras (${(e as Error).message.slice(0, 120)}).`);
    }
  }
  book = canonicalOrder(ensureFrontMatter(book), (k) => ELEMENT_RULES[k].group);
  return { book: { ...book, source: ext === '.docx' ? 'docx' : 'texto' }, warnings, llmUsed };
}
