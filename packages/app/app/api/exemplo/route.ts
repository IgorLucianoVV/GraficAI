import { sampleBook } from '@graficai/core';
import { route } from '@/lib/server';

export const GET = route(async () => ({ book: sampleBook(), warnings: [], llmUsed: false }));
