import { and, desc, eq, sql } from 'drizzle-orm';
import { defaultSettings, describePlan, diagnose, type Book, type ProjectSettings } from '@graficai/core';
import type { DB } from './db/client.ts';
import { projectVersions, projects, users, workspaces } from './db/schema.ts';
import { HttpError, badRequest, notFound } from './errors.ts';
import type { SessionUser } from './auth.ts';
import { requireRole } from './workspaces.ts';
import type { ProjectData, ProjectSummary } from './types.ts';

/** Intervalo mínimo entre versões automáticas. */
export const AUTO_VERSION_MS = 10 * 60 * 1000;
/** Versões automáticas guardadas por projeto (as nomeadas nunca são apagadas). */
export const AUTO_VERSIONS_KEPT = 30;
const MAX_DATA_BYTES = 20 * 1024 * 1024;

export function summarize(data: ProjectData): ProjectSummary {
  const d = diagnose(data.book, data.settings);
  return {
    pages: d.plan.totalPages,
    signatures: describePlan(d.plan),
    perCopy: d.cost.perCopy,
    laudas: d.stats.laudas,
    trim: `${data.settings.design.trimWidthMm} × ${data.settings.design.trimHeightMm}`,
    issues: d.issues.filter((i) => i.severity !== 'info').length,
  };
}

/** Projetos antigos podem não ter campos novos de ajustes: completa com os padrões. */
export function normalizeData(data: ProjectData): ProjectData {
  const base = defaultSettings();
  const s = data.settings ?? base;
  const settings: ProjectSettings = {
    ...base,
    ...s,
    design: { ...base.design, ...s.design, chapterOpening: { ...base.design.chapterOpening, ...s.design?.chapterOpening } },
    printer: { ...base.printer, ...s.printer, offset: { ...base.printer.offset, ...s.printer?.offset } },
    production: { ...base.production, ...s.production },
    lauda: { ...base.lauda, ...s.lauda },
  };
  return { book: data.book, settings, warnings: data.warnings ?? [], llmUsed: !!data.llmUsed };
}

function checkData(data: ProjectData) {
  if (!data?.book?.elements || !Array.isArray(data.book.elements) || !data.settings?.design) throw badRequest('Projeto inválido.');
  if (JSON.stringify(data).length > MAX_DATA_BYTES) throw new HttpError(413, 'O projeto passou de 20 MB.');
}

export async function listProjects(db: DB, user: SessionUser, workspaceId: string) {
  await requireRole(db, user, workspaceId, 'leitor');
  return db
    .select({
      id: projects.id,
      title: projects.title,
      summary: projects.summary,
      updatedAt: projects.updatedAt,
      updatedBy: users.name,
    })
    .from(projects)
    .leftJoin(users, eq(users.id, projects.updatedBy))
    .where(eq(projects.workspaceId, workspaceId))
    .orderBy(desc(projects.updatedAt));
}

export async function createProject(db: DB, user: SessionUser, workspaceId: string, input: { title?: string; data: ProjectData }) {
  await requireRole(db, user, workspaceId, 'editor');
  const data = normalizeData(input.data);
  checkData(data);
  const title = (input.title ?? data.book.title ?? 'Sem título').trim().slice(0, 200) || 'Sem título';
  const summary = summarize(data);
  return db.transaction(async (tx) => {
    const [p] = await tx.insert(projects).values({ workspaceId, title, data, summary, createdBy: user.id, updatedBy: user.id }).returning({ id: projects.id });
    await tx.insert(projectVersions).values({ projectId: p.id, label: 'Versão inicial', auto: false, revision: 1, data, summary, createdBy: user.id });
    return p;
  });
}

async function loadProject(db: DB, id: string) {
  const p = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!p) throw notFound('Projeto não encontrado.');
  return p;
}

export async function getProject(db: DB, user: SessionUser, id: string) {
  const p = await loadProject(db, id);
  const role = await requireRole(db, user, p.workspaceId, 'leitor');
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, p.workspaceId) });
  return { id: p.id, title: p.title, workspaceId: p.workspaceId, workspaceName: ws?.name ?? '', data: normalizeData(p.data), revision: p.revision, updatedAt: p.updatedAt, role };
}

/**
 * Salvamento automático com concorrência otimista: só grava se `revision`
 * bater com a do banco (senão 409 com a versão atual). Cria uma versão
 * automática se a última tiver mais de 10 minutos.
 */
export async function saveProject(db: DB, user: SessionUser, id: string, input: { data: ProjectData; revision: number; title?: string }) {
  const p = await loadProject(db, id);
  await requireRole(db, user, p.workspaceId, 'editor');
  const data = normalizeData(input.data);
  checkData(data);
  const summary = summarize(data);
  const title = input.title?.trim().slice(0, 200) || p.title;

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(projects)
      .set({ data, summary, title, revision: sql`${projects.revision} + 1`, updatedBy: user.id, updatedAt: new Date() })
      .where(and(eq(projects.id, id), eq(projects.revision, input.revision)))
      .returning({ revision: projects.revision, updatedAt: projects.updatedAt });
    if (!updated.length) {
      const current = await tx.query.projects.findFirst({ where: eq(projects.id, id) });
      const who = current?.updatedBy ? await tx.query.users.findFirst({ where: eq(users.id, current.updatedBy) }) : null;
      throw new HttpError(409, `O projeto foi alterado${who ? ` por ${who.name}` : ''} em outra janela.`, { revision: current?.revision });
    }
    const last = await tx.query.projectVersions.findFirst({ where: eq(projectVersions.projectId, id), orderBy: desc(projectVersions.createdAt) });
    let versioned = false;
    if (!last || Date.now() - last.createdAt.getTime() > AUTO_VERSION_MS) {
      await tx.insert(projectVersions).values({ projectId: id, label: 'Salvamento automático', auto: true, revision: updated[0].revision, data, summary, createdBy: user.id });
      versioned = true;
      // Poda as automáticas mais antigas.
      await tx.execute(sql`
        DELETE FROM project_versions WHERE id IN (
          SELECT id FROM project_versions WHERE project_id = ${id} AND auto = true
          ORDER BY created_at DESC OFFSET ${AUTO_VERSIONS_KEPT}
        )`);
    }
    return { revision: updated[0].revision, updatedAt: updated[0].updatedAt, summary, versioned };
  });
}

export async function renameProject(db: DB, user: SessionUser, id: string, title: string) {
  const p = await loadProject(db, id);
  await requireRole(db, user, p.workspaceId, 'editor');
  const t = title.trim();
  if (!t) throw badRequest('Dê um título ao projeto.');
  await db.update(projects).set({ title: t.slice(0, 200), updatedAt: new Date(), updatedBy: user.id }).where(eq(projects.id, id));
}

export async function deleteProject(db: DB, user: SessionUser, id: string) {
  const p = await loadProject(db, id);
  await requireRole(db, user, p.workspaceId, 'editor');
  await db.delete(projects).where(eq(projects.id, id));
}

export async function duplicateProject(db: DB, user: SessionUser, id: string, targetWorkspaceId?: string) {
  const p = await getProject(db, user, id);
  return createProject(db, user, targetWorkspaceId ?? p.workspaceId, { title: `${p.title} (cópia)`, data: p.data });
}

export async function listVersions(db: DB, user: SessionUser, id: string) {
  const p = await loadProject(db, id);
  await requireRole(db, user, p.workspaceId, 'leitor');
  return db
    .select({
      id: projectVersions.id,
      label: projectVersions.label,
      auto: projectVersions.auto,
      revision: projectVersions.revision,
      summary: projectVersions.summary,
      createdAt: projectVersions.createdAt,
      createdBy: users.name,
    })
    .from(projectVersions)
    .leftJoin(users, eq(users.id, projectVersions.createdBy))
    .where(eq(projectVersions.projectId, id))
    .orderBy(desc(projectVersions.createdAt));
}

/** Versão nomeada do estado salvo atual. */
export async function createVersion(db: DB, user: SessionUser, id: string, label: string) {
  const p = await loadProject(db, id);
  await requireRole(db, user, p.workspaceId, 'editor');
  const l = label.trim();
  if (!l || l.length > 120) throw badRequest('Dê um nome de até 120 caracteres para a versão.');
  const [v] = await db
    .insert(projectVersions)
    .values({ projectId: id, label: l, auto: false, revision: p.revision, data: p.data, summary: p.summary, createdBy: user.id })
    .returning({ id: projectVersions.id });
  return v;
}

/** Restaura uma versão: guarda o estado atual como versão antes, para poder voltar. */
export async function restoreVersion(db: DB, user: SessionUser, id: string, versionId: string) {
  const p = await loadProject(db, id);
  await requireRole(db, user, p.workspaceId, 'editor');
  const v = await db.query.projectVersions.findFirst({ where: and(eq(projectVersions.id, versionId), eq(projectVersions.projectId, id)) });
  if (!v) throw notFound('Versão não encontrada.');
  return db.transaction(async (tx) => {
    await tx.insert(projectVersions).values({ projectId: id, label: `Antes de restaurar “${v.label}”`, auto: true, revision: p.revision, data: p.data, summary: p.summary, createdBy: user.id });
    const [u] = await tx
      .update(projects)
      .set({ data: v.data, summary: v.summary, revision: sql`${projects.revision} + 1`, updatedBy: user.id, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning({ revision: projects.revision });
    return { revision: u.revision, data: normalizeData(v.data) };
  });
}

export type { Book };
