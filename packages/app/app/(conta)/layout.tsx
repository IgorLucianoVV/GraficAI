import { requireUser, workspaceContext } from '@/lib/server';
import { Shell } from '@/components/Shell';

export const dynamic = 'force-dynamic';

export default async function ContaLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { list, current } = await workspaceContext(user);
  return (
    <Shell user={user} workspaces={list} current={current.id}>
      {children}
    </Shell>
  );
}
