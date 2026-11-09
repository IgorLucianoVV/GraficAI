import type { Diagnosis, ProjectSettings } from '@graficai/core';
import { describePlan } from '@graficai/core';
import { brl, dec, num } from '../format.ts';

export function Summary({ diag, settings }: { diag: Diagnosis; settings: ProjectSettings }) {
  const ew = diag.evenWorking;
  const blanksByReason = {
    abre_impar: diag.layout.pages.filter((p) => p.blankReason === 'abre_impar').length,
    verso: diag.layout.pages.filter((p) => p.blankReason === 'verso_branco').length,
    fecho: diag.plan.paddingPages,
  };

  return (
    <section aria-label="Resumo do diagnóstico" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="summary-grid">
        <div className="stat">
          <div className="stat-label">Páginas</div>
          <div className="stat-value">{num(diag.plan.totalPages)}</div>
          <div className="stat-sub">{num(diag.layout.contentPages)} com conteúdo e brancos de regra</div>
        </div>
        <div className="stat">
          <div className="stat-label">Cadernos</div>
          <div className="stat-value">{diag.plan.sizes.length}</div>
          <div className="stat-sub">{describePlan(diag.plan)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Fechamento</div>
          <div className="stat-value">{ew.pagesToFill === 0 ? 'Exato' : `+${ew.pagesToFill}`}</div>
          <div className="stat-sub">
            {ew.pagesToFill === 0 ? 'sem páginas sobrando' : `ou corte ${ew.pagesToCut} pp para ${ew.lowerTotal}`}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Custo da tiragem</div>
          <div className="stat-value">{brl(diag.cost.total)}</div>
          <div className="stat-sub">
            {num(settings.run)} ex. · {brl(diag.cost.perCopy)} cada
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Brancos</div>
          <div className="stat-value">{diag.layout.blankPages}</div>
          <div className="stat-sub">
            {blanksByReason.abre_impar} abertura · {blanksByReason.verso} verso · {blanksByReason.fecho} fechamento
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Laudas</div>
          <div className="stat-value">{dec(diag.stats.laudas)}</div>
          <div className="stat-sub">{num(diag.stats.charsWithSpaces)} car. ÷ {num(settings.lauda.charsPerLauda)}</div>
        </div>
      </div>

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Composição do custo</summary>
        <table className="small num" style={{ width: '100%', marginTop: 8, borderCollapse: 'collapse' }}>
          <tbody>
            {diag.cost.items.map((i) => (
              <tr key={i.label}>
                <td style={{ padding: '4px 0' }}>{i.label}</td>
                <td style={{ textAlign: 'right' }}>{brl(i.value)}</td>
              </tr>
            ))}
            <tr style={{ borderTop: '1px solid var(--border)', fontWeight: 600 }}>
              <td style={{ padding: '6px 0' }}>Total</td>
              <td style={{ textAlign: 'right' }}>{brl(diag.cost.total)}</td>
            </tr>
          </tbody>
        </table>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Estimativa a partir do perfil “{settings.printer.name}”. Os valores são de exemplo; a lombada ({num(diag.spineMm, 1)} mm) deve ser confirmada pela gráfica.
        </p>
      </details>
    </section>
  );
}
