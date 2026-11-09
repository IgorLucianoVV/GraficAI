# GraficAI

Diagnóstico editorial de livros: do manuscrito ao caderno fechado. Envie o original e veja as laudas, a estimativa de páginas, o plano de cadernos, a lombada e o custo de impressão — com cada página em branco explicada e propostas de projeto gráfico que reduzem cadernos.

Esta é a **fase F1 (Diagnóstico)** do plano de implementação.

## O que já funciona

- **Ingestão** de `.docx`, `.md` e `.txt` (DOCX via mammoth). A formatação dentro do parágrafo é preservada como trechos com estilo (itálico, negrito, sobrescrito, subscrito) e as notas de rodapé ficam ligadas à chamada (`Run.noteRef` ↔ `Block.noteId`), anexadas ao capítulo que as chama. No Markdown: `*itálico*`, `**negrito**`, `^sup^`, `~sub~` e notas `[^id]`. O texto puro continua alimentando laudas e castoff.
- **Estrutura do livro** por regras (NBR 6029): capítulos, prefácio, dedicatória, epígrafe, referências etc., com confiança e motivo de cada classificação. Refinamento opcional com Claude quando `ANTHROPIC_API_KEY` está definida. Elementos pré-textuais padrão (falsa folha de rosto, folha de rosto, ficha) são adicionados quando faltam.
- **Laudas** configuráveis (1.250 / 1.400 / 1.800 / 2.100 ou valor livre), com valor bruto e arredondamento contratual, por elemento, exportáveis em CSV.
- **Castoff por bloco**: mancha calculada a partir de formato, margens, corpo e entrelinha; aberturas de capítulo com afundamento.
- **Abertura de capítulo**: presets Clássica / Moderna / Sóbria ou personalizada — capitular rebaixada ou elevada (2–4 linhas), versalete na primeira linha ou nas primeiras palavras, numeral (arábico, romano, por extenso), fio ou vinheta. O efeito entra no castoff (largura da capitular por letra, versalete mais largo, parágrafo curto forçado à altura da capitular) com regras para diálogo, aspas, algarismos e palavras de uma letra; prévia ao vivo no painel.
- **Montagem**: capítulos em página ímpar, verso em branco de dedicatória/epígrafe; cada branco guarda o motivo.
- **Formato e folha**: formatos prontos ou personalizado (mm), com margens que podem acompanhar a proporção. No offset, a imposição calcula quantas páginas cabem na folha da gráfica (66 × 96, 76 × 112…) nas duas orientações, descontando pinça, margens e refile; isso define o maior caderno, os cadernos possíveis, o aproveitamento de papel e o custo do papel (área × gramatura × R$/kg). A folha é escolhida automaticamente pelo menor custo ou fixada.
- **Cadernos**: programação dinâmica escolhe a combinação de tamanhos aceitos pela gráfica (ex.: 32/16/8) com menos desperdício; mostra quanto cortar ou preencher para fechar ("even working").
- **Custo** por componente (chapas e acerto por caderno, papel, rodagem, encadernação, capa) ou digital (fixo + por página), e lombada.
- **Problemas**: finais de capítulo com poucas linhas, páginas pouco ocupadas, caderno incompleto ou fracionado, classificação incerta.
- **"Por que essa página existe?"**: clique em qualquer página do mapa de cadernos.
- **Otimizar livro**: propostas A (econômica), B (equilibrada) e C (confortável) dentro de limites de legibilidade (corpo ≥ 10 pt, entrelinha ≥ 1,18×), em Web Worker.
- **Exportar** (botão no topo ou Ctrl+K): *especificação para a gráfica* em PDF (formato, páginas, plano de cadernos, papel, lombada, capa aberta com orelhas e sangria, estimativa de referência, observações) e *brief para o designer* em PDF (mancha, tipografia, abertura de capítulo, estrutura com página inicial, cadernos, brancos e pontos de atenção). Os documentos são montados em `@graficai/core` (`printerSpecDoc`, `designerBriefDoc`) e desenhados no navegador com jsPDF.
- **Interface**: painel ao vivo (páginas, cadernos, R$/exemplar, laudas, lombada com deltas), desfazer/refazer (Ctrl+Z / Ctrl+Shift+Z), paleta de comandos (Ctrl+K), modo foco (Ctrl+\\), tema claro/escuro, `prefers-reduced-motion`, navegação por teclado.

> Os valores de custo dos perfis de gráfica são **de exemplo**. Substitua em `packages/core/src/defaults.ts` pela tabela da gráfica parceira.

## Rodando

Requer Node 20+.

```bash
npm install
npm run dev:api     # API em http://localhost:8787
npm run dev:web     # interface em http://localhost:5173 (proxy para a API)
```

Produção (a API serve o front compilado):

```bash
npm run build
npm start           # http://localhost:8787
```

IA opcional:

```bash
cp .env.example .env   # defina ANTHROPIC_API_KEY (e, se quiser, ANTHROPIC_MODEL)
```

O livro de exemplo abre sem servidor de IA; um manuscrito de teste está em `examples/manuscrito-exemplo.docx`.

## Testes

```bash
npm test          # motores determinísticos (cadernos, laudas, paginação, custo, propostas, classificação)
npm run typecheck
```

## Arquitetura

```
packages/
  core/   Motores determinísticos em TypeScript puro (sem LLM): laudas, castoff, montagem,
          cadernos, custo, problemas, explicações, propostas e classificação por regras.
          Roda no navegador (diagnóstico ao vivo) e no servidor.
  api/    Express: upload, conversão DOCX → blocos, classificação, refinamento opcional com Claude.
  web/    React + Vite: início, revisão da estrutura e área de diagnóstico.
```

Princípio: **o LLM interpreta, o código calcula**. O modelo só rotula a estrutura; todo número vem de `@graficai/core`.

## Próximas fases

- F2 — composição real com Typst por capítulo e PDF para gráfica.
- F3 — otimizador com composição real e variação por parágrafo.
- F4 — editor e agente conversacional.
