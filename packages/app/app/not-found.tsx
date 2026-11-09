import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="auth">
      <div className="auth-card">
        <h1>Página não encontrada</h1>
        <p className="muted">O endereço não existe ou você não tem acesso a ele.</p>
        <Link className="btn" href="/projetos">
          Ir para meus projetos
        </Link>
      </div>
    </main>
  );
}
