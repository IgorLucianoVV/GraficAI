import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { classifyBlocks, ensureFrontMatter, canonicalOrder, ELEMENT_RULES, sampleBook } from '@graficai/core';
import { ingestDocx, ingestMarkdown, ingestText } from './ingest.ts';
import { llmAvailable, refineWithLLM } from './llm.ts';

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

// Em produção, serve o front compilado.
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../../web/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => console.log(`GraficAI API em http://localhost:${port} (IA: ${llmAvailable() ? 'ligada' : 'desligada'})`));
