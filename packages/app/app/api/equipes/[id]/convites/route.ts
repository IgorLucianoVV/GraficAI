import { createInvite, type Role } from '@graficai/server';
import { body, route } from '@/lib/server';

export const POST = route<{ id: string }>(async ({ req, db, user, params }) => {
  const b = await body<{ role: Role }>(req);
  const inv = await createInvite(db, user, params.id, b.role);
  const origin = req.headers.get('origin') ?? req.nextUrl.origin;
  return { ...inv, url: `${origin}/convite/${inv.token}` };
});
