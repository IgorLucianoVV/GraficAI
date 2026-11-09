import type { Book, ProjectSettings, Variant } from '@graficai/core';
import { defaultSettings } from '@graficai/core';

export type View = 'inicio' | 'estrutura' | 'trabalho';
export type RightTab = 'problemas' | 'propostas' | 'ajustes' | 'pagina';

interface Snapshot {
  book: Book;
  settings: ProjectSettings;
  label: string;
}

export interface State {
  book: Book | null;
  settings: ProjectSettings;
  past: Snapshot[];
  future: Snapshot[];
  view: View;
  rightTab: RightTab;
  selectedPage: number | null;
  selectedElement: string | null;
  variants: Variant[] | null;
  variantsKey: string | null;
  optimizing: boolean;
  toast: { id: number; message: string; undo: boolean } | null;
  focus: boolean;
  warnings: string[];
  llmUsed: boolean;
  /** Estado antes de um ajuste contínuo (slider), para o desfazer voltar ao ponto inicial. */
  liveBase: Snapshot | null;
}

export const initialState: State = {
  book: null,
  settings: defaultSettings(),
  past: [],
  future: [],
  view: 'inicio',
  rightTab: 'problemas',
  selectedPage: null,
  selectedElement: null,
  variants: null,
  variantsKey: null,
  optimizing: false,
  toast: null,
  focus: false,
  warnings: [],
  llmUsed: false,
  liveBase: null,
};

export type Action =
  | { type: 'load'; book: Book; warnings?: string[]; llmUsed?: boolean; view: View }
  | { type: 'commit'; label: string; book?: Book; settings?: ProjectSettings; toast?: string }
  | { type: 'live'; settings: ProjectSettings; label: string }
  | { type: 'endLive' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'view'; view: View }
  | { type: 'rightTab'; tab: RightTab }
  | { type: 'selectPage'; page: number | null }
  | { type: 'selectElement'; id: string | null }
  | { type: 'optimizing' }
  | { type: 'variants'; variants: Variant[]; key: string }
  | { type: 'toast'; message: string; undo?: boolean }
  | { type: 'dismissToast' }
  | { type: 'focus' };

const MAX_HISTORY = 100;
let toastSeq = 1;

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'load':
      return {
        ...initialState,
        settings: state.settings,
        book: action.book,
        view: action.view,
        warnings: action.warnings ?? [],
        llmUsed: action.llmUsed ?? false,
      };
    case 'commit': {
      if (!state.book) return state;
      const snap: Snapshot = { book: state.book, settings: state.settings, label: action.label };
      return {
        ...state,
        past: [...state.past, snap].slice(-MAX_HISTORY),
        future: [],
        book: action.book ?? state.book,
        settings: action.settings ?? state.settings,
        toast: action.toast ? { id: toastSeq++, message: action.toast, undo: true } : state.toast,
      };
    }
    case 'live': {
      // Ajuste contínuo (arrastar slider): não empilha histórico a cada pixel.
      if (!state.book) return state;
      const liveBase = state.liveBase ?? { book: state.book, settings: state.settings, label: action.label };
      return { ...state, settings: action.settings, liveBase };
    }
    case 'endLive': {
      if (!state.liveBase) return state;
      const changed = JSON.stringify(state.liveBase.settings) !== JSON.stringify(state.settings);
      return {
        ...state,
        liveBase: null,
        past: changed ? [...state.past, state.liveBase].slice(-MAX_HISTORY) : state.past,
        future: changed ? [] : state.future,
      };
    }
    case 'undo': {
      const prev = state.past[state.past.length - 1];
      if (!prev || !state.book) return state;
      return {
        ...state,
        past: state.past.slice(0, -1),
        future: [{ book: state.book, settings: state.settings, label: prev.label }, ...state.future],
        book: prev.book,
        settings: prev.settings,
        toast: { id: toastSeq++, message: `Desfeito: ${prev.label}`, undo: false },
      };
    }
    case 'redo': {
      const next = state.future[0];
      if (!next || !state.book) return state;
      return {
        ...state,
        future: state.future.slice(1),
        past: [...state.past, { book: state.book, settings: state.settings, label: next.label }],
        book: next.book,
        settings: next.settings,
        toast: { id: toastSeq++, message: `Refeito: ${next.label}`, undo: false },
      };
    }
    case 'view':
      return { ...state, view: action.view };
    case 'rightTab':
      return { ...state, rightTab: action.tab };
    case 'selectPage':
      return { ...state, selectedPage: action.page, rightTab: action.page ? 'pagina' : state.rightTab };
    case 'selectElement':
      return { ...state, selectedElement: action.id };
    case 'optimizing':
      return { ...state, optimizing: true, rightTab: 'propostas' };
    case 'variants':
      return { ...state, optimizing: false, variants: action.variants, variantsKey: action.key };
    case 'toast':
      return { ...state, toast: { id: toastSeq++, message: action.message, undo: action.undo ?? false } };
    case 'dismissToast':
      return { ...state, toast: null };
    case 'focus':
      return { ...state, focus: !state.focus };
  }
}

/** Chave para saber se as propostas ainda correspondem ao livro e às configurações atuais. */
export function variantsKey(book: Book | null, settings: ProjectSettings): string {
  if (!book) return '';
  return JSON.stringify([book.elements.map((e) => [e.id, e.kind, e.blocks.length]), { ...settings, production: null }]);
}
