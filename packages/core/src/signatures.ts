import type { SignaturePlan } from './types.ts';

/**
 * Escolhe a combinação de cadernos aceitos pela gráfica que cobre `pages`
 * com o menor desperdício (páginas em branco de fechamento); em empate,
 * usa menos cadernos (menos acertos de máquina) e cadernos maiores.
 *
 * Programação dinâmica sobre o total de páginas — exata para os tamanhos
 * usuais (múltiplos de 4).
 */
export function planSignatures(pages: number, sizes: number[]): SignaturePlan {
  // Cadernos dobrados são múltiplos de 4; 2 é aceito para impressão digital (folhas soltas coladas).
  const valid = [...new Set(sizes.filter((s) => s > 0 && s % 2 === 0))].sort((a, b) => b - a);
  if (valid.length === 0) throw new Error('Nenhum tamanho de caderno válido.');
  if (pages <= 0) return { sizes: [], totalPages: 0, contentPages: 0, paddingPages: 0 };

  const largest = valid[0];
  const limit = pages + largest;
  // best[n] = menor número de cadernos para somar exatamente n páginas; -1 = impossível
  const best = new Array<number>(limit + 1).fill(-1);
  const pick = new Array<number>(limit + 1).fill(0);
  best[0] = 0;
  for (let n = 1; n <= limit; n++) {
    for (const s of valid) {
      if (s > n || best[n - s] < 0) continue;
      const count = best[n - s] + 1;
      if (best[n] < 0 || count < best[n]) {
        best[n] = count;
        pick[n] = s;
      }
    }
  }

  let target = -1;
  for (let n = pages; n <= limit; n++) {
    if (best[n] >= 0) {
      target = n;
      break;
    }
  }
  if (target < 0) throw new Error('Não foi possível montar os cadernos.');

  const chosen: number[] = [];
  for (let n = target; n > 0; n -= pick[n]) chosen.push(pick[n]);
  chosen.sort((a, b) => b - a);

  return { sizes: chosen, totalPages: target, contentPages: pages, paddingPages: target - pages };
}

/**
 * "Even working": totais que fecham sem página extra, logo abaixo e logo acima.
 * Usa o menor caderno aceito como granularidade.
 */
export function evenWorking(pages: number, sizes: number[]) {
  const plan = planSignatures(pages, sizes);
  let lower = pages;
  while (lower > 0 && planSignatures(lower, sizes).paddingPages !== 0) lower -= 1;
  return {
    pagesToCut: pages - lower,
    lowerTotal: lower,
    pagesToFill: plan.paddingPages,
    upperTotal: plan.totalPages,
  };
}

export function describePlan(plan: SignaturePlan): string {
  if (plan.sizes.length === 0) return 'sem cadernos';
  const counts = new Map<number, number>();
  for (const s of plan.sizes) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([s, c]) => `${c} × ${s}`)
    .join(' + ');
}
