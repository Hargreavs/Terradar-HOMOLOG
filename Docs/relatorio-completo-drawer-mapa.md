# Relatório completo (drawer do mapa) — campos por subaba e card

Documentação dos **elementos visíveis** no drawer lateral acionado por **«Ver relatório completo»** na aba mapa.  
Implementação: `src/components/map/RelatorioCompleto.tsx` (painel de decomposição: `RiskDecomposicaoRelatorioPanel.tsx`).  
Dados: `RelatorioData` (`src/data/relatorio.mock.ts`) + `Processo` (`src/types/index.ts`).

---

## Área fixa (fora do conteúdo das abas)


| Container                   | Campos / ações                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Barra superior (header)** | Número do processo (`processo.numero`, truncável com tooltip) · **Regime** (`RegimeBadge` a partir de `processo.regime`) |
| **Ações**                   | Botão **Exportar PDF** · Botão **Fechar** (✕)                                                                            |
| **Overlay (durante PDF)**   | Mensagem «Exportando relatório…»                                                                                         |
| **Navegação (abas)**        | Processo · Território · Inteligência · Risco · Fiscal                                                                    |


---

## Subaba **Processo**

### Card — Dados cadastrais (hero + grid)


| Rótulo                     | Origem dos dados                                                                 |
| -------------------------- | -------------------------------------------------------------------------------- |
| **Número** (título grande) | `processo.numero`                                                                |
| **Situação** (pill)        | `processo.situacao` → Ativo / Bloqueado / Inativo                                |
| **Titular**                | `processo.titular`                                                               |
| **Substância**             | `processo.substancia` (via `labelSubstanciaParaExibicao`)                        |
| **Regime**                 | `REGIME_LABELS[processo.regime]`                                                 |
| **Área**                   | `processo.area_ha` (formatado pt-BR + «ha»)                                      |
| **UF**                     | `processo.uf`                                                                    |
| **Município**              | `processo.municipio`                                                             |
| **Fase**                   | `FASE_LABELS[processo.fase]`                                                     |
| **Data protocolo**         | `dados_anm.data_protocolo`                                                       |
| **Prazo vencimento**       | `dados_anm.prazo_vencimento` (texto/cor via `prazoVencimentoExibicaoRelatorio`)  |
| **Tempo de tramitação**    | `dados_anm.tempo_tramitacao_anos` (cor por faixa `corTramitacaoAnos`)            |
| **Rodapé de fonte**        | `FonteLabel`: data `timestamps.cadastro_mineiro`, texto «ANM / Cadastro Mineiro» |


### Card — Último despacho ANM


| Campo             | Origem                                                   |
| ----------------- | -------------------------------------------------------- |
| Data              | `dados_anm.data_ultimo_despacho`                         |
| Texto do despacho | `dados_anm.ultimo_despacho`                              |
| Link SEI          | `dados_anm.numero_sei` (URL base `SEI_ANM_PESQUISA_URL`) |
| **Fonte**         | `timestamps.cadastro_mineiro` · «SEI-ANM»                |


### Card — Pendências *(condicional: só se `dados_anm.pendencias.length > 0`)*


| Campo     | Origem                                                   |
| --------- | -------------------------------------------------------- |
| Lista     | `dados_anm.pendencias[]` (itens com ícone ▲)             |
| **Fonte** | `timestamps.cadastro_mineiro` · «ANM / Cadastro Mineiro» |


### Card — Observações técnicas *(condicional: só se texto não vazio após trim)*


| Campo     | Origem                                                                                  |
| --------- | --------------------------------------------------------------------------------------- |
| Parágrafo | `dados_anm.observacoes_tecnicas` (trechos de área e `município/UF` podem ir em negrito) |
| **Fonte** | `timestamps.cadastro_mineiro` · «Terrae / Análise Técnica»                              |


> **Nota:** o campo `dados_anm.fase_atual` existe no mock mas **não** é exibido neste drawer; a fase mostrada vem de `processo.fase`.

---

## Subaba **Território**

### Card — Áreas sensíveis


| Linha                      | Conteúdo                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Título**                 | «Áreas sensíveis» + tooltip ⓘ (`AREAS_SENSIVEIS_DIST_TOOLTIP`)                                                                 |
| **Terra Indígena**         | Nome ou texto de ausência · distância km (cor `corDistanciaKm`) — `territorial.nome_ti_proxima`, `territorial.distancia_ti_km` |
| **Unidade de conservação** | Nome/tipo (`territorial.nome_uc_proxima`, `territorial.tipo_uc`) · km — `territorial.distancia_uc_km`                          |
| **APP**                    | Sim/Não — `territorial.sobreposicao_app` (tooltip glossário `GLOSSARIO_APP`)                                                   |
| **Quilombola**             | Sim/Não — `territorial.sobreposicao_quilombola`; nome opcional `territorial.nome_quilombola` (tooltip `GLOSSARIO_QUILOMBOLA`)  |
| **Fonte**                  | `timestamps.terras_indigenas` · «FUNAI / ICMBio»                                                                               |


### Card — Logística


| Linha              | Conteúdo                                                                               |
| ------------------ | -------------------------------------------------------------------------------------- |
| **Ferrovia**       | `territorial.nome_ferrovia` + `territorial.distancia_ferrovia_km` (ou texto sem infra) |
| **Porto**          | `territorial.nome_porto` + `territorial.distancia_porto_km`                            |
| **Sede municipal** | `processo.municipio` + `territorial.distancia_sede_municipal_km`                       |
| **Fonte**          | `timestamps.sigmine` · «DNIT / Antaq»                                                  |


### Card — Bioma


| Campo             | Origem                                                    |
| ----------------- | --------------------------------------------------------- |
| Nome              | `territorial.bioma`                                       |
| Texto explicativo | `biomaImplicacoes(territorial.bioma)` (derivado do bioma) |
| **Fonte**         | `timestamps.unidades_conservacao` · «IBGE / Biomas»       |


### Card — Aquífero


| Estado    | Conteúdo                                                                                                         |
| --------- | ---------------------------------------------------------------------------------------------------------------- |
| Com nome  | `territorial.nome_aquifero` · «Distância aproximada:» `territorial.distancia_aquifero_km` km (cor por distância) |
| Sem nome  | Mensagem «Nenhum aquífero relevante identificado»                                                                |
| **Fonte** | `timestamps.sigmine` · «CPRM / SGB»                                                                              |


---

## Subaba **Inteligência**

### Card — Contexto global


| Elemento            | Origem / comportamento                                                          |
| ------------------- | ------------------------------------------------------------------------------- |
| Título secção       | «Contexto global»                                                               |
| Destaque substância | `processo.substancia` (uppercase)                                               |
| **Reservas Brasil** | `intel_mineral.reservas_brasil_mundial_pct` % + barra + «das reservas mundiais» |
| **Produção Brasil** | `intel_mineral.producao_brasil_mundial_pct` % + barra + «da produção mundial»   |
| **Gap**             | Calculado (reservas − produção): texto «Gap: … p.p.» + parágrafo explicativo    |
| **Fonte**           | `timestamps.usgs` · «USGS Mineral Commodity Summaries»                          |


### Card — Preço e tendência


| Campo                 | Origem                                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Preço (modo onça)     | Se `intel_mineral.unidade_preco === 'oz'` e `preco_referencia_usd_oz`: USD/oz + linha «≈ USD/t» com `preco_medio_usd_t` |
| Preço (modo tonelada) | `intel_mineral.preco_medio_usd_t` USD/t                                                                                 |
| **Tendência**         | `intel_mineral.tendencia_preco` → badge Alta / Estável / Queda + ícone                                                  |
| Demanda 2030          | `intel_mineral.demanda_projetada_2030`                                                                                  |
| **Fonte**             | `timestamps.preco_spot` · «Trading Economics / LME · Projeção: IEA Critical Minerals Report 2025»                       |


### Card — Aplicações


| Campo     | Origem                                                 |
| --------- | ------------------------------------------------------ |
| Chips     | `intel_mineral.aplicacoes_principais[]`                |
| **Fonte** | `timestamps.usgs` · «USGS Mineral Commodity Summaries» |


### Card — Estratégia nacional


| Campo                   | Origem                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| Texto (bloco com borda) | `intel_mineral.estrategia_nacional`                                                                             |
| **Fonte**               | `timestamps.alertas_legislativos` · «MME / Plano Nacional de Mineração 2030 + Adoo (monitoramento regulatório)» |


### Container — Valor estimado da reserva *(não usa o componente `Card`; `div` estilizado)*


| Campo       | Origem                                                                 |
| ----------- | ---------------------------------------------------------------------- |
| Valor       | `intel_mineral.valor_estimado_usd_mi` (via `formatarUsdMiInteligente`) |
| Metodologia | `intel_mineral.metodologia_estimativa`                                 |
| **Fonte**   | `timestamps.sigmine` · «Estimativa Terrae / SIGMINE»                   |


### Card — Processos vizinhos (tabela)


| Coluna      | Origem                                                |
| ----------- | ----------------------------------------------------- |
| Nº processo | `v.numero`                                            |
| Titular     | `v.titular` (truncado + tooltip)                      |
| Fase        | `v.fase`                                              |
| DIST. (km)  | `v.distancia_km` (tooltip explica centroides SIGMINE) |
| RISK        | `v.risk_score` (cor por faixa)                        |


> Os campos `substancia` e `area_ha` existem no tipo `ProcessoVizinho` no mock, mas **não** aparecem na tabela deste drawer.

| **Fonte** | `timestamps.sigmine` · «ANM / SIGMINE» |

> **Campos em `IntelMineral` não usados nesta subaba:** `paises_concorrentes`, `potencial_reserva_estimado_t` (não há linha dedicada no layout atual).

---

## Subaba **Risco**

### Card — Risk Score (resumo)


| Campo                 | Origem                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Título                | «Risk Score»                                                                                                     |
| Valor total           | `processo.risk_score` ou «N/A» se null (tooltip com `RiskTotalCalcTooltipContent` quando há `risk_decomposicao`) |
| Classificação textual | `classificacaoRiscoTotal(processo.risk_score)` (Baixo / médio / alto)                                            |
| Barras por dimensão   | `processo.risk_breakdown`: geológico, ambiental, social, regulatório (0–100)                                     |
| **Fonte**             | `timestamps.cadastro_mineiro` · «Terrae, com dados ANM, FUNAI, ICMBio e IBGE»                                    |


### Card — Decomposição por dimensão *(condicional: `processo.risk_score !== null` e decomposição calculada)*

Componente `RiskDecomposicaoRelatorioPanel`:


| Elemento              | Conteúdo                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Barra de pesos        | Pesos 25% / 30% / 25% / 20% (Geo / Amb / Soc / Reg)                                                                                                                       |
| Acordeão por dimensão | **Geológico**, **Ambiental**, **Social**, **Regulatório**: score da dimensão, barra, expansão com lista de **variáveis** (`nome`, `valor`, `texto`, `fonte` por variável) |


### Card — Alertas regulatórios

Por item em `processo.alertas` (ordenados):


| Elemento         | Origem                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| Barra de impacto | `AlertaItemImpactoBar` (`nivel_impacto`)                                                                     |
| Título           | `alerta.titulo`                                                                                              |
| Link             | «Ver no Diário» (placeholder `#`, `console.log`)                                                             |
| Meta             | Label de relevância (tipo/nível) · `rotuloFontePublicacaoExibicao(fonte, fonte_diario)` · data `alerta.data` |
| Estado vazio     | «Nenhum alerta regulatório ativo»                                                                            |
| **Fonte**        | `timestamps.alertas_legislativos` · «Adoo»                                                                   |


---

## Subaba **Fiscal**

### Card — CAPAG (município)


| Campo       | Origem                                       |
| ----------- | -------------------------------------------- |
| Letra CAPAG | `fiscal.capag` (tooltip `textoTooltipCapag`) |
| Descrição   | `fiscal.capag_descricao`                     |
| Local       | `processo.municipio` / `processo.uf`         |
| **Fonte**   | `timestamps.siconfi` · «STN / SICONFI»       |


### Card — Indicadores financeiros (grid 3 colunas)


| Métrica                       | Origem                                                    |
| ----------------------------- | --------------------------------------------------------- |
| Receita própria               | `fiscal.receita_propria_mi` (Mi R$ → formatado BRL)       |
| Dívida consolidada            | `fiscal.divida_consolidada_mi`                            |
| PIB municipal                 | `fiscal.pib_municipal_mi`                                 |
| Dependência de transferências | `fiscal.dependencia_transferencias_pct` % (tooltip + cor) |
| **Fonte**                     | `timestamps.siconfi` · «STN / FINBRA»                     |


### Card — CFEM: processo vs. município *(condicional: há histórico de processo OU municipal)*


| Elemento           | Origem                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Título / subtítulo | Texto fixo sobre comparação arrecadação                                                                                          |
| Legenda barras     | «Este processo» vs «Município»                                                                                                   |
| Gráfico por ano    | `fiscal.cfem_historico` (`ano`, `valor_recolhido_brl`) vs `fiscal.cfem_municipal_historico` (`ano`, `valor_total_municipio_brl`) |
| Totais 5 anos      | Somas + texto «Este processo representa X% da CFEM municipal» ou «Este processo não gerou CFEM no período 2020-2024»             |
| **Fonte**          | Data máxima entre `timestamps.cfem` e `timestamps.cfem_municipal` · «ANM / CFEM»                                                 |


### Card — Incentivos estaduais


| Campo     | Origem                                               |
| --------- | ---------------------------------------------------- |
| Chips     | `fiscal.incentivos_estaduais[]`                      |
| **Fonte** | `timestamps.siconfi` · «Secretarias estaduais / STN» |


### Card — Linhas BNDES


| Campo     | Origem                                             |
| --------- | -------------------------------------------------- |
| Chips     | `fiscal.linhas_bndes[]`                            |
| **Fonte** | `timestamps.siconfi` · «BNDES / Linhas de crédito» |


### Card — Estimativa CFEM em operação


| Campo                      | Origem / regra                                            |
| -------------------------- | --------------------------------------------------------- |
| Regime bloqueio permanente | Texto fixo: processo bloqueado, sem operação              |
| Caso contrário             | `fiscal.estimativa_cfem_anual_operacao_mi` (Mi → BRL/ano) |
| Bloqueio provisório        | Nota «(projeção condicional ao levantamento do bloqueio)» |
| Texto explicativo          | «Estimativa de CFEM anual em fase de operação»            |
| Alíquota                   | `fiscal.aliquota_cfem_pct` %                              |
| **Fonte**                  | `timestamps.cfem` · «ANM / CFEM · Alíquotas»              |


> **Nota:** `fiscal.observacao` e `fiscal.cfem_total_5anos_mi` existem no tipo `DadosFiscaisRicos` no mock, mas **não** são renderizados como blocos separados neste drawer.

---

## Timestamps usados nos `FonteLabel` (referência)


| Chave em `timestamps`     | Uso típico no drawer                                    |
| ------------------------- | ------------------------------------------------------- |
| `cadastro_mineiro`        | Processo, despacho, pendências, observações, Risk Score |
| `sigmine`                 | Logística, aquífero, valor reserva, vizinhos            |
| `terras_indigenas`        | Áreas sensíveis                                         |
| `unidades_conservacao`    | Bioma                                                   |
| `usgs`                    | Contexto global, aplicações                             |
| `preco_spot`              | Preço e tendência                                       |
| `alertas_legislativos`    | Estratégia nacional, alertas legislativos               |
| `siconfi`                 | CAPAG, métricas financeiras, incentivos, BNDES          |
| `cfem` / `cfem_municipal` | CFEM (card comparativo + máximo data)                   |


---

*Gerado a partir da estrutura do componente em `RelatorioCompleto.tsx`.*