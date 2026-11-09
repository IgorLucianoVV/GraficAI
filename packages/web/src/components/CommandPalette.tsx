import { useEffect, useMemo, useRef, useState } from 'react';

export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  run: () => void;
  enabled?: boolean;
}

/** Paleta de comandos (Ctrl/⌘+K): mostra o atalho de cada comando para ensinar os atalhos. */
export function CommandPalette({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<Element | null>(document.activeElement);

  const list = useMemo(() => {
    const n = q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return commands.filter((c) => c.enabled !== false && c.label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(n));
  }, [q, commands]);

  useEffect(() => {
    input.current?.focus();
    const o = opener.current;
    return () => (o as HTMLElement | null)?.focus?.();
  }, []);
  useEffect(() => setIdx(0), [q]);

  const run = (c: Command) => {
    onClose();
    c.run();
  };

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Paleta de comandos"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIdx((i) => Math.min(list.length - 1, i + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setIdx((i) => Math.max(0, i - 1));
          } else if (e.key === 'Enter' && list[idx]) run(list[idx]);
        }}
      >
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Digite um comando…" aria-label="Buscar comando" />
        <ul role="listbox">
          {list.map((c, i) => (
            <li key={c.id}>
              <button role="option" aria-selected={i === idx} onMouseEnter={() => setIdx(i)} onClick={() => run(c)}>
                <span>{c.label}</span>
                {c.shortcut && <span className="kbd">{c.shortcut}</span>}
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="muted small" style={{ padding: 10 }}>Nenhum comando encontrado.</li>}
        </ul>
      </div>
    </div>
  );
}
