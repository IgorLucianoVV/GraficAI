import { getDb, listProjects } from '@graficai/server';
import { requireUser, workspaceContext } from '@/lib/server';
import { ProjectsView } from '@/components/ProjectsView';

export const metadata = { title: 'Projetos' };

export default async function Page() {
  const user = await requireUser();
  const { current, list } = await workspaceContext(user);
  const projects = await listProjects(await getDb(), user, current.id);
  return (
    <ProjectsView
      workspace={current}
      others={list.filter((w) => w.id !== current.id && w.role !== 'leitor')}
      projects={projects.map((p) => ({ ...p, updatedAt: p.updatedAt.toISOString() }))}
    />
  );
}
