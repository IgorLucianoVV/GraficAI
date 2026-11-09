import { deleteLibraryItem, updateLibraryItem, badRequest } from '@graficai/server';
import { body, route } from '@/lib/server';

type P = { kind: string; id: string };
const kindOf = (k: string) => {
  if (k !== 'grafica' && k !== 'modelo') throw badRequest('Tipo inválido.');
  return k;
};

export const PATCH = route<P>(async ({ req, db, user, params }) => {
  const b = await body<{ name?: string; data?: unknown }>(req);
  await updateLibraryItem(db, user, kindOf(params.kind), params.id, b);
});
export const DELETE = route<P>(async ({ db, user, params }) => deleteLibraryItem(db, user, kindOf(params.kind), params.id));
