import { getProject, typeset, TypesetError, HttpError, type ProjectData } from '@graficai/server';
import type { ProductionSpec, TypesetOptions } from '@graficai/core';
import { body, route } from '@/lib/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Composição Typst do projeto salvo. O livro vem do banco (sem reenviar), e o
 * PDF sai em streaming, o que evita o limite de 4,5 MB de resposta na Vercel.
 */
export const POST = route<{ id: string }>(async ({ req, db, user, params }) => {
  const b = await body<{ options?: Partial<TypesetOptions> & { padToSignatures?: boolean; production?: ProductionSpec }; format?: 'pdf' | 'typ' | 'json' }>(req);
  const p = await getProject(db, user, params.id);
  const data: ProjectData = p.data;
  const o = b.options ?? {};
  const settings = o.production ? { ...data.settings, production: o.production } : data.settings;
  const format = b.format ?? 'pdf';
  try {
    const r = typeset(data.book, settings, { trimMarks: o.trimMarks, padToSignatures: !!o.padToSignatures, pdf: format === 'pdf' });
    if (format === 'json') return { pages: r.pages, padding: r.padding, starts: r.starts, warnings: r.warnings };
    const headers = { 'X-GraficAI-Pages': String(r.pages), 'X-GraficAI-Padding': String(r.padding), 'Cache-Control': 'no-store' };
    if (format === 'typ') return new Response(r.source, { headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } });
    const pdf = r.pdf!;
    const stream = new ReadableStream({
      start(controller) {
        const CHUNK = 256 * 1024;
        for (let i = 0; i < pdf.length; i += CHUNK) controller.enqueue(new Uint8Array(pdf.subarray(i, i + CHUNK)));
        controller.close();
      },
    });
    return new Response(stream, { headers: { ...headers, 'Content-Type': 'application/pdf' } });
  } catch (e) {
    if (e instanceof TypesetError) throw new HttpError(422, 'A composição falhou.', { diagnostics: e.diagnostics.slice(0, 10) });
    throw e;
  }
});
