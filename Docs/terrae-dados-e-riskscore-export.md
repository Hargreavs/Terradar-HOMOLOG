# Terrae — Exportação: dados por processo + lógica de Risk Score

Documento gerado para análise de produto. Fontes: `src/data/processos.mock.ts`, `src/data/dashboard.mock.ts`, `src/types/index.ts`, `src/components/map/RelatorioCompleto.tsx`, `src/components/map/ProcessoPopup.tsx`, `src/components/map/MapView.tsx`, `src/components/dashboard/InteligenciaDashboard.tsx`.

---

## Exportação 1 — Dados disponíveis por processo

### 1.1 Interfaces TypeScript (estrutura de `Processo` e tipos relacionados)

Definidas em `src/types/index.ts`:

**`Processo`**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `string` | Identificador interno do processo no mock (ex.: `p1`). |
| `numero` | `string` | Número do processo ANM (formato tipo `872.390/2012`). |
| `regime` | `Regime` | Regime minerário (ver união abaixo). |
| `fase` | `Fase` | Fase do processo (ver união abaixo). |
| `substancia` | `string` | Substância principal (chave interna, ex.: `FERRO`, `OURO`). |
| `is_mineral_estrategico` | `boolean` | Se o processo/substância entra como mineral estratégico no mock. |
| `titular` | `string` | Nome do titular. |
| `area_ha` | `number` | Área do processo em hectares. |
| `uf` | `string` | Sigla da UF. |
| `municipio` | `string` | Nome do município. |
| `lat` | `number` | Latitude (centro aproximado para polígono). |
| `lng` | `number` | Longitude. |
| `data_protocolo` | `string` | Data de protocolo `YYYY-MM-DD`. |
| `ano_protocolo` | `number` | Ano de protocolo (número). |
| `situacao` | `'ativo' \| 'inativo' \| 'bloqueado'` | Situação cadastral simplificada. |
| `risk_score` | `number \| null` | Score agregado 0–100 ou `null` se indisponível. |
| `risk_breakdown` | `RiskBreakdown \| null` | Sub-scores por dimensão ou `null`. |
| `valor_estimado_usd_mi` | `number` | Valor estimado das reservas (milhões USD). |
| `ultimo_despacho_data` | `string` | Data do último despacho ANM `YYYY-MM-DD`. |
| `alertas` | `AlertaLegislativo[]` | Lista de alertas legislativos associados. |
| `fiscal` | `DadosFiscais` | Bloco fiscal do município/ente (mock). |
| `geojson` | `GeoJSONPolygon` | Polígono Mapbox (Feature com `Polygon`). |

**`Regime`** (`string` union):  
`concessao_lavra` \| `autorizacao_pesquisa` \| `req_lavra` \| `licenciamento` \| `mineral_estrategico` \| `bloqueio_permanente` \| `bloqueio_provisorio`

**`Fase`**: `requerimento` \| `pesquisa` \| `concessao` \| `lavra` \| `encerrado`

**`RiskBreakdown`**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `geologico` | `number` | Sub-score dimensão geológica (0–100 no mock). |
| `ambiental` | `number` | Sub-score ambiental. |
| `social` | `number` | Sub-score social. |
| `regulatorio` | `number` | Sub-score regulatório. |

**`AlertaLegislativo`**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `string` | ID do alerta no catálogo. |
| `fonte` | `'DOU' \| 'Câmara' \| 'Senado' \| 'DOE' \| 'IBAMA' \| 'ANM'` | Canal institucional. |
| `fonte_diario` | `string` | Texto de publicação (sigla ou nome curto no mock). |
| `data` | `string` | Data `YYYY-MM-DD`. |
| `titulo` | `string` | Título curto. |
| `resumo` | `string` | Resumo / descrição. |
| `nivel_impacto` | `NivelImpacto` (`1 \| 2 \| 3 \| 4`) | Nível de impacto legislativo. |
| `tipo_impacto` | `'restritivo' \| 'favoravel' \| 'neutro' \| 'incerto'` | Classificação de stance. |
| `urgencia` | `'imediata' \| 'medio_prazo' \| 'longo_prazo'` | Urgência. |

**`DadosFiscais`**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `capag` | `'A' \| 'B' \| 'C' \| 'D'` | Nota CAPAG simulada. |
| `receita_propria_mi` | `number` | Receita própria (milhões R$). |
| `divida_consolidada_mi` | `number` | Dívida consolidada (milhões R$). |
| `incentivos_estaduais` | `string[]` | Lista de incentivos (texto). |
| `linhas_bndes` | `string[]` | Linhas de crédito relevantes (texto). |
| `observacao` | `string` | Observação analítica. |

**`GeoJSONPolygon`**

| Caminho | Tipo | Descrição |
|---------|------|-----------|
| `type` | `'Feature'` | Constante GeoJSON. |
| `properties.id` | `string` | Ecoa identificação (alinhado ao processo). |
| `geometry.type` | `'Polygon'` | Polígono simples. |
| `geometry.coordinates` | `number[][][]` | Anel fechado `[lng, lat][]` (fechamento duplicando primeiro vértice). |

### 1.2 Tipos auxiliares em `processos.mock.ts` (não exportados)

- **`RawProcesso`**: `Omit<Processo, 'geojson'>` — processo antes de anexar polígono.
- **`ProcessoSeed`**: `Omit<RawProcesso, 'risk_breakdown' \| 'alertas' \| 'fiscal' \| 'valor_estimado_usd_mi' \| 'ultimo_despacho_data'>` — linha em `processosSeed`; inclui `risk_score` opcional na prática todas as entradas definem número explícito.

### 1.3 Campos do objeto `Processo` final (mock) — referência com exemplo real

Exemplo: processo **`p1`** (`872.390/2012`, Itabira/MG), após `rawProcessos` + `geojson`:

| Campo | Tipo | Exemplo (mock) | O que representa |
|-------|------|----------------|------------------|
| `id` | string | `p1` | Chave estável no mock. |
| `numero` | string | `872.390/2012` | Número ANM. |
| `regime` | Regime | `concessao_lavra` | Concessão de lavra. |
| `fase` | Fase | `lavra` | Em lavra. |
| `substancia` | string | `FERRO` | Substância principal. |
| `is_mineral_estrategico` | boolean | `false` | Não estratégico neste seed. |
| `titular` | string | `Vale Mineração S.A.` | Titular. |
| `area_ha` | number | `1240.5` | Área (ha). |
| `uf` | string | `MG` | UF. |
| `municipio` | string | `Itabira` | Município. |
| `lat` | number | `-19.62` | Centro para geração do polígono. |
| `lng` | number | `-43.22` | Centro para geração do polígono. |
| `data_protocolo` | string | `2012-03-14` | Protocolo. |
| `ano_protocolo` | number | `2012` | Ano. |
| `situacao` | string | `ativo` | Ativo. |
| `risk_score` | number | `42` | Score agregado (definido no seed; ver secção 2). |
| `risk_breakdown.geologico` | number | `35` | Vem de `RISK_BY_ID['p1']`. |
| `risk_breakdown.ambiental` | number | `45` | Idem. |
| `risk_breakdown.social` | number | `40` | Idem. |
| `risk_breakdown.regulatorio` | number | `48` | Idem. |
| `valor_estimado_usd_mi` | number | (derivado) | `valorEstimadoUsdMiPara(p)` por regime + hash. |
| `ultimo_despacho_data` | string | (derivado) | `ultimoDespachoDataPara(p)`. |
| `alertas` | array | (derivado) | `pickAlertas(p)` — lista de refs do `CATALOGO_ALERTAS`. |
| `fiscal.capag` | string | (derivado) | `fiscalPara(p)` conforme município. |
| `fiscal.receita_propria_mi` | number | (derivado) | Idem. |
| `fiscal.divida_consolidada_mi` | number | (derivado) | Idem. |
| `fiscal.incentivos_estaduais` | array | (derivado) | Idem. |
| `fiscal.linhas_bndes` | array | (derivado) | Idem. |
| `fiscal.observacao` | string | (derivado) | Idem. |
| `geojson.type` | string | `Feature` | Feature GeoJSON. |
| `geojson.properties.id` | string | `p1` | ID. |
| `geojson.geometry.type` | string | `Polygon` | Polígono. |
| `geojson.geometry.coordinates` | array | `number[][][]` | Coordenadas geradas por `makePolygon(lat,lng,id)`. |

Cada alerta em `alertas[]` segue a tabela **`AlertaLegislativo`**; exemplos de instâncias estão em `CATALOGO_ALERTAS` no mesmo ficheiro (ex.: `anm89`, `lei15190`, `pec48`, …).

### 1.4 `dashboard.mock.ts` — estrutura do objeto `dashboardMock`

**Interface exportada `DashboardAlertaRecente`**

| Campo | Tipo | Exemplo | Descrição |
|-------|------|---------|-----------|
| `id` | string | `alerta-1` | ID do card de alerta no dashboard. |
| `titulo` | string | (texto longo PL) | Título exibido. |
| `tipo` | string | `Projeto de Lei` | Categoria da publicação. |
| `tipo_impacto` | union | `restritivo` | Stance (igual ao eixo dos alertas do mapa/relatório). |
| `nivel_impacto` | 1 \| 2 \| 3 \| 4 | `1` | Nível de impacto. |
| `fonte_publicacao` | string | `Câmara dos Deputados` | Nome completo da fonte na UI. |
| `data` | string | `2026-03-23` | Data ISO. |
| `ementa` | string | (texto) | Texto para tooltip. |
| `substancias_afetadas` | string[] | `['Terras Raras', 'Nióbio', 'Lítio']` | Lista de substâncias citadas. |

**`dashboardMock.alertas_recentes`**: `DashboardAlertaRecente[]` — 4 itens no mock atual.

**`dashboardMock.stats`** (objeto)

| Campo | Tipo | Exemplo | Descrição |
|-------|------|---------|-----------|
| `total_processos` | number | `30` | Total de processos (narrativa do dashboard). |
| `total_area_ha` | number | `14820` | Área agregada (ha). |
| `processos_ativos` | number | `24` | Ativos. |
| `processos_bloqueados` | number | `6` | Bloqueados. |
| `area_mineral_estrategico_ha` | number | `3240` | Área mineral estratégico. |
| `ufs_cobertas` | number | `6` | UFs cobertas. |
| `titulares_unicos` | number | `6` | Titulares distintos. |
| `risk_score_medio` | number | `52` | Média declarada no mock (não recalculada automaticamente a partir dos 30 processos neste objeto). |
| `processos_alto_risco` | number | `8` | Contagem alto risco. |
| `processos_baixo_risco` | number | `11` | Contagem baixo risco. |

**`dashboardMock.por_regime`**: array de `{ regime: string, count: number, area_ha: number, cor: string }`.

**`dashboardMock.por_uf`**: array de `{ uf: string, count: number, area_ha: number, risk_medio: number }`.

**`dashboardMock.producao_historica`**: array de `{ ano: number, ferro: number, cobre: number, ouro: number, niobio: number, terras_raras: number }` (comentário no ficheiro explica índices para o gráfico).

**`dashboardMock.ranking_titulares`**: array de `{ titular: string, processos: number, area_ha: number, substancias: string[], risk_medio: number }`.

**`dashboardMock.minerais_estrategicos`**: array de objetos com `substancia`, `sigla`, `processos`, `area_ha`, `reservas_pct`, `producao_pct`, `preco_usd_t`, `tendencia` (`'alta' \| 'estavel'`), `demandaNivel` (`'alta' \| 'moderada'`).

**`dashboardMock.calor_investimento`**: array de `{ uf: string, lat: number, lng: number, intensidade: number, valor_mi: number }`.

### 1.5 Dados derivados em runtime (fora dos mocks estáticos)

Estes valores **não** estão como campos fixos em `processos.mock.ts` / `dashboard.mock.ts`, mas são calculados na UI a partir de `PROCESSOS_MOCK` (ou listas filtradas):

| Derivado | Onde | Como |
|----------|------|------|
| Média de `risk_score` por UF | `InteligenciaDashboard.tsx` (`porUfCalculado`, `useMemo`) | Filtra processos por UF; média arredondada dos `risk_score !== null`. |
| Ranking de titulares com `risk_medio` | `InteligenciaDashboard.tsx` (`rankingOrdenado`) | Agrega por `titular`: soma `area_ha`, contagens, conjunto de substâncias, média dos `risk_score` não nulos. |
| Polígonos no mapa / cores por regime ou risco | `MapView.tsx` | `buildGeoJSON` + `corPorRisco` / cores de regime. |
| Processos filtrados | `useMapStore.ts` (`applyFilters`, `getProcessosFiltrados`) | Interseção de filtros (regime, substância, período, UF, município, faixa de risk score, busca, drill titular). |
| Dados do **Relatório completo** por processo | `relatorio.mock.ts` + `RelatorioCompleto.tsx` | Estrutura `RelatorioData` separada (não é o mesmo objeto que `Processo`); inclui CFEM, territorial, intel mineral, fiscal detalhado, vizinhos, etc. |

**CFEM / séries fiscais no relatório**: calculadas ou lidas a partir de `relatorio.mock.ts` e componentes filhos (ex. barras com tooltip), não de `processos.mock.ts`.

---

## Exportação 2 — Lógica do Risk Score

### 2.1 Resumo executivo

- **`risk_breakdown`** (4 dimensões): no mock atual são **valores fixos** por `id` de processo na tabela `RISK_BY_ID` em `processos.mock.ts`. **Não** existem variáveis de entrada (sobreposição TI, CPT, etc.) calculadas em pipeline; os números foram escolhidos manualmente para coerência narrativa comentada no ficheiro.
- **`risk_score` agregado**: cada seed em `processosSeed` define **`risk_score` explícito**. Na montagem, `risk_score: p.risk_score ?? pontuacaoRiscoMedia(risk_breakdown)` — como todos os seeds têm número, **a média ponderada não substitui** o valor no mock atual; a função `pontuacaoRiscoMedia` é o algoritmo oficial quando `risk_score` vier `undefined` no seed.
- **UI** (cores e rótulos “Baixo / Médio / Alto”): aplicam **thresholds** em componentes; há **ligeira inconsistência** entre ficheiros no limite **69 vs 70** (ver 2.5).

### 2.2 Fórmula do score total (agregado)

**Ficheiro:** `src/data/processos.mock.ts`

```ts
function pontuacaoRiscoMedia(b: RiskBreakdown): number {
  return Math.round(
    b.geologico * 0.25 + b.ambiental * 0.3 + b.social * 0.25 + b.regulatorio * 0.2,
  )
}
```

- **Pesos:** Geológico **25%**, Ambiental **30%**, Social **25%**, Regulatório **20%**.
- **Normalização / clamp nesta função:** apenas `Math.round` do produto interno; **não** há `clamp` explícito a 0–100 aqui (assume sub-scores já na faixa razoável).

Montagem:

```ts
const risk_breakdown = riskBreakdownPara(p)
return {
  ...p,
  risk_breakdown,
  risk_score: p.risk_score ?? pontuacaoRiscoMedia(risk_breakdown),
  ...
}
```

`riskBreakdownPara(p)` devolve `RISK_BY_ID[p.id]` ou, se faltar chave, `{ geologico: 50, ambiental: 50, social: 50, regulatorio: 50 }`.

### 2.3 As quatro dimensões — o que “alimenta” cada uma no código atual

| Dimensão | No mock | Em produção (o que o produto **poderia** usar) |
|----------|---------|-----------------------------------------------|
| **Geológico** | Constante em `RISK_BY_ID[id].geologico` | Dados de pesquisa mineral, relatórios, maturidade geológica (o texto de UX em `RelatorioCompleto` menciona relatórios de pesquisa). |
| **Ambiental** | Constante em `RISK_BY_ID` | Sobreposição UC/TI/APP, licenciamento, exigências de EIA (alinhado às descrições em `textoDimensaoRisco`). |
| **Social** | Constante em `RISK_BY_ID` | Conflitos fundiários, CPT, contexto de segurança (alinhado ao copy de UX). |
| **Regulatório** | Constante em `RISK_BY_ID` | Pendências ANM, alertas legislativos, regime (alinhado ao copy de UX). |

**Pesos por dimensão no agregado:** 25% / 30% / 25% / 20% (conforme função acima e texto explicativo em `RelatorioCompleto`: `textoFormulaMediaPonderadaRisk` / `textoFormulaMediaPonderadaRiskTooltip`).

**Thresholds interpretativos por dimensão (apenas copy / UX, não alteram o número):** em `RelatorioCompleto.tsx`, função `textoDimensaoRisco` e em `ProcessoPopup.tsx`, `mensagemTooltipDimensao` — usam a mesma lógica:

- `< 40` → texto “favorável / baixo risco na dimensão”
- `40–69` inclusivo (popup usa `<= 69` para médio em vários ramos) → moderado
- `≥ 70` (ou `> 69`) → elevado

### 2.4 Código completo relevante no mock (sub-scores + montagem)

Trecho essencial já citado; tabela `RISK_BY_ID` mapeia `p1`…`p30` para quatro números inteiros cada (ver ficheiro completo para todos os valores).

Processos **bloqueados** (`processoBloqueadoParaRisco`): `situacao === 'bloqueado'` ou regime `bloqueio_permanente` / `bloqueio_provisorio` — usado em `pickAlertas` (menos alertas), **não** zera `risk_breakdown` no código atual.

### 2.5 Faixas do Risk Score total na UI (cores e rótulos)

**`RelatorioCompleto.tsx`**

```ts
function corFaixaRisco(v: number): string {
  if (v < 40) return '#1D9E75'
  if (v <= 69) return '#E8A830'
  return '#E24B4A'
}

function classificacaoRiscoTotal(r: number): string {
  if (r < 40) return 'Baixo risco'
  if (r <= 69) return 'Risco médio'
  return 'Alto risco'
}
```

- **Baixo:** `v < 40`  
- **Médio:** `40 <= v <= 69`  
- **Alto:** `v >= 70`

**`ProcessoPopup.tsx`**

```ts
/** Faixas: menor que 40 verde, 40 a 69 âmbar, 70 ou mais vermelho (barras e números). */
function riskTierColor(v: number): string {
  if (v < 40) return '#1D9E75'
  if (v < 70) return '#E8A830'
  return '#E24B4A'
}
```

- **Âmbar** para `40 <= v <= 69` (porque `v < 70`).

**`MapView.tsx`** (`corPorRisco`)

```ts
if (v >= 0 && v <= 39) return '#1D9E75'
if (v >= 40 && v <= 69) return '#E8A830'
if (v >= 70 && v <= 100) return '#E24B4A'
```

**Nota:** O valor **69** é **médio** (âmbar) em todos; **70** é alto. A documentação no comentário do popup diz “40 a 69 âmbar”, coerente com `v < 70`.

### 2.6 Hardcoding vs cálculo

| Elemento | Estado no projeto |
|----------|-------------------|
| Valores das 4 dimensões | **Hardcoded** (`RISK_BY_ID`). |
| `risk_score` nos 30 processos | **Hardcoded** no `processosSeed` (número explícito por linha). |
| Fórmula agregada | **Implementada** (`pontuacaoRiscoMedia`); **não substitui** os scores do seed enquanto `risk_score` estiver definido. |
| Campos que **seriam** usados em produção para recalcular dimensões | Conceitualmente: indicadores geológicos, ambientais (sobreposição, licenças), sociais (conflitos), regulatórios (ANM + legislação); hoje refletidos só em **texto de tooltip** / relatório, não em funções de inferência. |

---

*Fim do documento.*
