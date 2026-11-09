'use client';
import type { DesignSpec, PrinterProfile } from '@graficai/core';
import type { ProjectData, Role } from '@graficai/server/types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

/** fetch JSON com erros em português vindos da API. */
export async function api<T = unknown>(url: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? (opts.body || opts.form ? 'POST' : 'GET'),
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
  } catch {
    throw new ApiError(0, 'Sem conexão com o servidor.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const { error, ...extra } = data as { error?: string };
    throw new ApiError(res.status, error ?? `Erro ${res.status}`, extra);
  }
  return data as T;
}

export interface ProjectPayload {
  id: string;
  title: string;
  workspaceId: string;
  workspaceName: string;
  data: ProjectData;
  revision: number;
  role: Role;
}

export interface LibraryItem<T> {
  id: string;
  name: string;
  data: T;
}

export interface Library {
  printers: LibraryItem<PrinterProfile>[];
  templates: LibraryItem<DesignSpec>[];
}
