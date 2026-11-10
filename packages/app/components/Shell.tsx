'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Role } from '@graficai/server/types';
import { api } from '@/src/api';

export interface WorkspaceItem {
  id: string;
  name: string;
  personal: boolean;
  role: Role;
  members: number;
}

export function selectWorkspace(id: string) {
  document.cookie = `gx_ws=${id}; path=/; max-age=${365 * 86400}; samesite=lax`;
}

/** Casca da área logada: navegação, troca de equipe e conta. */
export function Shell({ user, workspaces, current, children }: { user: { name: string; email: string; guest?: boolean }; workspaces: WorkspaceItem[]; current: string; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => setTheme((document.documentElement.dataset.theme as 'light' | 'dark') ?? 'light'), []);

  const nav = [
    { href: '/projetos', label: 'Projetos' },
    { href: '/equipe', label: 'Equipe' },
    { href: '/configuracoes', label: 'Configurações' },
  ];

  return (
    <div className="shell">
      <header className="shell-top">
        <Link href="/projetos" className="brand">
          <span className="brand-mark" aria-hidden />
          GraficAI
        </Link>
        <nav className="shell-nav" aria-label="Principal">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} aria-current={path.startsWith(n.href) ? 'page' : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="shell-right">
          <label className="ws-switch">
            <span className="sr-only">Equipe</span>
            <select
              value={current}
              onChange={(e) => {
                selectWorkspace(e.target.value);
                router.refresh();
              }}
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.personal ? ' (pessoal)' : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn btn-ghost btn-sm"
            aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
            onClick={() => {
              const t = theme === 'dark' ? 'light' : 'dark';
              setTheme(t);
              document.documentElement.dataset.theme = t;
              try {
                localStorage.setItem('graficai-theme', t);
              } catch {
                /* ignore */
              }
            }}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          {user.guest ? (
            <Link className="btn btn-sm btn-primary" href="/cadastro">
              Criar conta
            </Link>
          ) : (
            <span className="small muted" title={user.email}>
              {user.name}
            </span>
          )}
          <button
            className="btn btn-sm"
            onClick={async () => {
              if (user.guest && !window.confirm('Ao sair, você perde o acesso aos projetos de visitante. Sair mesmo assim?')) return;
              await api('/api/auth/sair', { body: {} }).catch(() => {});
              window.location.assign('/entrar');
            }}
          >
            Sair
          </button>
        </div>
      </header>
      {user.guest && (
        <div className="banner" role="status">
          <span>
            Você está como <strong>visitante</strong>. Seus projetos ficam salvos enquanto esta sessão existir (30 dias sem uso apagam). <Link href="/cadastro">Crie a conta</Link>{' '}
            para não perder nada, trabalhar em equipe e entrar de outro computador.
          </span>
        </div>
      )}
      <main className="shell-main">{children}</main>
    </div>
  );
}
