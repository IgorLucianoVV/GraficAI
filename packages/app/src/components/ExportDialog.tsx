import { useEscape } from '../useEscape.ts';
import { useEffect, useRef, useState } from 'react';
import type { Book, Diagnosis, ExportDoc, ProductionSpec, ProjectSettings } from '@graficai/core';
import { designerBriefDoc, printerSpecDoc } from '@graficai/core';
import { renderPdf, saveBlob } from '../export/pdf.ts';

interface Props {
  projectId: string;
  /** Garante que o estado atual está salvo: a composição lê o projeto do servidor. */
  beforeCompose: () => Promise<boolean>;
  book: Book;
  diag: Diagnosis;
  settings: ProjectSettings;
  onSaveProduction: (p: ProductionSpec) => void;
  onExportJson: () => void;
  onClose: () => void;
  onDone: (msg: string) => void;
}

/** Exportação: especificação para a gráfica, brief para o designer e o livro composto. */
export function ExportDialog({ projectId, beforeCompose, book, diag, settings, onSaveProduction, onExportJson, onClose, onDone }: Props) {
  useEscape(onClose, true);
  const [prod, setProd] = useState<ProductionSpec>(settings.production);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [marks, setMarks] = useState<'nenhuma' | 'sangria' | 'marcas'>('nenhuma');
  const [pad, setPad] = useState(true);
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

  const slug = book.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'livro';

  /** Composição real no servidor (Typst). */
  const runTypeset = async (format: 'pdf' | 'typ') => {
    setBusy(`miolo-${format}`);
    setError(null);
    try {
      if (changed) onSaveProduction(prod);
      // Espera o salvamento: a composição usa o projeto gravado (sem reenviar o livro).
      await new Promise((r) => setTimeout(r, 0));
      await beforeCompose();
      const res = await fetch(`/api/projetos/${projectId}/compor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ options: { trimMarks: marks, padToSignatures: pad, production: prod }, format }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error([j.error, ...(j.diagnostics ?? [])].filter(Boolean).join(' ') || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const name = format === 'pdf' ? `${slug}-miolo${marks === 'marcas' ? '-marcas' : marks === 'sangria' ? '-sangria' : ''}.pdf` : `${slug}-miolo.typ`;
      saveBlob(name, blob);
      const pages = res.headers.get('X-GraficAI-Pages');
      const padding = Number(res.headers.get('X-GraficAI-Padding') ?? 0);
      onDone(
        format === 'pdf'
          ? `Miolo composto: ${pages} páginas reais${padding ? ` (${padding} em branco para fechar o caderno)` : ''}. Estimativa era ${diag.plan.totalPages}.`
          : `Fonte Typst exportado (${name}).`,
      );
    } catch (e) {
      setError(`Não foi possível compor o livro: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="exp-title" onMouseDown={(e) => e.stopPropagation()}>
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

        <section className="export-card export-wide">
          <h3>Livro composto</h3>
          <p className="small muted">
            O miolo diagramado de verdade, com o projeto gráfico atual: formato, margens, corpo e entrelinha, abertura de capítulo com capitular, notas de rodapé,
            sumário com páginas reais, cabeço e fólio. Pronto para revisão ou para a gráfica.
          </p>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="field">
              <label htmlFor="ts-marks">Saída</label>
              <select id="ts-marks" value={marks} onChange={(e) => setMarks(e.target.value as typeof marks)}>
                <option value="nenhuma">Formato final (leitura e revisão)</option>
                <option value="sangria">Com sangria</option>
                <option value="marcas">Com sangria e marcas de corte (gráfica)</option>
              </select>
            </div>
            <label className="check small" style={{ flex: 'none' }}>
              <input type="checkbox" checked={pad} onChange={(e) => setPad(e.target.checked)} />
              Fechar o último caderno
            </label>
          </div>
          <div className="row">
            <button className="btn btn-primary" disabled={!!busy} onClick={() => runTypeset('pdf')}>
              {busy === 'miolo-pdf' ? 'Compondo…' : 'Baixar miolo (PDF)'}
            </button>
            <button className="btn" disabled={!!busy} onClick={() => runTypeset('typ')} style={{ flex: 'none' }}>
              {busy === 'miolo-typ' ? 'Gerando…' : 'Fonte Typst (.typ)'}
            </button>
          </div>
        </section>

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
