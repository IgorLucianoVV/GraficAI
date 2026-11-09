'use client';
import { useEscape } from '../useEscape.ts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type ProjectPayload } from '../api.ts';
import { brl, num } from '../format.ts';
import type { ProjectSummary } from '@graficai/server/types';

interface Version {
  id: string;
  label: string;
  auto: boolean;
  revision: number;
  summary: ProjectSummary | null;
  createdAt: string;
  createdBy: string | null;
}

const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** Histórico: versões nomeadas e automáticas, criar e restaurar. */
export function HistoryDialog({
  projectId,
  canEdit,
  beforeVersion,
  onRestored,
  onClose,
}: {
  projectId: string;
  canEdit: boolean;
  beforeVersion: () => Promise<boolean>;
  onRestored: (p: ProjectPayload) => void;
  onClose: () => void;
}) {
  useEscape(onClose, true);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAuto, setShowAuto] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api<Version[]>(`/api/projetos/${projectId}/versoes`).then(setVersions, (e) => setError(e.message));
  }, [projectId]);
  useEffect(() => {
    load();
    input.current?.focus();
  }, [load]);

  const create = async () => {
    if (!label.trim()) return;
    setBusy('criar');
    setError(null);
    try {
      if (!(await beforeVersion())) throw new Error('Não foi possível salvar o estado atual antes de criar a versão.');
      await api(`/api/projetos/${projectId}/versoes`, { body: { label } });
      setLabel('');
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const restore = async (v: Version) => {
    setBusy(v.id);
    setError(null);
    try {
      await beforeVersion();
      await api(`/api/projetos/${projectId}/versoes/${v.id}/restaurar`, { body: {} });
      onRestored(await api<ProjectPayload>(`/api/projetos/${projectId}`));
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const shown = versions?.filter((v) => showAuto || !v.auto) ?? [];
  const autoCount = versions?.filter((v) => v.auto).length ?? 0;

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="hist-title" onMouseDown={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h2 id="hist-title">Histórico de versões</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          O projeto é salvo automaticamente a cada alteração. A cada 10 minutos de trabalho fica guardada uma versão automática; dê nome às versões importantes
          (por exemplo, “Enviado à gráfica”).
        </p>
        {canEdit && (
          <form
            className="row"
            style={{ alignItems: 'flex-end' }}
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <div className="field">
              <label htmlFor="v-label">Nova versão</label>
              <input id="v-label" ref={input} type="text" placeholder="Ex.: Prova 1 aprovada" value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <button className="btn btn-primary" style={{ flex: 'none' }} disabled={!label.trim() || !!busy}>
              {busy === 'criar' ? 'Salvando…' : 'Salvar versão'}
            </button>
          </form>
        )}
        {error && (
          <p className="small" role="alert" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}
        {autoCount > 0 && (
          <label className="check small">
            <input type="checkbox" checked={showAuto} onChange={(e) => setShowAuto(e.target.checked)} />
            Mostrar versões automáticas ({autoCount})
          </label>
        )}
        {!versions ? (
          <p className="small muted">Carregando…</p>
        ) : (
          <ul className="version-list">
            {shown.map((v) => (
              <li key={v.id} className={v.auto ? 'auto' : ''}>
                <div>
                  <strong>{v.label}</strong>
                  <span className="small muted">
                    {when(v.createdAt)}
                    {v.createdBy ? ` · ${v.createdBy}` : ''}
                    {v.summary ? ` · ${num(v.summary.pages)} pp · ${v.summary.signatures} · ${brl(v.summary.perCopy)}/ex.` : ''}
                  </span>
                </div>
                {canEdit && (
                  <button className="btn btn-sm" disabled={!!busy} onClick={() => void restore(v)}>
                    {busy === v.id ? 'Restaurando…' : 'Restaurar'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
