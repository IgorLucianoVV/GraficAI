'use client';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { diagnose, describePlan, type Diagnosis, type ProjectSettings, type Variant } from '@graficai/core';
import { initialState, reducer, variantsKey, type State } from './state.ts';
import { TopBar } from './components/TopBar.tsx';
import { HistoryDialog } from './components/HistoryDialog.tsx';
import { api, ApiError, type Library, type ProjectPayload } from './api.ts';
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

export type SaveStatus = 'salvo' | 'pendente' | 'salvando' | 'erro' | 'conflito' | 'leitura';

function fromProject(p: ProjectPayload): State {
  const needsReview = p.data.book.elements.some((e) => e.confidence !== 'alta' && e.classifiedBy !== 'usuario');
  return reducer(initialState, { type: 'load', book: p.data.book, settings: p.data.settings, warnings: p.data.warnings, llmUsed: p.data.llmUsed, view: needsReview ? 'estrutura' : 'trabalho' });
}

/** Editor de um projeto salvo: diagnóstico ao vivo + salvamento automático. */
export function Editor({ project, library: initialLibrary }: { project: ProjectPayload; library: Library }) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, project, fromProject);
  const [palette, setPalette] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [history, setHistory] = useState(false);
  const [library, setLibrary] = useState(initialLibrary);
  const [theme, setTheme] = useState<Theme>('light');
  const worker = useRef<Worker | null>(null);
  const readOnly = project.role === 'leitor';

  // ---- Salvamento automático -------------------------------------------------
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(readOnly ? 'leitura' : 'salvo');
  const [saveError, setSaveError] = useState<string | null>(null);
  const revision = useRef(project.revision);
  const saved = useRef({ book: state.book, settings: state.settings });
  const latest = useRef({ book: state.book, settings: state.settings, warnings: state.warnings, llmUsed: state.llmUsed });
  latest.current = { book: state.book, settings: state.settings, warnings: state.warnings, llmUsed: state.llmUsed };
  const inflight = useRef<Promise<boolean> | null>(null);
  const dirty = state.book !== saved.current.book || state.settings !== saved.current.settings;

  const save = useCallback(async (): Promise<boolean> => {
    if (readOnly) return true;
    if (inflight.current) await inflight.current;
    const snap = latest.current;
    if (!snap.book || (snap.book === saved.current.book && snap.settings === saved.current.settings)) return true;
    const run = (async () => {
      setSaveStatus('salvando');
      try {
        const r = await api<{ revision: number }>(`/api/projetos/${project.id}`, {
          method: 'PUT',
          body: { revision: revision.current, data: { book: snap.book, settings: snap.settings, warnings: snap.warnings, llmUsed: snap.llmUsed } },
        });
        revision.current = r.revision;
        saved.current = { book: snap.book, settings: snap.settings };
        const stillDirty = latest.current.book !== snap.book || latest.current.settings !== snap.settings;
        setSaveStatus(stillDirty ? 'pendente' : 'salvo');
        setSaveError(null);
        return true;
      } catch (e) {
        const err = e as ApiError;
        setSaveStatus(err.status === 409 ? 'conflito' : 'erro');
        setSaveError(err.message);
        return false;
      } finally {
        inflight.current = null;
      }
    })();
    inflight.current = run;
    return run;
  }, [project.id, readOnly]);

  // Grava 1,2 s depois da última mudança (ajustes contínuos esperam soltar o controle).
  useEffect(() => {
    if (readOnly || !dirty || state.liveBase || saveStatus === 'conflito') return;
    setSaveStatus((s) => (s === 'salvando' ? s : 'pendente'));
    const t = setTimeout(() => void save(), 1200);
    return () => clearTimeout(t);
  }, [state.book, state.settings, state.liveBase, dirty, readOnly, save, saveStatus]);

  // Avisa antes de sair com alteração não gravada.
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!readOnly && (dirty || inflight.current)) e.preventDefault();
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty, readOnly]);

  /** Conflito: recarrega a versão do servidor (descarta a local) ou sobrescreve. */
  const resolveConflict = useCallback(
    async (mode: 'recarregar' | 'sobrescrever') => {
      const fresh = await api<ProjectPayload>(`/api/projetos/${project.id}`);
      revision.current = fresh.revision;
      if (mode === 'recarregar') {
        const st = fromProject(fresh);
        saved.current = { book: st.book, settings: st.settings };
        dispatch({ type: 'load', book: fresh.data.book, settings: fresh.data.settings, warnings: fresh.data.warnings, llmUsed: fresh.data.llmUsed, view: state.view });
        setSaveStatus('salvo');
      } else {
        setSaveStatus('pendente');
        await save();
      }
    },
    [project.id, save, state.view],
  );

  const restored = useCallback((p: ProjectPayload) => {
    revision.current = p.revision;
    saved.current = { book: p.data.book, settings: p.data.settings };
    dispatch({ type: 'load', book: p.data.book, settings: p.data.settings, warnings: p.data.warnings, llmUsed: p.data.llmUsed, view: 'trabalho' });
    dispatch({ type: 'toast', message: 'Versão restaurada. O estado anterior ficou guardado no histórico.' });
  }, []);

  useEffect(() => {
    setTheme(initialTheme());
  }, []);

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
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void save();
      } else if (mod && e.key.toLowerCase() === 'k') {
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
  }, [state.selectedPage, diag, save]);

  // Toast some sozinho.
  useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => dispatch({ type: 'dismissToast' }), 6000);
    return () => clearTimeout(t);
  }, [state.toast]);

  const commands: Command[] = [
    { id: 'projetos', label: 'Ir para meus projetos', run: () => router.push('/projetos') },
    { id: 'historico', label: 'Histórico de versões…', run: () => setHistory(true) },
    { id: 'salvar', label: 'Salvar agora', shortcut: 'Ctrl S', run: () => void save(), enabled: !readOnly },
    { id: 'estrutura', label: 'Ir para Estrutura', run: () => dispatch({ type: 'view', view: 'estrutura' }), enabled: !!state.book },
    { id: 'trabalho', label: 'Ir para Diagnóstico', run: () => dispatch({ type: 'view', view: 'trabalho' }), enabled: !!state.book },
    { id: 'otimizar', label: 'Gerar propostas de projeto', run: () => { dispatch({ type: 'view', view: 'trabalho' }); optimize(); }, enabled: !!state.book },
    { id: 'ajustes', label: 'Abrir ajustes do projeto gráfico', run: () => { dispatch({ type: 'view', view: 'trabalho' }); dispatch({ type: 'rightTab', tab: 'ajustes' }); }, enabled: !!state.book },
    { id: 'undo', label: 'Desfazer', shortcut: 'Ctrl Z', run: () => dispatch({ type: 'undo' }), enabled: state.past.length > 0 },
    { id: 'redo', label: 'Refazer', shortcut: 'Ctrl Shift Z', run: () => dispatch({ type: 'redo' }), enabled: state.future.length > 0 },
    { id: 'foco', label: 'Modo foco (esconder painéis)', shortcut: 'Ctrl \\', run: () => dispatch({ type: 'focus' }), enabled: !!state.book },
    { id: 'exportar', label: 'Exportar: livro composto, gráfica ou designer (PDF)…', run: () => setExporting(true), enabled: !!state.book },
    { id: 'export', label: 'Exportar diagnóstico (JSON)', run: exportReport, enabled: !!state.book },
    { id: 'print', label: 'Imprimir relatório', run: () => window.print(), enabled: !!state.book },
    { id: 'tema', label: theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro', run: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) },
  ];

  const view = state.view === 'inicio' ? 'trabalho' : state.view;

  return (
    <div className="app">
      <TopBar
        title={state.book?.title ?? null}
        view={view}
        onView={(v) => dispatch({ type: 'view', view: v })}
        workspaceName={project.workspaceName}
        saveStatus={saveStatus}
        saveError={saveError}
        onSave={() => void save()}
        onHistory={() => setHistory(true)}
        diag={diag}
        prev={prevDiag}
        onPalette={() => setPalette(true)}
        onExport={state.book ? () => setExporting(true) : undefined}
        theme={theme}
        onTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />

      {saveStatus === 'conflito' && (
        <div className="banner banner-warn" role="alert">
          <span>{saveError} Suas últimas alterações ainda não foram gravadas.</span>
          <button className="btn btn-sm" onClick={() => void resolveConflict('recarregar')}>
            Usar a versão mais recente
          </button>
          <button className="btn btn-sm" onClick={() => void resolveConflict('sobrescrever')}>
            Manter as minhas
          </button>
        </div>
      )}
      {readOnly && (
        <div className="banner" role="status">
          Você tem acesso de leitura neste projeto: pode explorar e exportar, mas as alterações não são salvas.
        </div>
      )}

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
            onBook={(book, label) => dispatch({ type: 'commit', label, book })}
            library={library}
            canEdit={!readOnly}
            onSaveTemplate={async (name) => {
              const r = await api<{ id: string }>(`/api/equipes/${project.workspaceId}/biblioteca`, { body: { kind: 'modelo', name, data: state.settings.design } });
              setLibrary((l) => ({ ...l, templates: [...l.templates, { id: r.id, name, data: state.settings.design }].sort((a, b) => a.name.localeCompare(b.name)) }));
              dispatch({ type: 'toast', message: `Modelo “${name}” salvo na equipe ${project.workspaceName}.` });
            }}
            onSelectPage={(p) => dispatch({ type: 'selectPage', page: p })}
            onFixIssue={() => dispatch({ type: 'view', view: 'estrutura' })}
          />
        </div>
      )}

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

      {history && <HistoryDialog projectId={project.id} canEdit={!readOnly} beforeVersion={save} onRestored={restored} onClose={() => setHistory(false)} />}
      {palette && <CommandPalette commands={commands} onClose={() => setPalette(false)} />}
      {exporting && state.book && diag && (
        <ExportDialog
          projectId={project.id}
          beforeCompose={save}
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
