import { revokeInvite } from '@graficai/server';
import { route } from '@/lib/server';

export const DELETE = route<{ id: string }>(async ({ db, user, params }) => revokeInvite(db, user, params.id));
