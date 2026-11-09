'use client';
import { useState } from 'react';
import { api } from '@/src/api';

export function AcceptInvite({ token, userName }: { token: string; userName: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        className="btn btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api('/api/convites/aceitar', { body: { token } });
            window.location.assign('/projetos');
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        {busy ? 'Entrando…' : `Aceitar como ${userName}`}
      </button>
      {error && <p className="form-error">{error}</p>}
    </>
  );
}
