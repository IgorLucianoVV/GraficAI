import { createProject, listProjects, type ProjectData } from '@graficai/server';
import { body, route } from '@/lib/server';

export const GET = route<{ id: string }>(async ({ db, user, params }) => listProjects(db, user, params.id));
export const POST = route<{ id: string }>(async ({ req, db, user, params }) => {
  const b = await body<{ title?: string; data: ProjectData }>(req);
  return createProject(db, user, params.id, b);
});
