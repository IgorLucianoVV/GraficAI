import { NextResponse } from 'next/server';
import { SESSION_COOKIE, signOut } from '@graficai/server';
import { clearSessionCookie, route } from '@/lib/server';

export const POST = route(
  async ({ req, db }) => {
    await signOut(db, req.cookies.get(SESSION_COOKIE)?.value);
    return clearSessionCookie(NextResponse.json({ ok: true }));
  },
  { auth: false },
);
