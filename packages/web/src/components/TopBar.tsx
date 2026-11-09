import type { Diagnosis } from '@graficai/core';
import { describePlan } from '@graficai/core';
import type { View } from '../state.ts';
import { brl, dec, num, signed } from '../format.ts';

interface Props {
  title: string | null;
  view: View;
  onView: (v: View) => void;
  diag: Diagnosis | null;
  prev: Diagnosis | null;
  onPalette: () => void;
  onExport?: () => void;
  theme: 'light' | 'dark';
  onTheme: () => void;
}

function Delta({ value, f, lowerIsBetter = true }: { value: number; f: (n: number) => string; lowerIsBetter?: boolean }) {
  if (!value) return null;
  const good = lowerIsBetter ? value < 0 : value > 0;
  return <span className={`metric-delta ${good ? 'delta-good' : 'delta-bad'}`}>{signed(value, f)}</span>;
}

export function TopBar({ title, view, onView, diag, prev, onPalette, onExport, theme, onTheme }: Props) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden />
        GraficAI
      </div>
      {title && <span className="book-title" title={title}>{title}</span>}
      {title && (
        <nav className="tabs" role="tablist" aria-label="Vistas">
          <button className="tab" role="tab" aria-selected={view === 'estrutura'} onClick={() => onView('estrutura')}>
            Estrutura
          </button>
          <button className="tab" role="tab" aria-selected={view === 'trabalho'} onClick={() => onView('trabalho')}>
            Diagnóstico
          </button>
        </nav>
      )}
      {diag ? (
        <div className="metrics" aria-live="polite">
          <div className="metric">
            <span className="metric-value" key={diag.plan.totalPages}>{num(diag.plan.totalPages)}</span>
            <span className="metric-label">páginas <Delta value={prev ? diag.plan.totalPages - prev.plan.totalPages : 0} f={(n) => num(n)} /></span>
          </div>
          <div className="metric">
            <span className="metric-value">{diag.plan.sizes.length}</span>
            <span className="metric-label" title={describePlan(diag.plan)}>
              cadernos <Delta value={prev ? diag.plan.sizes.length - prev.plan.sizes.length : 0} f={(n) => num(n)} />
            </span>
          </div>
          <div className="metric">
            <span className="metric-value">{brl(diag.cost.perCopy)}</span>
            <span className="metric-label">por exemplar <Delta value={prev ? Math.round((diag.cost.perCopy - prev.cost.perCopy) * 100) / 100 : 0} f={brl} /></span>
          </div>
          <div className="metric">
            <span className="metric-value">{dec(diag.stats.laudas)}</span>
            <span className="metric-label">laudas</span>
          </div>
          <div className="metric">
            <span className="metric-value">{num(diag.spineMm, 1)} mm</span>
            <span className="metric-label">lombada</span>
          </div>
        </div>
      ) : (
        <div style={{ marginLeft: 'auto' }} />
      )}
      {onExport && diag && (
        <button className="btn btn-sm" onClick={onExport}>
          Exportar
        </button>
      )}
      <button className="btn btn-ghost btn-sm" onClick={onPalette} aria-label="Abrir paleta de comandos">
        Comandos <span className="kbd">Ctrl K</span>
      </button>
      <button className="btn btn-ghost btn-sm" onClick={onTheme} aria-label="Alternar tema">
        {theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
      </button>
    </header>
  );
}
