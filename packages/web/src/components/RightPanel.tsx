import type { Book, Diagnosis, Issue, ProjectSettings, Variant, DesignSpec } from '@graficai/core';
import { PRINTERS, PAPERS, TRIMS, describePlan, explainPage, KIND_LABELS } from '@graficai/core';
import type { RightTab } from '../state.ts';
import { brl, dec, num } from '../format.ts';
import { OpeningSettings } from './OpeningSettings.tsx';

interface Props {
  tab: RightTab;
  onTab: (t: RightTab) => void;
  book: Book;
  diag: Diagnosis;
  settings: ProjectSettings;
  selectedPage: number | null;
  variants: Variant[] | null;
  variantsStale: boolean;
  optimizing: boolean;
  onOptimize: () => void;
  onApplyVariant: (v: Variant) => void;
  onLive: (s: ProjectSettings, label: string) => void;
  onEndLive: () => void;
  onCommit: (s: ProjectSettings, label: string) => void;
  onSelectPage: (p: number) => void;
  onFixIssue: (i: Issue) => void;
}

export function RightPanel(props: Props) {
  const { tab, onTab, diag } = props;
  const alerts = diag.issues.filter((i) => i.severity !== 'info').length;
  return (
    <aside className="panel right" aria-label="Diagnóstico e ajustes">
      <div className="panel-head">
        <div className="tabs" role="tablist" style={{ flexWrap: 'wrap' }}>
          <button className="tab" role="tab" aria-selected={tab === 'problemas'} onClick={() => onTab('problemas')}>
            Problemas {alerts > 0 && <span className="num">({alerts})</span>}
          </button>
          <button className="tab" role="tab" aria-selected={tab === 'propostas'} onClick={() => onTab('propostas')}>
            Propostas
          </button>
          <button className="tab" role="tab" aria-selected={tab === 'ajustes'} onClick={() => onTab('ajustes')}>
            Ajustes
          </button>
          {props.selectedPage && (
            <button className="tab" role="tab" aria-selected={tab === 'pagina'} onClick={() => onTab('pagina')}>
              Pág. {props.selectedPage}
            </button>
          )}
        </div>
      </div>
      <div className="panel-body">
        {tab === 'problemas' && <Issues {...props} />}
        {tab === 'propostas' && <Proposals {...props} />}
        {tab === 'ajustes' && <Adjustments {...props} />}
        {tab === 'pagina' && props.selectedPage && <PageDetail {...props} page={props.selectedPage} />}
      </div>
    </aside>
  );
}

function Issues({ diag, onSelectPage, onFixIssue, onTab }: Props) {
  if (diag.issues.length === 0)
    return (
      <div className="issue info">
        <span className="issue-bar" style={{ background: 'var(--success)' }} />
        <p>Nenhum problema encontrado. O livro fecha em {describePlan(diag.plan)} sem páginas sobrando.</p>
      </div>
    );
  const order = { erro: 0, alerta: 1, info: 2 } as const;
  return (
    <>
      <p className="small muted" style={{ margin: 0 }}>
        Encontrei {diag.issues.length} {diag.issues.length === 1 ? 'ponto' : 'pontos'} de atenção.
      </p>
      {[...diag.issues]
        .sort((a, b) => order[a.severity] - order[b.severity])
        .map((i, idx) => (
          <div key={idx} className={`issue ${i.severity}`}>
            <span className="issue-bar" />
            <div>
              <p>{i.message}</p>
              {i.suggestion && <p className="sugg">{i.suggestion}</p>}
              <div className="issue-actions">
                {i.page && (
                  <button className="btn btn-sm" onClick={() => onSelectPage(i.page!)}>
                    Ver página
                  </button>
                )}
                {(i.kind === 'fecho_caderno' || i.kind === 'linhas_viuvas') && (
                  <button className="btn btn-sm" onClick={() => onTab('propostas')}>
                    Ver propostas
                  </button>
                )}
                {i.kind === 'baixa_confianca' && (
                  <button className="btn btn-sm" onClick={() => onFixIssue(i)}>
                    Revisar estrutura
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
    </>
  );
}

function Proposals({ diag, variants, variantsStale, optimizing, onOptimize, onApplyVariant }: Props) {
  if (optimizing)
    return (
      <div aria-live="polite">
        <p style={{ margin: 0, fontWeight: 600 }}>Testando variações de corpo, entrelinha e margens…</p>
        <p className="small muted">Cada variação é composta e montada em cadernos. Você pode continuar trabalhando.</p>
      </div>
    );
  if (!variants)
    return (
      <>
        <p style={{ margin: 0 }}>
          Gere três projetos — econômico, equilibrado e confortável — dentro de limites de legibilidade (corpo ≥ 10 pt, entrelinha ≥ 1,18×).
        </p>
        <button className="btn btn-primary" onClick={onOptimize}>
          Gerar propostas
        </button>
      </>
    );
  const best = Math.min(...variants.map((v) => v.diagnosis.cost.total));
  return (
    <>
      {variantsStale && (
        <div className="issue alerta">
          <span className="issue-bar" />
          <div>
            <p className="small">O livro ou os ajustes mudaram desde que as propostas foram geradas.</p>
            <div className="issue-actions">
              <button className="btn btn-sm" onClick={onOptimize}>
                Gerar de novo
              </button>
            </div>
          </div>
        </div>
      )}
      <p className="small muted" style={{ margin: 0 }}>
        Atual: {diag.plan.totalPages} páginas · {describePlan(diag.plan)} · {brl(diag.cost.perCopy)}/ex.
      </p>
      {variants.map((v) => {
        const saving = diag.cost.total - v.diagnosis.cost.total;
        return (
          <article key={v.id} className={`variant${v.diagnosis.cost.total === best ? ' best' : ''}`} aria-label={`Proposta ${v.id}, ${v.label}`}>
            <div className="variant-head">
              <span className="variant-name">
                {v.id} · {v.label}
              </span>
              <span className="variant-cost">{brl(v.diagnosis.cost.perCopy)}/ex.</span>
            </div>
            <div className="small num">{v.description}</div>
            <div className={`saving ${saving > 0 ? 'delta-good' : saving < 0 ? 'delta-bad' : 'muted'}`}>
              {saving > 0 ? `Economia de ${brl(saving)} na tiragem` : saving < 0 ? `Custa ${brl(-saving)} a mais na tiragem` : 'Mesmo custo do projeto atual'}
              {v.diagnosis.plan.sizes.length !== diag.plan.sizes.length && ` · ${diag.plan.sizes.length} → ${v.diagnosis.plan.sizes.length} cadernos`}
            </div>
            <ul className="changes">
              {v.changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <div className="issue-actions">
              <button className="btn btn-sm btn-primary" onClick={() => onApplyVariant(v)}>
                Aplicar
              </button>
            </div>
          </article>
        );
      })}
      <p className="small muted" style={{ margin: 0 }}>
        Aplicar é reversível com Ctrl+Z. O texto nunca é alterado; só o projeto gráfico.
      </p>
    </>
  );
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  unit,
  onLive,
  onEnd,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onLive: (v: number) => void;
  onEnd: () => void;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>
        <span>{label}</span>
        <span className="num" style={{ color: 'var(--text)' }}>
          {dec(value)} {unit}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onLive(Number(e.target.value))}
        onPointerUp={onEnd}
        onKeyUp={onEnd}
        onBlur={onEnd}
      />
    </div>
  );
}

function Adjustments({ book, settings, onLive, onEndLive, onCommit, diag }: Props) {
  const d = settings.design;
  const live = (patch: Partial<DesignSpec>, label: string) => onLive({ ...settings, design: { ...d, ...patch } }, label);
  const commit = (s: ProjectSettings, label: string) => onCommit(s, label);
  const trim = TRIMS.find((t) => t.w === d.trimWidthMm && t.h === d.trimHeightMm);

  return (
    <>
      <p className="section-title">Projeto gráfico</p>
      <div className="field">
        <label htmlFor="trim">Formato</label>
        <select
          id="trim"
          value={trim ? trim.label : 'custom'}
          onChange={(e) => {
            const t = TRIMS.find((x) => x.label === e.target.value);
            if (t) commit({ ...settings, design: { ...d, trimWidthMm: t.w, trimHeightMm: t.h } }, `formato ${t.label}`);
          }}
        >
          {TRIMS.map((t) => (
            <option key={t.label}>{t.label}</option>
          ))}
          {!trim && <option value="custom">{d.trimWidthMm / 10} × {d.trimHeightMm / 10} cm</option>}
        </select>
      </div>
      <Slider id="body" label="Corpo do texto" value={d.bodySizePt} min={9} max={14} step={0.25} unit="pt" onLive={(v) => live({ bodySizePt: v }, 'corpo do texto')} onEnd={onEndLive} />
      <Slider id="lead" label="Entrelinha" value={d.leadingPt} min={10} max={20} step={0.25} unit="pt" onLive={(v) => live({ leadingPt: v }, 'entrelinha')} onEnd={onEndLive} />
      {d.leadingPt / d.bodySizePt < 1.18 && <p className="small" style={{ color: 'var(--warning)', margin: 0 }}>Entrelinha apertada para o corpo escolhido (menos de 1,18×).</p>}
      <Slider id="mi" label="Margem interna" value={d.marginInnerMm} min={12} max={35} step={0.5} unit="mm" onLive={(v) => live({ marginInnerMm: v }, 'margem interna')} onEnd={onEndLive} />
      <Slider id="mo" label="Margem externa" value={d.marginOuterMm} min={10} max={30} step={0.5} unit="mm" onLive={(v) => live({ marginOuterMm: v }, 'margem externa')} onEnd={onEndLive} />
      <Slider
        id="mt"
        label="Margens sup./inf."
        value={d.marginTopMm}
        min={12}
        max={30}
        step={0.5}
        unit="mm"
        onLive={(v) => live({ marginTopMm: v, marginBottomMm: v }, 'margens superior e inferior')}
        onEnd={onEndLive}
      />
      <Slider id="ps" label="Espaço entre parágrafos" value={d.paragraphSpacingLines} min={0} max={1} step={0.25} unit="linha" onLive={(v) => live({ paragraphSpacingLines: v }, 'espaço entre parágrafos')} onEnd={onEndLive} />
      <label className="check small">
        <input type="checkbox" checked={d.chaptersOnOdd} onChange={(e) => commit({ ...settings, design: { ...d, chaptersOnOdd: e.target.checked } }, 'abertura de capítulos')} />
        Capítulos sempre em página ímpar
      </label>
      <p className="small muted num" style={{ margin: 0 }}>
        Mancha: {num(diag.layout.metrics.charsPerLine)} caracteres × {num(diag.layout.metrics.linesPerPage)} linhas por página.
      </p>

      <hr className="sep" />
      <OpeningSettings book={book} diag={diag} settings={settings} onCommit={commit} />

      <hr className="sep" />
      <p className="section-title">Gráfica e tiragem</p>
      <div className="field">
        <label htmlFor="printer">Perfil da gráfica</label>
        <select
          id="printer"
          value={settings.printer.id}
          onChange={(e) => {
            const p = PRINTERS.find((x) => x.id === e.target.value)!;
            commit({ ...settings, printer: { ...JSON.parse(JSON.stringify(p)), paper: settings.printer.paper } }, `gráfica ${p.name}`);
          }}
        >
          {PRINTERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="run">Tiragem</label>
          <input id="run" type="number" min={1} step={100} value={settings.run} onChange={(e) => Number(e.target.value) > 0 && commit({ ...settings, run: Math.round(Number(e.target.value)) }, 'tiragem')} />
        </div>
        <div className="field">
          <label htmlFor="paper">Papel</label>
          <select
            id="paper"
            value={settings.printer.paper.name}
            onChange={(e) => commit({ ...settings, printer: { ...settings.printer, paper: PAPERS.find((p) => p.name === e.target.value)! } }, 'papel')}
          >
            {PAPERS.map((p) => (
              <option key={p.name}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Cadernos aceitos: {settings.printer.signatureSizes.join(', ')} páginas. Valores de custo são de exemplo — substitua pela tabela da sua gráfica.
      </p>
    </>
  );
}

function PageDetail({ book, diag, page, onSelectPage }: Props & { page: number }) {
  const ex = explainPage(book, diag, page);
  const p = diag.layout.pages[page - 1];
  const el = p?.elementId ? book.elements.find((e) => e.id === p.elementId) : null;
  const lines = p && p.kind === 'conteudo' ? Math.max(1, Math.round(p.fill * 22)) : 0;
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-sm" style={{ flex: 'none' }} disabled={page <= 1} onClick={() => onSelectPage(page - 1)} aria-label="Página anterior">
          ←
        </button>
        <span className="num small" style={{ textAlign: 'center' }}>
          {page} de {diag.plan.totalPages}
        </span>
        <button className="btn btn-sm" style={{ flex: 'none' }} disabled={page >= diag.plan.totalPages} onClick={() => onSelectPage(page + 1)} aria-label="Próxima página">
          →
        </button>
      </div>
      <div className="page-preview" aria-hidden>
        {p && p.kind === 'conteudo' && (
          <div className="mancha" style={{ left: '17%', right: '13%', top: p.isOpener ? '30%' : '10%' }}>
            {p.isOpener && el && <div className="ttl">{el.title}</div>}
            {Array.from({ length: lines }, (_, i) => (
              <div key={i} className="ln" style={{ width: i === lines - 1 ? '55%' : '100%' }} />
            ))}
          </div>
        )}
        {p && p.kind === 'branco' && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 12, color: '#8a857b' }}>em branco</div>
        )}
        <div style={{ position: 'absolute', bottom: 6, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: '#8a857b' }}>{page}</div>
      </div>
      <div className="why">
        <h3>{ex.title}</h3>
        {ex.lines.map((l) => (
          <p key={l} className="small">
            {l}
          </p>
        ))}
      </div>
      {el && <p className="small muted">{KIND_LABELS[el.kind]}</p>}
    </>
  );
}
