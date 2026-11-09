import { listWorkspaces } from '@graficai/server';
import { route } from '@/lib/server';

export const GET = route(async ({ db, user }) => ({ user, workspaces: await listWorkspaces(db, user) }));
