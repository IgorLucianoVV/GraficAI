import { notFound } from 'next/navigation';
import { getDb, getProject, HttpError, listLibrary } from '@graficai/server';
import { requireUser } from '@/lib/server';
import { Editor } from '@/src/Editor';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/projetos/${id}`);
  try {
    const p = await getProject(await getDb(), user, id);
    return { title: p.title };
  } catch {
    return { title: 'Projeto' };
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/projetos/${id}`);
  const db = await getDb();
  let project;
  try {
    project = await getProject(db, user, id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  const library = await listLibrary(db, user, project.workspaceId);
  return (
    <Editor
      project={{ id: project.id, title: project.title, workspaceId: project.workspaceId, workspaceName: project.workspaceName, data: project.data, revision: project.revision, role: project.role }}
      library={{ printers: library.printers.map(({ id, name, data }) => ({ id, name, data })), templates: library.templates.map(({ id, name, data }) => ({ id, name, data })) }}
    />
  );
}
