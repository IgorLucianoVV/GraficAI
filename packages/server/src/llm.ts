import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { ELEMENT_RULES, type Book, type ElementKind } from '@graficai/core';

/**
 * Refinamento opcional da estrutura com Claude. O LLM só reclassifica
 * elementos (rótulos); nunca calcula páginas, cadernos ou custo.
 * Sem ANTHROPIC_API_KEY o produto funciona só com regras.
 */
const KINDS = Object.keys(ELEMENT_RULES) as [ElementKind, ...ElementKind[]];

const ResultSchema = z.object({
  elements: z.array(
    z.object({
      index: z.number().int(),
      kind: z.enum(KINDS),
      confidence: z.enum(['alta', 'media', 'baixa']),
      rationale: z.string().max(300),
    }),
  ),
});

export function llmAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function refineWithLLM(book: Book): Promise<{ book: Book; changed: number }> {
  if (!llmAvailable()) return { book, changed: 0 };
  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5-5';

  const outline = book.elements.map((e, index) => ({
    index,
    kind: e.kind,
    title: e.title.slice(0, 120),
    chars: e.blocks.reduce((a, b) => a + b.text.length, 0),
    start: e.blocks.map((b) => b.text).join(' ').slice(0, 240),
  }));

  const prompt = `Você classifica a estrutura editorial de um manuscrito brasileiro (NBR 6029).
Tipos permitidos: ${KINDS.join(', ')}.
Para cada elemento abaixo (título, tamanho em caracteres e início do texto), devolva o tipo mais provável,
a confiança (alta, media, baixa) e um motivo curto em português.
Responda SOMENTE com JSON no formato {"elements":[{"index":0,"kind":"capitulo","confidence":"alta","rationale":"..."}]}.

Elementos:
${JSON.stringify(outline)}`;

  const res = await client.messages.create({ model, max_tokens: 4000, messages: [{ role: 'user', content: prompt }] });
  const text = res.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const parsed = ResultSchema.safeParse(JSON.parse(json));
  if (!parsed.success) return { book, changed: 0 };

  let changed = 0;
  const elements = book.elements.map((e, i) => {
    const r = parsed.data.elements.find((x) => x.index === i);
    if (!r) return e;
    if (r.kind !== e.kind) changed += 1;
    return { ...e, kind: r.kind, confidence: r.confidence, classifiedBy: 'llm' as const, rationale: r.rationale };
  });
  return { book: { ...book, elements }, changed };
}
