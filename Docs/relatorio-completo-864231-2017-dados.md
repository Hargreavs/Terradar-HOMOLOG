# Dados do relatório completo — processo **864.231/2017** (`p_864231`)

Documento gerado a partir do código-fonte (`processos.mock.ts`, `relatorio.mock.ts`, `riskScoreDecomposicao.ts`, `RelatorioCompleto.tsx`).  
Referência de número: **864.231/2017** (SIGMINE); id interno: **`p_864231`**.

---

## 1. `localStorage` (o que existe de verdade)

| Chave | Conteúdo |
|-------|----------|
| **`terrae-filtros`** | Estado persistido do Zustand (`useMapStore`): apenas `filtros.camadas`, `filtros.periodo`, `filtros.riskScoreMin`, `filtros.riskScoreMax` e `camadasGeo`. **Não** inclui processo selecionado, nem dados do relatório. |
| **`terrae-processos`** | Removido no carregamento (`loadProcessos()` em `useMapStore.ts`); a lista de processos vem sempre de **`PROCESSOS_MOCK`** em memória. |

**Conclusão:** não há blob de `localStorage` com os campos do drawer “Ver relatório completo” para este (ou outro) processo. O drawer usa:

- **`processo`**: entrada em `PROCESSOS_MOCK` com `id === 'p_864231'`;
- **`dados`**: `relatoriosMock['p_864231']` → função `relatorio864231V2()` em `relatorio.mock.ts`;
- **`relatorioDrawerAberto`**: só em memória (não persistido).

Os blocos abaixo são os **dados efetivos** usados pela UI, extraídos do mock auditado.

---

## 2. Objeto `Processo` (`PROCESSOS_MOCK` — `p_864231`)

Usado no cabeçalho do drawer, grid “resumo”, Risk (dimensões + decomposição), Opportunity (cálculo alternativo), Fiscal (município/UF), etc.

| Campo | Valor |
|-------|--------|
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
| `mes_protocolo` | `null` |
| `situacao` | `ativo` |
| `risk_score` | `23` (média ponderada a partir de `risk_breakdown`) |
| `risk_breakdown` | `{ geologico: 52, ambiental: 10, social: 22, regulatorio: 6 }` — o **ambiental** exibido vem de `ambientalDetalheMockFromProcesso` → **10** (caso auditado `p_864231`) |
| `valor_estimado_usd_mi` | `938047` |
| `ultimo_despacho_data` | `2026-03-13` |
| `geojson` | Polígono SIGMINE (EPSG:4674), vértices em `geojsonSigmine864231()` — `processos.mock.ts` |

### `fiscal` (no `Processo`)

| Campo | Valor |
|-------|--------|
| `capag` | `C` |
| `receita_propria_mi` | `2.44` |
| `divida_consolidada_mi` | `0` |
| `incentivos_estaduais` | `['Prospera Tocantins (score 2/3)']` |
| `linhas_bndes` | BNDES Finem Mineração, Finame, Crédito PME, Finem Meio Ambiente, Chamada Minerais Estratégicos |
| `observacao` | Texto longo TCE-TO/SICAP + RREO (igual ao bloco fiscal do relatório) |

### `alertas` (ordenação + corte `pickAlertas`)

Para `p_864231` (TO, autorização de pesquisa, não bloqueado): pool inclui `anm89`, `lei15190`, `pl2197`, `bndesFinep`; ordenação por hash; `count = 1 + floor(hashUnit(id,88)*4)` → **1 alerta**.  
Primeiro item após ordenação: **PL 2.197/2025** (`id` `pl-2197-2025`, Câmara, favorável, etc. — ver `CATALOGO_ALERTAS.pl2197` em `processos.mock.ts`).

### `risk_decomposicao` (gerado por `gerarRiskDecomposicaoParaProcesso`)

- **Geológico:** variáveis genéricas por substância/fase/qualidade (`variaveisGeologicas`) — scores derivados de lookups (ouro/pesquisa).
- **Ambiental (fixo 864231):** score `10`, uma variável — proximidade/sobreposição aquífero Depósito Aluvionar (Qa), Granular (Gr), fonte CPRM/SGB + SIGMINE.
- **Social (fixo 864231):** score alinhado a `rb.social` (22); variáveis: IDH-M, densidade, comunidades tradicionais (TI Avá-Canoeiro ~112,5 km), CAPAG C — textos em `variaveisSociais` quando `p.id === 'p_864231'`.
- **Regulatório:** `variaveisRegulatorias` — o texto “dias desde último despacho” usa **`Date.now()`**; valores numéricos **mudam com o dia da execução**.

---

## 3. `RelatorioData` — `relatoriosMock['p_864231']`

Chave: `processo_id: 'p_864231'`. Estrutura completa abaixo, por **subaba** e **card** da UI.

---

### Subaba **Processo**

| Container / card | Fonte de dados |
|------------------|----------------|
| **Cabeçalho** | `processo.numero`, badge situação (`processo.situacao`). |
| **Card resumo (grid)** | `processo` (titular, substância, regime, área, UF, município, fase) + `dados_anm` (ano protocolo, tempo tramitação). |
| **Card Cadastro Mineiro** | Lista derivada de `dados_anm` + `processo` (mesmo grid). Rodapé: `timestamps.cadastro_mineiro`. |
| **Último despacho ANM** | `dados_anm.data_ultimo_despacho`, `ultimo_despacho`, `numero_sei`. Disclaimer SEI se `mostrarDisclaimerSEI(processo)` (protocolo &lt; set/2019 ou 2019 com mês &lt; 9). Rodapé: `timestamps.cadastro_mineiro`, fonte SEI-ANM. |
| **Pendências** | `dados_anm.pendencias` (vazio no mock 864231). |
| **Observações técnicas** | `observacoes_tecnicas.ciclo_regulatorio` + `identificacao`. Disclaimer curto + rodapé se ano &lt; 2019. |

#### `dados_anm`

```json
{
  "fase_atual": "AUTORIZAÇÃO DE PESQUISA",
  "data_protocolo": "2017",
  "ano_protocolo": 2017,
  "tempo_tramitacao_anos": 9,
  "data_ultimo_despacho": "2026-03-13",
  "ultimo_despacho": "541 - AUT PESQ/RAL ANO BASE APRESENTADO EM 13/03/2026",
  "numero_sei": "48417.864231/2017-35",
  "pendencias": []
}
```

#### `observacoes_tecnicas`

```json
{
  "ciclo_regulatorio": [
    { "label": "Ano de protocolo", "valor": "2017" },
    { "label": "Tempo de tramitação", "valor": "~9 anos" },
    { "label": "Fase atual", "valor": "Autorização de Pesquisa" },
    { "label": "Último evento", "valor": "13/03/2026" },
    { "label": "Código do evento", "valor": "541 - AUT PESQ/RAL ANO BASE APRESENTADO EM 13/03/2026" }
  ],
  "identificacao": [
    { "label": "Titular", "valor": "M P Lanca Mineradora" },
    { "label": "CNPJ", "valor": "21.515.445/0001-84" },
    { "label": "Processo SEI", "valor": "48417.864231/2017-35" }
  ]
}
```

---

### Subaba **Território**

| Container / card | Fonte de dados |
|------------------|----------------|
| **Áreas sensíveis** | `territorial` (TI, UC PI, UC US, APP, quilombola), `timestamps.terras_indigenas`. |
| **Logística** | Ferrovia, rodovia (se houver), porto, sede (`nome_sede`, `distancia_sede_km` ou fallback `distancia_sede_municipal_km`). `timestamps.sigmine`. |
| **Bioma** | `territorial.bioma`, `timestamps.unidades_conservacao`. |
| **Aquífero** | `territorial.nome_aquifero`, `unidade_hidrogeologica`, `sobreposicao_aquifero`, `distancia_aquifero_km`. `timestamps.cadastro_mineiro`. |

#### `territorial` (v6 auditado)

Inclui, entre outros: TI Avá-Canoeiro (109,7 km); UC PI Chapada dos Veadeiros (167,6 km); UC US APA Meandros (146,5 km); quilombola Kalunga (125,8 km); APP não verificada; aquífero Qa/Gr sobreposto; bioma Cerrado; ferrovia EF-151 RMC 23,9 km; BR-153 28,3 km; porto Santa Terezinha/MT 317,9 km; sede Jaú do Tocantins 29,3 km.  
Objeto completo: ver `relatorio864231V2().territorial` em `relatorio.mock.ts` (linhas ~1880–1937).

---

### Subaba **Inteligência**

| Container / card | Fonte de dados |
|------------------|----------------|
| **Contexto global** | `intel_mineral.reservas_brasil_mundial_pct`, `producao_brasil_mundial_pct`, textos de gap. `timestamps.usgs`. |
| **Preço e tendência** | `intel_mineral` (USD/oz, BRL/g, câmbio, tendência). |
| **Demanda / estratégia** | `demanda_projetada_2030`, `estrategia_nacional`. |
| **Valor estimado** | `valor_estimado_usd_mi`, `valor_estimado_brl_tri`, `metodologia_estimativa`. |
| **Processos vizinhos** | `intel_mineral.processos_vizinhos` → `PROCESSOS_VIZINHOS_864231` (5 itens). |

Campos principais de `intel_mineral` no mock: `substancia_contexto`, reservas/produção %, demanda, `preco_medio_usd_t` + `unidade_preco: "oz"`, `preco_referencia_usd_oz: 4862.76`, `preco_referencia_brl_g`, `cambio_brl_usd`, aplicações, `valor_estimado_usd_mi: 938047`, `valor_estimado_brl_tri: 5.33`, metodologia, vizinhos.

---

### Subaba **Risco**

| Container / card | Fonte de dados |
|------------------|----------------|
| **Risk Score (total)** | `processo.risk_score`, tooltip com `risk_decomposicao` (`gerarRiskDecomposicaoParaProcesso`). |
| **Barras por dimensão** | `processo.risk_breakdown` (geológico 52, ambiental 10, social 22, regulatório 6). |
| **Painel decomposição** | `risk_decomposicao` (4 dimensões com variáveis). |
| **Alertas regulatórios** | `processo.alertas` (ordenados na UI). |

---

### Subaba **Oportunidade**

| Container / card | Fonte de dados |
|------------------|----------------|
| **Opportunity Score (3 perfis)** | `oportunidade.perfis` + tooltips; valores fixos para `p_864231` via `computeOpportunityForProcesso` (75 / 72 / 70 conforme perfil). |
| **Decomposição** | `oportunidade.dimensoes`, `oportunidade.decomposicao` (atratividade, viabilidade, segurança). |
| **Cruzamento TERRADAR** | `oportunidade.cruzamento` (texto RS/OS, data, contexto). |

Objeto `oportunidade` completo: `relatorio864231V2().oportunidade` em `relatorio.mock.ts` (inclui textos de viabilidade que ainda mencionam ferrovia 11 km — alinhamento futuro com `territorial` se desejado).

---

### Subaba **Fiscal**

| Container / card | Fonte de dados |
|------------------|----------------|
| **CAPAG** | `fiscal.capag`, `capag_descricao`, município/UF do `processo`. `timestamps.siconfi`. |
| **Métricas município** | `receita_propria_mi`, `divida_consolidada_mi`, `pib_municipal_mi`, `dependencia_transferencias_pct`. |
| **CFEM** | `cfem_historico`, `cfem_total_5anos_mi`, `cfem_municipal_historico`, `aliquota_cfem_pct`, `estimativa_cfem_anual_operacao_mi`. |
| **Incentivos / BNDES** | `incentivos_estaduais`, `linhas_bndes`. |
| **Observação fiscal** | `fiscal.observacao`. |

O bloco `fiscal` do relatório espelha o mock rico (CAPAG C, CFEM municipal por ano, etc.) — ver `relatorio864231V2().fiscal`.

---

## 4. `timestamps` (rodapés “Atualizado em…”)

```json
{
  "cadastro_mineiro": "2026-04-11",
  "sigmine": "2026-04-11",
  "terras_indigenas": "2026-04-11",
  "unidades_conservacao": "2026-04-11",
  "usgs": "2026-01-15",
  "preco_spot": "2026-03-31",
  "alertas_legislativos": "2026-04-11",
  "siconfi": "2025-11-30",
  "cfem": "2026-04-11",
  "cfem_municipal": "2025-12-31"
}
```

---

## 5. `metadata` (auditoria / fontes)

Presente em `relatorio864231V2().metadata`: `fonte_sigmine`, `fonte_precos`, `fonte_reservas`, `fonte_territorial`, `fonte_fiscal`, `fonte_car`, `fonte_demanda`, câmbio, `versao_config`, notas de alertas e PostGIS. Útil para tooltips e rodapés contextuais.

---

## 6. Como reproduzir os dados no DevTools

1. **Persistido:** `localStorage.getItem('terrae-filtros')` → JSON com só filtros/camadas geo.  
2. **Relatório do processo:** não está no `localStorage`; no código: `relatoriosMock['p_864231']` após import do módulo, ou inspecionar `relatorio864231V2()` em `src/data/relatorio.mock.ts`.  
3. **Processo:** `PROCESSOS_MOCK.find(p => p.id === 'p_864231')` em `src/data/processos.mock.ts`.

---

*Última extração alinhada ao repositório: estrutura do drawer em `RelatorioCompleto.tsx` e mocks em `relatorio.mock.ts` / `processos.mock.ts`.*
