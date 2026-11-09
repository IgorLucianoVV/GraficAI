import { getDb, listLibrary } from '@graficai/server';
import { requireUser, workspaceContext } from '@/lib/server';
import { SettingsView } from '@/components/SettingsView';

export const metadata = { title: 'Configurações' };

export default async function Page() {
  const user = await requireUser('/configuracoes');
  const { current } = await workspaceContext(user);
  const lib = await listLibrary(await getDb(), user, current.id);
  return (
    <SettingsView
      user={user}
      workspace={current}
      printers={lib.printers.map(({ id, name, data }) => ({ id, name, data }))}
      templates={lib.templates.map(({ id, name, data }) => ({ id, name, data }))}
    />
  );
}
