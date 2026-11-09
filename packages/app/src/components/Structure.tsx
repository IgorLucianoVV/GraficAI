import { Fragment, useMemo, useState } from 'react';
import { ELEMENT_RULES, KIND_LABELS, GROUP_LABELS, type Book, type BookElement, type ElementKind } from '@graficai/core';
import { groupColor, num } from '../format.ts';
import { inlineStats } from '@graficai/core';
import { Runs, blocksRuns } from './Runs.tsx';

interface Props {
  book: Book;
  llmUsed: boolean;
  warnings: string[];
  onChange: (book: Book, label: string, toast?: string) => void;
  onContinue: () => void;
}

const KINDS = Object.keys(KIND_LABELS) as ElementKind[];
const RANK = { baixa: 0, media: 1, alta: 2 } as const;

export function Structure({ book, llmUsed, warnings, onChange, onContinue }: Props) {
  const [lowFirst, setLowFirst] = useState(true);
  const [why, setWhy] = useState<string | null>(null);

  const rows = useMemo(() => {
    const list = book.elements.map((e, i) => ({ e, i }));
    if (!lowFirst) return list;
    return [...list].sort((a, b) => {
      const ra = a.e.classifiedBy === 'usuario' ? 3 : RANK[a.e.confidence];
      const rb = b.e.classifiedBy === 'usuario' ? 3 : RANK[b.e.confidence];
      return ra - rb || a.i - b.i;
    });
  }, [book, lowFirst]);

  const pending = book.elements.filter((e) => e.confidence !== 'alta' && e.classifiedBy !== 'usuario').length;

  const update = (id: string, patch: Partial<BookElement>, label: string) =>
    onChange({ ...book, elements: book.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) }, label);

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= book.elements.length) return;
    const els = [...book.elements];
    [els[index], els[j]] = [els[j], els[index]];
    onChange({ ...book, elements: els }, 'mover elemento');
  };

  const remove = (id: string) => {
    const el = book.elements.find((e) => e.id === id)!;
    onChange({ ...book, elements: book.elements.filter((e) => e.id !== id) }, `remover “${el.title}”`, `“${el.title}” removido.`);
  };

  const acceptAll = () =>
    onChange(
      { ...book, elements: book.elements.map((e) => ({ ...e, classifiedBy: 'usuario' as const, confidence: 'alta' as const })) },
      'aceitar classificação',
      'Classificação aceita para todos os elementos.',
    );

  const chars = (e: BookElement) => e.blocks.reduce((a, b) => a + b.text.length, 0);

  return (
    <main className="center">
      <div className="structure">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-book)', fontSize: 26 }}>Revise a estrutura</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              {pending > 0
                ? `${pending} ${pending === 1 ? 'elemento precisa' : 'elementos precisam'} de revisão — eles aparecem primeiro.`
                : 'Tudo revisado. Os números do diagnóstico já usam esta estrutura.'}{' '}
              {llmUsed ? <span className="ai-tag">classificado com IA</span> : <span className="small">Classificado por regras.</span>}
            </p>
          </div>
          <label className="check small">
            <input type="checkbox" checked={lowFirst} onChange={(e) => setLowFirst(e.target.checked)} />
            Incertos primeiro
          </label>
          <button className="btn" onClick={acceptAll}>
            Aceitar todos
          </button>
          <button className="btn btn-primary" onClick={onContinue}>
            Ver diagnóstico →
          </button>
        </div>

        {warnings.length > 0 && (
          <div className="issue alerta" role="status">
            <span className="issue-bar" />
            <div>
              {warnings.map((w) => (
                <p key={w} className="small">{w}</p>
              ))}
            </div>
          </div>
        )}

        <table className="st-table">
          <thead>
            <tr>
              <th style={{ width: 70 }}>Ordem</th>
              <th>Elemento</th>
              <th style={{ width: 210 }}>Tipo</th>
              <th style={{ width: 110 }}>Caracteres</th>
              <th style={{ width: 130 }}>Confiança</th>
              <th style={{ width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ e, i }) => (
              <Fragment key={e.id}>
                <tr>
                  <td>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button className="btn btn-ghost btn-sm" aria-label={`Mover “${e.title}” para cima`} disabled={i === 0} onClick={() => move(i, -1)}>
                        ↑
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        aria-label={`Mover “${e.title}” para baixo`}
                        disabled={i === book.elements.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="dot" style={{ background: groupColor(e.kind) }} aria-hidden />
                      <span className="num muted small">{i + 1}.</span>
                      <span>{e.title}</span>
                      <InlineBadges el={e} />
                    </div>
                  </td>
                  <td>
                    <select
                      aria-label={`Tipo de “${e.title}”`}
                      value={e.kind}
                      onChange={(ev) =>
                        update(e.id, { kind: ev.target.value as ElementKind, classifiedBy: 'usuario', confidence: 'alta', rationale: 'definido por você.' }, `mudar tipo de “${e.title}”`)
                      }
                    >
                      {(['pre', 'texto', 'pos'] as const).map((g) => (
                        <optgroup key={g} label={GROUP_LABELS[g]}>
                          {KINDS.filter((k) => ELEMENT_RULES[k].group === g).map((k) => (
                            <option key={k} value={k}>
                              {KIND_LABELS[k]}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </td>
                  <td className="num">{num(chars(e))}</td>
                  <td>
                    {e.classifiedBy === 'usuario' ? (
                      <span className="badge usuario">revisado</span>
                    ) : (
                      <button className="btn btn-ghost btn-sm" style={{ padding: 0 }} onClick={() => setWhy(why === e.id ? null : e.id)} aria-expanded={why === e.id}>
                        <span className={`badge ${e.confidence}`}>{e.confidence === 'media' ? 'média' : e.confidence}</span>
                        <span className="small muted">Por quê?</span>
                      </button>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      {e.classifiedBy !== 'usuario' && e.confidence !== 'alta' && (
                        <button className="btn btn-sm" onClick={() => update(e.id, { classifiedBy: 'usuario', confidence: 'alta' }, `confirmar “${e.title}”`)}>
                          Confirmar
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm" aria-label={`Remover “${e.title}”`} onClick={() => remove(e.id)}>
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
                {why === e.id && (
                  <tr>
                    <td></td>
                    <td colSpan={5}>
                      <div className="why small">
                        <p>
                          <strong>{e.classifiedBy === 'llm' ? 'IA' : 'Regra'}:</strong> {e.rationale}
                        </p>
                        <p className="muted">{e.blocks.length ? <Runs runs={blocksRuns(e.blocks)} limit={260} /> : 'Sem texto (página fixa).'}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function InlineBadges({ el }: { el: BookElement }) {
  const st = inlineStats(el);
  if (!st.notes && !st.italic && !st.bold) return null;
  const parts = [st.notes && `${st.notes} ${st.notes === 1 ? 'nota' : 'notas'}`, st.italic && `${st.italic} itálico${st.italic === 1 ? '' : 's'}`, st.bold && `${st.bold} negrito${st.bold === 1 ? '' : 's'}`].filter(Boolean);
  return (
    <span className="small muted" title="Formatação preservada do original">
      · {parts.join(' · ')}
    </span>
  );
}
