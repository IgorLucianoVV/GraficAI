import { createWorkspace, listWorkspaces } from '@graficai/server';
import { body, route } from '@/lib/server';

export const GET = route(async ({ db, user }) => listWorkspaces(db, user));
export const POST = route(async ({ req, db, user }) => {
  const b = await body<{ name: string }>(req);
  const ws = await createWorkspace(db, user, String(b.name ?? ''));
  return { id: ws.id };
});
