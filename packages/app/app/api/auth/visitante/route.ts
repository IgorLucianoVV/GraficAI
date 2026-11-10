import { NextResponse } from 'next/server';
import { HttpError, signInAsGuest } from '@graficai/server';
import { route, setSessionCookie } from '@/lib/server';

// Limite simples por IP (por instância): evita criar visitantes em massa.
const hits = new Map<string, { n: number; until: number }>();
const MAX = 20;
const WINDOW = 60 * 60 * 1000;

export const POST = route(
  async ({ req, db }) => {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
    const h = hits.get(ip);
    const n = h && h.until > Date.now() ? h.n + 1 : 1;
    if (n > MAX) throw new HttpError(429, 'Muitos acessos de visitante. Tente de novo mais tarde ou crie uma conta.');
    hits.set(ip, { n, until: h && h.until > Date.now() ? h.until : Date.now() + WINDOW });
    const { user, token } = await signInAsGuest(db);
    return setSessionCookie(NextResponse.json({ user }), token);
  },
  { auth: false },
);
