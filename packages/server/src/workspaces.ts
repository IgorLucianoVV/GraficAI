import { and, asc, eq, gt, isNull, sql } from 'drizzle-orm';
import type { DB } from './db/client.ts';
import { invites, memberships, users, workspaces, type Role } from './db/schema.ts';
import { HttpError, badRequest, forbidden, notFound } from './errors.ts';
import { newToken, requireAccount, sha256, type SessionUser } from './auth.ts';

export const ROLE_RANK: Record<Role, number> = { leitor: 0, editor: 1, dono: 2 };
export const ROLE_LABEL: Record<Role, string> = { dono: 'Dono', editor: 'Editor', leitor: 'Leitor' };
const ROLES = Object.keys(ROLE_RANK) as Role[];
const isRole = (r: unknown): r is Role => ROLES.includes(r as Role);

/** Papel do usuário na equipe, ou erro 404 (não revela a existência de equipes alheias). */
export async function requireRole(db: DB, user: SessionUser, workspaceId: string, min: Role): Promise<Role> {
  const m = await db.query.memberships.findFirst({ where: and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, user.id)) });
  if (!m) throw notFound('Equipe não encontrada.');
  if (ROLE_RANK[m.role] < ROLE_RANK[min]) throw forbidden(min === 'dono' ? 'Só o dono da equipe pode fazer isso.' : 'Seu papel nesta equipe é só de leitura.');
  return m.role;
}

export async function listWorkspaces(db: DB, user: SessionUser) {
  return db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      personal: workspaces.personal,
      role: memberships.role,
      members: sql<number>`(SELECT count(*)::int FROM memberships m2 WHERE m2.workspace_id = ${workspaces.id})`,
    })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(eq(memberships.userId, user.id))
    .orderBy(sql`${workspaces.personal} DESC`, asc(workspaces.name));
}

export async function createWorkspace(db: DB, user: SessionUser, name: string) {
  requireAccount(user, 'criar equipes');
  const n = name.trim();
  if (!n || n.length > 80) throw badRequest('Dê um nome de até 80 caracteres para a equipe.');
  return db.transaction(async (tx) => {
    const [ws] = await tx.insert(workspaces).values({ name: n, createdBy: user.id }).returning();
    await tx.insert(memberships).values({ workspaceId: ws.id, userId: user.id, role: 'dono' });
    return ws;
  });
}

export async function renameWorkspace(db: DB, user: SessionUser, id: string, name: string) {
  await requireRole(db, user, id, 'dono');
  const n = name.trim();
  if (!n || n.length > 80) throw badRequest('Dê um nome de até 80 caracteres para a equipe.');
  await db.update(workspaces).set({ name: n }).where(eq(workspaces.id, id));
}

export async function workspaceDetail(db: DB, user: SessionUser, id: string) {
  const role = await requireRole(db, user, id, 'leitor');
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, id) });
  if (!ws) throw notFound();
  const members = await db
    .select({ userId: users.id, name: users.name, email: users.email, role: memberships.role, since: memberships.createdAt })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.workspaceId, id))
    .orderBy(asc(users.name));
  const pending =
    role === 'dono'
      ? await db
          .select({ id: invites.id, role: invites.role, expiresAt: invites.expiresAt, createdAt: invites.createdAt })
          .from(invites)
          .where(and(eq(invites.workspaceId, id), isNull(invites.acceptedAt), gt(invites.expiresAt, new Date())))
      : [];
  return { workspace: ws, role, members, invites: pending };
}

/** Convite por link (sem e-mail): o token só aparece uma vez, na criação. */
export async function createInvite(db: DB, user: SessionUser, workspaceId: string, role: Role, days = 7) {
  requireAccount(user, 'convidar pessoas');
  await requireRole(db, user, workspaceId, 'dono');
  if (!isRole(role)) throw badRequest('Papel inválido.');
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) });
  if (ws?.personal) throw badRequest('A equipe pessoal não aceita convidados. Crie uma equipe para trabalhar junto.');
  const token = newToken();
  const [inv] = await db
    .insert(invites)
    .values({ workspaceId, role, tokenHash: sha256(token), createdBy: user.id, expiresAt: new Date(Date.now() + days * 864e5) })
    .returning();
  return { id: inv.id, token, role, expiresAt: inv.expiresAt };
}

export async function revokeInvite(db: DB, user: SessionUser, inviteId: string) {
  const inv = await db.query.invites.findFirst({ where: eq(invites.id, inviteId) });
  if (!inv) throw notFound('Convite não encontrado.');
  await requireRole(db, user, inv.workspaceId, 'dono');
  await db.delete(invites).where(eq(invites.id, inviteId));
}

/** Dados públicos do convite (para a tela de aceite). */
export async function inviteInfo(db: DB, token: string) {
  const inv = await db.query.invites.findFirst({ where: eq(invites.tokenHash, sha256(token)) });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) throw notFound('Convite inválido ou expirado.');
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, inv.workspaceId) });
  return { workspaceId: inv.workspaceId, workspaceName: ws?.name ?? '', role: inv.role };
}

export async function acceptInvite(db: DB, user: SessionUser, token: string) {
  requireAccount(user, 'entrar numa equipe');
  const inv = await db.query.invites.findFirst({ where: eq(invites.tokenHash, sha256(token)) });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) throw notFound('Convite inválido ou expirado.');
  const existing = await db.query.memberships.findFirst({ where: and(eq(memberships.workspaceId, inv.workspaceId), eq(memberships.userId, user.id)) });
  await db.transaction(async (tx) => {
    if (!existing) await tx.insert(memberships).values({ workspaceId: inv.workspaceId, userId: user.id, role: inv.role });
    else if (ROLE_RANK[inv.role] > ROLE_RANK[existing.role])
      await tx.update(memberships).set({ role: inv.role }).where(and(eq(memberships.workspaceId, inv.workspaceId), eq(memberships.userId, user.id)));
    await tx.update(invites).set({ acceptedAt: new Date(), acceptedBy: user.id }).where(eq(invites.id, inv.id));
  });
  return { workspaceId: inv.workspaceId };
}

async function owners(db: DB, workspaceId: string) {
  return (await db.select({ id: memberships.userId }).from(memberships).where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.role, 'dono')))).length;
}

export async function setMemberRole(db: DB, user: SessionUser, workspaceId: string, memberId: string, role: Role) {
  await requireRole(db, user, workspaceId, 'dono');
  if (!isRole(role)) throw badRequest('Papel inválido.');
  const m = await db.query.memberships.findFirst({ where: and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, memberId)) });
  if (!m) throw notFound('Membro não encontrado.');
  if (m.role === 'dono' && role !== 'dono' && (await owners(db, workspaceId)) <= 1) throw new HttpError(409, 'A equipe precisa de pelo menos um dono.');
  await db.update(memberships).set({ role }).where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, memberId)));
}

/** Remove um membro (dono) ou sai da equipe (o próprio usuário). */
export async function removeMember(db: DB, user: SessionUser, workspaceId: string, memberId: string) {
  const self = memberId === user.id;
  await requireRole(db, user, workspaceId, self ? 'leitor' : 'dono');
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) });
  if (ws?.personal && self) throw badRequest('Você não pode sair da sua equipe pessoal.');
  const m = await db.query.memberships.findFirst({ where: and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, memberId)) });
  if (!m) throw notFound('Membro não encontrado.');
  if (m.role === 'dono' && (await owners(db, workspaceId)) <= 1) throw new HttpError(409, 'A equipe precisa de pelo menos um dono. Passe a posse antes de sair.');
  await db.delete(memberships).where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, memberId)));
}

export async function deleteWorkspace(db: DB, user: SessionUser, workspaceId: string) {
  await requireRole(db, user, workspaceId, 'dono');
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) });
  if (ws?.personal) throw badRequest('A equipe pessoal não pode ser excluída.');
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
}
