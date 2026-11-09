import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { diagnose, sampleBook, describePlan, type Book, type Diagnosis, type ProjectSettings, type Variant } from '@graficai/core';
import { initialState, reducer, variantsKey } from './state.ts';
import { TopBar } from './components/TopBar.tsx';
import { Home } from './components/Home.tsx';
import { Structure } from './components/Structure.tsx';
import { LeftPanel } from './components/LeftPanel.tsx';
import { RightPanel } from './components/RightPanel.tsx';
import { Flatplan } from './components/Flatplan.tsx';
import { Summary } from './components/Summary.tsx';
import { ExportDialog } from './components/ExportDialog.tsx';
import { CommandPalette, type Command } from './components/CommandPalette.tsx';
import { brl, download } from './format.ts';

type Theme = 'light' | 'dark';

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem('graficai-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* armazenamento indisponível */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [palette, setPalette] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const worker = useRef<Worker | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('graficai-theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  // Diagnóstico síncrono: é aritmética sobre o modelo do livro, poucos milissegundos.
  const diag: Diagnosis | null = useMemo(() => (state.book ? diagnose(state.book, state.settings) : null), [state.book, state.settings]);

  // Referência para os deltas da barra superior: o estado antes da última mudança.
  const prevDiag = useMemo(() => {
    const ref = state.liveBase ?? state.past[state.past.length - 1];
    return ref ? diagnose(ref.book, ref.settings) : null;
  }, [state.liveBase, state.past]);

  const currentKey = variantsKey(state.book, state.settings);

  const loadBook = useCallback((book: Book, warnings: string[] = [], llmUsed = false) => {
    const needsReview = book.elements.some((e) => e.confidence !== 'alta');
    dispatch({ type: 'load', book, warnings, llmUsed, view: needsReview ? 'estrutura' : 'trabalho' });
  }, []);

  const openSample = useCallback(() => {
    setError(null);
    loadBook(sampleBook());
  }, [loadBook]);

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      setLoading('enviando');
      try {
        const fd = new FormData();
        fd.append('file', file);
        setLoading('lendo');
        const res = await fetch('/api/manuscripts', { method: 'POST', body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
        loadBook(data.book, data.warnings, data.llmUsed);
      } catch (e) {
        const msg = (e as Error).message;
        setError(msg.includes('Failed to fetch') ? 'Não consegui falar com o servidor. Ele está rodando (npm run dev)?' : msg);
      } finally {
        setLoading(null);
      }
    },
    [loadBook],
  );

  const optimize = useCallback(() => {
    if (!state.book) return;
    worker.current?.terminate();
    const w = new Worker(new URL('./optimizer.worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    dispatch({ type: 'optimizing' });
    const key = currentKey;
    w.onmessage = (e: MessageEvent<{ variants: Variant[]; key: string }>) => {
      dispatch({ type: 'variants', variants: e.data.variants, key: e.data.key });
      w.terminate();
    };
    w.postMessage({ book: state.book, settings: state.settings, key });
  }, [state.book, state.settings, currentKey]);

  const applyVariant = useCallback(
    (v: Variant) => {
      if (!diag) return;
      const saving = diag.cost.total - v.diagnosis.cost.total;
      dispatch({
        type: 'commit',
        label: `proposta ${v.id}`,
        settings: { ...state.settings, design: v.design },
        toast: `Proposta ${v.id} aplicada: ${v.diagnosis.plan.totalPages} páginas${saving > 0 ? `, economia de ${brl(saving)}` : ''}.`,
      });
    },
    [diag, state.settings],
  );

  const commitSettings = useCallback((settings: ProjectSettings, label: string) => dispatch({ type: 'commit', label, settings }), []);

  const exportReport = useCallback(() => {
    if (!state.book || !diag) return;
    const report = {
      livro: state.book.title,
      geradoEm: new Date().toISOString(),
      configuracoes: state.settings,
      laudas: { caracteresComEspacos: diag.stats.charsWithSpaces, laudasBrutas: Math.round(diag.stats.laudasRaw * 100) / 100, laudas: diag.stats.laudas, porElemento: diag.stats.byElement },
      paginacao: { paginasConteudo: diag.layout.contentPages, paginasTotais: diag.plan.totalPages, brancos: diag.layout.blankPages, elementos: diag.layout.elements },
      cadernos: { plano: describePlan(diag.plan), tamanhos: diag.plan.sizes, fechamento: diag.evenWorking },
      custo: diag.cost,
      lombadaMm: diag.spineMm,
      problemas: diag.issues,
    };
    download(`${state.book.title}-diagnostico.json`, JSON.stringify(report, null, 2), 'application/json');
  }, [state.book, state.settings, diag]);

  // Atalhos globais.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const typing = (e.target as HTMLElement)?.matches?.('input[type=text], input[type=number], textarea, select');
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      } else if (mod && !typing && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
      } else if (mod && !typing && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        dispatch({ type: 'redo' });
      } else if (mod && e.key === '\\') {
        e.preventDefault();
        dispatch({ type: 'focus' });
      } else if (!mod && !typing && state.selectedPage && diag && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && (e.target as HTMLElement)?.classList?.contains('pg')) {
        e.preventDefault();
        const next = Math.min(diag.plan.totalPages, Math.max(1, state.selectedPage + (e.key === 'ArrowRight' ? 1 : -1)));
        dispatch({ type: 'selectPage', page: next });
        (document.querySelector(`.pg[title^="Página ${next},"]`) as HTMLElement | null)?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.selectedPage, diag]);

  // Toast some sozinho.
  useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => dispatch({ type: 'dismissToast' }), 6000);
    return () => clearTimeout(t);
  }, [state.toast]);

  const commands: Command[] = [
    { id: 'sample', label: 'Abrir livro de exemplo', run: openSample },
    { id: 'upload', label: 'Enviar manuscrito…', run: () => fileInput.current?.click() },
    { id: 'estrutura', label: 'Ir para Estrutura', run: () => dispatch({ type: 'view', view: 'estrutura' }), enabled: !!state.book },
    { id: 'trabalho', label: 'Ir para Diagnóstico', run: () => dispatch({ type: 'view', view: 'trabalho' }), enabled: !!state.book },
    { id: 'otimizar', label: 'Gerar propostas de projeto', run: () => { dispatch({ type: 'view', view: 'trabalho' }); optimize(); }, enabled: !!state.book },
    { id: 'ajustes', label: 'Abrir ajustes do projeto gráfico', run: () => { dispatch({ type: 'view', view: 'trabalho' }); dispatch({ type: 'rightTab', tab: 'ajustes' }); }, enabled: !!state.book },
    { id: 'undo', label: 'Desfazer', shortcut: 'Ctrl Z', run: () => dispatch({ type: 'undo' }), enabled: state.past.length > 0 },
    { id: 'redo', label: 'Refazer', shortcut: 'Ctrl Shift Z', run: () => dispatch({ type: 'redo' }), enabled: state.future.length > 0 },
    { id: 'foco', label: 'Modo foco (esconder painéis)', shortcut: 'Ctrl \\', run: () => dispatch({ type: 'focus' }), enabled: !!state.book },
    { id: 'exportar', label: 'Exportar para a gráfica ou designer (PDF)…', run: () => setExporting(true), enabled: !!state.book },
    { id: 'export', label: 'Exportar diagnóstico (JSON)', run: exportReport, enabled: !!state.book },
    { id: 'print', label: 'Imprimir relatório', run: () => window.print(), enabled: !!state.book },
    { id: 'tema', label: theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro', run: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) },
    { id: 'inicio', label: 'Voltar ao início', run: () => dispatch({ type: 'view', view: 'inicio' }) },
  ];

  const view = state.book ? state.view : 'inicio';

  return (
    <div className="app">
      <TopBar
        title={state.book?.title ?? null}
        view={view}
        onView={(v) => dispatch({ type: 'view', view: v })}
        diag={view === 'inicio' ? null : diag}
        prev={prevDiag}
        onPalette={() => setPalette(true)}
        onExport={state.book ? () => setExporting(true) : undefined}
        theme={theme}
        onTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />

      {view === 'inicio' && <Home onFile={upload} onSample={openSample} loading={loading} error={error} />}

      {view === 'estrutura' && state.book && (
        <Structure
          book={state.book}
          llmUsed={state.llmUsed}
          warnings={state.warnings}
          onChange={(book, label, toast) => dispatch({ type: 'commit', label, book, toast })}
          onContinue={() => dispatch({ type: 'view', view: 'trabalho' })}
        />
      )}

      {view === 'trabalho' && state.book && diag && (
        <div className={`workspace${state.focus ? ' focus' : ''}`}>
          <LeftPanel
            book={state.book}
            diag={diag}
            lauda={state.settings.lauda}
            selectedElement={state.selectedElement}
            onElement={(id, first) => {
              dispatch({ type: 'selectElement', id });
              if (id) document.querySelector(`.pg[title^="Página ${first},"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }}
            onLauda={(lauda) => commitSettings({ ...state.settings, lauda }, 'configuração de lauda')}
          />
          <main className="center">
            <Summary diag={diag} settings={state.settings} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h2 className="section-title">Mapa de cadernos · {describePlan(diag.plan)}</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm" onClick={() => dispatch({ type: 'focus' })}>
                  {state.focus ? 'Mostrar painéis' : 'Modo foco'}
                </button>
                <button className="btn btn-sm btn-primary" onClick={optimize} disabled={state.optimizing}>
                  {state.optimizing ? 'Gerando…' : 'Otimizar livro'}
                </button>
              </div>
            </div>
            <Flatplan
              book={state.book}
              diag={diag}
              selected={state.selectedPage}
              highlight={state.selectedElement}
              onSelect={(p) => dispatch({ type: 'selectPage', page: p })}
            />
          </main>
          <RightPanel
            tab={state.rightTab}
            onTab={(t) => dispatch({ type: 'rightTab', tab: t })}
            book={state.book}
            diag={diag}
            settings={state.settings}
            selectedPage={state.selectedPage}
            variants={state.variants}
            variantsStale={!!state.variants && state.variantsKey !== currentKey}
            optimizing={state.optimizing}
            onOptimize={optimize}
            onApplyVariant={applyVariant}
            onLive={(settings, label) => dispatch({ type: 'live', settings, label })}
            onEndLive={() => dispatch({ type: 'endLive' })}
            onCommit={commitSettings}
            onSelectPage={(p) => dispatch({ type: 'selectPage', page: p })}
            onFixIssue={() => dispatch({ type: 'view', view: 'estrutura' })}
          />
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept=".docx,.md,.markdown,.txt"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            dispatch({ type: 'view', view: 'inicio' });
            upload(f);
          }
          e.target.value = '';
        }}
      />

      {state.toast && (
        <div className="toast" role="status" key={state.toast.id}>
          <span>{state.toast.message}</span>
          {state.toast.undo && (
            <button className="btn btn-sm" onClick={() => dispatch({ type: 'undo' })}>
              Desfazer
            </button>
          )}
          <button className="btn btn-sm" aria-label="Fechar aviso" onClick={() => dispatch({ type: 'dismissToast' })}>
            ✕
          </button>
        </div>
      )}

      {palette && <CommandPalette commands={commands} onClose={() => setPalette(false)} />}
      {exporting && state.book && diag && (
        <ExportDialog
          book={state.book}
          diag={diag}
          settings={state.settings}
          onSaveProduction={(production) => commitSettings({ ...state.settings, production }, 'dados de produção')}
          onExportJson={exportReport}
          onClose={() => setExporting(false)}
          onDone={(message) => dispatch({ type: 'toast', message })}
        />
      )}
    </div>
  );
}
