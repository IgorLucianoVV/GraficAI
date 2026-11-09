import type { Book, DesignSpec, ProjectSettings, Variant, Diagnosis } from './types.ts';
import { diagnose } from './diagnose.ts';
import { describePlan } from './signatures.ts';

/** Limites de legibilidade que o otimizador nunca viola. */
export const LIMITS = { minBodyPt: 10, maxBodyPt: 13, minLeadingRatio: 1.18, maxLeadingRatio: 1.5, minInnerMm: 15, minOuterMm: 12, minTopBottomMm: 14 };

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export function deviation(base: DesignSpec, d: DesignSpec): number {
  const t = (a: number, b: number, range: number) => ((a - b) / range) ** 2;
  return (
    t(d.bodySizePt, base.bodySizePt, 1) +
    t(d.leadingPt, base.leadingPt, 1.5) +
    t(d.marginInnerMm, base.marginInnerMm, 5) +
    t(d.marginOuterMm, base.marginOuterMm, 5) +
    t(d.marginTopMm, base.marginTopMm, 5) +
    t(d.paragraphSpacingLines, base.paragraphSpacingLines, 1)
  );
}

export function describeChanges(base: DesignSpec, d: DesignSpec): string[] {
  const c: string[] = [];
  if (d.bodySizePt !== base.bodySizePt) c.push(`Corpo ${fmt(base.bodySizePt)} → ${fmt(d.bodySizePt)} pt`);
  if (d.leadingPt !== base.leadingPt) c.push(`Entrelinha ${fmt(base.leadingPt)} → ${fmt(d.leadingPt)} pt`);
  if (d.marginInnerMm !== base.marginInnerMm || d.marginOuterMm !== base.marginOuterMm)
    c.push(`Margens laterais ${fmt(base.marginInnerMm)}/${fmt(base.marginOuterMm)} → ${fmt(d.marginInnerMm)}/${fmt(d.marginOuterMm)} mm`);
  if (d.marginTopMm !== base.marginTopMm) c.push(`Margens sup./inf. ${fmt(base.marginTopMm)} → ${fmt(d.marginTopMm)} mm`);
  if (d.paragraphSpacingLines !== base.paragraphSpacingLines)
    c.push(`Espaço entre parágrafos ${fmt(base.paragraphSpacingLines)} → ${fmt(d.paragraphSpacingLines)} linha`);
  return c.length ? c : ['Projeto atual, sem alterações'];
}

/** Gera candidatos dentro dos limites; o espaço é pequeno e cada composição é aritmética. */
export function candidateDesigns(base: DesignSpec): DesignSpec[] {
  const out: DesignSpec[] = [];
  const sizes = [-1, -0.5, -0.25, 0, 0.25, 0.5].map((x) => base.bodySizePt + x);
  const leadOffsets = [-1, -0.5, 0, 0.5, 1];
  const marginOffsets = [-3, -1.5, 0, 2];
  const spacings = base.paragraphSpacingLines > 0 ? [base.paragraphSpacingLines, 0] : [0];
  const ratio = base.leadingPt / base.bodySizePt;

  for (const size of sizes) {
    if (size < LIMITS.minBodyPt || size > LIMITS.maxBodyPt) continue;
    for (const lo of leadOffsets) {
      const leading = Math.round((size * ratio + lo) * 4) / 4;
      const r = leading / size;
      if (r < LIMITS.minLeadingRatio || r > LIMITS.maxLeadingRatio) continue;
      for (const mo of marginOffsets) {
        const inner = base.marginInnerMm + mo;
        const outer = base.marginOuterMm + mo;
        const tb = base.marginTopMm + mo;
        if (inner < LIMITS.minInnerMm || outer < LIMITS.minOuterMm || tb < LIMITS.minTopBottomMm) continue;
        for (const sp of spacings) {
          out.push({ ...base, bodySizePt: size, leadingPt: leading, marginInnerMm: inner, marginOuterMm: outer, marginTopMm: tb, marginBottomMm: base.marginBottomMm + mo, paragraphSpacingLines: sp });
        }
      }
    }
  }
  return out;
}

/**
 * Propostas A (econômica), B (equilibrada), C (confortável). Descarta
 * variantes dominadas: mesmo custo e mais desvio não interessam.
 */
export function proposeVariants(book: Book, settings: ProjectSettings): Variant[] {
  const base = settings.design;
  const baseDiag = diagnose(book, settings);
  const evaluated = candidateDesigns(base).map((design) => {
    const diagnosis = diagnose(book, settings, design, baseDiag.stats);
    return { design, diagnosis, deviation: deviation(base, design) };
  });

  // Fronteira de Pareto em (custo, desvio).
  const pareto = evaluated.filter(
    (a) => !evaluated.some((b) => b !== a && b.diagnosis.cost.total <= a.diagnosis.cost.total && b.deviation <= a.deviation && (b.diagnosis.cost.total < a.diagnosis.cost.total || b.deviation < a.deviation)),
  );
  const pool = pareto.length ? pareto : evaluated;

  const econ = [...pool].sort((a, b) => a.diagnosis.cost.total - b.diagnosis.cost.total || a.deviation - b.deviation)[0];
  const baseCost = baseDiag.cost.total || 1;
  const balanced = [...pool].sort((a, b) => a.diagnosis.cost.total / baseCost + 0.12 * a.deviation - (b.diagnosis.cost.total / baseCost + 0.12 * b.deviation))[0];
  const comfortPool = evaluated.filter(
    (e) => e.design.bodySizePt >= base.bodySizePt && e.design.leadingPt >= base.leadingPt && e.design.marginInnerMm >= base.marginInnerMm,
  );
  const comfort = [...comfortPool].sort((a, b) => a.diagnosis.cost.total - b.diagnosis.cost.total || a.deviation - b.deviation)[0] ?? { design: base, diagnosis: baseDiag, deviation: 0 };

  const make = (id: Variant['id'], label: string, e: { design: DesignSpec; diagnosis: Diagnosis; deviation: number }): Variant => ({
    id,
    label,
    description: `${e.diagnosis.plan.totalPages} páginas · ${describePlan(e.diagnosis.plan)}`,
    design: e.design,
    diagnosis: e.diagnosis,
    deviation: Math.round(e.deviation * 100) / 100,
    changes: describeChanges(base, e.design),
  });

  return [make('A', 'Econômica', econ), make('B', 'Equilibrada', balanced), make('C', 'Confortável', comfort)];
}
