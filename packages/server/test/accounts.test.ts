import { beforeAll, describe, expect, it } from 'vitest';
import { defaultSettings, sampleBook, PRINTERS } from '@graficai/core';
import {
  acceptInvite,
  createInvite,
  createMemoryDb,
  createPrinter,
  createProject,
  createTemplate,
  createVersion,
  createWorkspace,
  getProject,
  hashPassword,
  HttpError,
  listLibrary,
  listProjects,
  listVersions,
  listWorkspaces,
  removeMember,
  restoreVersion,
  saveProject,
  setMemberRole,
  signIn,
  signOut,
  signUp,
  userFromToken,
  verifyPassword,
  type DB,
  type ProjectData,
} from '../src/index.ts';

const status = async (p: Promise<unknown>) => {
  try {
    await p;
    return 200;
  } catch (e) {
    if (e instanceof HttpError) return e.status;
    throw e;
  }
};

const data = (): ProjectData => ({ book: sampleBook(), settings: defaultSettings(), warnings: [], llmUsed: false });

describe('contas, equipes e projetos', () => {
  let db: DB;
  beforeAll(async () => {
    db = await createMemoryDb();
  }, 30000);

  it('senha: hash e verificação', async () => {
    const h = await hashPassword('segredo-123');
    expect(h.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('segredo-123', h)).toBe(true);
    expect(await verifyPassword('errada', h)).toBe(false);
  });

  it('cadastro cria equipe pessoal; entrar e sair', async () => {
    const { user, token } = await signUp(db, { email: 'Ana@Editora.com', password: 'senha-forte', name: 'Ana Souza' });
    expect(user.email).toBe('ana@editora.com');
    expect((await userFromToken(db, token))?.id).toBe(user.id);
    const ws = await listWorkspaces(db, user);
    expect(ws).toHaveLength(1);
    expect(ws[0]).toMatchObject({ personal: true, role: 'dono' });
    expect(await status(signUp(db, { email: 'ana@editora.com', password: 'outra-senha', name: 'Ana' }))).toBe(409);
    expect(await status(signIn(db, { email: 'ana@editora.com', password: 'errada!!' }))).toBe(401);
    const again = await signIn(db, { email: 'ANA@editora.com', password: 'senha-forte' });
    await signOut(db, again.token);
    expect(await userFromToken(db, again.token)).toBeNull();
    expect(await userFromToken(db, token)).not.toBeNull();
    expect(await status(signUp(db, { email: 'x', password: '1', name: 'X' }))).toBe(400);
  });

  it('projeto: salvar com revisão, conflito, versões e restauração', async () => {
    const { user } = await signUp(db, { email: 'bia@x.com', password: 'senha-forte', name: 'Bia' });
    const [ws] = await listWorkspaces(db, user);
    const { id } = await createProject(db, user, ws.id, { data: data() });
    const list = await listProjects(db, user, ws.id);
    expect(list[0]).toMatchObject({ id, title: 'Rios de Papel' });
    expect(list[0].summary!.pages).toBeGreaterThan(100);

    const p = await getProject(db, user, id);
    expect(p.revision).toBe(1);
    const changed = { ...p.data, settings: { ...p.data.settings, run: 3000 } };
    const r = await saveProject(db, user, id, { data: changed, revision: 1 });
    expect(r.revision).toBe(2);
    // Mesma revisão de novo: conflito.
    expect(await status(saveProject(db, user, id, { data: changed, revision: 1 }))).toBe(409);

    await createVersion(db, user, id, 'Antes da revisão');
    const v = await listVersions(db, user, id);
    expect(v.map((x) => x.label)).toEqual(expect.arrayContaining(['Versão inicial', 'Antes da revisão']));
    const initial = v.find((x) => x.label === 'Versão inicial')!;
    const restored = await restoreVersion(db, user, id, initial.id);
    expect(restored.data.settings.run).toBe(1000);
    expect((await getProject(db, user, id)).revision).toBe(restored.revision);
    expect((await listVersions(db, user, id)).some((x) => x.label.startsWith('Antes de restaurar'))).toBe(true);
  }, 30000);

  it('equipe: convite, papéis e isolamento', async () => {
    const { user: dono } = await signUp(db, { email: 'dono@x.com', password: 'senha-forte', name: 'Dono' });
    const { user: carla } = await signUp(db, { email: 'carla@x.com', password: 'senha-forte', name: 'Carla' });
    const { user: estranho } = await signUp(db, { email: 'e@x.com', password: 'senha-forte', name: 'Estranho' });
    const team = await createWorkspace(db, dono, 'Editora Rio');
    const { id: pid } = await createProject(db, dono, team.id, { data: data() });

    // Quem não é membro não vê nada (404, não 403).
    expect(await status(getProject(db, estranho, pid))).toBe(404);
    expect(await status(listProjects(db, estranho, team.id))).toBe(404);

    const inv = await createInvite(db, dono, team.id, 'leitor');
    expect(await status(createInvite(db, carla, team.id, 'editor'))).toBe(404);
    await acceptInvite(db, carla, inv.token);
    expect(await status(acceptInvite(db, estranho, inv.token))).toBe(404); // já usado

    // Leitor lê mas não salva.
    const p = await getProject(db, carla, pid);
    expect(p.role).toBe('leitor');
    expect(await status(saveProject(db, carla, pid, { data: p.data, revision: p.revision }))).toBe(403);

    await setMemberRole(db, dono, team.id, carla.id, 'editor');
    expect(await status(saveProject(db, carla, pid, { data: p.data, revision: p.revision }))).toBe(200);

    // A equipe nunca fica sem dono.
    expect(await status(setMemberRole(db, dono, team.id, dono.id, 'editor'))).toBe(409);
    expect(await status(removeMember(db, dono, team.id, dono.id))).toBe(409);
    await removeMember(db, carla, team.id, carla.id);
    expect(await status(getProject(db, carla, pid))).toBe(404);

    // Equipe pessoal não aceita convite.
    const [personal] = await listWorkspaces(db, dono);
    expect(await status(createInvite(db, dono, personal.id, 'editor'))).toBe(400);
  }, 30000);

  it('perfis de gráfica e modelos da equipe', async () => {
    const { user } = await signUp(db, { email: 'lib@x.com', password: 'senha-forte', name: 'Lib' });
    const [ws] = await listWorkspaces(db, user);
    const { id } = await createPrinter(db, user, ws.id, 'Gráfica Parceira', JSON.parse(JSON.stringify(PRINTERS[0])));
    await createTemplate(db, user, ws.id, 'Romance 14×21', defaultSettings().design);
    const lib = await listLibrary(db, user, ws.id);
    expect(lib.printers[0]).toMatchObject({ id, name: 'Gráfica Parceira' });
    expect(lib.printers[0].data.id).toBe(id);
    expect(lib.templates[0].name).toBe('Romance 14×21');
    expect(await status(createPrinter(db, user, ws.id, 'X', { nada: true } as never))).toBe(400);
  }, 30000);
});
