import { getDb, workspaceDetail } from '@graficai/server';
import { requireUser, workspaceContext } from '@/lib/server';
import { TeamView } from '@/components/TeamView';

export const metadata = { title: 'Equipe' };

export default async function Page() {
  const user = await requireUser('/equipe');
  const { current } = await workspaceContext(user);
  const d = await workspaceDetail(await getDb(), user, current.id);
  return (
    <TeamView
      me={user.id}
      guest={!!user.guest}
      workspace={{ id: d.workspace.id, name: d.workspace.name, personal: d.workspace.personal }}
      role={d.role}
      members={d.members.map((m) => ({ ...m, since: m.since.toISOString() }))}
      invites={d.invites.map((i) => ({ ...i, expiresAt: i.expiresAt.toISOString(), createdAt: i.createdAt.toISOString() }))}
    />
  );
}
