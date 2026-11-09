import { createPrinter, createTemplate, listLibrary, badRequest } from '@graficai/server';
import type { DesignSpec, PrinterProfile } from '@graficai/core';
import { body, route } from '@/lib/server';

export const GET = route<{ id: string }>(async ({ db, user, params }) => listLibrary(db, user, params.id));
export const POST = route<{ id: string }>(async ({ req, db, user, params }) => {
  const b = await body<{ kind: 'grafica' | 'modelo'; name: string; data: unknown }>(req);
  if (b.kind === 'grafica') return createPrinter(db, user, params.id, b.name, b.data as PrinterProfile);
  if (b.kind === 'modelo') return createTemplate(db, user, params.id, b.name, b.data as DesignSpec);
  throw badRequest('Tipo inválido.');
});
