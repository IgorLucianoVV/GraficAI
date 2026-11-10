import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server';
import { GuestButton } from '@/components/GuestButton';

export const dynamic = 'force-dynamic';

export default async function Landing() {
  if (await currentUser()) redirect('/projetos');
  return (
    <div className="landing">
      <header className="landing-top">
        <span className="brand">
          <span className="brand-mark" aria-hidden />
          GraficAI
        </span>
        <nav style={{ display: 'flex', gap: 8 }}>
          <Link className="btn btn-ghost" href="/entrar">
            Entrar
          </Link>
          <Link className="btn btn-primary" href="/cadastro">
            Criar conta
          </Link>
        </nav>
      </header>
      <main className="landing-hero">
        <div>
          <h1>Do manuscrito ao caderno fechado.</h1>
          <p>
            Envie o original e veja as laudas, o plano de cadernos, a lombada e o custo de impressão. Ajuste o projeto gráfico com tudo recalculado ao vivo e
            exporte o livro composto em PDF.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" href="/cadastro" style={{ minHeight: 44, padding: '0 22px', fontSize: 15 }}>
              Criar conta grátis
            </Link>
            <GuestButton style={{ minHeight: 44, padding: '0 22px', fontSize: 15 }} />
          </div>
          <div className="landing-points">
            <div>
              <strong>Cadernos sem desperdício</strong>
              <span>Imposição pela folha da sua gráfica e propostas que fecham o último caderno.</span>
            </div>
            <div>
              <strong>Livro composto</strong>
              <span>Miolo em PDF com capitular, notas, sumário, cabeço e marcas de corte.</span>
            </div>
            <div>
              <strong>Trabalho em equipe</strong>
              <span>Projetos com histórico de versões, perfis de gráfica e modelos compartilhados.</span>
            </div>
          </div>
        </div>
      </main>
      <footer className="landing-foot">GraficAI</footer>
    </div>
  );
}
