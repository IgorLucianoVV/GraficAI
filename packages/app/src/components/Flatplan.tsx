import type { Book, Diagnosis, Page } from '@graficai/core';
import { KIND_LABELS } from '@graficai/core';
import { groupColor } from '../format.ts';

interface Props {
  book: Book;
  diag: Diagnosis;
  selected: number | null;
  onSelect: (page: number) => void;
  highlight: string | null;
}

function pageLabel(p: Page, book: Book): string {
  if (p.kind === 'branco') {
    const r = p.blankReason === 'abre_impar' ? 'branco obrigatório (abertura em ímpar)' : p.blankReason === 'verso_branco' ? 'branco editorial (verso)' : 'branco de fechamento do caderno';
    return `Página ${p.number}, ${r}`;
  }
  const el = book.elements.find((e) => e.id === p.elementId);
  return `Página ${p.number}, ${el ? `${KIND_LABELS[el.kind]} ${el.title}` : ''}, ocupação ${Math.round(p.fill * 100)}%`;
}

/**
 * Mapa de cadernos (flatplan): cada faixa é um caderno, as páginas aparecem em
 * pares de leitura (par à esquerda, ímpar à direita), coloridas por grupo editorial.
 */
export function Flatplan({ book, diag, selected, onSelect, highlight }: Props) {
  const issuePages = new Set(diag.issues.filter((i) => i.page).map((i) => i.page!));
  const kindOf = new Map(book.elements.map((e) => [e.id, e.kind]));
  const capOf = new Map(diag.layout.elements.filter((e) => e.opening?.cap).map((e) => [e.id, e.opening!.cap!]));
  let cursor = 0;

  return (
    <section className="flatplan" aria-label="Mapa de cadernos">
      {diag.plan.sizes.map((size, sigIdx) => {
        const start = cursor;
        cursor += size;
        const pages = diag.layout.pages.slice(start, start + size);
        // Página 1 é ímpar e fica sozinha (direita); depois, pares par/ímpar.
        const spreads: Page[][] = [];
        let i = 0;
        if (pages[0] && pages[0].number % 2 === 1) {
          spreads.push([pages[0]]);
          i = 1;
        }
        for (; i < pages.length; i += 2) spreads.push(pages.slice(i, i + 2));

        return (
          <div className="sig" key={sigIdx}>
            <div className="sig-label">
              <strong>Caderno {sigIdx + 1}</strong>
              {size} pp · {start + 1}–{start + size}
            </div>
            <div className="sig-pages">
              {spreads.map((sp) => (
                <div className="spread" key={sp[0].number}>
                  {sp.map((p) => {
                    const kind = p.elementId ? kindOf.get(p.elementId) : undefined;
                    const cls = ['pg'];
                    if (p.kind === 'branco') cls.push('blank', p.blankReason === 'verso_branco' ? 'verso' : p.blankReason === 'fecho_caderno' ? 'pad' : 'odd');
                    if (p.isOpener) cls.push('opener');
                    if (issuePages.has(p.number)) cls.push('issue');
                    const dim = highlight && p.elementId !== highlight;
                    return (
                      <button
                        key={p.number}
                        className={cls.join(' ')}
                        aria-pressed={selected === p.number}
                        aria-label={pageLabel(p, book)}
                        title={pageLabel(p, book)}
                        onClick={() => onSelect(p.number)}
                        style={{ opacity: dim ? 0.35 : 1 }}
                      >
                        {p.kind === 'conteudo' && kind && (
                          <span
                            className="pg-fill"
                            style={{
                              background: groupColor(kind),
                              height: `${Math.max(2, p.fill * (p.isOpener ? 12 : 21))}px`,
                              opacity: 0.35 + 0.5 * p.fill,
                            }}
                          />
                        )}
                        {p.isOpener && p.elementId && capOf.has(p.elementId) && (
                          <span className="pg-cap" aria-hidden>
                            {capOf.get(p.elementId)}
                          </span>
                        )}
                        <span className="pg-num">{p.number}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div className="legend">
        <span><i style={{ background: 'var(--group-pre)' }} />Pré-textual</span>
        <span><i style={{ background: 'var(--group-texto)' }} />Texto</span>
        <span><i style={{ background: 'var(--group-pos)' }} />Pós-textual</span>
        <span><i style={{ backgroundImage: 'repeating-linear-gradient(45deg, var(--paper-hatch) 0 2px, transparent 2px 6px)' }} />Branco obrigatório</span>
        <span><i style={{ borderStyle: 'dashed' }} />Branco editorial</span>
        <span><i style={{ background: 'var(--paper-pad)' }} />Fechamento de caderno</span>
        <span><i style={{ position: 'relative' }}><b style={{ position: 'absolute', right: -4, top: -4, width: 7, height: 7, borderRadius: '50%', background: 'var(--warning)' }} /></i>Atenção</span>
      </div>
    </section>
  );
}
