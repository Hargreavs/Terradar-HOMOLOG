# Terrae — Especificação visual e de conteúdo: tela Inteligência Mineral

Documento em texto estruturado (pode ser copiado integralmente para `.txt` / Notepad).  
Reflete a implementação em `src/components/dashboard/InteligenciaDashboard.tsx`, `src/index.css`, `tailwind.config.ts` e `src/lib/regimes.ts`.

---

## 1. Padrão de tipo de fontes (família)

- **Global (body e app):** `'Helvetica Neue', Helvetica, Arial, sans-serif`  
  Definido em `index.css` (`body`) e reforçado no container principal do dashboard (`InteligenciaDashboard`).
- **Não há** outra família tipográfica dedicada na tela; pesos usados: **500** (títulos médios, valores KPI, rótulos de destaque) e peso normal nos demais textos.

---

## 2. Padrão de tamanhos de fonte (px)

Valores observados na tela Inteligência (inline styles e eixos Recharts):

| Uso típico | Tamanho (px) |
|------------|----------------|
| Rodapé (fonte de dados) | 11 |
| Pills do gráfico de produção, toggles “Por Área / Por Processos”, ranking (posição #) | 12 |
| Cabeçalhos de tabela (`Th`, `ThSort`), chevron / ícones compactos em filtros | 12–13 |
| Títulos de secção em MAIÚSCULAS (“Distribuição por regime”, etc.), eixo X/Y do gráfico de linhas, muitos rótulos de linha de dados, subtítulo KPI vazio, mini-barras “Reservas/Produção”, badge de risk na UF | 13 |
| Ícone informativo ⓘ (`InfoTooltip`) | 14 |
| Texto de células da tabela, campo de busca, botão Exportar CSV, paginação, vários corpos de tooltip | 14 |
| Texto “principal” secundário (nomes de substância em minerais estratégicos, linhas do tooltip de produção) | 14–16 |
| Subtítulo do cabeçalho (“Visão consolidada…”), rótulos de filtro ativo nos botões, texto “Limpar filtros” vazio da tabela | 16 |
| Título H1 “Inteligência Mineral” | 24 |
| Valor numérico grande nos cartões KPI | 32 |

**Letter-spacing:** títulos de painel em caixa alta usam aprox. **1.5px**. Cabeçalhos de tabela: **0.5px**.

---

## 3. Paleta hexadecimal (elementos da tela)

### 3.1 Fundos

| Token / uso | Hex |
|-------------|-----|
| Fundo principal da página (scroll do dashboard) | `#0D0D0C` |
| Fundo secundário (alternância de linhas da tabela, estado inativo de alguns toggles) | `#111110` |
| Cards / painéis (`terrae-intel-hover-panel`), dropdowns, tooltip do gráfico de produção | `#1A1A18` |
| Trilho de barras horizontais (regime, UF, mini-barras %) | `#2C2C2A` |
| Cabeçalho da tabela (`thead`) | `#0D0D0C` |
| Subcards “Minerais estratégicos” (fundo interno) | `#0D0D0C` |

### 3.2 Texto

| Uso | Hex |
|-----|-----|
| Texto primário claro | `#F1EFE8` |
| Texto secundário | `#888780` |
| Texto terciário / desativado | `#5F5E5A` |
| Título de secção (referência de design system em `:root`) | `#B4B2A9` (ex.: estado vazio do ranking) |
| Texto “médio” / corpo em tooltips e vários rótulos | `#D3D1C7` |
| Branco puro (títulos de painel em caixa alta, botões ativos, bordas de filtro) | `#FFFFFF` |
| Ação “Limpar filtros” (estado vazio da tabela) | `#F1B85A` |

### 3.3 Bordas e traços (strokes)

| Uso | Hex |
|-----|-----|
| Borda padrão de painéis, inputs, tooltips, separadores | `#2C2C2A` |
| Hover de painéis (classe `terrae-intel-hover-panel`) | `#888780` |
| Hover de subpainéis | `#6E6E6A` |
| Grade do gráfico de linhas (CartesianGrid), eixos | `#2C2C2A` (com opacidade 0.3 na grade) |
| Ícones de estado vazio (barras, mapa, pódio, tabela) | `#A3A29A` |
| Checkbox vazio (multi-select) | `#2C2C2A` |

### 3.4 Marca Terrae (acentos e sliders em CSS global)

| Nome | Hex |
|------|-----|
| terrae-50 | `#FAEEDA` |
| terrae-100 | `#FAC775` |
| terrae-200 | `#EF9F27` |
| terrae-400 | `#BA7517` |
| terrae-600 | `#854F0B` |
| terrae-800 | `#633806` |
| terrae-900 | `#412402` |

### 3.5 Regimes minerários (barras, badges na tabela, `REGIME_COLORS`)

| Regime | Hex |
|--------|-----|
| Concessão de Lavra | `#378ADD` |
| Autorização de Pesquisa | `#1D9E75` |
| Req. de Lavra | `#7F77DD` |
| Licenciamento | `#639922` |
| Mineral Estratégico | `#0F6E56` |
| Bloqueio Permanente | `#E24B4A` |
| Bloqueio Provisório | `#EF9F27` |

### 3.6 Substâncias no gráfico de produção / pills de ranking

| Substância / série | Hex |
|--------------------|-----|
| Ferro | `#378ADD` |
| Cobre | `#E24B4A` |
| Ouro | `#EF9F27` |
| Nióbio | `#1D9E75` |
| Terras Raras (e aliações no ranking: Neodímio, Lítio, Disprósio, etc.) | `#0F6E56` |
| Pill sem cor mapeada (fallback) | fundo `#2C2C2A`, texto `#888780` |

### 3.7 Risk Score (barras UF, badges, KPI)

| Faixa | Hex |
|-------|-----|
| Sem score / neutro | `#5F5E5A` |
| Baixo (`< 40`) | `#1D9E75` |
| Médio (`40`–`69`) | `#EF9F27` |
| Alto (`≥ 70`) | `#E24B4A` |

**Nota:** na função `corBarraUf`, a barra de contagem por UF usa `< 70` para amarelo e `≥ 70` para vermelho (ligeiramente diferente do texto do KPI que cita `> 69` para médio).

### 3.8 Pills de filtros ativos (cabeçalho)

| Tipo de filtro | Cor da pill (texto, borda, fundo com sufixo `26` = ~15% opacidade em hex de 8 dígitos) |
|----------------|----------------------------------------------------------------------------------------|
| UF | `#EF9F27` |
| Substância | `#378ADD` |
| Período (mês início/fim) | `#7F77DD` |
| Regime | `#1D9E75` |

### 3.9 Sombras e overlays (rgba)

- Dropdowns / tooltip produção: `box-shadow: 0 8px 24px rgba(0,0,0,0.35)`
- Tooltips KPI / linha / info: `0 4px 16px rgba(0,0,0,0.45)`
- Badge KPI hover: `0 0 0 1px rgba(136, 135, 128, 0.2)`
- Fundo de badge de regime/substância na tabela: cor da série + `26` no final (ex.: `#378ADD26`)

### 3.10 Scrollbar (dashboard)

- Track: `#1A1A18`; thumb hover: `#4A4A48` (definido em `index.css` para `.terrae-intel-dashboard-scroll`).

---

## 4. Tooltips genéricos (aparência)

- **Larguras:** KPI e linha: 220px; Info ⓘ: 260px.
- **Fundo:** `#0D0D0C`; **borda:** `1px solid #2C2C2A`; **cantos:** 6px; **sombra:** ver item 3.9.
- **Texto:** KPI título `#F1EFE8` (peso 500), corpo `#888780`. Info ⓘ: `#D3D1C7`. Tooltip de linha (regime/UF): `#D3D1C7`.
- **Atraso (KPI e ⓘ):** 300 ms.

---

## 5. Textos dos informativos ⓘ (`InfoTooltip`)

Estes textos aparecem apenas ao passar o rato sobre o símbolo ⓘ ao lado do título correspondente (ou do rótulo do KPI de risco).

### 5.1 Produção histórica por substância

> O gráfico usa índice base 100, onde 100 representa a produção de cada substância em 2019. Valores acima de 100 indicam crescimento em relação a 2019; por exemplo, 150 significa 50% a mais que a produção de 2019. Substâncias com produção zero em 2019 são exibidas como 'sem produção' no ano base.

### 5.2 Risk Score (cartão KPI “Risco médio da carteira”)

> O Risk Score é um indicador proprietário do Terrae que varia de 0 a 100. É calculado ponderando quatro dimensões: Geológico (25%), Ambiental (30%), Social (25%) e Regulatório (20%). Abaixo de 40 é considerado baixo risco, entre 40 e 69 risco médio, acima de 70 alto risco.

### 5.3 Distribuição por regime

> Regime é a modalidade jurídica do título minerário outorgado pela ANM. Cada regime tem direitos e obrigações distintos. A Concessão de Lavra é o título definitivo para extração, enquanto a Autorização de Pesquisa permite apenas estudos geológicos.

### 5.4 Minerais estratégicos

> Minerais classificados pelo Decreto MME 11.892/2025 como críticos para a transição energética e segurança nacional brasileira. Recebem tratamento prioritário na ANM e são objeto de acordos internacionais com EUA e União Europeia.

---

## 6. Tooltips dos cartões KPI (hover no cartão inteiro)

**Título + corpo** (portal fixo, mesmo estilo da secção 4).

| Cartão (label visível) | Título do tooltip | Corpo do tooltip |
|------------------------|-------------------|------------------|
| Processos monitorados | Processos monitorados | Total de processos minerários ativos e bloqueados no universo monitorado pelo Terrae. Inclui todos os regimes: Concessão de Lavra, Autorização de Pesquisa, Req. de Lavra, Licenciamento e Mineral Estratégico. |
| Hectares mapeados | Hectares mapeados | Soma das áreas de todos os processos monitorados, em hectares. Representa a extensão territorial total sob análise pelo Terrae, equivalente à área georreferenciada no SIGMINE/ANM. |
| Risco médio da carteira | Risco médio da carteira | Média dos Risk Scores de todos os processos com score calculado. O Risk Score varia de 0 a 100 e pondera quatro dimensões: Geológico (25%), Ambiental (30%), Social (25%) e Regulatório (20%). |
| Substâncias críticas | Substâncias críticas | Número de substâncias classificadas pelo MME como minerais críticos para a transição energética e segurança nacional presentes nos processos monitorados. Incluem terras raras, nióbio e lítio. |
| Unidades federativas | Unidades federativas | Número de estados brasileiros com pelo menos um processo monitorado pelo Terrae. A cobertura atual inclui MG, PA, GO, BA, AM e MT. |

**Dados mostrados nos cartões (derivados dos processos após filtros):**

- Número total de processos; subtítulo: contagem ativos e bloqueados.
- Soma de `area_ha`; subtítulo: conversão aproximada para km².
- Média arredondada dos `risk_score` não nulos; se nenhum score, mostra “N/A”; subtítulo: contagens alto / baixo / médio segundo faixas acima.
- Contagem de siglas estratégicas distintas (Nd, Nb, Li, Dy, Pr, Tb) entre processos com `is_mineral_estrategico`; lista no subtítulo ou “N/D”.
- Número de UFs distintas e lista separada por “ · ”.

---

## 7. Gráficos e visualizações de dados (conteúdo, tooltips, dados)

### 7.1 Distribuição por regime (barras horizontais empilhadas em trilho)

**Contexto:** Mostra como os processos filtrados (exceto que o **filtro por regime não se aplica** a este bloco: usa `processosFiltratos(filtros, { skipRegime: true })`) se distribuem por modalidade de título.

**Elementos visuais:** Para cada regime (ordem fixa `REGIMES_ORDEM`), linha com nome do regime, barra proporcional ao **número de processos** (largura = percentual do máximo de contagem entre regimes), cor = `REGIME_COLORS`, coluna numérica de processos e coluna de **hectares totais** (`area_ha`) somados.

**Interação:** Clicar na barra alterna filtro global de regime (mesmo regime / limpar). Com outro regime selecionado, linhas não selecionadas ficam com opacidade reduzida.

**Informativo ⓘ:** ver secção 5.3.

**Tooltip ao pairar na linha (IntelLinhaTooltip):**  
Texto dinâmico, por regime:

`{count} processos de {label do regime} totalizando {area_ha formatado pt-BR} ha de área mapeada.`

**Estado vazio (sem processos com filtros atuais):** ícone de barras cinza, texto “Nenhum processo encontrado”.

---

### 7.2 Processos por estado (barras horizontais por UF)

**Contexto:** UFs fixas da lista `MG, PA, GO, BA, AM, MT`. Usa processos com **filtro de UF ignorado** (`skipUfs: true`) para sempre mostrar as seis UFs.

**Dados por linha:**

- Sigla da UF; barra de largura proporcional à contagem de processos na UF (máximo = maior contagem entre as seis).
- Cor da barra de preenchimento: cinza se contagem 0; cinza neutro se não há risk médio; senão cor por faixa de **risk médio** da UF (`corBarraUf`).
- Número de processos; pill ou texto de **Risk Score médio** arredondado entre processos com `risk_score` não nulo, ou “N/A” / “N/D” conforme regras especiais no código para AM/MT.

**Interação:** Clicar na linha alterna a UF no multi-filtro. Com UFs selecionadas, linhas não selecionadas com opacidade 0.4.

**Informativo ⓘ:** não há ⓘ neste painel.

**Tooltip ao pairar na linha:**

`{count} processos em {UF}. Risk Score médio: {média ou N/A} (baseado em {scoredCount} processos com score calculado).`

**Estado vazio:** “Nenhum estado com processos” (ícone de mapa).

---

### 7.3 Produção histórica por substância (gráfico de linhas — Recharts)

**Contexto:** Evolução anual de um **índice base 100 em 2019** para cinco séries: Ferro, Cobre, Ouro, Nióbio, Terras Raras.

**Fonte dos dados brutos:** `dashboardMock.producao_historica` (não é recalculada pelos filtros do dashboard; é estática no mock).

**Transformação:** Para cada ano e cada chave, valor exibido = `(produção_no_ano / produção_em_2019) * 100`, exceto Terras Raras: se base 2019 for 0 e houver produção posterior, a lógica usa 100 no primeiro ano com produção; se ambos zero, índice 0.

**Eixos:** X = ano; Y domínio inferior fixo **60**, superior automático. Grade horizontal discreta (`#2C2C2A` @ 0.3). Ticks `#888780` 13px.

**Pills:** Ligar/desligar séries; com filtro de substâncias ativo, só séries compatíveis com o mapeamento `chavesGraficoParaSubstancias` permanecem ativas (outras desativadas e com opacidade reduzida).

**Informativo ⓘ:** secção 5.1.

**Tooltip customizado (`ProducaoTooltip`):**

- Título: **ano** (label do eixo).
- Por série ativa: nome colorido, valor do índice (número com vírgula decimal pt-BR), e à direita:
  - “sem produção” (cinza `#5F5E5A`) se índice 0 ou valor inválido;
  - “estável” (`#888780`) se diferença ao 100 < 0.1;
  - variação `+X,X%` em verde `#1D9E75` ou `-X,X%` em vermelho `#E24B4A`.
- Rodapé do tooltip: `Índice base 100 = produção em 2019`.

**Subtítulo fixo abaixo do título do painel:** “Índice base 100 em 2019 (crescimento percentual)”.

---

### 7.4 Minerais estratégicos (cartões com mini-barras de percentual)

**Contexto:** Lista vinda de `dashboardMock.minerais_estrategicos` (dados de exemplo; **não** filtrados pelos filtros do topo).

**Por item:** Sigla (cor `#EF9F27`), nome da substância (`#D3D1C7`), etiqueta de tendência “Alta” (`#1D9E75`), “Estável” (`#888780`) ou “Queda” (`#E24B4A`).

**Mini-gráficos:**

- “Reservas: {pct}% mundial” e “Produção: {pct}% mundial” com trilho `#2C2C2A` e preenchimento colorido: verde `#1D9E75` se pct > 20, laranja `#EF9F27` se > 5, senão cinza `#5F5E5A`.

**Rodapé do cartão:** preço `USD {formatado}/t` e `{processos} processos`.

**Informativo ⓘ:** secção 5.4.

**Tooltip de biblioteca:** não há; apenas o ⓘ.

---

### 7.5 Ranking de titulares (lista ordenada, não Recharts)

**Contexto:** Agregação **dos processos já filtrados** por `titular`: contagem de processos, soma de `area_ha`, até 4 substâncias distintas, média de `risk_score` quando existir.

**Ordenação:** Botão “Por Área” (área decrescente) ou “Por Processos” (contagem decrescente).

**Cada linha:** posição, nome do titular (ellipsis), até duas pills de substância (cores `COR_SUBSTANCIA` ou fallback), valor principal em laranja (`#EF9F27`) mostrando ha ou número de processos, badge de risk médio (cores da secção 3.7 com fundo translúcido).

**Interação:** Clicar seleciona titular e filtra a tabela abaixo; ✕ limpa seleção. Linhas não selecionadas ficam esmaecidas quando há seleção.

**Tooltips:** nenhum tooltip de hover dedicado nas linhas do ranking.

**Estado vazio:** ícone de pódio, “Nenhum titular encontrado”, subtítulo “Ajuste os filtros para ver o ranking de titulares” (`#B4B2A9`).

---

### 7.6 Tabela de processos

**Contexto:** Lista paginada (10 linhas) dos processos do conjunto filtrado, opcionalmente restritos ao titular selecionado no ranking. Busca textual em número, titular e substância. Ordenação opcional por área, fase ou risk.

**Não é um gráfico**, mas concentra dados tabulares: Processo, Regime (badge colorido), Substância, Titular, UF, Área, Fase, Risk Score (badge ou N/A), Situação.

**Tooltips:** nenhum específico; linha clicável abre o processo no mapa.

**Estado vazio:** mensagem “Nenhum processo encontrado para os filtros selecionados” e botão “Limpar filtros” em `#F1B85A`.

---

## 8. Rodapé da página

Texto fixo (com data atual formatada em pt-BR):

`Dados: ANM/SIGMINE · FUNAI · ICMBio · STN · Adoo · Atualizado em {hoje}`

Estilo: 11px, cor `#5F5E5A`, borda superior `#2C2C2A`.

---

## 9. Notas de implementação (para manutenção)

- **Filtros cruzados:** Regime no painel 7.1 ignora o próprio filtro de regime; UF no 7.2 ignora o filtro de UF; KPIs, ranking e tabela usam o conjunto completo de filtros.
- **Produção histórica e minerais estratégicos** leem apenas o mock global, não o subconjunto filtrado de processos.
- Valores “N/A” e “N/D” indicam ausência de dado ou regra de exibição no código, conforme o contexto.

---

Fim do documento.
