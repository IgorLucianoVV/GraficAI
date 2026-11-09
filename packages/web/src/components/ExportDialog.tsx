import { useEffect, useRef, useState } from 'react';
import type { Book, Diagnosis, ExportDoc, ProductionSpec, ProjectSettings } from '@graficai/core';
import { designerBriefDoc, printerSpecDoc } from '@graficai/core';
import { renderPdf, saveBlob } from '../export/pdf.ts';

interface Props {
  book: Book;
  diag: Diagnosis;
  settings: ProjectSettings;
  onSaveProduction: (p: ProductionSpec) => void;
  onExportJson: () => void;
  onClose: () => void;
  onDone: (msg: string) => void;
}

/** Exportação: especificação para a gráfica e brief para o designer, em PDF. */
export function ExportDialog({ book, diag, settings, onSaveProduction, onExportJson, onClose, onDone }: Props) {
  const [prod, setProd] = useState<ProductionSpec>(settings.production);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(document.activeElement);

  useEffect(() => {
    first.current?.focus();
    const o = opener.current;
    return () => (o as HTMLElement | null)?.focus?.();
  }, []);

  const field = <K extends keyof ProductionSpec>(k: K, v: ProductionSpec[K]) => setProd((p) => ({ ...p, [k]: v }));
  const changed = JSON.stringify(prod) !== JSON.stringify(settings.production);

  const run = async (kind: 'grafica' | 'designer') => {
    setBusy(kind);
    setError(null);
    try {
      if (changed) onSaveProduction(prod);
      const s = { ...settings, production: prod };
      const doc: ExportDoc = kind === 'grafica' ? printerSpecDoc(book, s, diag) : designerBriefDoc(book, s, diag);
      saveBlob(doc.filename, await renderPdf(doc));
      onDone(`${doc.title} exportada (${doc.filename}).`);
    } catch (e) {
      setError(`Não foi possível gerar o PDF: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="exp-title" onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        <div className="dialog-head">
          <h2 id="exp-title">Exportar</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        <div className="export-cards">
          <section className="export-card">
            <h3>Para a gráfica</h3>
            <p className="small muted">Especificação técnica para orçamento: formato, páginas, plano de cadernos, papel, lombada, capa aberta com sangria e estimativa de referência.</p>
            <button ref={first} className="btn btn-primary" disabled={!!busy} onClick={() => run('grafica')}>
              {busy === 'grafica' ? 'Gerando…' : 'Baixar especificação (PDF)'}
            </button>
          </section>
          <section className="export-card">
            <h3>Para o designer</h3>
            <p className="small muted">Brief do projeto gráfico: mancha, tipografia, abertura de capítulo, estrutura com página inicial de cada elemento, cadernos, brancos e pontos de atenção.</p>
            <button className="btn btn-primary" disabled={!!busy} onClick={() => run('designer')}>
              {busy === 'designer' ? 'Gerando…' : 'Baixar brief (PDF)'}
            </button>
          </section>
        </div>

        <details className="export-prod" open={changed || undefined}>
          <summary>Dados de produção (entram na especificação)</summary>
          <div className="export-grid">
            <div className="field">
              <label htmlFor="pr-int">Cores do miolo</label>
              <input id="pr-int" type="text" value={prod.interiorColors} onChange={(e) => field('interiorColors', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pr-fin">Acabamento</label>
              <input id="pr-fin" type="text" value={prod.finishing} onChange={(e) => field('finishing', e.target.value)} />
            </div>
            <div className="field wide">
              <label htmlFor="pr-cov">Capa</label>
              <input id="pr-cov" type="text" value={prod.cover} onChange={(e) => field('cover', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pr-flap">Orelhas (mm cada, 0 = sem)</label>
              <input id="pr-flap" type="number" min={0} max={150} value={prod.flapsMm} onChange={(e) => field('flapsMm', Math.max(0, Number(e.target.value) || 0))} />
            </div>
            <div className="field">
              <label htmlFor="pr-bleed">Sangria (mm)</label>
              <input id="pr-bleed" type="number" min={0} max={10} value={prod.bleedMm} onChange={(e) => field('bleedMm', Math.max(0, Number(e.target.value) || 0))} />
            </div>
            <div className="field wide">
              <label htmlFor="pr-contact">Contato</label>
              <input id="pr-contact" type="text" placeholder="Nome, e-mail ou telefone" value={prod.contact} onChange={(e) => field('contact', e.target.value)} />
            </div>
            <div className="field wide">
              <label htmlFor="pr-notes">Observações</label>
              <textarea id="pr-notes" rows={2} placeholder="Prova de cor, prazo, entrega…" value={prod.notes} onChange={(e) => field('notes', e.target.value)} />
            </div>
          </div>
        </details>

        {error && (
          <p className="small" role="alert" style={{ color: 'var(--danger, #c0392b)' }}>
            {error}
          </p>
        )}
        <div className="dialog-foot">
          <span className="small muted">Os PDFs usam o diagnóstico atual, incluindo a proposta aplicada.</span>
          <button className="btn btn-ghost btn-sm" onClick={onExportJson}>
            Diagnóstico completo (JSON)
          </button>
        </div>
      </div>
    </div>
  );
}
