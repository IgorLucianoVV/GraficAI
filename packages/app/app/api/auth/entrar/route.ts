import { NextResponse } from 'next/server';
import { mergeGuestInto, signIn } from '@graficai/server';
import { body, route, setSessionCookie } from '@/lib/server';

/** Entrar. Se havia um visitante nesta sessão, os projetos dele vão para a conta. */
export const POST = route(
  async ({ req, db, user: current }) => {
    const b = await body<{ email: string; password: string }>(req);
    const { user, token } = await signIn(db, { email: String(b.email ?? ''), password: String(b.password ?? '') });
    const moved = current?.guest ? await mergeGuestInto(db, current.id, user.id) : 0;
    return setSessionCookie(NextResponse.json({ user, moved }), token);
  },
  { auth: false },
);
