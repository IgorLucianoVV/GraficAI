'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PRESET_LABELS, PRINTERS, sheetLabel, type DesignSpec, type PrinterProfile, type SheetFormat } from '@graficai/core';
import { api, type LibraryItem } from '@/src/api';
import type { WorkspaceItem } from './Shell';

type Tab = 'graficas' | 'modelos' | 'conta';

export function SettingsView({
  user,
  workspace,
  printers,
  templates,
}: {
  user: { name: string; email: string };
  workspace: WorkspaceItem;
  printers: LibraryItem<PrinterProfile>[];
  templates: LibraryItem<DesignSpec>[];
}) {
  const [tab, setTab] = useState<Tab>('graficas');
  const canEdit = workspace.role !== 'leitor';
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Configurações</h1>
          <p>Perfis de gráfica e modelos valem para todos os projetos da equipe {workspace.name}.</p>
        </div>
      </div>
      <div className="tabs-inline" role="tablist">
        {(
          [
            ['graficas', `Perfis de gráfica (${printers.length})`],
            ['modelos', `Modelos de projeto gráfico (${templates.length})`],
            ['conta', 'Minha conta'],
          ] as [Tab, string][]
        ).map(([t, l]) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'graficas' && <Printers workspaceId={workspace.id} printers={printers} canEdit={canEdit} />}
      {tab === 'modelos' && <Templates templates={templates} canEdit={canEdit} />}
      {tab === 'conta' && <Account user={user} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Perfis de gráfica

function Printers({ workspaceId, printers, canEdit }: { workspaceId: string; printers: LibraryItem<PrinterProfile>[]; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ id: string | null; name: string; data: PrinterProfile } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startNew = (base: PrinterProfile, name: string) => setEditing({ id: null, name, data: JSON.parse(JSON.stringify(base)) });

  if (editing)
    return (
      <PrinterForm
        value={editing}
        onCancel={() => setEditing(null)}
        onSave={async (v) => {
          if (v.id) await api(`/api/biblioteca/grafica/${v.id}`, { method: 'PATCH', body: { name: v.name, data: v.data } });
          else await api(`/api/equipes/${workspaceId}/biblioteca`, { body: { kind: 'grafica', name: v.name, data: v.data } });
          setEditing(null);
          router.refresh();
        }}
      />
    );

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Perfis de gráfica</h2>
        {canEdit && (
          <div className="row" style={{ flex: 'none' }}>
            <select
              className="btn"
              value=""
              aria-label="Criar perfil a partir de um exemplo"
              onChange={(e) => {
                const p = PRINTERS.find((x) => x.id === e.target.value);
                if (p) startNew(p, 'Minha gráfica');
              }}
            >
              <option value="">Novo perfil a partir de…</option>
              {PRINTERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {error && <p className="form-error" style={{ margin: 12 }}>{error}</p>}
      {printers.length === 0 ? (
        <div className="panel-body">
          <p className="muted" style={{ margin: 0 }}>
            Nenhum perfil ainda. Os projetos usam os perfis de exemplo, com valores ilustrativos. Cadastre a tabela da sua gráfica para custos reais: folhas de
            impressão, dobra, acerto por caderno, papel (R$/kg), rodagem, encadernação e capa.
          </p>
        </div>
      ) : (
        <ul className="list">
          {printers.map((p) => (
            <li key={p.id}>
              <div className="grow">
                <strong>{p.name}</strong>
                <span className="small muted">
                  {p.data.process === 'offset'
                    ? `Offset · dobra até ${p.data.offset.maxFolding} pp · folhas ${p.data.offset.sheets.map(sheetLabel).join(', ')} · ${p.data.paper.name}`
                    : `Digital · R$ ${p.data.digital.fixedPerCopy} + R$ ${p.data.digital.perPage}/pág.`}
                </span>
              </div>
              {canEdit && (
                <>
                  <button className="btn btn-sm" onClick={() => setEditing({ id: p.id, name: p.name, data: JSON.parse(JSON.stringify(p.data)) })}>
                    Editar
                  </button>
                  <button className="btn btn-sm" onClick={() => startNew(p.data, `${p.name} (cópia)`)}>
                    Duplicar
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={async () => {
                      if (!window.confirm(`Excluir o perfil “${p.name}”? Projetos que já usam ficam com uma cópia dele.`)) return;
                      try {
                        await api(`/api/biblioteca/grafica/${p.id}`, { method: 'DELETE' });
                        router.refresh();
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Excluir
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Num({ id, label, value, onChange, step = 1, min = 0, suffix }: { id: string; label: string; value: number; onChange: (n: number) => void; step?: number; min?: number; suffix?: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {suffix && <span className="small">{suffix}</span>}
      </label>
      <input id={id} type="number" min={min} step={step} value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function PrinterForm({
  value,
  onSave,
  onCancel,
}: {
  value: { id: string | null; name: string; data: PrinterProfile };
  onSave: (v: { id: string | null; name: string; data: PrinterProfile }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(value.name);
  const [d, setD] = useState<PrinterProfile>(value.data);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const o = d.offset;
  const setO = (patch: Partial<PrinterProfile['offset']>) => setD({ ...d, offset: { ...o, ...patch } });
  const setSheet = (i: number, patch: Partial<SheetFormat>) => setO({ sheets: o.sheets.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const sizes = d.process === 'digital' ? d.signatureSizes : [o.maxFolding, o.maxFolding / 2, o.maxFolding / 4].filter((s) => s >= Math.max(4, o.minSignature));
          await onSave({ id: value.id, name, data: { ...d, name, signatureSizes: sizes } });
        } catch (err) {
          setError((err as Error).message);
          setBusy(false);
        }
      }}
    >
      <div className="panel-head">
        <h2>{value.id ? `Editar “${value.name}”` : 'Novo perfil de gráfica'}</h2>
        <div className="row" style={{ flex: 'none' }}>
          <button type="button" className="btn" onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn btn-primary" disabled={busy || !name.trim()}>
            {busy ? 'Salvando…' : 'Salvar perfil'}
          </button>
        </div>
      </div>
      <div className="panel-body">
        {error && <p className="form-error">{error}</p>}
        <div className="grid-2">
          <div className="field">
            <label htmlFor="pf-name">Nome</label>
            <input id="pf-name" type="text" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="pf-proc">Processo</label>
            <select id="pf-proc" value={d.process} onChange={(e) => setD({ ...d, process: e.target.value as 'offset' | 'digital', signatureSizes: e.target.value === 'digital' ? [2] : d.signatureSizes })}>
              <option value="offset">Offset</option>
              <option value="digital">Digital</option>
            </select>
          </div>
        </div>

        <p className="section-title">Papel do miolo</p>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="pp-name">Papel</label>
            <input id="pp-name" type="text" value={d.paper.name} onChange={(e) => setD({ ...d, paper: { ...d.paper, name: e.target.value } })} />
          </div>
          <Num id="pp-g" label="Gramatura" suffix="g/m²" value={d.paper.grammage} onChange={(n) => setD({ ...d, paper: { ...d.paper, grammage: n } })} />
          <Num id="pp-mm" label="Espessura por página" suffix="mm" step={0.001} value={d.paper.mmPerPage} onChange={(n) => setD({ ...d, paper: { ...d.paper, mmPerPage: n } })} />
          <Num id="pp-kg" label="Preço" suffix="R$/kg" step={0.1} value={d.paper.pricePerKg} onChange={(n) => setD({ ...d, paper: { ...d.paper, pricePerKg: n } })} />
        </div>

        {d.process === 'digital' ? (
          <>
            <p className="section-title">Digital</p>
            <div className="grid-2">
              <Num id="dg-f" label="Fixo por exemplar" suffix="R$" step={0.01} value={d.digital.fixedPerCopy} onChange={(n) => setD({ ...d, digital: { ...d.digital, fixedPerCopy: n } })} />
              <Num id="dg-p" label="Por página" suffix="R$" step={0.001} value={d.digital.perPage} onChange={(n) => setD({ ...d, digital: { ...d.digital, perPage: n } })} />
            </div>
          </>
        ) : (
          <>
            <p className="section-title">Folhas de impressão</p>
            <ul className="list" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
              {o.sheets.map((s, i) => (
                <li key={i}>
                  <div className="row" style={{ flex: 1, alignItems: 'flex-end' }}>
                    <div className="field">
                      <label htmlFor={`sh-n-${i}`}>Nome</label>
                      <input id={`sh-n-${i}`} type="text" value={s.name} onChange={(e) => setSheet(i, { name: e.target.value })} />
                    </div>
                    <Num id={`sh-w-${i}`} label="Largura" suffix="mm" value={s.widthMm} onChange={(n) => setSheet(i, { widthMm: n })} />
                    <Num id={`sh-h-${i}`} label="Altura" suffix="mm" value={s.heightMm} onChange={(n) => setSheet(i, { heightMm: n })} />
                  </div>
                  <button type="button" className="btn btn-sm" disabled={o.sheets.length <= 1} onClick={() => setO({ sheets: o.sheets.filter((_, j) => j !== i) })}>
                    Remover
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-sm"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => setO({ sheets: [...o.sheets, { id: `f${Date.now().toString(36)}`, name: 'Nova', widthMm: 640, heightMm: 880 }] })}
            >
              Adicionar folha
            </button>

            <p className="section-title">Dobra e acerto</p>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="of-fold">Maior caderno da dobradeira</label>
                <select id="of-fold" value={o.maxFolding} onChange={(e) => setO({ maxFolding: Number(e.target.value) })}>
                  {[8, 16, 32, 64].map((n) => (
                    <option key={n} value={n}>
                      {n} páginas
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="of-min">Menor caderno aceito</label>
                <select id="of-min" value={o.minSignature} onChange={(e) => setO({ minSignature: Number(e.target.value) })}>
                  {[4, 8, 16].map((n) => (
                    <option key={n} value={n}>
                      {n} páginas
                    </option>
                  ))}
                </select>
              </div>
              <Num id="of-s1" label="Chapas + acerto: folha inteira" suffix="R$" value={o.setupByFraction['1'] ?? 0} onChange={(n) => setO({ setupByFraction: { ...o.setupByFraction, '1': n } })} />
              <Num id="of-s2" label="… meia folha" suffix="R$" value={o.setupByFraction['0.5'] ?? 0} onChange={(n) => setO({ setupByFraction: { ...o.setupByFraction, '0.5': n } })} />
              <Num id="of-s4" label="… quarto de folha" suffix="R$" value={o.setupByFraction['0.25'] ?? 0} onChange={(n) => setO({ setupByFraction: { ...o.setupByFraction, '0.25': n } })} />
              <Num id="of-run" label="Rodagem" suffix="R$/1.000 folhas" value={o.runPerThousandSheets} onChange={(n) => setO({ runPerThousandSheets: n })} />
              <Num id="of-waste" label="Perda de papel" suffix="%" value={Math.round(o.waste * 1000) / 10} step={0.5} onChange={(n) => setO({ waste: n / 100 })} />
              <Num id="of-bind" label="Encadernação" suffix="R$/ex." step={0.01} value={o.bindingPerCopy} onChange={(n) => setO({ bindingPerCopy: n })} />
              <Num id="of-cover" label="Capa" suffix="R$/ex." step={0.01} value={o.coverPerCopy} onChange={(n) => setO({ coverPerCopy: n })} />
            </div>
            <details>
              <summary className="small muted">Imposição (pinça, margens, refile)</summary>
              <div className="grid-2" style={{ marginTop: 8 }}>
                <Num id="of-grip" label="Pinça" suffix="mm" value={o.gripperMm} onChange={(n) => setO({ gripperMm: n })} />
                <Num id="of-marg" label="Margem nas outras bordas" suffix="mm" value={o.sheetMarginMm} onChange={(n) => setO({ sheetMarginMm: n })} />
                <Num id="of-allow" label="Refile/sangria por página" suffix="mm" value={o.pageAllowanceMm} onChange={(n) => setO({ pageAllowanceMm: n })} />
              </div>
            </details>
          </>
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Modelos

function Templates({ templates, canEdit }: { templates: LibraryItem<DesignSpec>[]; canEdit: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
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
    <section className="panel">
      <div className="panel-head">
        <h2>Modelos de projeto gráfico</h2>
      </div>
      {error && <p className="form-error" style={{ margin: 12 }}>{error}</p>}
      {templates.length === 0 ? (
        <div className="panel-body">
          <p className="muted" style={{ margin: 0 }}>
            Nenhum modelo ainda. No editor de um projeto, em Ajustes → Modelo de projeto gráfico → <strong>Salvar atual</strong>, o formato, a mancha, a tipografia e a
            abertura de capítulo viram um modelo para novos livros.
          </p>
        </div>
      ) : (
        <ul className="list">
          {templates.map((t) => (
            <li key={t.id}>
              <div className="grow">
                <strong>{t.name}</strong>
                <span className="small muted">
                  {t.data.trimWidthMm} × {t.data.trimHeightMm} mm · corpo {t.data.bodySizePt}/{t.data.leadingPt} pt · margens {t.data.marginTopMm}/{t.data.marginBottomMm}/
                  {t.data.marginInnerMm}/{t.data.marginOuterMm} mm · abertura {PRESET_LABELS[t.data.chapterOpening?.preset ?? 'classica']}
                </span>
              </div>
              {canEdit && (
                <>
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      const n = window.prompt('Novo nome do modelo', t.name);
                      if (n && n.trim() && n !== t.name) void act(() => api(`/api/biblioteca/modelo/${t.id}`, { method: 'PATCH', body: { name: n } }));
                    }}
                  >
                    Renomear
                  </button>
                  <button className="btn btn-sm" onClick={() => window.confirm(`Excluir o modelo “${t.name}”?`) && void act(() => api(`/api/biblioteca/modelo/${t.id}`, { method: 'DELETE' }))}>
                    Excluir
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Conta

function Account({ user }: { user: { name: string; email: string } }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Minha conta</h2>
      </div>
      <div className="panel-body">
        <p style={{ margin: 0 }}>
          <strong>{user.name}</strong> · {user.email}
        </p>
        <form
          style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (f.get('next') !== f.get('confirm')) return setMsg({ ok: false, text: 'A confirmação não confere com a nova senha.' });
            try {
              await api('/api/auth/senha', { body: { current: f.get('current'), next: f.get('next') } });
              (e.target as HTMLFormElement).reset();
              setMsg({ ok: true, text: 'Senha alterada. As outras sessões foram encerradas.' });
            } catch (err) {
              setMsg({ ok: false, text: (err as Error).message });
            }
          }}
        >
          <p className="section-title" style={{ margin: 0 }}>
            Trocar senha
          </p>
          <div className="field">
            <label htmlFor="pw-cur">Senha atual</label>
            <input id="pw-cur" name="current" type="password" autoComplete="current-password" required className="search" />
          </div>
          <div className="field">
            <label htmlFor="pw-new">Nova senha</label>
            <input id="pw-new" name="next" type="password" autoComplete="new-password" minLength={8} required className="search" />
          </div>
          <div className="field">
            <label htmlFor="pw-conf">Confirmar nova senha</label>
            <input id="pw-conf" name="confirm" type="password" autoComplete="new-password" minLength={8} required className="search" />
          </div>
          {msg && <p className={msg.ok ? 'small' : 'form-error'} style={msg.ok ? { color: 'var(--success)', margin: 0 } : undefined}>{msg.text}</p>}
          <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
            Alterar senha
          </button>
        </form>
      </div>
    </section>
  );
}
