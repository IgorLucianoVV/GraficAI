import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse, type NextRequest } from 'next/server';
import { getDb, HttpError, listWorkspaces, SESSION_COOKIE, SESSION_DAYS, unauthorized, userFromToken, type DB, type SessionUser } from '@graficai/server';

export const WS_COOKIE = 'gx_ws';

/** Usuário da sessão (componentes de servidor). */
export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return userFromToken(await getDb(), token);
}

export async function requireUser(next = '/projetos'): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect(`/entrar?proximo=${encodeURIComponent(next)}`);
  return u;
}

/** Equipes do usuário e a selecionada (cookie gx_ws, senão a pessoal). */
export async function workspaceContext(user: SessionUser) {
  const db = await getDb();
  const list = await listWorkspaces(db, user);
  const wanted = (await cookies()).get(WS_COOKIE)?.value;
  const current = list.find((w) => w.id === wanted) ?? list[0];
  return { list, current };
}

export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  });
  return res;
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
  return res;
}

/** Bloqueia POST/PUT/DELETE vindos de outro site (complementa o SameSite=Lax). */
function sameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

type Ctx<P> = { req: NextRequest; params: P; db: DB; user: SessionUser };

/**
 * Envelope das rotas: banco, usuário, checagem de origem e erros em JSON.
 * `auth: false` deixa a rota pública (user pode vir null).
 */
export function route<P extends Record<string, string> = Record<string, never>>(fn: (c: Ctx<P>) => Promise<unknown>, opts: { auth?: boolean } = {}) {
  return async (req: NextRequest, ctx: { params: Promise<P> }) => {
    try {
      if (req.method !== 'GET' && !sameOrigin(req)) throw new HttpError(403, 'Origem não permitida.');
      const db = await getDb();
      const user = await userFromToken(db, req.cookies.get(SESSION_COOKIE)?.value);
      if (opts.auth !== false && !user) throw unauthorized();
      const out = await fn({ req, params: (await ctx?.params) ?? ({} as P), db, user: user as SessionUser });
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message, ...e.extra }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: 'Erro inesperado no servidor.' }, { status: 500 });
    }
  };
}

export async function body<T>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'Corpo da requisição inválido.');
  }
}
