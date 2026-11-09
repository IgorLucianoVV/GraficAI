import path from 'node:path';
import { sql } from 'drizzle-orm';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzleLite } from 'drizzle-orm/pglite';
import * as schema from './schema.ts';
import { MIGRATIONS } from './migrations.ts';

export type DB = NodePgDatabase<typeof schema>;

/**
 * Banco: Postgres quando DATABASE_URL existe (Neon, Vercel Postgres, Supabase…);
 * senão PGlite em disco (.data/pglite), um Postgres embutido para rodar local
 * sem instalar nada. As duas APIs do Drizzle são equivalentes.
 */
async function open(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  let db: DB;
  if (url) {
    const { Pool } = await import('pg');
    db = drizzlePg(new Pool({ connectionString: url, max: Number(process.env.DATABASE_POOL_MAX ?? 5) }), { schema });
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const dir = process.env.GRAFICAI_DATA_DIR ?? path.join(process.cwd(), '.data', 'pglite');
    const { mkdirSync } = await import('node:fs');
    mkdirSync(dir, { recursive: true });
    db = drizzleLite(new PGlite(dir), { schema }) as unknown as DB;
  }
  await migrate(db);
  return db;
}

const g = globalThis as unknown as { __graficaiDb?: Promise<DB> };

/** Conexão única por processo (sobrevive ao recarregamento do Next em dev). */
export function getDb(): Promise<DB> {
  g.__graficaiDb ??= open().catch((e) => {
    g.__graficaiDb = undefined;
    throw e;
  });
  return g.__graficaiDb;
}

/** Banco em memória para testes. */
export async function createMemoryDb(): Promise<DB> {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = drizzleLite(new PGlite(), { schema }) as unknown as DB;
  await migrate(db);
  return db;
}

/** Aplica as migrações embutidas que ainda não rodaram (idempotente, com trava). */
export async function migrate(db: DB) {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS _graficai_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(724391)`);
    const done = new Set((await tx.execute<{ id: string }>(sql`SELECT id FROM _graficai_migrations`)).rows.map((r) => r.id));
    for (const m of MIGRATIONS) {
      if (done.has(m.id)) continue;
      for (const stmt of m.statements) await tx.execute(sql.raw(stmt));
      await tx.execute(sql`INSERT INTO _graficai_migrations (id) VALUES (${m.id})`);
    }
  });
}

export { schema };
