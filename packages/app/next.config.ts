import path from 'node:path';
import type { NextConfig } from 'next';

const root = path.resolve(process.cwd(), '../..');

const config: NextConfig = {
  // Pacotes do monorepo em TypeScript são compilados pelo Next.
  transpilePackages: ['@graficai/core', '@graficai/server'],
  // Binários nativos e drivers ficam fora do bundle.
  serverExternalPackages: ['@myriaddreamin/typst-ts-node-compiler', '@electric-sql/pglite', 'pg', 'mammoth'],
  outputFileTracingRoot: root,
  // Fontes usadas pelo Typst na composição.
  outputFileTracingIncludes: { '/api/projetos/**': ['../server/fonts/**'] },
  poweredByHeader: false,
};

export default config;
