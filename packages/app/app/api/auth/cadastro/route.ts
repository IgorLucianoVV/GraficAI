import { NextResponse } from 'next/server';
import { signUp } from '@graficai/server';
import { body, route, setSessionCookie } from '@/lib/server';

export const POST = route(
  async ({ req, db }) => {
    const b = await body<{ email: string; password: string; name: string }>(req);
    const { user, token } = await signUp(db, { email: String(b.email ?? ''), password: String(b.password ?? ''), name: String(b.name ?? '') });
    return setSessionCookie(NextResponse.json({ user }), token);
  },
  { auth: false },
);
