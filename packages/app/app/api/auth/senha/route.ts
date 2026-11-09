import { NextResponse } from 'next/server';
import { changePassword } from '@graficai/server';
import { body, route, setSessionCookie } from '@/lib/server';

export const POST = route(async ({ req, db, user }) => {
  const b = await body<{ current: string; next: string }>(req);
  const token = await changePassword(db, user, String(b.current ?? ''), String(b.next ?? ''));
  return setSessionCookie(NextResponse.json({ ok: true }), token);
});
