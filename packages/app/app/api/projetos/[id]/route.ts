import { deleteProject, getProject, renameProject, saveProject, type ProjectData } from '@graficai/server';
import { body, route } from '@/lib/server';

type P = { id: string };
export const GET = route<P>(async ({ db, user, params }) => getProject(db, user, params.id));
export const PUT = route<P>(async ({ req, db, user, params }) => {
  const b = await body<{ data: ProjectData; revision: number; title?: string }>(req);
  return saveProject(db, user, params.id, b);
});
export const PATCH = route<P>(async ({ req, db, user, params }) => {
  const b = await body<{ title: string }>(req);
  await renameProject(db, user, params.id, String(b.title ?? ''));
});
export const DELETE = route<P>(async ({ db, user, params }) => deleteProject(db, user, params.id));
