# Processo **864.231/2017** — localStorage e dados para validação

Este documento serve para **validar** o que o TERRADAR persiste no browser e quais são os **dados de origem** (mock) associados ao processo **864.231/2017** (`id`: `p_864231`), organizados como no drawer **Relatório completo** (subabas e títulos de card).

---

## 1. O que está (e o que **não** está) no `localStorage`

| Chave | Conteúdo persistido |
|--------|----------------------|
| `terrae-filtros` | Estado parcial do Zustand: **`filtros.camadas`**, **`filtros.periodo`**, **`filtros.riskScoreMin`**, **`filtros.riskScoreMax`**, mais **`camadasGeo`** (visibilidade das camadas GeoJSON do mapa). |
| *(removido ao iniciar)* | `terrae-processos` é **apagado** em `loadProcessos()` — não guarda lista de processos. |

**Não persistido** (memória de sessão / estado React): `substancias`, `uf`, `municipio`, `searchQuery`, `processoSelecionado`, `relatorioDrawerAberto`, `flyTo`, drill Intel, etc.

### 1.1 Implicação para o processo 864.231/2017

- **Não existe** blob JSON no `localStorage` com “dados do processo 864.231”.
- Os dados cadastrais, relatório, risco e fiscal vêm de **`PROCESSOS_MOCK`** e **`relatoriosMock['p_864231']`** em código (`src/data/processos.mock.ts`, `src/data/relatorio.mock.ts`).
- O `localStorage` só influencia **se o processo aparece no mapa** (filtros de camada, período, faixa de risk score, etc.).

### 1.2 Valores **default** de filtros persistíveis (após merge)

Comportamento típico quando o utilizador **nunca** alterou filtros (ou após reset):

| Campo | Valor default |
|--------|----------------|
| `camadas.*` (todos os regimes) | `true` (inclui `autorizacao_pesquisa`) |
| `periodo` | `[1960, 2026]` — **2017** entra no intervalo |
| `riskScoreMin` / `riskScoreMax` | `0` / `100` — **risk 23** entra |

Para o **864.231** aparecer: manter **Autorização de pesquisa** ligada, período que cubra **2017**, e faixa de risco que inclua **23** (defaults ok).

---

## 2. Estado em memória: objeto `Processo` (`p_864231`)

Dados usados no mapa, popup, filtros e base do relatório (campos principais).

| Campo | Valor |
|--------|--------|
| `id` | `p_864231` |
| `numero` | `864.231/2017` |
| `regime` | `autorizacao_pesquisa` |
| `fase` | `pesquisa` |
| `substancia` | `MINÉRIO DE OURO` |
| `is_mineral_estrategico` | `false` |
| `titular` | `M P LANCA MINERADORA` |
| `cnpj_titular` | `21.515.445/0001-84` |
| `area_ha` | `1600` |
| `uf` | `TO` |
| `municipio` | `Jaú do Tocantins` |
| `lat` / `lng` (centróide / fly) | `-12.845` / `-48.816` |
| `data_protocolo` | `2017` |
| `ano_protocolo` | `2017` |
| `situacao` | `ativo` |
| `risk_score` | `23` |
| `risk_breakdown` | geológico **52**, ambiental **10**, social **22**, regulatório **6** |
| `valor_estimado_usd_mi` | `938047` |
| `ultimo_despacho_data` | `2026-03-13` |
| `fiscal` (resumo painel processo) | CAPAG **C**, receita **2,44** Mi R$, dívida **0**, incentivos/lines conforme mock |
| `geojson` | Polígono SIGMINE (anel fechado; propriedades com `id`) |

**Alertas legislativos** (`alertas[]`): gerados por `pickAlertas` — pool inclui portaria ANM 89, Lei 15.190, PL 2197, BNDES/FINEp; quantidade **1 a 4** e ordem dependem do hash do `id` (ver `processos.mock.ts`).

**Oportunidade (Radar / override):** conservador **75** (faixa alta), moderado **72**, arrojado **70**; dimensões forçadas: atratividade **65**, viabilidade **68**, segurança **85** (`opportunityScore.ts`).

---

## 3. Relatório completo — `relatoriosMock['p_864231']`

Chave: `processo_id` = `p_864231`. Estrutura alinhada às subabas do drawer.

### 3.1 Subaba **Processo**

#### Card — **Dados cadastrais** (número + situação + grelha)

| Origem | Conteúdo |
|--------|-----------|
| `processo.numero` | `864.231/2017` |
| Situação (pill) | Ativo |
| Titular, substância, regime, área, UF, município, fase | Conforme secção 2 |
| `dados_anm.data_protocolo` | `2017` |
| `dados_anm.prazo_vencimento` | `~Nov/2028` |
| `dados_anm.tempo_tramitacao_anos` | `9` |
| `dados_anm.fase_atual` | `AUTORIZAÇÃO DE PESQUISA` |

*Rodapé “Atualizado em…”:* `timestamps.cadastro_mineiro` → `2026-04-11` (fonte cadastro mineiro).

#### Card — **Último despacho ANM**

| Campo | Valor |
|--------|--------|
| `data_ultimo_despacho` | `2026-03-13` |
| `ultimo_despacho` | `541 - AUT PESQ/RAL ANO BASE APRESENTADO EM 13/03/2026` |
| `numero_sei` | `48417.864231/2017-35` |

#### Card — **Pendências**

| Valor |
|--------|
| `pendencias` | `[]` (vazio) |

#### Card — **Observações técnicas**

Texto completo (alvará, GU, cessão, CREA, lavra, planta, produção estimada) em `dados_anm.observacoes_tecnicas` — ver fonte em `relatorio864231V2()` em `relatorio.mock.ts`.

---

### 3.2 Subaba **Território**

#### Card — **Áreas sensíveis**

| Campo | Valor |
|--------|--------|
| TI | `TI Avá-Canoeiro (Regularizada)` — **112,5** km |
| UC | `APA Lago de Peixe/Angical` — tipo `Uso Sustentável (Estadual/TO)` — **57,1** km |
| APP | Não |
| Quilombola | Não; texto nome: `Kalunga do Mimoso (128,1 km)` |

#### Card — **Logística**

| Campo | Valor |
|--------|--------|
| Ferrovia | `Ferrovia Norte-Sul EF-151 (VALEC)` — **11,0** km |
| Porto | `Tucuruí/PA` — **1015,9** km |
| Sede municipal | **32,6** km (com município do processo na UI) |

#### Card — **Bioma**

| Campo | Valor |
|--------|--------|
| `bioma` | `Cerrado` (+ texto derivado `biomaImplicacoes` na UI) |

#### Card — **Aquífero**

| Campo | Valor |
|--------|--------|
| `nome_aquifero` | `Depósito Aluvionar (Qa), Unidade Granular (Gr)` |
| `distancia_aquifero_km` | `0` |

*Fontes nos cards:* `timestamps.terras_indigenas`, `sigmine`, `unidades_conservacao`, etc. (ver secção 3.6).

---

### 3.3 Subaba **Inteligência**

#### Card — **Contexto global**

| Campo | Valor |
|--------|--------|
| `substancia_contexto` | Texto minério de ouro / SIGMINE 864.231 |
| `reservas_brasil_mundial_pct` | `3.8` |
| `producao_brasil_mundial_pct` | `2.4` |
| Gap (calculado na UI) | Derivado dos dois % acima |

#### Card — **Preço e tendência**

| Campo | Valor |
|--------|--------|
| `preco_referencia_usd_oz` | `4862.76` |
| `preco_medio_usd_t` | `156341123` (equiv. USD/t no modo onça) |
| `unidade_preco` | `oz` |
| `tendencia_preco` | `estavel` |
| `demanda_projetada_2030` | Texto longo (World Gold Council / perspectiva 2026+) |

#### Card — **Aplicações**

`aplicacoes_principais`: Reserva de valor, Eletrônicos, Joalheria, Medicina.

#### Card — **Estratégia nacional**

`estrategia_nacional` — texto LBMA / garimpo / cooperativas / Decreto 10.966/2022.

#### Container — **Valor estimado da reserva**

| Campo | Valor |
|--------|--------|
| `valor_estimado_usd_mi` | `938047` |
| `metodologia_estimativa` | Fórmula 1 ha × 750.000 t × teor × preço (texto completo no mock) |

#### Card — **Processos vizinhos** (tabela)

- **20** linhas em `processos_vizinhos` (lista em `PROCESSOS_VIZINHOS_864231`).
- Colunas: Nº, Titular, Fase, Substância, Área (ha), DIST. (km), RISK.
- `distancia_km` e `risk_score`: **`null`** → UI **N/D** / **N/A**.

`paises_concorrentes`: `null`; `potencial_reserva_estimado_t`: `null`.

---

### 3.4 Subaba **Risco**

#### Card — **Risk Score**

| Campo | Valor |
|--------|--------|
| Total | `23` (classe “Baixo risco”) |
| Barras | Geológico 52, Ambiental 10, Social 22, Regulatório 6 |

#### Card — **Decomposição por dimensão** (`RiskDecomposicaoRelatorioPanel`)

Textos auditados para **864.231** (ex.: ambiental Qa/Gr; social Jaú / TI Avá-Canoeiro / CAPAG) — ver `riskScoreDecomposicao.ts`.

#### Card — **Alertas regulatórios**

Lista conforme `processo.alertas` (ver secção 2).

---

### 3.5 Subaba **Fiscal**

#### Card — **CAPAG (município)**

| Campo | Valor |
|--------|--------|
| `capag` | `C` |
| `capag_descricao` | Texto com endividamento 0,145; poupança corrente 0,960; liquidez 0,002 |
| Local | `Jaú do Tocantins / TO` |

#### Card — **Indicadores financeiros** (receita / dívida / PIB + dependência)

| Campo | Valor |
|--------|--------|
| `receita_propria_mi` | `2.44` |
| `divida_consolidada_mi` | `0` |
| `pib_municipal_mi` | `110.8` |
| `dependencia_transferencias_pct` | `92.2` |

#### Card — **CFEM: processo vs. município**

| Campo | Valor |
|--------|--------|
| `cfem_historico` (processo) | `[]` |
| `cfem_municipal_historico` | 2021–2025 com valores BRL e `substancias` por ano (ver mock) |
| `cfem_total_5anos_mi` | `0.065` |
| `aliquota_cfem_pct` | `1.5` |
| `estimativa_cfem_anual_operacao_mi` | `1.36` |

#### Card — **Incentivos estaduais**

`['Prospera Tocantins (score 2/3)']`

#### Card — **Linhas BNDES**

Cinco linhas: Finem Mineração, Finame, Crédito PME, Finem Meio Ambiente, Chamada Minerais Estratégicos.

#### Card — **Estimativa CFEM em operação**

Alíquota **1,5%**; estimativa anual conforme `estimativa_cfem_anual_operacao_mi`.

`observacao` (bloco fiscal): texto TCE-TO/SICAP, RREO, RCL, superávit, etc. — ver `relatorio864231V2().fiscal.observacao`.

---

### 3.6 **`timestamps`** (rodapés “Atualizado em…”)

| Chave | Valor |
|--------|--------|
| `cadastro_mineiro` | `2026-04-11` |
| `sigmine` | `2026-04-11` |
| `terras_indigenas` | `2023-09-05` |
| `unidades_conservacao` | `2025-08-01` |
| `usgs` | `2026-01-15` |
| `preco_spot` | `2026-03-31` |
| `alertas_legislativos` | `2026-04-11` |
| `siconfi` | `2025-11-30` |
| `cfem` | `2026-04-11` |
| `cfem_municipal` | `2025-12-31` |

---

### 3.7 **`metadata`** (não há card dedicado no drawer; dados de auditoria no objeto)

Inclui: `fonte_sigmine`, `fonte_precos`, `fonte_reservas`, `fonte_territorial`, `fonte_fiscal`, `fonte_car`, `fonte_demanda`, `cambio` / `cambio_data` / `cambio_nota`, `calculado_em`, `versao_config`, `nota_alertas`, `nota_postgis` — valores literais em `relatorio864231V2().metadata`.

---

## 4. Referência de código

| O quê | Onde |
|--------|------|
| Persistência `localStorage` | `src/store/useMapStore.ts` (`name: 'terrae-filtros'`, `partialize`) |
| Processo | `src/data/processos.mock.ts` — seed `p_864231`, `RISK_BY_ID`, `geojsonSigmine864231` |
| Relatório | `src/data/relatorio.mock.ts` — `relatorio864231V2()`, `PROCESSOS_VIZINHOS_864231` |
| Drawer (estrutura UI) | `src/components/map/RelatorioCompleto.tsx` |

---

*Documento gerado para validação de consistência entre persistência, mock e UI. Os dados do processo **não** são serializados por processo no `localStorage`; a tabela da secção 1 resume o que é guardado de forma global.*
