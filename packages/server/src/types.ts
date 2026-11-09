import type { Book, ProjectSettings } from '@graficai/core';

/** O que um projeto guarda: o livro, os ajustes e o contexto da ingestão. */
export interface ProjectData {
  book: Book;
  settings: ProjectSettings;
  warnings: string[];
  llmUsed: boolean;
}

/** Números para os cartões da lista de projetos (calculados ao salvar). */
export interface ProjectSummary {
  pages: number;
  signatures: string;
  perCopy: number;
  laudas: number;
  trim: string;
  issues: number;
}

export type Role = 'dono' | 'editor' | 'leitor';
