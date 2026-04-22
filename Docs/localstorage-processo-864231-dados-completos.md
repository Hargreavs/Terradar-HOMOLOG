# Processo **864.231/2017** — `localStorage` e dados completos para validação

**ID interno:** `p_864231`  
**Referência de código:** `src/store/useMapStore.ts`, `src/data/processos.mock.ts`, `src/data/relatorio.mock.ts`

Este documento separa o que **realmente** fica no browser (`localStorage`) do que **não** é persistido mas alimenta o mapa e o drawer **Relatório completo** (subabas e títulos de card/container).

---

## 1. O que existe no `localStorage` (global — não é por processo)

Não há chave JSON com “dados do 864.231”. A única persistência é:

| Chave | Conteúdo |
|--------|-----------|
| **`terrae-filtros`** | Parte do estado Zustand (`persist`): `filtros.camadas`, `filtros.periodo`, `filtros.riskScoreMin`, `filtros.riskScoreMax`, e **`camadasGeo`** (visibilidade das camadas geográficas no mapa). |

A chave legada **`terrae-processos`** é **removida** ao iniciar a app (`loadProcessos()`); a lista de processos vem sempre do mock.

### 1.1 Exemplo de JSON persistido (valores default típicos)

Após serialização pelo Zustand `persist` (estrutura típica com `state` / `version`):

```json
{
  "state": {
    "filtros": {
      "camadas": {
        "concessao_lavra": true,
        "autorizacao_pesquisa": true,
        "req_lavra": true,
        "licenciamento": true,
        "lavra_garimpeira": true,
        "registro_extracao": true,
        "disponibilidade": true,
        "mineral_estrategico": true,
        "bloqueio_provisorio": true,
        "bloqueio_permanente": true
      },
      "periodo": [1960, 2026],
      "riskScoreMin": 0,
      "riskScoreMax": 100
    },
    "camadasGeo": {
      "terras_indigenas": false,
      "unidades_conservacao": false,
      "quilombolas": false,
      "app_car": false,
      "aquiferos": false,
      "ferrovias": false,
      "portos": false
    }
  },
  "version": 0
}
```

**Campos de filtro não guardados** (reiniciam no F5): `substancias`, `uf`, `municipio`, `searchQuery`.

**Estado não persistido** (memória): `processoSelecionado`, `relatorioDrawerAberto`, `flyTo`, drill Intel, etc.

### 1.2 Visibilidade do processo 864.231 no mapa

Com os defaults acima, o processo entra no filtro: regime **Autorização de pesquisa**, ano **2017** no período, **risk 23** na faixa 0–100.

---

## 2. Dados do processo em memória — objeto `Processo` (`p_864231`)

Origem: `processos.mock.ts` (seed + `rawProcessos` / `processosMock`). **Não** vai para `localStorage`.

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
| `lat` / `lng` | `-12.845` / `-48.816` |
| `data_protocolo` | `2017` |
| `ano_protocolo` | `2017` |
| `situacao` | `ativo` |
| `risk_score` | `23` |
| `risk_breakdown` | geológico **52**, ambiental **10**, social **22**, regulatório **6** |
| `valor_estimado_usd_mi` | `938047` |
| `ultimo_despacho_data` | `2026-03-13` |
| `geojson` | Polígono SIGMINE (`geojsonSigmine864231()` — anel fechado EPSG:4674) |

### 2.1 Alertas legislativos (`alertas[]`)

Gerados por `pickAlertas`. Para `p_864231`, o conjunto elegível (TO, não bloqueado, não mineral estratégico) inclui entre outros: ANM 89, Lei 15.190, PL 2.197, BNDES/Finep. Ordenação por hash e **quantidade = 1** (`hashUnit(p_864231, 88) ≈ 0,23` → 1 alerta).

**Alerta exibido (primeiro após ordenação):** `bndesFinep` — *Chamada pública BNDES/Finep: beneficiamento de minerais estratégicos* (`id` catalog: `bndes-finep-2025-03`).

### 2.2 Fiscal resumido (`processo.fiscal` — painel processo / não confundir com `relatorio.fiscal`)

| Campo | Valor |
|--------|--------|
| `capag` | `C` |
| `receita_propria_mi` | `2.44` |
| `divida_consolidada_mi` | `0` |
| `incentivos_estaduais` | `['Prospera Tocantins (score 2/3)']` |
| `linhas_bndes` | Cinco linhas (Finem Mineração, Finame, PME, Finem Meio Ambiente, Chamada Minerais Estratégicos) |
| `observacao` | Texto TCE-TO/SICAP, RREO, RCL, superávit (ver mock) |

### 2.3 Oportunidade (Radar — override em `opportunityScore.ts`)

| Perfil | `scoreTotal` |
|--------|----------------|
| Conservador | 75 |
| Moderado | 72 |
| Arrojado | 70 |

Dimensões fixas: atratividade **65**, viabilidade **68**, segurança **85**.

---

## 3. Relatório completo — `relatoriosMock['p_864231']` (`relatorio864231V2()`)

Chave: `processo_id` = `p_864231`. Estrutura alinhada às **subabas** do drawer.

---

### 3.1 Subaba **Processo**

#### Card — **Dados cadastrais** (número + situação + grelha)

| Origem | Conteúdo |
|--------|----------|
| Número / situação | `864.231/2017`, Ativo |
| Titular, substância, regime, área, UF, município, fase | Conforme secção 2 |
| `dados_anm.data_protocolo` | `2017` |
| `dados_anm.prazo_vencimento` | `~Nov/2028` |
| `dados_anm.tempo_tramitacao_anos` | `9` |
| `dados_anm.fase_atual` | `AUTORIZAÇÃO DE PESQUISA` |

*Rodapé:* `timestamps.cadastro_mineiro` → `2026-04-11`.

#### Card — **Último despacho ANM**

| Campo | Valor |
|--------|--------|
| `data_ultimo_despacho` | `2026-03-13` |
| `ultimo_despacho` | `541 - AUT PESQ/RAL ANO BASE APRESENTADO EM 13/03/2026` |
| `numero_sei` | `48417.864231/2017-35` |

#### Card — **Pendências**

`pendencias`: `[]`

#### Card — **Observações técnicas**

Texto completo em `dados_anm.observacoes_tecnicas` (alvará, GU, cessão, CREA, lavra, planta, produção estimada):

> Área de 1.600 ha nos municípios de Jaú do Tocantins/TO e Montividiu do Norte/GO, bioma Cerrado. Endereço: Fazenda Três Marias, Lote 68, Gleba 14, Loteamento Água Quente. Alvará de Pesquisa nº 4682/2017, prorrogação de +3 anos concedida em 13/11/2025 (Despacho nº 172920/COROUT-TO/PI/MA/ANM/2025). GU nº 5/2020 (renovada, válida até 12/07/2025). Titular anterior: Engemid Construção e Mineração Eireli (cessão em 20/04/2022). Engenheira responsável: Lohanne Sousa Alves (CREA 322.042 VD/TO). Método de lavra: céu aberto, desmonte mecânico (escavadeira). Planta de beneficiamento em implantação (britador, moinho, centrífugas). Produção estimada: 308.880 g Au/ano ≈ R$ 90,9 mi/ano.

---

### 3.2 Subaba **Território**

#### Card — **Áreas sensíveis**

| Item | Dados |
|------|--------|
| Terra Indígena | `TI Avá-Canoeiro (Regularizada)` — **112,5** km |
| Unidade de conservação | `APA Lago de Peixe/Angical` — tipo `Uso Sustentável (Estadual/TO)` — **57,1** km |
| APP | Não |
| Quilombola | Não; nome: `Kalunga do Mimoso (128,1 km)` |

#### Card — **Logística**

| Item | Valor |
|------|--------|
| Ferrovia | `Ferrovia Norte-Sul EF-151 (VALEC)` — **11,0** km |
| Porto | `Tucuruí/PA` — **1015,9** km |
| Sede municipal | **32,6** km (rótulo com município do processo na UI) |

#### Card — **Bioma**

`bioma`: `Cerrado` (+ texto derivado `biomaImplicacoes` na UI).

#### Card — **Aquífero**

| Campo | Valor |
|--------|--------|
| `nome_aquifero` | `Depósito Aluvionar (Qa), Unidade Granular (Gr)` |
| `distancia_aquifero_km` | `0` (UI: sobreposição — badge e texto explicativo, não “0,0 km” como erro) |

---

### 3.3 Subaba **Inteligência**

#### Card — **Contexto global**

| Campo | Valor |
|--------|--------|
| `substancia_contexto` | Minério de ouro / referência SIGMINE TERRADAR 864.231 |
| `reservas_brasil_mundial_pct` | `3.8` |
| `producao_brasil_mundial_pct` | `2.4` |
| Gap | Calculado na UI a partir dos dois % |

#### Card — **Preço e tendência**

| Campo | Valor |
|--------|--------|
| `unidade_preco` | `oz` |
| `preco_referencia_usd_oz` | `4862.76` |
| `preco_medio_usd_t` | `156341123` |
| `tendencia_preco` | `estavel` |
| `demanda_projetada_2030` | Texto World Gold Council / perspectiva 2026+ |
| Câmbio / BRL | `cambio_brl_usd` **5.68**, `cambio_data` **2026-04-11**, `preco_referencia_brl_g` **889.07** |

#### Card — **Aplicações**

`aplicacoes_principais`: Reserva de valor, Eletrônicos, Joalheria, Medicina.

#### Card — **Estratégia nacional**

`estrategia_nacional` — LBMA, garimpo, cooperativas, Decreto 10.966/2022.

#### Container — **Valor estimado da reserva**

| Campo | Valor |
|--------|--------|
| `valor_estimado_usd_mi` | `938047` |
| `valor_estimado_brl_tri` | `5.33` |
| `metodologia_estimativa` | Fórmula 1 ha × volume × teor × preço (texto completo no mock) |
| Rodapé fonte | Estimativa TERRADAR / SIGMINE |

`paises_concorrentes`: `null`. `potencial_reserva_estimado_t`: `null`.

#### Card — **Processos vizinhos** (tabela — ordem por distância crescente)

Colunas na UI: Nº, Titular, Fase, Substância, Área (ha), DIST. (km) com **1 casa decimal**, RISK (valor · Baixo/Médio/Alto com cor por faixa).

| Nº processo | Titular | Fase | Substância | Área (ha) | DIST. (km) | RISK |
|-------------|---------|------|------------|-----------|------------|------|
| 861.532/2024 | DJ PARTICIPACOES LTDA | Autorização de Pesquisa | MINÉRIO DE OURO | 1796.41 | 5.5 | 23 · Baixo |
| 864.100/2023 | Mineradora Serra Geral Ltda | Autorização de Pesquisa | MINÉRIO DE LÍTIO | 8978.37 | 6.0 | 22 · Baixo |
| 864.119/2023 | LAURIVALDO DIAS | Autorização de Pesquisa | MINÉRIO DE LÍTIO | 9997.54 | 7.3 | 22 · Baixo |
| 864.219/2020 | AFLA INVESTIMENTOS E PARTICIPAÇÕES LTDA | Autorização de Pesquisa | MINÉRIO DE OURO | 1151.54 | 9.9 | 23 · Baixo |
| 864.429/2022 | Engegold Mineração Ltda | Autorização de Pesquisa | MINÉRIO DE OURO | 9035.72 | 10.7 | 23 · Baixo |
| 864.122/2020 | WELINGTON BENEDITO LEITE | Autorização de Pesquisa | MINÉRIO DE OURO | 1980.84 | 11.1 | 23 · Baixo |
| 864.007/2025 | ETRA PESQUISA MINERAL LTDA | Autorização de Pesquisa | TERRAS RARAS | 5986.73 | 14.5 | 23 · Baixo |
| 864.138/2016 | G-TAU LOCACOES DE MAQUINAS E EQUIPAMENTOS LTDA | Autorização de Pesquisa | MINÉRIO DE OURO | 1959.65 | 15.2 | 23 · Baixo |
| 864.072/2024 | CONCREGELL CONCRETO PMW LTDA | Autorização de Pesquisa | MINÉRIO DE LÍTIO | 9198.46 | 16.9 | 22 · Baixo |
| 864.337/2021 | Lucas Gabriel dos Reis Fernandes | Autorização de Pesquisa | OURO | 1480.48 | 19.1 | 23 · Baixo |
| 864.505/2022 | Mineradora Serra Geral Ltda | Autorização de Pesquisa | MINÉRIO DE LÍTIO | 8792.21 | 21.1 | 22 · Baixo |
| 860.599/2017 | Granitos Retiro Ltda. | Autorização de Pesquisa | MINÉRIO DE OURO | 1738.38 | 22.0 | 23 · Baixo |
| 864.452/2012 | CALCARIO MARA ROSA LTDA | Autorização de Pesquisa | MINÉRIO DE OURO | 1724.45 | 23.0 | 23 · Baixo |
| 860.083/2018 | STTONES & ESPATO BRASIL LTDA | Autorização de Pesquisa | MINÉRIO DE OURO | 1974.46 | 23.5 | 23 · Baixo |
| 861.022/2013 | CEFAS MINERACAO LTDA | Concessão de Lavra | GRANITO | 155.29 | 24.0 | 17 · Baixo |
| 864.518/2021 | AXIA MINERACAO S.A | Autorização de Pesquisa | MINÉRIO DE OURO | 1306.52 | 29.1 | 23 · Baixo |
| 860.396/2010 | STTONES & ESPATO BRASIL LTDA | Autorização de Pesquisa | MINÉRIO DE OURO | 1624.04 | 29.8 | 23 · Baixo |
| 864.228/2020 | ADIGINTON DA SILVA FERREIRA | Autorização de Pesquisa | OURO | 2032.53 | 30.7 | 23 · Baixo |
| 861.226/2022 | MIREP EMPREENDIMENTOS S/A | Autorização de Pesquisa | MINÉRIO DE OURO | 1386.41 | 31.5 | 23 · Baixo |
| 860.067/2009 | MINERACAO MATA AZUL S/A | Autorização de Pesquisa | MINÉRIO DE OURO | 1875.6 | 34.7 | 23 · Baixo |

---

### 3.4 Subaba **Risco**

#### Card — **Risk Score**

| Campo | Valor |
|--------|--------|
| Total | `23` — classe “Baixo risco” |
| Barras | Geológico 52, Ambiental 10, Social 22, Regulatório 6 |

#### Card — **Decomposição por dimensão**

Textos auditados para 864.231 — ver `riskScoreDecomposicao.ts` / `RiskDecomposicaoRelatorioPanel`.

#### Card — **Alertas regulatórios**

Conforme `processo.alertas` (secção 2.1).

---

### 3.5 Subaba **Fiscal**

#### Card — **CAPAG (município)**

| Campo | Valor |
|--------|--------|
| `capag` | `C` |
| `capag_descricao` | Texto Tesouro (endividamento, poupança corrente, liquidez) |
| Local na UI | Jaú do Tocantins / TO |

#### Card — **Indicadores financeiros**

| Campo | Valor |
|--------|--------|
| `receita_propria_mi` | `2.44` |
| `divida_consolidada_mi` | `0` |
| `pib_municipal_mi` | `110.8` |
| `dependencia_transferencias_pct` | `92.2` |

#### Card — **CFEM: processo vs. município**

| Campo | Valor |
|--------|--------|
| `cfem_historico` | `[]` |
| `cfem_municipal_historico` | 2021–2025 (valores BRL e `substancias` por ano — ver mock) |
| `cfem_total_5anos_mi` | `0.065` |
| `aliquota_cfem_pct` | `1.5` |
| `estimativa_cfem_anual_operacao_mi` | `1.36` |

#### Card — **Incentivos estaduais**

`['Prospera Tocantins (score 2/3)']`

#### Card — **Linhas BNDES**

Cinco entradas (Finem Mineração, Finame, PME, Finem Meio Ambiente, Chamada Minerais Estratégicos).

#### Card — **Observação fiscal**

`fiscal.observacao` — texto longo TCE-TO/SICAP, RREO, despesa pessoal, RCL, etc.

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

### 3.7 **`metadata`** (auditoria — sem card dedicado no drawer)

Objeto completo em `relatorio864231V2().metadata`:

| Chave | Valor (resumo) |
|--------|----------------|
| `fonte_sigmine` | REST API SIGMINE — consultado em 11/04/2026 |
| `fonte_precos` | IMF PCPS março/2026 + USGS MCS 2026 |
| `fonte_reservas` | USGS Mineral Commodity Summaries 2026 |
| `fonte_territorial` | Shapefiles FUNAI, CNUC, INCRA, IBGE, CPRM/SGB |
| `fonte_fiscal` | CAPAG, IBGE, TCE-TO/SICAP, RREO, ANM CFEM |
| `fonte_car` | GeoServer SICAR — 5 imóveis rurais |
| `fonte_demanda` | World Gold Council — Gold Demand Trends 2025 |
| `cambio` | `5.68` |
| `cambio_data` | `2026-04-11` |
| `cambio_nota` | Fallback BCB |
| `calculado_em` | `2026-04-11T19:00:00Z` |
| `versao_config` | Config-Scores v1 + Master-Substancias v3 |
| `nota_alertas` | Alertas default / Adoo não integrado |
| `nota_postgis` | Shapefiles Python; produção PostGIS |

---

## 4. Referência rápida de ficheiros

| O quê | Onde |
|--------|------|
| `localStorage` | `src/store/useMapStore.ts` — `name: 'terrae-filtros'` |
| Processo + GeoJSON | `src/data/processos.mock.ts` |
| Relatório + vizinhos | `src/data/relatorio.mock.ts` — `relatorio864231V2()`, `PROCESSOS_VIZINHOS_864231` |
| Drawer | `src/components/map/RelatorioCompleto.tsx` |

---

*Documento para validação: o `localStorage` não contém blob por processo; as secções 2–3 espelham os mocks usados quando o utilizador abre o 864.231/2017.*
