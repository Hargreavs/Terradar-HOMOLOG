# Processo 864.231/2017 — inventário de dados (por subaba e card)

**Identificação**

| Campo | Valor |
|--------|--------|
| Número | 864.231/2017 |
| `processo_id` / chave no mapa | `p_864231` |

**Origem dos dados (código)**  
- Relatório completo (drawer): `relatoriosMock['p_864231']` = função `relatorio864231V2()` em `src/data/relatorio.mock.ts`.  
- Processo no mapa: entrada em `processosSeed` + campos derivados em `processosMock` em `src/data/processos.mock.ts`.  
- O **localStorage** (se usado) tende a espelhar o mesmo par `{ processo, dados }` em sessão; este ficheiro é o snapshot canónico dos mocks.

---

## A. Objeto **Processo** (mapa / lista — `processosMock`, `id === 'p_864231'`)

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
| `lat` | `-12.845` |
| `lng` | `-48.816` |
| `data_protocolo` | `2017` |
| `ano_protocolo` | `2017` |
| `mes_protocolo` | `null` |
| `situacao` | `ativo` |
| `risk_score` | `23` (média ponderada do `risk_breakdown`) |
| `risk_breakdown.geologico` | `52` |
| `risk_breakdown.ambiental` | `10` |
| `risk_breakdown.social` | `22` |
| `risk_breakdown.regulatorio` | `6` |
| `valor_estimado_usd_mi` | `938_047` |
| `ultimo_despacho_data` | `2026-03-13` |
| `risk_decomposicao` | Gerado em runtime por `gerarRiskDecomposicaoParaProcesso` (não está dentro de `relatorio864231V2()`). |
| `alertas` | Lista produzida por `pickAlertas` (varia conforme regras do seed; não duplicada aqui). |
| `fiscal` (objeto resumido no **Processo**) | Em `fiscalPara('p_864231')` existe um bloco legado **diferente** do fiscal rico do relatório; **na subaba Fiscal do drawer usa-se `dados.fiscal` do relatório** (secção B). |

---

## B. **`timestamps`** (`relatorio864231V2`)

| Campo | Valor (ISO) |
|--------|-------------|
| `cadastro_mineiro` | `2026-04-11` |
| `sigmine` | `2026-04-11` |
| `terras_indigenas` | `2026-04-11` |
| `unidades_conservacao` | `2026-04-11` |
| `usgs` | `2026-01-15` |
| `preco_spot` | `2026-03-31` |
| `alertas_legislativos` | `2026-04-11` |
| `siconfi` | `2025-02-19` |
| `cfem` | `2026-04-12` |
| `cfem_municipal` | `2026-04-12` |

---

## C. **`metadata`** (`relatorio864231V2`)

| Campo | Valor |
|--------|--------|
| `fonte_sigmine` | `REST API SIGMINE, consultado em 11/04/2026` |
| `fonte_precos` | `IMF PCPS Mar/2026 + USGS MCS 2026` |
| `fonte_reservas` | `USGS Mineral Commodity Summaries 2026` |
| `fonte_territorial` | (texto longo shapefiles FUNAI/CNUC/INCRA/CAR/CPRM — ver fonte) |
| `fonte_fiscal` | `STN CAPAG Municípios (fev/2025, ano base 2023), SICONFI DCA I-C e I-AB (exercício 2024), IBGE API Agregados (PIB 2023), ANM Dados Abertos CFEM (2022-2025)` |
| `fonte_car` | `GeoServer SICAR: 5 imóveis rurais sobrepõem o processo (~72% da área), todos "Aguardando análise"` |
| `fonte_demanda` | `World Gold Council, Gold Demand Trends Q2 2025` |
| `cambio` | `5.0229` |
| `cambio_data` | `2026-04-10` |
| `cambio_nota` | `BCB PTAX oficial (venda), 10/04/2026 13:04:25` |
| `calculado_em` | `2026-04-11T19:00:00Z` |
| `versao_config` | `Config-Scores v1 + Master-Substancias v10` |
| `nota_alertas` | (texto — ver fonte) |
| `nota_postgis` | (texto — ver fonte) |

---

## Subaba **Processo**

### Card: identificação (número, situação, grid)

| Campo | Valor |
|--------|--------|
| Número exibido | `864.231/2017` |
| Situação | `ativo` |
| Titular | `M P LANCA MINERADORA` |
| Substância | (rótulo UI a partir de) `MINÉRIO DE OURO` |
| Regime | Autorização de pesquisa |
| Área | `1.600 ha` |
| UF | `TO` |
| Município | `Jaú do Tocantins` |
| Fase | Pesquisa |
| Ano de protocolo | `2017` |
| Tempo de tramitação | `9 anos` |

*Fonte rodapé card:* ANM / Cadastro Mineiro · `timestamps.cadastro_mineiro`

### Card: último despacho ANM

| Campo | Valor |
|--------|--------|
| `data_ultimo_despacho` | `2026-03-13` |
| `ultimo_despacho` | `541 - AUT PESQ/RAL ANO BASE APRESENTADO EM 13/03/2026` |
| `numero_sei` | `48417.864231/2017-35` |

*Fonte rodapé:* SEI-ANM · `timestamps.cadastro_mineiro`

### Card: pendências

| Campo | Valor |
|--------|--------|
| `pendencias` | `[]` (vazio) |

*(Card oculto se lista vazia.)*

### Card: observações técnicas

**Ciclo regulatório**

| label | valor |
|--------|--------|
| Ano de protocolo | `2017` |
| Tempo de tramitação | `~9 anos` |
| Fase atual | `Autorização de Pesquisa` |
| Último evento | `13/03/2026` |
| Código do evento | `541 - AUT PESQ/RAL ANO BASE APRESENTADO EM 13/03/2026` |

**Identificação**

| label | valor |
|--------|--------|
| Titular | `M P Lanca Mineradora` |
| CNPJ | `21.515.445/0001-84` |
| Processo SEI | `48417.864231/2017-35` |

*Rodapé:* SIGMINE / SEI-ANM · data `timestamps.cadastro_mineiro`

### Objeto `dados_anm` (campos adicionais)

| Campo | Valor |
|--------|--------|
| `fase_atual` | `AUTORIZAÇÃO DE PESQUISA` |
| `data_protocolo` | `2017` |
| `ano_protocolo` | `2017` |
| `tempo_tramitacao_anos` | `9` |

---

## Subaba **Território**

### Card: áreas sensíveis

| Campo | Valor |
|--------|--------|
| TI nome | `Avá-Canoeiro` |
| TI fase | `Regularizada` |
| TI UF | `GO` |
| TI municípios | `Minaçu, Colinas do Sul` |
| TI distância km | `109.7` |
| UC PI nome | `Parque Nacional da Chapada dos Veadeiros` |
| UC PI tipo | `Proteção Integral (Federal/GO)` |
| UC PI distância km | `167.6` |
| UC US nome | `APA dos Meandros do Rio Araguaia` |
| UC US tipo | `Uso Sustentável (Federal)` |
| UC US distância km | `146.5` |
| Quilombola nome | `Kalunga do Mimoso` |
| Quilombola UF | `TO` |
| Quilombola municípios | `Arraias, Paranã` |
| Quilombola distância km | `125.8` |
| `sobreposicao_app` | `false` |
| `observacao_app` | `Não verificada.\n\nVerificação completa requer cruzamento com hidrografia ANA e altimetria SRTM.` |
| `sobreposicao_quilombola` | `false` |

*Fonte:* FUNAI · CNUC/MMA · INCRA · CAR · `timestamps.terras_indigenas`

### Card: logística

| Campo | Valor |
|--------|--------|
| Ferrovia nome | `EF-151 Rumo Malha Central (RMC)` |
| Ferrovia situação | `Em Operação` |
| Ferrovia bitola | `Larga` |
| Ferrovia UF | `TO` |
| Ferrovia distância km | `23.9` |
| Rodovia | `BR-153` |
| Rodovia tipo | `Eixo Principal` |
| Rodovia UF | `TO` |
| Rodovia distância km | `28.3` |
| Porto nome | `Santa Terezinha` |
| Porto tipo | `Porto Público (fluvial)` |
| Porto UF | `MT` |
| Porto rio | `Rio Araguaia` |
| Porto distância km | `317.9` |
| Sede | `Jaú do Tocantins` |
| Sede UF | `TO` |
| Sede distância km | `29.3` |

*Fonte:* DNIT · ANTAQ · IBGE/OSM · `timestamps.sigmine`

### Card: bioma

| Campo | Valor |
|--------|--------|
| `bioma` | `Cerrado` |

*Fonte:* IBGE / Biomas · `timestamps.unidades_conservacao`

### Card: hidrografia

| Campo | Valor |
|--------|--------|
| `nome_aquifero` | `Depósito Aluvionar (Qa)` |
| `unidade_hidrogeologica` | `Granular (Gr)` |
| `distancia_aquifero_km` | `0` |
| `sobreposicao_aquifero` | `true` |

*Fonte:* CPRM/SGB · `timestamps.cadastro_mineiro` ou `sigmine` conforme ramo UI

### Campos territoriais de apoio (legado / uma linha)

| Campo | Valor |
|--------|--------|
| `nome_uc_proxima` | `APA dos Meandros do Rio Araguaia` |
| `tipo_uc` | `Uso Sustentável (Federal)` |
| `distancia_uc_km` | `146.5` |

---

## Subaba **Inteligência**

### Card: contexto global

| Campo | Valor |
|--------|--------|
| `substancia_contexto` | (texto completo — ver `intel_mineral` na fonte) |
| `reservas_brasil_mundial_pct` | `3.8` |
| `producao_brasil_mundial_pct` | `2.4` |

*Fonte:* USGS Mineral Commodity Summaries · `timestamps.usgs`

### Card: preço e tendência

| Campo | Valor |
|--------|--------|
| `unidade_preco` | `oz` |
| `preco_referencia_usd_oz` | `4862.76` |
| `preco_referencia_brl_g` | `785.29` |
| `cambio_brl_usd` | `5.0229` |
| `cambio_data` | `2026-04-10` |
| `cambio_nota` | `BCB PTAX oficial (venda), 10/04/2026 13:04:25` |
| `preco_medio_usd_t` | `156341123` |
| `tendencia_preco` | `alta` |
| `var_1a_pct` | `62.8` |
| `cagr_5a_pct` | `23.1` |
| `demanda_projetada_2030` | (texto corrido longo — ver fonte) |
| `demanda_projetada_estruturada.titulo` | `WGC Q2/2025` |
| `demanda_projetada_estruturada.itens` | 7 strings (lista no mock) |

*Fonte rodapé:* `metadata.fonte_demanda` → `metadata.fonte_precos` → fallback IMF/USGS; data: `metadata.calculado_em` ou `timestamps.preco_spot`

### Card: aplicações

`aplicacoes_principais`: `Reserva de valor`, `Eletrônicos`, `Joalheria`, `Medicina`

*Fonte:* USGS · `timestamps.usgs`

### Card: estratégia nacional

| Campo | Valor |
|--------|--------|
| `estrategia_nacional` | (texto completo) |
| `estrategia_nacional_itens[0]` | `PNM 2030: rastreabilidade...` |
| `estrategia_nacional_itens[1]` | `Certificação de origem...` |

*Fonte:* MME / PNM 2030 + Adoo · `timestamps.alertas_legislativos`

### Container: valor estimado da reserva

| Campo | Valor |
|--------|--------|
| `valor_estimado_usd_ha` | `586_279_375` |
| `valor_estimado_usd_mi` | `938_047` |
| `valor_estimado_brl_tri` | `4.71` |
| `potencial_reserva_estimado_t` | `null` |
| `metodologia_estimativa` | (texto fórmula — ver fonte) |

*Cálculo UI:* Mi USD = `valor_estimado_usd_ha × processo.area_ha / 1e6` com `area_ha = 1600`.

*Fonte:* Estimativa TERRADAR / SIGMINE · `timestamps.sigmine`

### Card: processos vizinhos (tabela)

Cada linha em `processos_vizinhos` (5 registos):

| numero | titular | fase | substancia | area_ha | distancia_km |
|--------|---------|------|------------|---------|--------------|
| 861.532/2024 | DJ Participações Ltda | Autorização de Pesquisa | MINÉRIO DE OURO | 1796.41 | 5.5 |
| 864.100/2023 | Mineradora Serra Geral Ltda | Autorização de Pesquisa | MINÉRIO DE LÍTIO | 8978.37 | 6.0 |
| 864.429/2022 | Engegold Mineração Ltda | Autorização de Pesquisa | MINÉRIO DE OURO | 9035.72 | 10.7 |
| 864.007/2025 | ETRA Pesquisa Mineral Ltda | Autorização de Pesquisa | TERRAS RARAS | 5986.73 | 14.5 |
| 861.022/2013 | CEFAS Mineração Ltda | Concessão de Lavra | GRANITO | 155.29 | 24.0 |

*Fonte:* ANM / SIGMINE · `timestamps.sigmine`

---

## Subaba **Risco**

### Card: Risk Score

| Campo | Valor |
|--------|--------|
| `risk_score` (processo) | `23` |
| `risk_breakdown.geologico` | `52` |
| `risk_breakdown.ambiental` | `10` |
| `risk_breakdown.social` | `22` |
| `risk_breakdown.regulatorio` | `6` |

*Fonte:* Terrae, com dados ANM, FUNAI, ICMBio e IBGE · `timestamps.cadastro_mineiro`

### Card: decomposição (painel)

Valores e textos gerados por `gerarRiskDecomposicaoParaProcesso` / `RiskDecomposicaoRelatorioPanel` — não estão serializados em `relatorio864231V2()`.

### Card: alertas regulatórios

Lista = `processo.alertas` (mock dinâmico).  
*Fonte rodapé:* Adoo · `timestamps.alertas_legislativos`

---

## Subaba **Oportunidade**

Dados em `oportunidade` dentro de `relatorio864231V2()`.

### Card: Opportunity Score (perfis)

| Perfil | valor | label | cor | pesos (atr / viab / seg) |
|--------|-------|-------|-----|---------------------------|
| conservador | 75 | Alta | `#1D9E75` | 0.25 / 0.3 / 0.45 |
| moderado | 72 | Moderada | `#E8A830` | 0.4 / 0.3 / 0.3 |
| arrojado | 70 | Moderada | `#E8A830` | 0.55 / 0.25 / 0.2 |

### Dimensões

| Dimensão | valor | cor |
|----------|-------|-----|
| atratividade | 65 | `#D4A843` |
| viabilidade | 68 | `#5B8CB8` |
| seguranca | 85 | `#1D9E75` |

### Decomposição (`decomposicao`)

Objeto com arrays `atratividade`, `viabilidade`, `seguranca` — cada item: `nome`, `valor`, `peso`, `texto`, opcional `dado`, `impacto_neutro` (ver `relatorio.mock.ts` linhas ~2155–2300).

### Cruzamento (`cruzamento`)

| Campo | Valor |
|--------|--------|
| `tipo` | `analise` |
| `abertura` | `Este processo combina dois fatores favoráveis.` |
| `explicacao` | (texto Risk 23 + OS 75…) |
| `contexto` | (texto região / vizinhos / CFEM) |
| `data` | `11/04/2026` |
| `rs` | `23` |
| `os` | `75` |

*Fonte Opportunity Score:* TERRADAR, com dados ANM, IBGE, Tesouro e USGS · `timestamps.cadastro_mineiro`  
*Análise TERRADAR (rodapé do bloco):* `TERRADAR · {cruzamento.data}`

---

## Subaba **Fiscal** (`dados.fiscal` do relatório)

### Card: CAPAG

| Campo | Valor |
|--------|--------|
| `capag` | `C` |
| `capag_descricao` | (texto completo — ver fonte) |
| `capag_estruturado.resumo` | `Capacidade de pagamento.\n(ano base 2023)` |
| `capag_estruturado.indicadores` | Endividamento `0,00%` nota A; Poupança Corrente `95,73%` nota C; Liquidez `0,79%` nota B |
| `capag_estruturado.rodape` | `Nota C determinada pela poupança corrente.` |

*Fonte:* STN / CAPAG Municipios · `timestamps.siconfi`

### Card: indicadores municipais

| Campo | Valor |
|--------|--------|
| `receita_propria_mi` | `2.19` |
| `divida_consolidada_mi` | `1.75` |
| `pib_municipal_mi` | `110.8` |
| `dependencia_transferencias_pct` | `93.3` |

*Fonte:* STN / SICONFI (DCA) · `timestamps.siconfi`

### Card: CFEM processo vs. município

| Campo | Valor |
|--------|--------|
| `cfem_historico` | `[]` |
| `cfem_total_5anos_mi` | `0.065` |

**`cfem_municipal_historico`**

| ano | valor_total_municipio_brl | substancias |
|-----|----------------------------|-------------|
| 2022 | 21209.55 | Zirconio, Granito, Areia |
| 2023 | 6824.40 | Zirconio, Areia |
| 2024 | 3492.79 | Zirconio, Areia |
| 2025 | 33767.15 | Zirconio, Areia |

*Soma BRL (2022–2025):* 65.293,89 (referência para totais na UI).

*Fonte:* ANM / CFEM · `max(timestamps.cfem, cfem_municipal)`

### Card: incentivos estaduais

- `Prospera Tocantins (score 2/3)`

*Fonte:* Secretarias estaduais / STN · `timestamps.siconfi`

### Card: linhas BNDES

1. `BNDES Finem - Mineracao`  
2. `BNDES Finame`  
3. `BNDES Credito PME`  
4. `BNDES Finem - Meio Ambiente`

*Fonte:* BNDES / Linhas de crédito · `timestamps.siconfi`

### Card: estimativa CFEM em operação

| Campo | Valor |
|--------|--------|
| `estimativa_cfem_anual_operacao_mi` | `3.64` |
| `aliquota_cfem_pct` | `1.5` |

*Fonte:* ANM / CFEM · Alíquotas · `timestamps.cfem`

### Campo `observacao` (não é card próprio)

Texto completo em `fiscal.observacao` no mock (parágrafo sobre CAPAG, SICONFI, Dicf, dívida 1,75 Mi, RCL).

---

## Referência rápida — ficheiros

| Conteúdo | Ficheiro |
|----------|----------|
| Relatório completo 864.231 | `src/data/relatorio.mock.ts` → `relatorio864231V2()` |
| Processo no mapa | `src/data/processos.mock.ts` → seed `p_864231` + `processosMock` |

---

*Documento gerado para apoio a cálculos e auditoria; número do processo no pedido (86.4231) corrigido para **864.231/2017**.*
