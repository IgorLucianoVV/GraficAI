import { useState } from 'react';
import { ELEMENT_RULES, GROUP_LABELS, LAUDA_PRESETS, type Book, type Diagnosis, type LaudaConfig } from '@graficai/core';
import { dec, download, groupColor, num } from '../format.ts';

interface Props {
  book: Book;
  diag: Diagnosis;
  lauda: LaudaConfig;
  selectedElement: string | null;
  onElement: (id: string | null, firstPage: number) => void;
  onLauda: (l: LaudaConfig) => void;
}

export function LeftPanel({ book, diag, lauda, selectedElement, onElement, onLauda }: Props) {
  const [tab, setTab] = useState<'arvore' | 'laudas'>('arvore');
  const layoutOf = new Map(diag.layout.elements.map((e) => [e.id, e]));

  const exportCsv = () => {
    const rows = [['elemento', 'caracteres_com_espacos', 'laudas'], ...diag.stats.byElement.map((e) => [`"${e.title.replace(/"/g, '""')}"`, e.charsWithSpaces, String(e.laudas).replace('.', ',')])];
    rows.push(['"TOTAL"', diag.stats.charsWithSpaces, String(Math.round(diag.stats.laudasRaw * 100) / 100).replace('.', ',')]);
    download(`${book.title}-laudas.csv`, rows.map((r) => r.join(';')).join('\n'), 'text/csv;charset=utf-8');
  };

  return (
    <aside className="panel" aria-label="Estrutura e laudas">
      <div className="panel-head">
        <div className="tabs" role="tablist">
          <button className="tab" role="tab" aria-selected={tab === 'arvore'} onClick={() => setTab('arvore')}>
            Árvore
          </button>
          <button className="tab" role="tab" aria-selected={tab === 'laudas'} onClick={() => setTab('laudas')}>
            Laudas
          </button>
        </div>
      </div>

      {tab === 'arvore' ? (
        <div className="panel-body" style={{ gap: 0 }}>
          {(['pre', 'texto', 'pos'] as const).map((g) => {
            const items = book.elements.filter((e) => ELEMENT_RULES[e.kind].group === g);
            if (!items.length) return null;
            return (
              <div key={g}>
                <div className="tree-group">{GROUP_LABELS[g]}</div>
                <ul className="tree">
                  {items.map((e) => {
                    const lay = layoutOf.get(e.id);
                    return (
                      <li key={e.id}>
                        <button
                          className="tree-item"
                          aria-current={selectedElement === e.id}
                          onClick={() => onElement(selectedElement === e.id ? null : e.id, lay?.startPage ?? 1)}
                        >
                          <span className="dot" style={{ background: groupColor(e.kind) }} aria-hidden />
                          <span className="tree-title">{e.title}</span>
                          <span className="tree-pages">{lay ? `p. ${lay.startPage}` : ''}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          <p className="small muted" style={{ padding: '12px 8px 0' }}>
            Clique num elemento para destacá-lo no mapa. Reordene na aba Estrutura.
          </p>
        </div>
      ) : (
        <div className="panel-body">
          <div className="summary-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="stat">
              <div className="stat-value">{dec(Math.round(diag.stats.laudasRaw * 100) / 100)}</div>
              <div className="stat-label">laudas (valor bruto)</div>
            </div>
            <div className="stat">
              <div className="stat-value">{dec(diag.stats.laudas)}</div>
              <div className="stat-label">laudas (contrato)</div>
            </div>
          </div>
          <div className="small num">
            <div>{num(diag.stats.charsWithSpaces)} caracteres com espaços</div>
            <div className="muted">{num(diag.stats.charsWithoutSpaces)} sem espaços · {num(diag.stats.words)} palavras · {num(diag.stats.paragraphs)} parágrafos</div>
          </div>
          <div className="field">
            <label htmlFor="lauda-preset">Caracteres por lauda</label>
            <select
              id="lauda-preset"
              value={LAUDA_PRESETS.some((p) => p.chars === lauda.charsPerLauda) ? lauda.charsPerLauda : 'custom'}
              onChange={(e) => e.target.value !== 'custom' && onLauda({ ...lauda, charsPerLauda: Number(e.target.value) })}
            >
              {LAUDA_PRESETS.map((p) => (
                <option key={p.chars} value={p.chars}>
                  {p.label} — {p.note}
                </option>
              ))}
              <option value="custom">Outro valor…</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="lauda-custom">Valor exato</label>
            <input
              id="lauda-custom"
              type="number"
              min={500}
              max={5000}
              step={50}
              value={lauda.charsPerLauda}
              onChange={(e) => Number(e.target.value) >= 500 && onLauda({ ...lauda, charsPerLauda: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor="lauda-round">Arredondamento</label>
            <select id="lauda-round" value={lauda.rounding} onChange={(e) => onLauda({ ...lauda, rounding: e.target.value as LaudaConfig['rounding'] })}>
              <option value="nenhum">Sem arredondar (2 casas)</option>
              <option value="meia">Para cima, em meia lauda</option>
              <option value="cima">Para cima, lauda inteira</option>
            </select>
          </div>
          <label className="check small">
            <input type="checkbox" checked={lauda.includeNotes} onChange={(e) => onLauda({ ...lauda, includeNotes: e.target.checked })} />
            Incluir notas de rodapé na contagem
          </label>
          <hr className="sep" />
          <p className="section-title">Por elemento</p>
          <table className="small num" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {diag.stats.byElement
                .filter((e) => e.charsWithSpaces > 0)
                .map((e) => (
                  <tr key={e.id}>
                    <td style={{ padding: '3px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{e.title}</td>
                    <td style={{ textAlign: 'right' }}>{dec(e.laudas)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <button className="btn" onClick={exportCsv}>
            Exportar laudas (CSV)
          </button>
        </div>
      )}
    </aside>
  );
}
