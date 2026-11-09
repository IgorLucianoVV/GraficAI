// Copia as migrações SQL do drizzle-kit para um módulo TS, para não depender de
// caminhos no disco em ambiente serverless.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const dir = new URL('../drizzle/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const list = files.map((f) => ({ id: f.replace(/\.sql$/, ''), statements: readFileSync(new URL(f, dir), 'utf8').split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean) }));
writeFileSync(new URL('../src/db/migrations.ts', import.meta.url), `// Gerado por scripts/embed-migrations.mjs — não edite.\nexport const MIGRATIONS: { id: string; statements: string[] }[] = ${JSON.stringify(list, null, 2)};\n`);
console.log(`${files.length} migração(ões) embutida(s).`);
