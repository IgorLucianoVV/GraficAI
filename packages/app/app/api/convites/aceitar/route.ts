import { NextResponse } from 'next/server';
import { acceptInvite } from '@graficai/server';
import { body, route, WS_COOKIE } from '@/lib/server';

export const POST = route(async ({ req, db, user }) => {
  const b = await body<{ token: string }>(req);
  const r = await acceptInvite(db, user, String(b.token ?? ''));
  const res = NextResponse.json(r);
  res.cookies.set(WS_COOKIE, r.workspaceId, { path: '/', sameSite: 'lax', maxAge: 365 * 86400 });
  return res;
});
