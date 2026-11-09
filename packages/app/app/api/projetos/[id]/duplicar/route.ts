import { duplicateProject } from '@graficai/server';
import { body, route } from '@/lib/server';

export const POST = route<{ id: string }>(async ({ req, db, user, params }) => {
  const b = await body<{ workspaceId?: string }>(req).catch(() => ({}) as { workspaceId?: string });
  return duplicateProject(db, user, params.id, b.workspaceId);
});
