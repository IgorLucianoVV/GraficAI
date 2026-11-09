import { readManuscript, badRequest } from '@graficai/server';
import { route } from '@/lib/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** Upload do manuscrito → livro estruturado (o cliente cria o projeto em seguida). */
export const POST = route(async ({ req }) => {
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') throw badRequest('Envie um arquivo no campo "file".');
  const buf = Buffer.from(await file.arrayBuffer());
  return readManuscript(buf, file.name, { ai: req.nextUrl.searchParams.get('ai') !== '0' });
});
