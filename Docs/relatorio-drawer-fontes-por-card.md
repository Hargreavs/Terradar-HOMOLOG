# Drawer “Ver relatório completo” — fontes por subaba e card

Referência ao código em `src/components/map/RelatorioCompleto.tsx` (e painéis filhos quando aplicável).  
O componente `FonteLabel` renderiza: **Atualizado em `DD/MM/AAAA` · Fonte: {texto}**, exceto quando a data ISO é inválida (mostra só **Fonte:**).

**Campo de data usado no rodapé:** coluna `dataIso` abaixo.

---

## Subaba **Processo**


| #   | Card / container (título ou conteúdo)                                                                                                                   | `dataIso`                     | Texto exibido após “Fonte:”                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Primeiro card: número do processo + situação + **grid** (Titular, Substância, Regime, Área, UF, Município, Fase, Ano de protocolo, Tempo de tramitação) | `timestamps.cadastro_mineiro` | **ANM / Cadastro Mineiro**                                                                                                        |
| 2   | **Último despacho ANM** (data, texto, link SEI)                                                                                                         | `timestamps.cadastro_mineiro` | **SEI-ANM**                                                                                                                       |
| 3   | **Pendências** (se lista não vazia)                                                                                                                     | `timestamps.cadastro_mineiro` | **ANM / Cadastro Mineiro**                                                                                                        |
| 4   | **Observações técnicas** (Ciclo regulatório / Identificação)                                                                                            | *(inline, não `FonteLabel`)*  | Rodapé: **SIGMINE / SEI-ANM** — data formatada a partir de `timestamps.cadastro_mineiro` (texto “Atualizado em …” quando há data) |


---

## Subaba **Território**


| #   | Card / container                                     | `dataIso`                         | Texto exibido após “Fonte:”        |
| --- | ---------------------------------------------------- | --------------------------------- | ---------------------------------- |
| 1   | **Áreas sensíveis** (TI, UC, APP, quilombola, etc.)  | `timestamps.terras_indigenas`     | **FUNAI · CNUC/MMA · INCRA · CAR** |
| 2   | **Logística** (ferrovia, rodovia, porto, sede)       | `timestamps.sigmine`              | **DNIT · ANTAQ · IBGE/OSM**        |
| 3   | **Bioma**                                            | `timestamps.unidades_conservacao` | **IBGE / Biomas**                  |
| 4   | **Hidrografia** (quando há aquífero)                 | `timestamps.cadastro_mineiro`     | **CPRM/SGB**                       |
| 5   | **Hidrografia** (quando “nenhum aquífero relevante”) | `timestamps.sigmine`              | **CPRM/SGB**                       |


---

## Subaba **Inteligência**


| #   | Card / container                                                         | `dataIso`                                                                                         | Texto exibido após “Fonte:”                                                                                                         |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Contexto global** (reservas/produção %, gap)                           | `timestamps.usgs`                                                                                 | **USGS Mineral Commodity Summaries**                                                                                                |
| 2   | **Preço e tendência** (demanda no mesmo card)                            | **Condicional:** `metadata.calculado_em` (10 primeiros caracteres) **ou** `timestamps.preco_spot` | **Condicional:** `metadata.fonte_demanda` **ou** fallback **Trading Economics / LME · Projeção: IEA Critical Minerals Report 2025** |
| 3   | **Aplicações**                                                           | `timestamps.usgs`                                                                                 | **USGS Mineral Commodity Summaries**                                                                                                |
| 4   | **Estratégia nacional**                                                  | `timestamps.alertas_legislativos`                                                                 | **MME / Plano Nacional de Mineração 2030 + Adoo (monitoramento regulatório)**                                                       |
| 5   | **Valor estimado da reserva** (`div`, não `Card`) — fórmula + disclaimer | `timestamps.sigmine`                                                                              | **Estimativa TERRADAR / SIGMINE**                                                                                                   |
| 6   | **Processos vizinhos** (tabela)                                          | `timestamps.sigmine`                                                                              | **ANM / SIGMINE**                                                                                                                   |


*Tooltip do cabeçalho da coluna DIST. (km): texto “fonte: SIGMINE/ANM” (não é `FonteLabel`).*

---

## Subaba **Risco**


| #   | Card / container                                                            | `dataIso`                         | Texto exibido após “Fonte:”                                                                                                  |
| --- | --------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Risk Score** (nota, breakdown, barras)                                    | `timestamps.cadastro_mineiro`     | **Terrae, com dados ANM, FUNAI, ICMBio e IBGE**                                                                              |
| 2   | **Painel de decomposição** (`RiskDecomposicaoRelatorioPanel`)               | —                                 | **Sem `FonteLabel` no rodapé.** Cada variável pode ter `fonte` própria no mock (exibida em tooltip `title` como “Fonte: …”). |
| 3   | **Alertas regulatórios** (lista; cada alerta mostra `fonte` + data do item) | `timestamps.alertas_legislativos` | **Adoo**                                                                                                                     |


---

## Subaba **Oportunidade**


| #   | Card / container                                            | `dataIso`                     | Texto exibido após “Fonte:”                                                                        |
| --- | ----------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | **Opportunity Score** (três perfis)                         | `timestamps.cadastro_mineiro` | **TERRADAR, com dados ANM, IBGE, Tesouro e USGS** (`noWrap` no `FonteLabel`)                       |
| 2   | **Decomposição** (`OportunidadeDecomposicaoRelatorioPanel`) | —                             | **Sem linha de rodapé “Fonte”** no painel.                                                         |
| 3   | **Análise TERRADAR** (bloco com `cruzamento`)               | —                             | **Não usa `FonteLabel`.** Rodapé interno: `**TERRADAR · {cruzamento.data}`** (data vinda do mock). |


---

## Subaba **Fiscal**


| #   | Card / container                                                              | `dataIso`                                                                         | Texto exibido após “Fonte:”     |
| --- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------- |
| 1   | **CAPAG** (nota + descrição + município/UF)                                   | `timestamps.siconfi`                                                              | **STN / SICONFI**               |
| 2   | **Indicadores** (receita própria, dívida, PIB, dependência de transferências) | `timestamps.siconfi`                                                              | **STN / FINBRA**                |
| 3   | **CFEM: processo vs. município**                                              | `max(timestamps.cfem, timestamps.cfem_municipal)` (string ISO, maior lexicamente) | **ANM / CFEM**                  |
| 4   | **Incentivos estaduais**                                                      | `timestamps.siconfi`                                                              | **Secretarias estaduais / STN** |
| 5   | **Linhas BNDES**                                                              | `timestamps.siconfi`                                                              | **BNDES / Linhas de crédito**   |
| 6   | **Estimativa CFEM em operação**                                               | `timestamps.cfem`                                                                 | **ANM / CFEM · Alíquotas**      |


---

## Observações

1. **Metadados do relatório** (`relatorio.metadata`): campos como `fonte_fiscal`, `fonte_precos`, … **não** substituem automaticamente os textos do `FonteLabel`; a exceção é **Inteligência → Preço e tendência** (demanda), que usa `metadata.fonte_demanda` e `metadata.calculado_em` quando existem.
2. **Datas** vêm de `RelatorioData.timestamps` no mock (`relatorio.mock.ts`), por processo.
3. Para **revisar** o que atualizar, alinhe cada linha desta tabela com as políticas de `metadata` e com as fontes reais dos dados mockados.

---

*Gerado a partir da estrutura do drawer em `RelatorioCompleto.tsx`.*