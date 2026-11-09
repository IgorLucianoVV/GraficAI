'use client';
import { useEscape } from '@/src/useEscape';
import { useEffect, useRef, useState } from 'react';
import { defaultSettings, PRINTERS, type Book } from '@graficai/core';
import { api, type Library } from '@/src/api';

/** Novo projeto: manuscrito (ou exemplo) + modelo de projeto gráfico + gráfica da equipe. */
export function NewProjectDialog({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  useEscape(onClose, !busy);
  const [error, setError] = useState<string | null>(null);
  const [library, setLibrary] = useState<Library>({ printers: [], templates: [] });
  const [template, setTemplate] = useState('');
  const [printer, setPrinter] = useState(PRINTERS[0].id);

  useEffect(() => {
    api<Library>(`/api/equipes/${workspaceId}/biblioteca`).then((l) => {
      setLibrary(l);
      if (l.printers[0]) setPrinter(l.printers[0].id);
    }, () => {});
  }, [workspaceId]);

  const create = async (source: () => Promise<{ book: Book; warnings: string[]; llmUsed: boolean }>) => {
    setError(null);
    try {
      setBusy('Lendo o manuscrito…');
      const r = await source();
      setBusy('Criando o projeto…');
      const settings = defaultSettings();
      const t = library.templates.find((x) => x.id === template);
      if (t) settings.design = JSON.parse(JSON.stringify(t.data));
      const own = library.printers.find((x) => x.id === printer);
      settings.printer = JSON.parse(JSON.stringify(own ? own.data : PRINTERS.find((x) => x.id === printer) ?? PRINTERS[0]));
      const p = await api<{ id: string }>(`/api/equipes/${workspaceId}/projetos`, { body: { data: { ...r, settings } } });
      window.location.assign(`/projetos/${p.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  const upload = (file: File) =>
    create(() => {
      const fd = new FormData();
      fd.append('file', file);
      return api('/api/manuscritos', { form: fd });
    });

  return (
    <div className="palette-backdrop" onMouseDown={() => !busy && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="np-title" onMouseDown={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h2 id="np-title">Novo projeto</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={!!busy} aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="np-tpl">Projeto gráfico</label>
            <select id="np-tpl" value={template} onChange={(e) => setTemplate(e.target.value)}>
              <option value="">Padrão (14 × 21, corpo 11/14,5)</option>
              {library.templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="np-pr">Gráfica</label>
            <select id="np-pr" value={printer} onChange={(e) => setPrinter(e.target.value)}>
              {library.printers.length > 0 && (
                <optgroup label="Da equipe">
                  {library.printers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Exemplos">
                {PRINTERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>
        <div
          className={`drop${over ? ' over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files[0];
            if (f && !busy) void upload(f);
          }}
        >
          {busy ? (
            <p aria-live="polite" style={{ fontWeight: 600 }}>
              {busy}
            </p>
          ) : (
            <>
              <p style={{ fontSize: 16, fontWeight: 600 }}>Arraste o manuscrito para cá</p>
              <p className="muted">.docx, .md ou .txt · até 4 MB</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                <button className="btn btn-primary" onClick={() => input.current?.click()}>
                  Escolher arquivo
                </button>
                <button className="btn" onClick={() => void create(() => api('/api/exemplo'))}>
                  Usar livro de exemplo
                </button>
              </div>
            </>
          )}
          <input
            ref={input}
            type="file"
            accept=".docx,.md,.markdown,.txt"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = '';
            }}
          />
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
