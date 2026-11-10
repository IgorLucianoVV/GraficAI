import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { and, eq, gt, lt, sql } from 'drizzle-orm';
import type { DB } from './db/client.ts';
import { designTemplates, memberships, printerProfiles, projectVersions, projects, sessions, users, workspaces } from './db/schema.ts';
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
  /** Visitante: usa tudo, mas sem e-mail; pode virar conta normal sem perder nada. */
  guest?: boolean;
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
  const found = await db.query.users.findFirst({ where: eq(users.email, email) });
  const user = found && !found.guest ? found : undefined;
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
    .select({ id: users.id, email: users.email, name: users.name, guest: users.guest, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const s = row[0];
  if (!s) return null;
  if (s.expiresAt.getTime() - Date.now() < (SESSION_DAYS / 2) * 864e5) {
    await db.update(sessions).set({ expiresAt: new Date(Date.now() + SESSION_DAYS * 864e5) }).where(eq(sessions.id, id));
    await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, s.id));
  }
  return { id: s.id, email: s.email, name: s.name, guest: s.guest };
}

export async function signOut(db: DB, token: string | undefined | null) {
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
}

// ---------------------------------------------------------------------------
// Visitante

/** Hash impossível de bater: visitante não entra por senha. */
const NO_PASSWORD = '!visitante';

/** Cria um visitante com equipe pessoal e abre a sessão. */
export async function signInAsGuest(db: DB) {
  const tag = randomBytes(6).toString('hex');
  const user = await db.transaction(async (tx) => {
    const [u] = await tx.insert(users).values({ email: `visitante-${tag}@visitante.graficai`, name: 'Visitante', passwordHash: NO_PASSWORD, guest: true, lastSeenAt: new Date() }).returning();
    const [ws] = await tx.insert(workspaces).values({ name: 'Projetos do visitante', personal: true, createdBy: u.id }).returning();
    await tx.insert(memberships).values({ workspaceId: ws.id, userId: u.id, role: 'dono' });
    return u;
  });
  const token = await createSession(db, user.id);
  return { user: { id: user.id, email: user.email, name: user.name, guest: true }, token };
}

/** Visitante vira conta normal: mesmo usuário, projetos e sessão continuam. */
export async function upgradeGuest(db: DB, guest: SessionUser, input: { email: string; password: string; name: string }) {
  if (!guest.guest) throw badRequest('Você já tem uma conta.');
  const email = normalizeEmail(input.email);
  validate(email, input.password, input.name);
  const exists = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (exists) throw new HttpError(409, 'Já existe uma conta com esse e-mail. Entre nela: seus projetos de visitante vão junto.');
  const name = input.name.trim();
  await db.transaction(async (tx) => {
    await tx.update(users).set({ email, name, passwordHash: await hashPassword(input.password), guest: false }).where(eq(users.id, guest.id));
    await tx
      .update(workspaces)
      .set({ name: `Projetos de ${name.split(' ')[0]}` })
      .where(and(eq(workspaces.createdBy, guest.id), eq(workspaces.personal, true)));
  });
  return { id: guest.id, email, name, guest: false };
}

/**
 * Visitante entrou numa conta existente: os projetos, perfis e modelos da
 * equipe pessoal do visitante passam para a equipe pessoal da conta, e o
 * visitante é apagado.
 */
export async function mergeGuestInto(db: DB, guestId: string, userId: string) {
  if (guestId === userId) return 0;
  const guest = await db.query.users.findFirst({ where: eq(users.id, guestId) });
  if (!guest?.guest) return 0;
  const from = await db.query.workspaces.findFirst({ where: and(eq(workspaces.createdBy, guestId), eq(workspaces.personal, true)) });
  const to = await db.query.workspaces.findFirst({ where: and(eq(workspaces.createdBy, userId), eq(workspaces.personal, true)) });
  let moved = 0;
  await db.transaction(async (tx) => {
    if (from && to) {
      moved = (await tx.update(projects).set({ workspaceId: to.id }).where(eq(projects.workspaceId, from.id)).returning({ id: projects.id })).length;
      await tx.update(printerProfiles).set({ workspaceId: to.id }).where(eq(printerProfiles.workspaceId, from.id));
      await tx.update(designTemplates).set({ workspaceId: to.id }).where(eq(designTemplates.workspaceId, from.id));
      await tx.delete(workspaces).where(eq(workspaces.id, from.id));
    }
    // Autoria (created_by/updated_by) passa para a conta antes de apagar o visitante.
    await tx.update(projects).set({ createdBy: userId }).where(eq(projects.createdBy, guestId));
    await tx.update(projects).set({ updatedBy: userId }).where(eq(projects.updatedBy, guestId));
    await tx.update(projectVersions).set({ createdBy: userId }).where(eq(projectVersions.createdBy, guestId));
    await tx.delete(users).where(eq(users.id, guestId));
  });
  return moved;
}

/**
 * Apaga visitantes parados há mais de `days` dias (com tudo o que é só deles).
 * Rode periodicamente (cron da Vercel ou manual).
 */
export async function purgeGuests(db: DB, days = 30) {
  const limit = new Date(Date.now() - days * 864e5);
  const old = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.guest, true), lt(sql`coalesce(${users.lastSeenAt}, ${users.createdAt})`, limit)));
  for (const u of old) {
    await db.delete(workspaces).where(and(eq(workspaces.createdBy, u.id), eq(workspaces.personal, true)));
    await db.delete(users).where(eq(users.id, u.id));
  }
  return old.length;
}

/** Bloqueia ações que exigem conta com e-mail. */
export function requireAccount(user: SessionUser, what = 'fazer isso') {
  if (user.guest) throw new HttpError(403, `Crie sua conta para ${what}. Seus projetos de visitante continuam com você.`);
}

export async function changePassword(db: DB, user: SessionUser, current: string, next: string) {
  requireAccount(user, 'definir uma senha');
  const row = await db.query.users.findFirst({ where: eq(users.id, user.id) });
  if (!row || !(await verifyPassword(current, row.passwordHash))) throw new HttpError(400, 'Senha atual incorreta.');
  validate(user.email, next);
  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, user.id));
  // Encerra as outras sessões.
  await db.delete(sessions).where(eq(sessions.userId, user.id));
  return createSession(db, user.id);
}
