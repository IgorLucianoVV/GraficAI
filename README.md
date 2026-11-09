# GraficAI

Diagnóstico editorial de livros: do manuscrito ao caderno fechado. Envie o original e veja as laudas, a estimativa de páginas, o plano de cadernos, a lombada e o custo de impressão — com cada página em branco explicada e propostas de projeto gráfico que reduzem cadernos.

Com contas, equipes e projetos salvos; pronto para subir na Vercel com Postgres no Neon.

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

> Os perfis de gráfica de exemplo têm valores **ilustrativos**. Cadastre a tabela da sua gráfica em Configurações → Perfis de gráfica.

## Livro composto (Typst)

Exportar → **Livro composto** gera o miolo diagramado de verdade com [Typst](https://typst.app) (via `@myriaddreamin/typst-ts-node-compiler`, sem instalar nada além do `npm install`):

- formato, margens interna/externa, corpo e entrelinha do projeto; hifenização em português;
- abertura de capítulo: numeral, ornamento, capitular rebaixada (medida palavra a palavra) ou elevada, versalete; epígrafe de capítulo;
- notas de rodapé na chamada, numeradas por capítulo; sumário com as páginas reais;
- cabeço, fólio, aberturas em página ímpar e brancos sem cabeço/fólio;
- saída no formato final, com sangria ou com sangria e marcas de corte; opção de fechar o último caderno.

`POST /api/projetos/:id/compor` com `{ options: { trimMarks, padToSignatures }, format: 'pdf' | 'typ' | 'json' }` compõe o projeto salvo e devolve o PDF em streaming. Fonte padrão: EB Garamond (OFL, em `packages/server/fonts`).

## Contas, equipes e projetos

- **Conta** com e-mail e senha (scrypt, sessão em cookie httpOnly guardada no banco, 30 dias).
- **Equipes**: cada conta tem uma equipe pessoal; crie outras e convide por link (7 dias, uso único). Papéis: **dono** (tudo), **editor** (cria e edita), **leitor** (vê e exporta).
- **Projetos** da equipe com **salvamento automático** (1,2 s após a última alteração), controle de conflito entre janelas, **versões nomeadas**, versões automáticas a cada 10 min (as 30 mais recentes) e **restauração** (o estado atual vira versão antes).
- **Perfis de gráfica** (folhas, dobra, acerto, papel em R$/kg, rodagem, encadernação, capa) e **modelos de projeto gráfico** da equipe, usados ao criar projetos e no editor.

## Rodando

Requer Node 20.9+.

```bash
npm install
npm run dev        # http://localhost:3000
```

Sem `DATABASE_URL`, o banco é um Postgres embutido (PGlite) em `packages/app/.data`, criado sozinho. Para usar um Postgres de verdade ou a IA, copie `packages/app/.env.example` para `packages/app/.env.local`.

Produção local: `npm run build && npm start`.

## Deploy grátis (Vercel + Neon)

1. Crie um banco no [Neon](https://neon.com) (plano Free) e copie a *connection string* (com `sslmode=require`).
2. Na [Vercel](https://vercel.com), importe o repositório do GitHub com **Root Directory = `packages/app`** (framework Next.js; mantenha ativado “Include files outside the root directory”).
3. Em *Environment Variables*: `DATABASE_URL` (Neon) e, se quiser, `ANTHROPIC_API_KEY`.
4. Deploy. As tabelas são criadas na primeira requisição (migrações embutidas e idempotentes).

Limites do plano gratuito que importam aqui: Vercel Hobby é para uso não comercial; requisições de até 4,5 MB (manuscritos grandes com imagens podem passar disso); o Neon suspende o banco após 5 min parado (a primeira requisição depois demora um pouco mais).

## Testes

```bash
npm test          # motores, ingestão, composição Typst, contas/equipes/projetos (PGlite em memória)
npm run typecheck
```

## Arquitetura

```
packages/
  core/    Motores determinísticos em TypeScript puro: laudas, castoff, imposição, cadernos,
           custo, abertura de capítulo, propostas, classificação por regras, gerador Typst.
  server/  Banco (Drizzle + Postgres/PGlite), autenticação, equipes, projetos e versões,
           perfis/modelos, ingestão de DOCX/MD/TXT, IA opcional, composição Typst.
  app/     Next.js (App Router): páginas, rotas /api e o editor (diagnóstico ao vivo no navegador).
```

Princípio: **o LLM interpreta, o código calcula**. O modelo só rotula a estrutura; todo número vem de `@graficai/core`.

Migrações: edite `packages/server/src/db/schema.ts` e rode `npm run db:generate -w @graficai/server`.

## Próximas fases

- F2.4 — painel estimado × real (calibrar o castoff com a composição).
- F3 — otimizador com composição real e variação por parágrafo.
- F4 — editor e agente conversacional.
