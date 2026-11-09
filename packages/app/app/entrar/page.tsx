import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/AuthForm';
import { currentUser } from '@/lib/server';

export const metadata = { title: 'Entrar' };
export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ proximo?: string }> }) {
  const { proximo } = await searchParams;
  if (await currentUser()) redirect(proximo?.startsWith('/') ? proximo : '/projetos');
  return <AuthForm mode="entrar" next={proximo} />;
}
