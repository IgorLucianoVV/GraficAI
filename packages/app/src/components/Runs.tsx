import type React from 'react';
import type { Block, Run } from '@graficai/core';
import { blockRuns } from '@graficai/core';

/** Desenha trechos com estilo; `limit` corta em N caracteres. Chamadas de nota viram números. */
export function Runs({ runs, limit, noteNumber }: { runs: Run[]; limit?: number; noteNumber?: (id: string) => number }) {
  let left = limit ?? Infinity;
  const out: React.JSX.Element[] = [];
  runs.forEach((r, i) => {
    if (left <= 0) return;
    if (r.noteRef) {
      out.push(
        <sup key={i} className="note-ref" title={`Nota ${r.noteRef}`}>
          {noteNumber ? noteNumber(r.noteRef) : '*'}
        </sup>,
      );
      return;
    }
    const text = r.text.length > left ? r.text.slice(0, left) + '…' : r.text;
    left -= r.text.length;
    let node: React.JSX.Element | string = text;
    if (r.italic) node = <em>{node}</em>;
    if (r.bold) node = <strong>{node}</strong>;
    if (r.sup) node = <sup>{node}</sup>;
    if (r.sub) node = <sub>{node}</sub>;
    if (r.smallcaps) node = <span style={{ fontVariant: 'small-caps' }}>{node}</span>;
    out.push(<span key={i}>{node}</span>);
  });
  return <>{out}</>;
}

/** Trechos de vários blocos concatenados (para prévias). */
export function blocksRuns(blocks: Block[]): Run[] {
  return blocks.filter((b) => b.type !== 'nota').flatMap((b, i) => (i ? [{ text: ' ' }, ...blockRuns(b)] : blockRuns(b)));
}
