import { ELEMENT_RULES, type ElementKind } from '@graficai/core';

export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const num = (n: number, digits = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const dec = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export function groupColor(kind: ElementKind): string {
  const g = ELEMENT_RULES[kind].group;
  return g === 'pre' ? 'var(--group-pre)' : g === 'pos' ? 'var(--group-pos)' : 'var(--group-texto)';
}

export function signed(n: number, f: (x: number) => string): string {
  if (n === 0) return '';
  return `${n > 0 ? '+' : '−'}${f(Math.abs(n))}`;
}

export function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
