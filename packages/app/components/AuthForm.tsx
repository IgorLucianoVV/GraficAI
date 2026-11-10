'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/src/api';

/** Entrar ou criar conta. Depois redireciona para `next` (só caminhos internos). */
export function AuthForm({ mode, next, guest = false }: { mode: 'entrar' | 'cadastro'; next?: string; guest?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/projetos';
  const signup = mode === 'cadastro';

  return (
    <main className="auth">
      <div className="auth-card">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden />
          GraficAI
        </Link>
        <h1>{signup ? 'Criar conta' : 'Entrar'}</h1>
        {guest && (
          <p className="small muted" style={{ margin: 0 }}>
            Você está como visitante. {signup ? 'Ao criar a conta, seus projetos continuam com você.' : 'Ao entrar, seus projetos de visitante vão para a sua conta.'}
          </p>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setError(null);
            try {
              await api(`/api/auth/${mode}`, { body: Object.fromEntries(f) });
              // Navegação completa: o servidor passa a enxergar o cookie de sessão.
              window.location.assign(safeNext);
            } catch (err) {
              setError((err as Error).message);
              setBusy(false);
            }
          }}
        >
          {signup && (
            <div className="field">
              <label htmlFor="name">Nome</label>
              <input id="name" name="name" type="text" autoComplete="name" required maxLength={120} />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">
              Senha {signup && <span className="small">mínimo de 8 caracteres</span>}
            </label>
            <input id="password" name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={signup ? 8 : undefined} required />
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Aguarde…' : signup ? 'Criar conta' : 'Entrar'}
          </button>
        </form>
        {!guest && (
          <>
            <div className="or" aria-hidden>
              <span>ou</span>
            </div>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await api('/api/auth/visitante', { body: {} });
                  window.location.assign(safeNext);
                } catch (err) {
                  setError((err as Error).message);
                  setBusy(false);
                }
              }}
            >
              Entrar como visitante
            </button>
            <p className="small muted" style={{ margin: '-6px 0 0' }}>
              Sem cadastro. Seus projetos ficam salvos neste navegador; crie a conta quando quiser e eles vão junto.
            </p>
          </>
        )}
        <p className="small muted" style={{ margin: 0 }}>
          {signup ? (
            <>
              Já tem conta? <Link href={`/entrar${next ? `?proximo=${encodeURIComponent(next)}` : ''}`}>Entrar</Link>
            </>
          ) : (
            <>
              Ainda não tem conta? <Link href={`/cadastro${next ? `?proximo=${encodeURIComponent(next)}` : ''}`}>Criar conta</Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
