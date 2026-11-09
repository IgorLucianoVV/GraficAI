import type { ElementKind, ElementRule, ElementGroup } from './types.ts';

// Convenções editoriais (NBR 6029 + prática de mercado). Configuráveis no futuro por editora.
export const ELEMENT_RULES: Record<ElementKind, ElementRule> = {
  falsa_folha_rosto: { opensOn: 'impar', blankVerso: false, fixedPages: 2, group: 'pre' },
  folha_rosto: { opensOn: 'impar', blankVerso: false, fixedPages: 1, group: 'pre' },
  ficha: { opensOn: 'qualquer', blankVerso: false, fixedPages: 1, group: 'pre' },
  dedicatoria: { opensOn: 'impar', blankVerso: true, fixedPages: 1, group: 'pre' },
  agradecimentos: { opensOn: 'impar', blankVerso: false, group: 'pre' },
  epigrafe: { opensOn: 'impar', blankVerso: true, fixedPages: 1, group: 'pre' },
  sumario: { opensOn: 'impar', blankVerso: false, group: 'pre' },
  prefacio: { opensOn: 'impar', blankVerso: false, group: 'pre' },
  apresentacao: { opensOn: 'impar', blankVerso: false, group: 'pre' },
  introducao: { opensOn: 'impar', blankVerso: false, group: 'texto' },
  capitulo: { opensOn: 'impar', blankVerso: false, group: 'texto' },
  conclusao: { opensOn: 'impar', blankVerso: false, group: 'texto' },
  posfacio: { opensOn: 'impar', blankVerso: false, group: 'pos' },
  referencias: { opensOn: 'impar', blankVerso: false, group: 'pos' },
  glossario: { opensOn: 'impar', blankVerso: false, group: 'pos' },
  anexo: { opensOn: 'impar', blankVerso: false, group: 'pos' },
  indice: { opensOn: 'impar', blankVerso: false, group: 'pos' },
  sobre_autor: { opensOn: 'qualquer', blankVerso: false, fixedPages: 1, group: 'pos' },
  colofao: { opensOn: 'qualquer', blankVerso: false, fixedPages: 1, group: 'pos' },
};

export const KIND_LABELS: Record<ElementKind, string> = {
  falsa_folha_rosto: 'Falsa folha de rosto',
  folha_rosto: 'Folha de rosto',
  ficha: 'Ficha catalográfica',
  dedicatoria: 'Dedicatória',
  agradecimentos: 'Agradecimentos',
  epigrafe: 'Epígrafe',
  sumario: 'Sumário',
  prefacio: 'Prefácio',
  apresentacao: 'Apresentação',
  introducao: 'Introdução',
  capitulo: 'Capítulo',
  conclusao: 'Conclusão',
  posfacio: 'Posfácio',
  referencias: 'Referências',
  glossario: 'Glossário',
  anexo: 'Anexo',
  indice: 'Índice',
  sobre_autor: 'Sobre o autor',
  colofao: 'Colofão',
};

export const GROUP_LABELS: Record<ElementGroup, string> = {
  pre: 'Pré-textuais',
  texto: 'Textuais',
  pos: 'Pós-textuais',
};

export function ruleFor(kind: ElementKind, chaptersOnOdd: boolean): ElementRule {
  const rule = ELEMENT_RULES[kind];
  if (!chaptersOnOdd && rule.group === 'texto') return { ...rule, opensOn: 'qualquer' };
  return rule;
}
