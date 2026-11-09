import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { and, eq, gt } from 'drizzle-orm';
import type { DB } from './db/client.ts';
import { memberships, sessions, users, workspaces } from './db/schema.ts';
import { HttpError, badRequest } from './errors.ts';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

export const SESSION_COOKIE = 'gx_session';
export const SESSION_DAYS = 30;

/** Hash de senha com scrypt (Node nativo): scrypt$N$r$p$sal$hash. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const got = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function validate(email: string, password: string, name?: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest('Informe um e-mail válido.');
  if (password.length < 8) throw badRequest('A senha precisa ter pelo menos 8 caracteres.');
  if (password.length > 200) throw badRequest('Senha longa demais.');
  if (name !== undefined && !name.trim()) throw badRequest('Informe seu nome.');
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

/** Cria a conta, a equipe pessoal e já abre a sessão. */
export async function signUp(db: DB, input: { email: string; password: string; name: string }) {
  const email = normalizeEmail(input.email);
  validate(email, input.password, input.name);
  const exists = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (exists) throw new HttpError(409, 'Já existe uma conta com esse e-mail.');
  const passwordHash = await hashPassword(input.password);
  const user = await db.transaction(async (tx) => {
    const [u] = await tx.insert(users).values({ email, name: input.name.trim(), passwordHash }).returning();
    const [ws] = await tx.insert(workspaces).values({ name: `Projetos de ${u.name.split(' ')[0]}`, personal: true, createdBy: u.id }).returning();
    await tx.insert(memberships).values({ workspaceId: ws.id, userId: u.id, role: 'dono' });
    return u;
  });
  const token = await createSession(db, user.id);
  return { user: { id: user.id, email: user.email, name: user.name }, token };
}

// Limite simples de tentativas por e-mail (em memória, por instância).
const attempts = new Map<string, { n: number; until: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export async function signIn(db: DB, input: { email: string; password: string }) {
  const email = normalizeEmail(input.email);
  const a = attempts.get(email);
  if (a && a.until > Date.now() && a.n >= MAX_ATTEMPTS) throw new HttpError(429, 'Muitas tentativas. Tente de novo em alguns minutos.');
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  // Verifica mesmo sem usuário, para não revelar quais e-mails existem pelo tempo de resposta.
  const ok = await verifyPassword(input.password, user?.passwordHash ?? 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA');
  if (!user || !ok) {
    attempts.set(email, { n: (a && a.until > Date.now() ? a.n : 0) + 1, until: Date.now() + WINDOW_MS });
    throw new HttpError(401, 'E-mail ou senha incorretos.');
  }
  attempts.delete(email);
  const token = await createSession(db, user.id);
  return { user: { id: user.id, email: user.email, name: user.name }, token };
}

export async function createSession(db: DB, userId: string): Promise<string> {
  const token = newToken();
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt: new Date(Date.now() + SESSION_DAYS * 864e5) });
  return token;
}

/** Usuário da sessão; renova a validade quando passou da metade. */
export async function userFromToken(db: DB, token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  const id = sha256(token);
  const row = await db
    .select({ id: users.id, email: users.email, name: users.name, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const s = row[0];
  if (!s) return null;
  if (s.expiresAt.getTime() - Date.now() < (SESSION_DAYS / 2) * 864e5) {
    await db.update(sessions).set({ expiresAt: new Date(Date.now() + SESSION_DAYS * 864e5) }).where(eq(sessions.id, id));
  }
  return { id: s.id, email: s.email, name: s.name };
}

export async function signOut(db: DB, token: string | undefined | null) {
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
}

export async function changePassword(db: DB, user: SessionUser, current: string, next: string) {
  const row = await db.query.users.findFirst({ where: eq(users.id, user.id) });
  if (!row || !(await verifyPassword(current, row.passwordHash))) throw new HttpError(400, 'Senha atual incorreta.');
  validate(user.email, next);
  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, user.id));
  // Encerra as outras sessões.
  await db.delete(sessions).where(eq(sessions.userId, user.id));
  return createSession(db, user.id);
}
