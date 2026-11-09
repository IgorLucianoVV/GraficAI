import { deleteWorkspace, renameWorkspace, workspaceDetail } from '@graficai/server';
import { body, route } from '@/lib/server';

export const GET = route<{ id: string }>(async ({ db, user, params }) => workspaceDetail(db, user, params.id));
export const PATCH = route<{ id: string }>(async ({ req, db, user, params }) => {
  const b = await body<{ name: string }>(req);
  await renameWorkspace(db, user, params.id, String(b.name ?? ''));
});
export const DELETE = route<{ id: string }>(async ({ db, user, params }) => deleteWorkspace(db, user, params.id));
