import { NextResponse } from 'next/server';
import { signUp, upgradeGuest } from '@graficai/server';
import { body, route, setSessionCookie } from '@/lib/server';

/** Cadastro. Se quem pede é visitante, a conta dele vira conta normal (projetos continuam). */
export const POST = route(
  async ({ req, db, user }) => {
    const b = await body<{ email: string; password: string; name: string }>(req);
    const input = { email: String(b.email ?? ''), password: String(b.password ?? ''), name: String(b.name ?? '') };
    if (user?.guest) return NextResponse.json({ user: await upgradeGuest(db, user, input), upgraded: true });
    const { user: created, token } = await signUp(db, input);
    return setSessionCookie(NextResponse.json({ user: created }), token);
  },
  { auth: false },
);
