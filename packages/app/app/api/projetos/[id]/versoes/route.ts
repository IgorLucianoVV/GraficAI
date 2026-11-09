import { createVersion, listVersions } from '@graficai/server';
import { body, route } from '@/lib/server';

export const GET = route<{ id: string }>(async ({ db, user, params }) => listVersions(db, user, params.id));
export const POST = route<{ id: string }>(async ({ req, db, user, params }) => {
  const b = await body<{ label: string }>(req);
  return createVersion(db, user, params.id, String(b.label ?? ''));
});
