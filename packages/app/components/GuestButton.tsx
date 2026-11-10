'use client';
import { useState } from 'react';
import { api } from '@/src/api';

/** Entra como visitante (sem cadastro) e vai para os projetos. */
export function GuestButton({ style, label = 'Experimentar sem conta' }: { style?: React.CSSProperties; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        className="btn"
        style={style}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api('/api/auth/visitante', { body: {} });
            window.location.assign('/projetos');
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        {busy ? 'Entrando…' : label}
      </button>
      {error && <p className="form-error">{error}</p>}
    </>
  );
}
