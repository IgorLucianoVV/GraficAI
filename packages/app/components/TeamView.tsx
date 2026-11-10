'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Role } from '@graficai/server/types';
import { api } from '@/src/api';
import { selectWorkspace } from './Shell';

const ROLE_LABEL: Record<Role, string> = { dono: 'Dono', editor: 'Editor', leitor: 'Leitor' };
const ROLE_HELP: Record<Role, string> = {
  dono: 'tudo, inclusive convidar e mudar papéis',
  editor: 'cria e edita projetos, perfis e modelos',
  leitor: 'vê e exporta, sem alterar',
};

interface Member {
  userId: string;
  name: string;
  email: string;
  role: Role;
}
interface Invite {
  id: string;
  role: Role;
  expiresAt: string;
}

export function TeamView({ me, guest = false, workspace, role, members, invites }: { me: string; guest?: boolean; workspace: { id: string; name: string; personal: boolean }; role: Role; members: Member[]; invites: Invite[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<Role>('editor');
  const [newTeam, setNewTeam] = useState('');
  const owner = role === 'dono';

  const act = async (fn: () => Promise<unknown>, after?: () => void) => {
    setError(null);
    try {
      await fn();
      after?.();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{workspace.name}</h1>
          <p>
            {workspace.personal ? 'Sua equipe pessoal: só você tem acesso. Para trabalhar com outras pessoas, crie uma equipe.' : `Seu papel: ${ROLE_LABEL[role]} — ${ROLE_HELP[role]}.`}
          </p>
        </div>
        {owner && (
          <button
            className="btn"
            onClick={() => {
              const n = window.prompt('Novo nome da equipe', workspace.name);
              if (n && n.trim() && n !== workspace.name) void act(() => api(`/api/equipes/${workspace.id}`, { method: 'PATCH', body: { name: n } }));
            }}
          >
            Renomear
          </button>
        )}
      </div>
      {error && <p className="form-error">{error}</p>}

      <section className="panel">
        <div className="panel-head">
          <h2>Membros ({members.length})</h2>
        </div>
        <ul className="list">
          {members.map((m) => (
            <li key={m.userId}>
              <div className="grow">
                <strong>
                  {m.name}
                  {m.userId === me ? ' (você)' : ''}
                </strong>
                <span className="small muted">{m.email}</span>
              </div>
              {owner && !workspace.personal ? (
                <select
                  aria-label={`Papel de ${m.name}`}
                  value={m.role}
                  onChange={(e) => void act(() => api(`/api/equipes/${workspace.id}/membros/${m.userId}`, { method: 'PATCH', body: { role: e.target.value } }))}
                >
                  {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="badge usuario">{ROLE_LABEL[m.role]}</span>
              )}
              {!workspace.personal && (owner || m.userId === me) && (
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    const self = m.userId === me;
                    if (window.confirm(self ? `Sair da equipe “${workspace.name}”?` : `Remover ${m.name} da equipe?`))
                      void act(
                        () => api(`/api/equipes/${workspace.id}/membros/${m.userId}`, { method: 'DELETE' }),
                        self ? () => selectWorkspace('') : undefined,
                      );
                  }}
                >
                  {m.userId === me ? 'Sair' : 'Remover'}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {owner && !workspace.personal && (
        <section className="panel">
          <div className="panel-head">
            <h2>Convidar</h2>
          </div>
          <div className="panel-body">
            <p className="small muted" style={{ margin: 0 }}>
              Gere um link e envie para a pessoa. Ele vale por 7 dias e pode ser usado uma vez.
            </p>
            <div className="row" style={{ alignItems: 'flex-end', maxWidth: 520 }}>
              <div className="field">
                <label htmlFor="inv-role">Papel</label>
                <select id="inv-role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)}>
                  {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]} — {ROLE_HELP[r]}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="btn btn-primary"
                style={{ flex: 'none' }}
                onClick={() => void act(async () => setLink((await api<{ url: string }>(`/api/equipes/${workspace.id}/convites`, { body: { role: inviteRole } })).url))}
              >
                Gerar link
              </button>
            </div>
            {link && (
              <div className="copy-box">
                <input readOnly value={link} aria-label="Link do convite" onFocus={(e) => e.currentTarget.select()} />
                <button className="btn" onClick={() => navigator.clipboard?.writeText(link)}>
                  Copiar
                </button>
              </div>
            )}
            {invites.length > 0 && (
              <ul className="list" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                {invites.map((i) => (
                  <li key={i.id}>
                    <div className="grow">
                      <span>Convite de {ROLE_LABEL[i.role].toLowerCase()} pendente</span>
                      <span className="small muted">expira em {new Date(i.expiresAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <button className="btn btn-sm" onClick={() => void act(() => api(`/api/convites/${i.id}`, { method: 'DELETE' }))}>
                      Cancelar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {guest ? (
        <section className="panel">
          <div className="panel-body">
            <p style={{ margin: 0 }}>
              Para criar equipes e convidar pessoas, <a href="/cadastro">crie sua conta</a>. Seus projetos de visitante continuam com você.
            </p>
          </div>
        </section>
      ) : (
      <section className="panel">
        <div className="panel-head">
          <h2>Nova equipe</h2>
        </div>
        <form
          className="panel-body"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newTeam.trim()) return;
            void act(async () => {
              const r = await api<{ id: string }>('/api/equipes', { body: { name: newTeam } });
              selectWorkspace(r.id);
              setNewTeam('');
            });
          }}
        >
          <p className="small muted" style={{ margin: 0 }}>
            Uma equipe tem projetos, perfis de gráfica e modelos próprios. Você será o dono e poderá convidar pessoas.
          </p>
          <div className="row" style={{ maxWidth: 520 }}>
            <input type="text" className="search" placeholder="Ex.: Editora Rio — produção" value={newTeam} maxLength={80} onChange={(e) => setNewTeam(e.target.value)} aria-label="Nome da nova equipe" />
            <button className="btn btn-primary" style={{ flex: 'none' }} disabled={!newTeam.trim()}>
              Criar equipe
            </button>
          </div>
        </form>
      </section>
      )}

      {owner && !workspace.personal && (
        <section className="panel">
          <div className="panel-head">
            <h2>Excluir equipe</h2>
            <button
              className="btn btn-sm"
              style={{ color: 'var(--danger)' }}
              onClick={() => {
                if (window.prompt(`Isso apaga todos os projetos, versões, perfis e modelos da equipe. Digite o nome da equipe para confirmar:`) === workspace.name)
                  void act(() => api(`/api/equipes/${workspace.id}`, { method: 'DELETE' }), () => selectWorkspace(''));
              }}
            >
              Excluir equipe
            </button>
          </div>
        </section>
      )}
    </>
  );
}
