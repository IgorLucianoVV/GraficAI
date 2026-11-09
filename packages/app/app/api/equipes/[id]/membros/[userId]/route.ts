import { removeMember, setMemberRole, type Role } from '@graficai/server';
import { body, route } from '@/lib/server';

export const PATCH = route<{ id: string; userId: string }>(async ({ req, db, user, params }) => {
  const b = await body<{ role: Role }>(req);
  await setMemberRole(db, user, params.id, params.userId, b.role);
});
export const DELETE = route<{ id: string; userId: string }>(async ({ db, user, params }) => removeMember(db, user, params.id, params.userId));
