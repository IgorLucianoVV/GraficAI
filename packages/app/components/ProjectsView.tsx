'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ProjectSummary } from '@graficai/server/types';
import { api } from '@/src/api';
import { brl, num } from '@/src/format';
import { NewProjectDialog } from './NewProjectDialog';
import type { WorkspaceItem } from './Shell';

interface ProjectRow {
  id: string;
  title: string;
  summary: ProjectSummary | null;
  updatedAt: string;
  updatedBy: string | null;
}

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function ProjectsView({ workspace, others, projects }: { workspace: WorkspaceItem; others: WorkspaceItem[]; projects: ProjectRow[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const canEdit = workspace.role !== 'leitor';
  const shown = projects.filter((p) => p.title.toLowerCase().includes(query.trim().toLowerCase()));

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Projetos</h1>
          <p>
            {workspace.name}
            {workspace.personal ? ' · equipe pessoal' : ` · ${workspace.members} ${workspace.members === 1 ? 'pessoa' : 'pessoas'}`}
            {!canEdit && ' · você tem acesso de leitura'}
          </p>
        </div>
        <div className="row" style={{ flex: 'none' }}>
          {projects.length > 3 && (
            <input type="search" placeholder="Buscar projeto" aria-label="Buscar projeto" value={query} onChange={(e) => setQuery(e.target.value)} className="search" />
          )}
          {canEdit && (
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              Novo projeto
            </button>
          )}
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {projects.length === 0 ? (
        <div className="empty">
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Nenhum projeto ainda</p>
          <p>Envie um manuscrito (.docx, .md ou .txt) ou comece pelo livro de exemplo.</p>
          {canEdit && (
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              Novo projeto
            </button>
          )}
        </div>
      ) : (
        <div className="project-grid">
          {shown.map((p) => (
            <div key={p.id} className="project-card">
              <Link href={`/projetos/${p.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                <h3>{p.title}</h3>
              </Link>
              {p.summary && (
                <div className="stats num">
                  <span>
                    <strong>{num(p.summary.pages)}</strong> pp
                  </span>
                  <span>{p.summary.signatures}</span>
                  <span>
                    <strong>{brl(p.summary.perCopy)}</strong>/ex.
                  </span>
                  <span>{p.summary.trim} mm</span>
                  {p.summary.issues > 0 && <span style={{ color: 'var(--warning)' }}>{p.summary.issues} pontos de atenção</span>}
                </div>
              )}
              <div className="meta">
                Atualizado {ago(p.updatedAt)}
                {p.updatedBy ? ` por ${p.updatedBy}` : ''}
              </div>
              <div className="card-foot">
              <Link href={`/projetos/${p.id}`} className="btn btn-sm">
                Abrir
              </Link>
              {canEdit && (
                <div className="actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    title="Renomear"
                    aria-label={`Renomear ${p.title}`}
                    onClick={() => {
                      const t = window.prompt('Novo título do projeto', p.title);
                      if (t && t.trim() && t !== p.title) void act(() => api(`/api/projetos/${p.id}`, { method: 'PATCH', body: { title: t } }));
                    }}
                  >
                    ✎
                  </button>
                  <button className="btn btn-ghost btn-sm" title="Duplicar" aria-label={`Duplicar ${p.title}`} onClick={() => void act(() => api(`/api/projetos/${p.id}/duplicar`, { body: {} }))}>
                    ⧉
                  </button>
                  {others.length > 0 && (
                    <select
                      className="btn btn-ghost btn-sm"
                      aria-label={`Copiar ${p.title} para outra equipe`}
                      title="Copiar para outra equipe"
                      value=""
                      onChange={(e) => {
                        const ws = others.find((o) => o.id === e.target.value);
                        if (ws) void act(() => api(`/api/projetos/${p.id}/duplicar`, { body: { workspaceId: ws.id } }));
                      }}
                    >
                      <option value="">⇢</option>
                      {others.map((o) => (
                        <option key={o.id} value={o.id}>
                          Copiar para {o.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    title="Excluir"
                    aria-label={`Excluir ${p.title}`}
                    onClick={() => {
                      if (window.confirm(`Excluir “${p.title}” e todo o histórico? Não dá para desfazer.`)) void act(() => api(`/api/projetos/${p.id}`, { method: 'DELETE' }));
                    }}
                  >
                    🗑
                  </button>
                </div>
              )}
              </div>
            </div>
          ))}
        </div>
      )}
      {creating && <NewProjectDialog workspaceId={workspace.id} onClose={() => setCreating(false)} />}
    </>
  );
}
