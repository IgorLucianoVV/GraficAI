'use client';
import { useEffect } from 'react';

/** Fecha diálogos com Esc mesmo quando o foco saiu deles. */
export function useEscape(onClose: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, enabled]);
}
