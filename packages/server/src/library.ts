import { and, asc, eq } from 'drizzle-orm';
import type { DesignSpec, PrinterProfile } from '@graficai/core';
import type { DB } from './db/client.ts';
import { designTemplates, printerProfiles } from './db/schema.ts';
import { badRequest, notFound } from './errors.ts';
import type { SessionUser } from './auth.ts';
import { requireRole } from './workspaces.ts';

/** Perfis de gráfica e modelos de projeto gráfico da equipe. */
type Kind = 'grafica' | 'modelo';
const table = (k: Kind) => (k === 'grafica' ? printerProfiles : designTemplates);

function checkName(name: string) {
  const n = name?.trim();
  if (!n || n.length > 120) throw badRequest('Dê um nome de até 120 caracteres.');
  return n;
}

function checkPrinter(p: PrinterProfile) {
  if (!p || (p.process !== 'offset' && p.process !== 'digital') || !p.paper || !p.offset || !p.digital || !Array.isArray(p.signatureSizes)) throw badRequest('Perfil de gráfica inválido.');
  if (p.process === 'offset' && (!Array.isArray(p.offset.sheets) || !p.offset.sheets.length)) throw badRequest('Cadastre pelo menos uma folha de impressão.');
}

function checkDesign(d: DesignSpec) {
  if (!d || !(d.trimWidthMm > 0) || !(d.trimHeightMm > 0) || !(d.bodySizePt > 0) || !(d.leadingPt > 0)) throw badRequest('Projeto gráfico inválido.');
}

export async function listLibrary(db: DB, user: SessionUser, workspaceId: string) {
  await requireRole(db, user, workspaceId, 'leitor');
  const [printers, templates] = await Promise.all([
    db.select().from(printerProfiles).where(eq(printerProfiles.workspaceId, workspaceId)).orderBy(asc(printerProfiles.name)),
    db.select().from(designTemplates).where(eq(designTemplates.workspaceId, workspaceId)).orderBy(asc(designTemplates.name)),
  ]);
  return {
    printers: printers.map((p) => ({ id: p.id, name: p.name, data: p.data, updatedAt: p.updatedAt })),
    templates: templates.map((t) => ({ id: t.id, name: t.name, data: t.data, updatedAt: t.updatedAt })),
  };
}

export async function createPrinter(db: DB, user: SessionUser, workspaceId: string, name: string, data: PrinterProfile) {
  await requireRole(db, user, workspaceId, 'editor');
  checkPrinter(data);
  const n = checkName(name);
  const [p] = await db.insert(printerProfiles).values({ workspaceId, name: n, data: { ...data, id: '', name: n }, createdBy: user.id }).returning();
  await db.update(printerProfiles).set({ data: { ...p.data, id: p.id } }).where(eq(printerProfiles.id, p.id));
  return { id: p.id };
}

export async function createTemplate(db: DB, user: SessionUser, workspaceId: string, name: string, data: DesignSpec) {
  await requireRole(db, user, workspaceId, 'editor');
  checkDesign(data);
  const [t] = await db.insert(designTemplates).values({ workspaceId, name: checkName(name), data, createdBy: user.id }).returning({ id: designTemplates.id });
  return t;
}

async function load(db: DB, kind: Kind, id: string) {
  const t = table(kind);
  const row = (await db.select().from(t).where(eq(t.id, id)).limit(1))[0];
  if (!row) throw notFound(kind === 'grafica' ? 'Perfil de gráfica não encontrado.' : 'Modelo não encontrado.');
  return row;
}

export async function updateLibraryItem(db: DB, user: SessionUser, kind: Kind, id: string, patch: { name?: string; data?: unknown }) {
  const row = await load(db, kind, id);
  await requireRole(db, user, row.workspaceId, 'editor');
  const name = patch.name !== undefined ? checkName(patch.name) : row.name;
  if (kind === 'grafica') {
    const data = (patch.data ?? row.data) as PrinterProfile;
    checkPrinter(data);
    await db.update(printerProfiles).set({ name, data: { ...data, id, name }, updatedAt: new Date() }).where(eq(printerProfiles.id, id));
  } else {
    const data = (patch.data ?? row.data) as DesignSpec;
    checkDesign(data);
    await db.update(designTemplates).set({ name, data, updatedAt: new Date() }).where(eq(designTemplates.id, id));
  }
}

export async function deleteLibraryItem(db: DB, user: SessionUser, kind: Kind, id: string) {
  const row = await load(db, kind, id);
  await requireRole(db, user, row.workspaceId, 'editor');
  const t = table(kind);
  await db.delete(t).where(and(eq(t.id, id), eq(t.workspaceId, row.workspaceId)));
}
