import { useRef, useState } from 'react';

interface Props {
  onFile: (file: File) => void;
  onSample: () => void;
  loading: string | null;
  error: string | null;
}

export function Home({ onFile, onSample, loading, error }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <main className="home">
      <div className="home-inner">
        <div>
          <h1>Do manuscrito ao caderno fechado.</h1>
          <p className="lead">
            Envie o original e veja em segundos as laudas, a estimativa de páginas, o plano de cadernos e o custo de impressão — com cada página em branco explicada.
          </p>
        </div>

        <div
          className={`drop${over ? ' over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files[0];
            if (f) onFile(f);
          }}
        >
          {loading ? (
            <ol className="progress" aria-live="polite">
              <li className="done">Arquivo recebido</li>
              <li className={loading !== 'enviando' ? 'done' : ''}>Lendo a estrutura do manuscrito…</li>
              <li>Contando laudas e montando cadernos</li>
            </ol>
          ) : (
            <>
              <p style={{ fontSize: 16, fontWeight: 600 }}>Arraste o manuscrito para cá</p>
              <p className="muted">.docx, .md ou .txt · até 25 MB</p>
              <div className="row" style={{ justifyContent: 'center', display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn-primary" style={{ flex: 'none' }} onClick={() => input.current?.click()}>
                  Escolher arquivo
                </button>
                <button className="btn" style={{ flex: 'none' }} onClick={onSample}>
                  Abrir livro de exemplo
                </button>
              </div>
            </>
          )}
          <input
            ref={input}
            type="file"
            accept=".docx,.md,.markdown,.txt"
            className="sr-only"
            aria-label="Escolher manuscrito"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
          {error && (
            <p role="alert" style={{ color: 'var(--danger)', marginTop: 12 }}>
              {error}
            </p>
          )}
        </div>

        <div className="steps">
          <div className="card">
            <h3>1. Estrutura</h3>
            <p>Capítulos, prefácio, referências e demais elementos são identificados. Você revisa o que ficou incerto.</p>
          </div>
          <div className="card">
            <h3>2. Diagnóstico</h3>
            <p>Laudas, páginas, cadernos, lombada e custo atualizam enquanto você ajusta corpo, entrelinha e margens.</p>
          </div>
          <div className="card">
            <h3>3. Propostas</h3>
            <p>Três projetos — econômico, equilibrado e confortável — com a economia de cada um. Você decide.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
