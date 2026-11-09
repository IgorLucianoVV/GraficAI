import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { classifyBlocks, ensureFrontMatter, canonicalOrder, ELEMENT_RULES, sampleBook } from '@graficai/core';
import { ingestDocx, ingestMarkdown, ingestText } from './ingest.ts';
import { llmAvailable, refineWithLLM } from './llm.ts';
import { typeset, TypesetError } from './typeset.ts';

// Carrega .env da raiz do repositório, se existir (Node ≥ 20.12).
try {
  process.loadEnvFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env'));
} catch {
  /* sem .env: segue com as variáveis do ambiente */
}

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

app.get('/api/health', (_req, res) => res.json({ ok: true, llm: llmAvailable() }));

app.get('/api/sample', (_req, res) => res.json({ book: sampleBook(), warnings: [], llmUsed: false }));

app.post('/api/manuscripts', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Envie um arquivo no campo "file".' });
    const name = file.originalname;
    const ext = path.extname(name).toLowerCase();

    let ingest;
    if (ext === '.docx') ingest = await ingestDocx(file.buffer, name);
    else if (ext === '.md' || ext === '.markdown') ingest = ingestMarkdown(file.buffer.toString('utf8'), name);
    else if (ext === '.txt') ingest = ingestText(file.buffer.toString('utf8'), name);
    else return res.status(415).json({ error: `Formato ${ext || 'desconhecido'} ainda não suportado. Use .docx, .md ou .txt.` });

    if (!ingest.blocks.length) return res.status(422).json({ error: 'Não encontrei texto no arquivo.' });

    let book = classifyBlocks(ingest.blocks, ingest.title);
    let llmUsed = false;
    const warnings = [...ingest.warnings];
    if (llmAvailable() && req.query.ai !== '0') {
      try {
        const refined = await refineWithLLM(book);
        book = refined.book;
        llmUsed = true;
      } catch (e) {
        // Degradação graciosa: sem IA, o diagnóstico continua com as regras.
        warnings.push(`IA indisponível, usando só regras (${(e as Error).message.slice(0, 120)}).`);
      }
    }
    book = canonicalOrder(ensureFrontMatter(book), (k) => ELEMENT_RULES[k].group);
    res.json({ book: { ...book, source: ext === '.docx' ? 'docx' : 'texto' }, warnings, llmUsed });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Falha ao ler o manuscrito. Verifique se o arquivo não está corrompido.' });
  }
});

/**
 * Composição real (Typst). Corpo: { book, settings, options: { trimMarks, padToSignatures }, format }.
 * format 'pdf' (padrão) devolve o miolo; 'typ' devolve o fonte; 'json' só o relatório.
 */
app.post('/api/typeset', express.json({ limit: '60mb' }), (req, res) => {
  const { book, settings, options = {}, format = 'pdf' } = req.body ?? {};
  if (!book?.elements || !settings?.design) return res.status(400).json({ error: 'Envie { book, settings }.' });
  try {
    const t0 = Date.now();
    const r = typeset(book, settings, { trimMarks: options.trimMarks, padToSignatures: !!options.padToSignatures, pdf: format === 'pdf' });
    const report = { pages: r.pages, padding: r.padding, starts: r.starts, warnings: r.warnings, ms: Date.now() - t0 };
    if (format === 'json') return res.json(report);
    if (format === 'typ') return res.type('text/plain; charset=utf-8').send(r.source);
    res.setHeader('X-GraficAI-Pages', String(r.pages));
    res.setHeader('X-GraficAI-Padding', String(r.padding));
    res.type('application/pdf').send(r.pdf);
  } catch (e) {
    if (e instanceof TypesetError) return res.status(422).json({ error: 'A composição falhou.', diagnostics: e.diagnostics.slice(0, 10) });
    console.error(e);
    res.status(500).json({ error: 'Falha inesperada na composição.' });
  }
});

// Em produção, serve o front compilado.
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../../web/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => console.log(`GraficAI API em http://localhost:${port} (IA: ${llmAvailable() ? 'ligada' : 'desligada'})`));
