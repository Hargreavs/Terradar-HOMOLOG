# Auditoria: leitura de Risk Score e Opportunity Score no drawer «Ver Relatório Completo»

Data do relatório: 2026-04-28 · Escopo: apenas leitura do código (sem alterações na base).

## 1. Resumo executivo

O número grande de **Risk Score** e os três **Opportunity Score** (Conservador / Moderado / Arrojado) vêm do objeto `Processo` no Zustand, enriquecido após `buildReportData` + `/api/processo`. O agregado exibido não usa diretamente a linha Supabase «crua»: o builder `buildReportData` em `reportDataBuilder.ts` **prioriza `api.scores_auto`** (resultado de `computeScoresAuto`, motor legado Node) sempre que existe, **substituindo** o uso de `api.scores` onde estão os valores persistidos pelo motor S31 — explicando divergências RS 80 vs 60 e OS “errados” mesmo com dimensões vindas do JSONB corretas.

O **tooltip** do Risk total (`RiskTotalCalcTooltipContent`) assume a fórmula fixa Geo×0,25 + Amb×0,30 + Soc×0,25 + Reg×0,20 e mostra `decomposicao.total === processo.risk_score`; se o motor S31 no banco grava um total **não** igual a essa média ponderada, o utilizador vê dimensões coerentes com o motor mas um total (e um “=” no tooltip) que não fecha com a fórmula exibida.

Para **Segurança**: o valor na aba Oportunidade vem de `ReportData.os_seg` (derivado do mesmo ramo `scores_auto` ou de `dimensoes_oportunidade` parseadas), não de um segundo cálculo isolado no JSX; divergência vs 50 indica **origem de dados** errada (prioridade `scores_auto`/merge), não apenas formatação.

---

## 2. Tarefa 1 — Caminho do dado

### 2.1 Card «RISK SCORE» no topo (número grande + 4 barras)


| Pergunta         | Resposta                                                                                                                                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Componente       | O bloco **não** está num ficheiro nomeado `RiskScoreCard.tsx`. O card é **inline** em `src/components/map/RelatorioCompleto.tsx`, dentro do branch `aba === 'risco'`, etiqueta textual «Risk Score», ~linhas **5503–5683** (número em destaque ~**5556**) e barras das quatro dimensões ~**5596–5681**. |
| Número grande    | `{processo.risk_score}` (mesmo objeto `processo` do store).                                                                                                                                                                                                                                             |
| Barras           | Labels Geológico / Ambiental / Social / Regulatório: valores de `riskDecomposicaoMemo` (prioridade) ou `processo.risk_breakdown` (fallback). Definidos em ~**5608–5623**.                                                                                                                               |
| Tooltip do total | `CamadaTooltipHover` + `RiskTotalCalcTooltipContent` (~**5537–5558**), import de `./RiskScoreCalcTooltipContent`.                                                                                                                                                                                       |


### 2.2 Card «OPPORTUNITY SCORE» (3 perfis)


| Pergunta            | Resposta                                                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Componente          | Também em `RelatorioCompleto.tsx`, `aba === 'oportunidade'`, ~~**5929–6088**: grelha 3 colunas «CONSERVADOR / MODERADO / ARROJADO», valores `oportunidade.perfis[k].valor` (~~**6043**). |
| Tooltips por perfil | `OportunidadePerfilCalcTooltipContent` de `./OportunidadeScoreCalcTooltipContent` (~**6021–6026**).                                                                                      |


### 2.3 Hook / serviço que busca dados


| Etapa                                | Onde                                                                                                                                                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Abertura do drawer                   | `MapView.tsx`: `abrirRelatorioDoProcesso` dispara `buildReportData(p.numero)` e `fetchProcessoCompleto(p.numero)` (em `src/lib/processoApi.ts` ou equivalente), depois `relatorioDataFromReportData(rd, processo, mercado)` para o conteúdo do drawer. |
| Enriquecimento do `processo` no mapa | `useEffect` ~**1489–1512** chama `buildEnrichmentPatch(p, rd, api)` (`MapView.tsx` ~**125–218**): escreve `risk_score`, `risk_breakdown`, `os_*_persistido`, labels/cores persistidos no Zustand.                                                      |
| Lista de dependência                 | Não existe um único hook `useProcessoDetalhe` dedicado ao drawer: fluxo síncrono/efeito centrado em `MapView` + `useMapStore`.                                                                                                                         |


### 2.4 Campos `risk_score`, `os_conservador`, `os_moderado`, `os_arrojado`

| Fonte API | Os caminhos públicos são `GET /api/processo`: o servidor faz merge de `getScores` + opcionalmente `computeScoresAuto` (`server/index.ts` ~~351–387). Cliente usa `scores` já mergeados **e** o campo paralelo `**scores_auto`**. |
| `buildReportData` | `**scores_auto` ganha**, se verdadeiro: `riskScore = scoresAuto.risk_score`, `osCons/osMod/osArr` dos `scores_auto.*` (`**reportDataBuilder.ts` ~1100–1116**). Caso contrário, lê `scores?.risk_score` e `scores?.os_*` via `propagarScoreNumerico` (~~**1117–1162**). |
| Drawer | `processo.risk_score` vem do patch (`**rd.risk_score`**). OS dos três quadrados usa `oportunidadeFromReport` → `rd.os_conservador` etc. (`**relatorioDataFromReportData.ts` ~742–746**). |
| São **retornados** pela API | Sim (`data.scores` e `data.scores_auto`). São **USADOS** no drawer através de `**ReportData`** já transformado pelo builder — **priorizando `scores_auto`**, não a linha persistida só, quando ambos existem. |

---

## 3. Tarefa 2 — Onde aparece «cálculo local» ou agregações fixas no frontend

Trechos mais relevantes (com hipótese de função):


| Caminho                                                             | ~Linhas                                      | Hipótese                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/report/reportDataBuilder.ts`                        | 1080–1162                                    | **Decisiva:** `if (scoresAuto) { ... }` usa `scoresAuto.risk_score` e breakdowns/OS do motor **auto**. **Hipótese:** sobrescreve intenção de exibir apenas DB S31 (**cálculo de origem servidor legado**, não apenas formatação).                                                                                                                                                                                                                                                                          |
| `src/components/report/reportDataBuilder.ts`                        | 1169–1171                                    | Sobrescreve dimensão **ambiental** com `riskDimFromScore(p.score_territorial)` se existir (**denormalização**). Mistura territorial + score (**risco lógico** de divergir do JSON completo das quatro dimensões).                                                                                                                                                                                                                                                                                          |
| `src/components/map/MapView.tsx` (`buildEnrichmentPatch`)           | 136–216                                      | Traduz `ReportData` em campos «honestos» no `processo`; rejeita `risk_score === 0` sintético (**formatação + política de null**).                                                                                                                                                                                                                                                                                                                                                                          |
| `src/lib/riskScoreDecomposicao.ts`                                  | `gerarRiskDecomposicaoParaProcesso` ~867–903 | Sem `dimensoes_risco_persistido` completo + com `risk_breakdown`: monta **decomposição de UI** — **ambiental** via `ambientalDetalheMockFromProcesso` (camadas geo locais/mocks **não são** o mesmo que só o número da dimensão vinda do relatório para sub-variáveis). **Geo/Soc/Reg** usam heurísticas + targets a partir dos quatro números. **Hipótese:** texto/barras de subfatores compatíveis com «motor» mas **painel detalhado** pode não refletir subfatores S31 persistidos (`subfatores: []`). |
| `src/components/map/RiskScoreCalcTooltipContent.tsx`                | 218–240                                      | `**RiskTotalCalcTooltipContent`** imputa sempre **Risk Score = Geo×0,25 + Amb×0,30 + Soc×0,25 + Reg×0,20** e igual a `decomposicao.total`. **Hipótese:** se S31 gravar um agregado com outra regra, o tooltip está ** filosoficamente desalinhado** (fórmula local **fixa**, não confirmada pelo motor ao vivo).                                                                                                                                                                                           |
| `src/lib/oportunidadeRelatorioUi.ts`                                | 11–22                                        | Pesos perfis (**0,2 / 0,3 / 0,5** etc.) **fixos UI** para barras proporcionais; totais vindos já de `ReportData`. **Formatação + layout**, não recomputação do trio OS a partir de dimensões (isso já entrou como `rd.os_*`).                                                                                                                                                                                                                                                                              |
| `src/lib/relatorioDataFromReportData.ts` (`oportunidadeFromReport`) | 682–726                                      | Fallback quando **não há** `subfatores` no JSON persistido: atratividade chama `**buildAtratividadeItemsS31`** (heurísticas locais `**s31SubfatorDecomp.ts**`); viab/seg com uma linha **«Dimensão calculada automaticamente (motor S31).»** usando `dimValOf` (**valores vindos do `ReportData`**).                                                                                                                                                                                                       |


---

## 4. Tarefa 3 — Tabela de campos numéricos visíveis (origem «mais provável»)

Legenda:**DB** = colunas / JSON esperados na resposta persistida Supabase.**RD** = `ReportData` pós-`buildReportData`. **Auto** = `scores_auto`.`P**Processo`** = objeto no store.**Mock** = heurística/demo em TS.


| Aba / Card                | Label / valor                               | Componente principal                                                   | Origem do número                                                                                        |
| ------------------------- | ------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Header**                | Área ha, ano, badges                        | `RelatorioCompleto`                                                    | SIGMINE/processos (`processo` / rd)                                                                     |
| **Risco – topo**          | Risk Score (hero)                           | `RelatorioCompleto` ~5556                                              | **P(Processo.risk_score)** ← **RD.risk_score** ← **scores_auto primeiro** (**reportDataBuilder** ~1100) |
| **Risco – topo**          | Zona textual (Baixo/Risco médio/Alto risco) | `montarExibicaoScoresRelatorio`                                        | `scores_exibicao_api` ou `risk_label_persistido` ou `classificacaoRiscoTotal(risk_score)`               |
| **Risco – barras**        | Geol/Amb/Soc/Reg                            | `RelatorioCompleto` ~5610–5621                                         | `riskDecomposicaoMemo.*.score` **ou** `risk_breakdown.*`                                                |
| **Risco – decomposição**  | Pesos Geo 25% / Amb 30% / Soc 25% / Reg 20% | `RiskDecomposicaoRelatorioPanel`                                       | **Constantes** `PESOS_RISK_DIMENSAO` em `riskScoreDecomposicao.ts` (**UI apenas**)                      |
| **Risco – decomposição**  | Barras por subfator dentro de cada dimensão | `RiskDecomposicaoRelatorioPanel` + opcional `riskDimensaoSubfatorLazy` | Mix: variáveis de `RiskDimensaoDetalhe` (persistido vs mock/regressão ao alvo)                          |
| **Risco – tooltip total** | Fórmula 0,25 / 0,30 / …                     | `RiskTotalCalcTooltipContent`                                          | **Derivado localmente** dos quatro scores em `decomposicao`; total = `**decomposicao.total`**           |


| **Oportunidade – topo** | 3 números OS | `RelatorioCompleto` ~~5960–6043 | `**oportunidade.perfis.*.valor`** ← **RD.os_conservador/os_moderado/os_arrojado** ← **scores_auto** se existir (**~~1110**) |
| **Oportunidade – topo** | Rótulos (Favorável, etc.) | `exibicaoScoresRelatorio.osLabel` | `rd.os_*` persistido/API ou `**getOpportunityLabel(valor)`** (**oportunidadeRelatorioUi** / mock) |
| **Oportunidade – barras triplas dimensões** | Atratividade / Viabilidade / Segurança valores | `OportunidadeDecomposicaoRelatorioPanel` | `**oportunidade.dimensoes.*.valor`** ← **RD.os_merc / os_viab / os_seg** |
| **Oportunidade – subfatores** | Linhas por subfator (+ barras %) | Mesmo painel via `oportunidade.decomposicao` | Se JSON `subfatores` preenchido: **persistido**. Senão atratividade: `**buildAtratividadeItemsS31`**; viab/senha uma linha com valor = dim (**relatorioDataFromReportData.ts** ~718–726) |

| **Inteligência** | Preços USD, BRL derivados CFEM, valor reserva USD/ha, etc. | `RelatorioCompleto` + helpers `computePrecoBrlDrawer` | `**intelFromReport`** (**RD**): PTAX (`rd.ptax`), master mercado cf. `relatorioDataFromReportData` |
| **Território** | Distâncias km TI/UC/quilombo/aquífero/porto/infra | `RelatorioCompleto` (várias secções) | `**territorialFromReport(rd, processo)`** — distâncias a partir `**rd.layers` / `rd.infraestrutura**` (~**relatorioDataFromReportData.ts** 94+) |
| **Território** | Cores distância (textoCorDistS31, etc.) | `distanciaCor` / `territorialAmbientalDisplay` | **Regas de threshold** frontend sobre km já vindos dos **layers** |

| **Fiscal – CAPAG** | Letra/nota visual | Drawer fiscal (`RelatorioCompleto`) | Estado **RD`/fiscal`/processo**, funções `**capagBadgeLetra`** etc. |

*(O ficheiro `RelatorioCompleto.tsx` ultrapassa 7k linhas; demais campos — CFEM série, «vizinhos», eventos SCM — derivam maioritariamente de `**relatorioDataFromReportData` + mocks de report** e foram confirmados por grep/`territorialFromReport`/`fiscalFromReport`, não cada linha aberta uma a uma por limite desta auditoria.)*

---

## 5. Tarefa 4 — inconsistências relatadas pelo utilizador vs auditoria


| Divergência (ex. Aurizona)                   | Confirmada?                         | Onde (arquivo:linha aprox.)                                                                                                                                                | Porquê (hipótese)                                                                                                                                                                                                                                                             |
| -------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **risk_score UI 80 vs DB 60**                | **Sim (mecanismo)**                 | `reportDataBuilder.ts` **~1100–1107**; `server/index.ts` **~361–386** (merge servidor); cliente **ignora** `scores` mergeado em favor de `scores_auto` no builder          | `hasManualRiskScore` no servidor só exige `risk_score` **número** — merge DB acontece em `scores_final`, mas o **cliente** reconstrói métricas a partir de `**scores_auto` primeiro**, que reflete **computeScoresAuto** (potencialmente desatualizado vs S31 v3 persistido). |
| *os_ 15/15/15 vs 56/60/62**                  | **Plausível com o mesmo mecanismo** | Idem + `relatorioDataFromReportData.ts` **~742–746**                                                                                                                       | OS agregados no drawer = `**rd.os_**`*, alimentados pelo mesmo ramo `**scores_auto**`.                                                                                                                                                                                        |
| **Segurança 40 vs 50**                       | **Sim no pipeline**                 | `reportDataBuilder.ts` **~1114–1116** (ramo auto) ou **~1150–1152** (parse JSON)                                                                                           | **Segurança** = `osSeg` = `scoresAuto.os_breakdown.seguranca` **ou** `dimensoes_oportunidade`; qualquer prioridade errada do auto vs persistido explica o salto. **Não** é um segundo cálculo independente no painel — é **fonte de dados errada** no `ReportData`.           |
| **Dimensões risco (50/80/26/10,8) «certas»** | Coerente                            | Se `scores_auto` copia **dimensões** coincidentes com o teu SQL mas **agregado** RS diferente, ou se barras leem **breakdown** do patch enquanto o hero lê **outro** campo | Revalidar no browser: `processo.risk_breakdown` vs `riskDecomposicaoMemo` vs `processo.risk_score` num único processo (DevTools / log temporário em dev).                                                                                                                     |


**Outras divergências suspeitas (confiança)**


| Suspeita                                                                                                                                                | Confiança | Notas                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------- |
| Tooltip RS total **≠** soma ponderada exibida se S31 não usa exatamente 25/30/25/20                                                                     | **Alta**  | `RiskScoreCalcTooltipContent.tsx` **~231–238** |
| Ambiente **denorm** `score_territorial` altera só **uma** dimensão no RD (**~1169–1171**), quebrando coerência com JSON completo                        | **Média** | `reportDataBuilder.ts`                         |
| `gerarRiskDecomposicaoParaProcesso` **ambiental** com score de **mock geométrico** pode diferir do valor numérico «oficial» da dimensão em casos limite | **Média** | `riskScoreDecomposicao.ts` **~888–903**        |


---

## 6. Tarefa 5 — Textos/jargões técnicos ou «dev-facing» hardcoded

*(Linhas quando o disco está em UTF-8 via PowerShell/`rg`; caracteres estranhos no IDE podem ser UTF-16.)*

### 6.1 «motor S31», multiplicadores, penalidades


| Texto                                             | Ficheiro:linha (aprox.)                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| `Total da dimensão (motor S31)`                   | `src/components/map/s31/SubfatorPanel.tsx` **:~88** `rg`)                 |
| `Multiplicador (motor S31):`                      | `src/components/map/riskDimensaoSubfatorLazy.tsx` **:~352**               |
| `Penalidades aplicadas (motor S31)`               | `src/components/map/OportunidadeDecomposicaoRelatorioPanel.tsx` **:~460** |
| «Condicionado ao consolidado do motor S31.»       | `src/lib/relatorioDataFromReportData.ts` **:~712**                        |
| «Dimensão calculada automaticamente (motor S31).» | `src/lib/relatorioDataFromReportData.ts` **:~723**                        |


### 6.2 Fontes estilo «cadastro + Master» / TERRADAR


| Texto                                           | Ficheiro:linha (aprox.)                                                             |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| `Fonte: cadastro + Master Substancias.`         | `src/components/map/riskDimensaoSubfatorLazy.tsx` **:~81**                          |
| `TERRADAR, com dados ANM, FUNAI, ICMBio e IBGE` | `src/components/map/RelatorioCompleto.tsx` **:~5688**                               |
| `TERRADAR, com dados ANM, IBGE, Tesouro e USGS` | `RelatorioCompleto.tsx` **:~6085**                                                  |
| Vários «TERRADAR», «Fonte: …», SIGMINE, etc.    | `RelatorioCompleto.tsx` (grep), ex. **~2912–2913**, **~3341**, **~4189**, **~5499** |


### 6.3 Identificadores A1…A5 (atratividade S31)


| Texto                                                              | Ficheiro:linha (aprox.)                                                                   |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `A1 Relevância (substância)` … `A5 Valor de reserva (ilustrativo)` | `src/lib/s31SubfatorDecomp.ts` **:~83–110** (`rg`)                                        |
| `master / ${processo.substancia}` (string técnica)                 | `s31SubfatorDecomp.ts` (função `buildGeologicoItemsS31`, ~linha **137** em leitura UTF-8) |


### 6.4 CPT / pressão social / tier


| Texto                          | Ficheiro:linha (aprox.)            |
| ------------------------------ | ---------------------------------- |
| `Pressão social · CPT`         | `RelatorioCompleto.tsx` **:~3349** |
| `SUPER CRÍTICA`                | `RelatorioCompleto.tsx` **:~3364** |
| `Mult. risco social`           | `RelatorioCompleto.tsx` **:~3421** |
| `Fonte: Atlas CPT (Cedoc/CPT)` | `RelatorioCompleto.tsx` **:~3455** |


### 6.5 Fórmulas e pesos visíveis (comentários/UI)


| Texto                                                            | Ficheiro:linha (aprox.)                                |
| ---------------------------------------------------------------- | ------------------------------------------------------ |
| `Risk Score = Geo × 0.25 + Amb × 0.30 + Soc × 0.25 + Reg × 0.20` | `RiskScoreCalcTooltipContent.tsx` **:~238**            |
| Social = IDH × 0.35 + …                                          | `RiskScoreCalcTooltipContent.tsx` **:~190–191**        |
| Regulatório = Tempo × 0.30 + …                                   | `RiskScoreCalcTooltipContent.tsx` **:~211–212**        |
| `OS Conservador = Atrat × 0.20 + …` (e moderado/arrojado)        | `OportunidadeScoreCalcTooltipContent.tsx` **:~95–112** |


### 6.6 Nomes tipo variável (`opportunityScore.ts` — usado em prospecção; referência para jargão)


| Padrão                      | Ficheiro:linha (aprox.)                     |
| --------------------------- | ------------------------------------------- |
| `A1 * 0.25 + A2 * 0.25 + …` | `src/lib/opportunityScore.ts` **:~445–488** |


---

## 7. Perguntas em aberto

1. `**scores_auto`/`computeScoresAuto`** em `server/db` (implementação exata) vs **SQL S31 v3** — não revista linha a linha nesta auditoria; hipótese principal de divergência permanece **prioridade no frontend** + **dois motores no backend**.
2. Confirmação **runtime** num processo de teste (DevTools): comparar `api.scores`, `api.scores_auto` e `ReportData` após `buildReportData` — não executado (pedido: sem testes).
3. Ficheiros `SubfatorPanel.tsx` / `s31SubfatorDecomp.ts` mostrando **1 linha** no `read_file` da IDE sugerem **UTF-16 no buffer**; conteúdo no disco pode estar correto (**validar encoding** no próximo refactor).
4. Tabela «**todos** os números**» do drawer: garantia absoluta exigiria inventário linha a linha das **7000+** linhas de `RelatorioCompleto.tsx` — aqui agrupado por domínio (Risco/OS/Território/Fiscal/Intel) com pontos críticos no caminho de dados.

---

*Fim do relatório.*