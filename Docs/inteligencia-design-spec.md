# Terrae: especificação visual da tela Inteligência Mineral

Documento de referência para tipografia e cores usados na página **Inteligência** (`InteligenciaDashboard`), incluindo estilos globais em `src/index.css` (classes `terrae-intel-*`), cores de regime em `src/lib/regimes.ts` e cores semânticas definidas no próprio componente.

---

## 1. Padrão de tipo de fontes (família)

| Uso | Valor |
|-----|--------|
| **Corpo da página (Inteligência)** | `'Helvetica Neue', Helvetica, Arial, sans-serif` |

Aplicado no contentor principal do dashboard via `fontFamily` inline. Não há outra família tipográfica dedicada nesta tela.

**Pesos utilizados**

- **500** (`fontWeight: 500`): título principal, valores de KPI, rótulos de coluna da tabela, destaques numéricos, siglas de minerais, indicadores de ordenação, texto em pills ativos de gráfico, etc.
- **400** (padrão do navegador): parágrafos, células de tabela, subtítulos de KPI, corpo geral.

---

## 2. Padrão de tamanho de fontes

Valores em **px** (pixel), como no código.

| Tamanho (px) | Onde aparece |
|--------------|----------------|
| **32** | Valor numérico principal nos **cards KPI** (`KpiCard`). |
| **24** | Título da página (**H1**): «Inteligência Mineral». |
| **16** | Título do **tooltip** do gráfico de produção (ano); **sigla** do mineral em «Minerais estratégicos». |
| **15** | Rótulo (label) do **KPI** sob o valor grande. |
| **14** | Subtítulo do header; textos secundários; **eixo** X/Y do gráfico (Recharts); corpo da **tabela** (`fontSize` base); **input** de busca; botão **Exportar CSV** e badge de estatísticas no topo; valores no rodapé de paginação; linhas do tooltip de produção; contagem em barras por UF. |
| **13** | Nome de regime nas barras; código **UF** em destaque; titular no ranking; **badges** de regime / risk na tabela; meta-informação em minerais (preço, nº processos); células de dados «secundários» com cor `#D3D1C7`. |
| **12** | Título da secção **«Tabela de processos»** (uppercase); **cabeçalhos** da tabela (`Th`, `ThSort`); **pills** do gráfico (substâncias) e toggles «Por Área / Por Processos»; rótulos das **mini-barras** (% mundial); numeração do ranking. |
| **11** | Títulos de secção em **caixa alta** («Distribuição por regime», «Processos por estado», etc.) com `letter-spacing: 1.5px`; **pills** pequenas de substância no ranking; **footer** de créditos. |

**Espaçamento entre letras (letter-spacing)**

- **1.5px**: títulos de secção em uppercase (11px), exceto cabeçalho da tabela.
- **0.5px**: cabeçalhos de coluna da tabela (12px, uppercase).

**Transformação de texto**

- **uppercase**: rótulos de secção e cabeçalhos de tabela.

---

## 3. Padrão de hexadecimais (e rgba associados)

Cores agrupadas por função. Quando o código usa sufixo **`26`** em hex sobre uma cor de 6 dígitos (ex.: `#EF9F2726`), trata-se de **~15% de opacidade** em canal alfa (32 em decimal / 255).

### 3.1. Fundos (background)

| Hex | Uso na Inteligência |
|-----|---------------------|
| `#0D0D0C` | Fundo **principal** da página; fundo de **subcards** dentro de «Minerais estratégicos»; fundo do **thead** da tabela; fundo do **campo de busca**. |
| `#1A1A18` | Fundo dos **painéis/cards** principais; fundos de **linhas pares** da tabela; fundo do **tooltip** do gráfico; **track** da scrollbar (webkit / referência). |
| `#111110` | Fundo das **linhas ímpares** da tabela. |
| `#2C2C2A` | Trilho de **barras de progresso**; fundo de **pills inativas** do gráfico; fundo do toggle de ranking **selecionado**; **hover** de linha da tabela; trilho das mini-barras em minerais. |
| `#FFFFFF` | Não usado como fundo sólido principal; botão CSV usa `transparent` com borda branca. |

**RGBA (fundo)**

| Valor | Uso |
|-------|-----|
| `rgba(29, 158, 117, 0.15)` | Fundo do badge **Situação: Ativo** (equiv. a verde com ~15% opacidade). |
| `rgba(226, 75, 74, 0.15)` | Fundo do badge **Situação: Bloqueado**. |
| `rgba(136, 135, 128, 0.15)` | Fundo do badge **Situação: Inativo**. |

### 3.2. Textos

| Hex | Uso |
|-----|-----|
| `#F1EFE8` | Título H1; valores KPI em destaque (quando aplicável); texto principal em badges/links em hover (exportar); números no tooltip do gráfico; texto do **input** de busca; código UF em destaque; toggle de ranking ativo; ícone de ordenação em cabeçalho ativo. |
| `#D3D1C7` | Texto de **corpo** em linhas de regime; substância ao lado da sigla; células da tabela (substância, titular, UF, área, fase); linhas do tooltip do gráfico. |
| `#B4B2A9` | Títulos de **secção** (uppercase); cabeçalhos da **tabela** (Th / ThSort). |
| `#888780` | Subtítulo do header; meta textos ( contagens, ha ); eixos do gráfico; texto de pills **inativas** no gráfico; meta no rodapé da tabela; botões de paginação **habilitados**; tendência **Estável** em minerais; texto em pills do ranking; cor do **situação inativa**. |
| `#5F5E5A` | Subtítulo dos KPIs (label acinzentado); risk **nulo** (N/A e função `corRisk`); texto **desativado** (paginação); numeração do ranking; rótulos das mini-barras; ícone da **lupa** no campo de busca. |
| `#FFFFFF` | Texto e borda do **badge** de estatísticas no topo; texto e borda do botão **Exportar CSV** (estado normal). |

### 3.3. Bordas (stroke / border)

| Hex | Uso |
|-----|-----|
| `#2C2C2A` | Borda padrão dos painéis (`.terrae-intel-hover-panel`, `.terrae-intel-hover-subpanel`); borda do **input** de busca; **border-bottom** das células da tabela; **separadores** horizontais (1px) no header, entre linhas do ranking, **footer**; trilho de barras; borda de pills **inativas** do gráfico; eixos do gráfico (Recharts). |
| `#FFFFFF` | Borda do badge de topo e do botão Exportar CSV. |
| `transparent` | Borda inicial dos **toggles** de ranking (`.terrae-intel-rank-toggle`). |

**Hover / foco (definidos em CSS)**

| Hex | Uso |
|-----|-----|
| `#888780` | Borda dos painéis **ao hover**; borda do input **hover/focus-visible**; borda de pill inativa do gráfico **ao hover**. |
| `#6e6e6a` | Borda de **subpainel** ao hover. |
| `#f1efe8` | Borda do **stat badge** ao hover. |
| `#5f5e5a` | Borda do **rank toggle** ao hover. |

### 3.4. Gráfico (Recharts)

| Hex / valor | Uso |
|-------------|-----|
| `#2C2C2A` | `CartesianGrid` **stroke** (com `strokeOpacity: 0.3`); eixos **axisLine** / **tickLine**. |
| `#888780` | Cor dos **ticks** (números dos eixos). |

**Linhas de série** (espessura 2px, pontos 3px): cores por substância (ver secção 3.7).

### 3.5. Sombras

| Valor | Uso |
|-------|-----|
| `0 8px 24px rgba(0, 0, 0, 0.35)` | Sombra do **tooltip** do gráfico de produção. |
| `0 0 0 1px rgba(241, 239, 232, 0.22)` | **Box-shadow** do stat badge ao hover (anel suave). |

### 3.6. Scrollbar (área Inteligência)

| Hex | Uso |
|-----|-----|
| `#1a1a18` | Trilho da scrollbar. |
| `#4a4a48` | **Thumb** da scrollbar (visível ao hover do painel scrollável). |

### 3.7. Cores de dados / séries / semântica

**Substâncias no gráfico e pills (`SUB_KEYS`)**

| Hex | Mineral |
|-----|---------|
| `#378ADD` | Ferro |
| `#E24B4A` | Cobre |
| `#EF9F27` | Ouro |
| `#1D9E75` | Nióbio |
| `#0F6E56` | Terras Raras |

**KPIs (valores coloridos)**

| Hex | Uso |
|-----|-----|
| `#F1EFE8` | Total de processos. |
| `#EF9F27` | Hectares mapeados; risco médio. |
| `#0F6E56` | Substâncias críticas. |
| `#378ADD` | UFs cobertas. |

**Risk score** (`corRisk` / barras UF / badges)

| Hex | Significado |
|-----|-------------|
| `#1D9E75` | Baixo (`< 40`) |
| `#EF9F27` | Médio (`40–69`) |
| `#E24B4A` | Alto (`≥ 70`) |
| `#5F5E5A` | Sem valor (`null`) |

**Barras horizontais por regime**  
Cor de preenchimento vem dos dados mock (`r.cor`), alinhada tipicamente às cores de **regime** abaixo.

**Tendência de preço (minerais)**

| Hex | Estado |
|-----|--------|
| `#1D9E75` | Alta |
| `#888780` | Estável |
| `#E24B4A` | Queda |

**Mini-barras reservas/produção (% mundial)**

| Hex | Condição |
|-----|----------|
| `#1D9E75` | pct > 20 |
| `#EF9F27` | pct > 5 e ≤ 20 |
| `#5F5E5A` | pct ≤ 5 |

### 3.8. Regimes minerários (badges na tabela)

Definidos em `REGIME_COLORS` (`src/lib/regimes.ts`), usados como **cor do texto** e fundo com sufixo **`26`** (15% opacidade).

| Hex | Regime |
|-----|--------|
| `#378ADD` | Concessão de Lavra |
| `#1D9E75` | Autorização de Pesquisa |
| `#7F77DD` | Req. de Lavra |
| `#639922` | Licenciamento |
| `#0F6E56` | Mineral Estratégico |
| `#E24B4A` | Bloqueio Permanente |
| `#EF9F27` | Bloqueio Provisório |

### 3.9. Pills / badges: padrão de preenchimento

- **Ativo (gráfico)**: `backgroundColor: ${cor}26`, `border: 1px solid ${cor}`, `color: cor`.
- **Inativo (gráfico)**: fundo `#2C2C2A`, borda `#2C2C2A`, texto `#5F5E5A`.
- **Risk / UF**: fundo `${corRisk(...)}26`, texto = mesma cor sólida.
- **Regime (tabela)**: fundo `${REGIME_COLORS[regime]}26`, texto = `REGIME_COLORS[regime]`.
- **Ranking (substâncias)**: fundo `#2C2C2A`, texto `#888780`, `fontSize: 11`, `borderRadius: 4`, padding `3px 8px`.
- **Stat badge (header)**: texto `#FFFFFF`, borda `1px solid #FFFFFF`, `borderRadius: 6`.

### 3.10. Raios de borda (referência rápida)

| px | Elemento |
|----|----------|
| 8 | Painéis principais, tooltip gráfico |
| 6 | Subcards minerais, input busca, botões secundários, stat badge |
| 4 | Badges de tabela (regime, risk, situação), pill UF risk |
| 999 | Pills do gráfico e toggles de ranking (totalmente arredondados) |

---

## 4. Ficheiros de origem

- `src/components/dashboard/InteligenciaDashboard.tsx`: layout, inline styles, gráfico, tabela.
- `src/index.css`: classes `.terrae-intel-*` (bordas hover, scrollbar, transições).
- `src/lib/regimes.ts`: `REGIME_COLORS` para badges de regime na tabela.

---

*Última extração a partir do código do repositório Terrae. Ao alterar o componente, atualize este documento para manter a referência alinhada.*
