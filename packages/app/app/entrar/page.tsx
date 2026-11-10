import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/AuthForm';
import { currentUser } from '@/lib/server';

export const metadata = { title: 'Entrar' };
export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ proximo?: string }> }) {
  const { proximo } = await searchParams;
  const user = await currentUser();
  // Visitante pode entrar numa conta ou criar a sua (os projetos vão junto).
  if (user && !user.guest) redirect(proximo?.startsWith('/') ? proximo : '/projetos');
  return <AuthForm mode="entrar" next={proximo} guest={!!user?.guest} />;
}
