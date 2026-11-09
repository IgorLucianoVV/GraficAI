import { restoreVersion } from '@graficai/server';
import { route } from '@/lib/server';

export const POST = route<{ id: string; vid: string }>(async ({ db, user, params }) => {
  const r = await restoreVersion(db, user, params.id, params.vid);
  return { revision: r.revision };
});
