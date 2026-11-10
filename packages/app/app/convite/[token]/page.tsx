import Link from 'next/link';
import { getDb, inviteInfo, ROLE_LABEL, HttpError } from '@graficai/server';
import { currentUser } from '@/lib/server';
import { AcceptInvite } from '@/components/AcceptInvite';

export const metadata = { title: 'Convite' };
export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let info: Awaited<ReturnType<typeof inviteInfo>> | null = null;
  try {
    info = await inviteInfo(await getDb(), token);
  } catch (e) {
    if (!(e instanceof HttpError)) throw e;
  }
  const user = await currentUser();
  const here = `/convite/${token}`;
  return (
    <main className="auth">
      <div className="auth-card">
        <span className="brand">
          <span className="brand-mark" aria-hidden />
          GraficAI
        </span>
        {!info ? (
          <>
            <h1>Convite inválido</h1>
            <p className="muted">O link expirou ou já foi usado. Peça um novo convite ao dono da equipe.</p>
            <Link className="btn" href="/projetos">
              Ir para meus projetos
            </Link>
          </>
        ) : (
          <>
            <h1>Entrar na equipe “{info.workspaceName}”</h1>
            <p className="muted">
              Você foi convidado como <strong>{ROLE_LABEL[info.role]}</strong>.
            </p>
            {user && !user.guest ? (
              <AcceptInvite token={token} userName={user.name} />
            ) : (
              <div className="row">
                <Link className="btn btn-primary" href={`/cadastro?proximo=${encodeURIComponent(here)}`}>
                  {user?.guest ? 'Criar conta (projetos de visitante vão junto)' : 'Criar conta'}
                </Link>
                <Link className="btn" href={`/entrar?proximo=${encodeURIComponent(here)}`}>
                  Já tenho conta
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
