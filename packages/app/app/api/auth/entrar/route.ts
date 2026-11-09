import { NextResponse } from 'next/server';
import { signIn } from '@graficai/server';
import { body, route, setSessionCookie } from '@/lib/server';

export const POST = route(
  async ({ req, db }) => {
    const b = await body<{ email: string; password: string }>(req);
    const { user, token } = await signIn(db, { email: String(b.email ?? ''), password: String(b.password ?? '') });
    return setSessionCookie(NextResponse.json({ user }), token);
  },
  { auth: false },
);
