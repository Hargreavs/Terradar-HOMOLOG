# Card de oportunidade — “Ver cálculo” (tipografia, cores e formato)

Referência extraída de `src/components/dashboard/ProspeccaoResultados.tsx` (vista de drilldown ativa quando `drilldownOpen === processoId`), com funções de cor em `src/lib/opportunityScore.ts` e `qualificadorTextoValorVar` no próprio componente.

**Fonte:** herança global do app (ex.: `'Helvetica Neue', Helvetica, Arial, sans-serif` nos painéis do dashboard). Onde não há `fontFamily` inline, aplica-se a fonte do container pai.

Valores de `fontSize` em **px** (número React = px no DOM).

---

## 1. Cabeçalho do card (permanece visível acima do conteúdo “Ver cálculo”)

Faixa superior com gradiente; não faz parte do bloco que substitui o corpo, mas integra o mesmo card.

| Elemento | Tamanho | Peso | Cor | Outros |
|----------|---------|------|-----|--------|
| Posição no ranking (`#1`, `#2`, …) | 32px | 700 | `corFaixa` (ver § Cores dinâmicas — faixa) | `letterSpacing: -0.5`, `lineHeight: 1` |
| Score total (dentro do círculo) | 21px | 700 | `#F1EFE8` | — |
| Label da faixa (Alta, Moderada, …) | 14px | 600 | `corFaixa` | `textTransform: uppercase`, `letterSpacing: 0.5` |

**Container do cabeçalho**

- Fundo: `linear-gradient(135deg, ${corFaixa}25 0%, ${corFaixa}0A 100%)`
- Padding: `16px 20px`
- Cantos superiores: `12px` (alinhado ao `borderRadius` do card)

**Círculo do score**

- Tamanho: 50×50px, `borderRadius: 50%`
- Fundo: `${corFaixa}20` (hex 8 dígitos com alpha)
- Borda: `2px solid` + cor `corFaixa`
- Sombra: `0 0 16px ${corFaixa}40`

---

## 2. Painel “Ver cálculo” (substitui o corpo normal do card)

**Container do painel**

- Padding: `16px 20px 20px 20px`
- Fundo: `#1A1A18`

### 2.1 Título e texto de perfil

| Elemento | Tamanho | Peso | Cor | Espaçamento |
|----------|---------|------|-----|-------------|
| “Decomposição da Pontuação” | 14px | 600 | `#D3D1C7` | `marginBottom: 8px` |
| Linha “Perfil: … — Atratividade ×…% + …” | 15px | (padrão) | `#8A8880` | `marginBottom: 16px`, `lineHeight: 1.45` |

---

## 3. Blocos por dimensão (Atratividade, Viabilidade, Segurança)

Cada dimensão: botão de linha (expansível) + barra horizontal + acordeão de variáveis.

**Espaçamento vertical entre dimensões:** `marginBottom: 14px` entre a 1ª e 2ª; `14px` entre 2ª e 3ª; após a 3ª dimensão, `40px` antes do rodapé de pontuação.

### 3.1 Linha do botão (cabeçalho da dimensão)

- Botão: largura 100%, `padding: 6px 0`, sem borda, fundo transparente, cursor pointer.
- Ícone **ChevronRight** (lucide): tamanho **14px**, cor `#5F5E5A`; rota 90° quando expandido.

| Elemento | Tamanho | Peso | Cor |
|----------|---------|------|-----|
| Texto `Dimensão (peso%)` ex.: `Atratividade (40%)` | 14px | 700 | `#888780` |
| Valor numérico da dimensão (0–100) | 16px | 700 | `corMiniBarraValor(dim.v)` (ver § Cores dinâmicas — valor) |

### 3.2 Barra da dimensão (macro)

| Parte | Valor |
|-------|--------|
| Trilho | altura **5px**, fundo `#2C2C2A`, `borderRadius: 3px`, `marginTop: 4px` |
| Preenchimento | largura `%` = valor da dimensão; cor = `corMiniBarraValor(dim.v)`; `borderRadius: 3px` |

### 3.3 Acordeão de variáveis (quando expandido)

**Container da lista**

- Borda esquerda: `2px solid` + cor `${corMiniBarraValor(dim.v)}30` (hex de 8 caracteres: cor RGB + canal `30` em hexadecimal).
- `marginLeft: 20px`, `paddingLeft: 12px`
- `marginTop` animado: 10px quando expandido, 0 quando fechado

**Cada linha de variável**

| Elemento | Tamanho | Peso | Cor | Outros |
|----------|---------|------|-----|--------|
| Nome da variável | 14px | (padrão) | `#8A8880` | `lineHeight: 1.35` |
| Valor numérico | 14px | 600 | `corMiniBarraValor(valor)` | — |
| Qualificador (Baixo / Médio / Alto) | 14px | (padrão) | ver § Qualificador | `marginLeft: 6px` em relação ao valor |

**Barra fina por variável**

- Trilho: altura **3px**, `#2C2C2A`, `borderRadius: 2px`, `marginTop: 4px`
- Preenchimento: largura `%` = valor; cor `corMiniBarraValor(valor)`; `borderRadius: 2px`; `opacity: 0.7`

**Espaço entre linhas de variáveis:** `marginTop: 10px` a partir da segunda linha.

---

## 4. Rodapé do painel “Ver cálculo”

**Bloco “Pontuação final”**

- Separador superior: `borderTop: 1px solid #2C2C2A`
- `marginTop: 16px`, `paddingTop: 12px`
- Layout: flex, space-between, align center

| Elemento | Tamanho | Peso | Cor |
|----------|---------|------|-----|
| “Pontuação final” | 15px | 700 | `#888780` |
| Valor `scoreTotal` | 18px | 700 | `corFaixaOpportunity(r.faixa)` (ver § Cores dinâmicas — faixa) |

**Área do botão Voltar**

- Separador: `borderTop: 1px solid #2C2C2A`
- `marginTop: 16px`, `paddingTop: 14px`
- Gap entre botões (só “Voltar” neste modo): `10px`

| Elemento | Tamanho | Peso | Cor | Borda / fundo |
|----------|---------|------|-----|----------------|
| “Voltar” | 16px | 500 | `#B4B2A9` | `1px solid #5F5E5A`, `borderRadius: 6px`, `padding: 7px 14px`, fundo transparente |

**Hover (Voltar)** — via JS no elemento: borda `#888780`, texto `#F1EFE8`.

---

## 5. Cores dinâmicas (lógica no código)

### 5.1 Faixa de oportunidade — `corFaixaOpportunity(faixa)`

Usada no ranking, label da faixa, círculo/score do cabeçalho (como borda/fundo) e no valor grande de “Pontuação final”.

| Faixa (`r.faixa`) | Hex |
|-------------------|-----|
| alta | `#1D9E75` |
| moderada | `#E8A830` |
| baixa | `#888780` |
| desfavoravel | `#E24B4A` |

### 5.2 Valor 0–100 — `corMiniBarraValor(v)`

Usada nos números das dimensões, barras e variáveis.

| Intervalo | Hex |
|-----------|-----|
| v ≥ 70 | `#1D9E75` |
| 40 ≤ v < 70 | `#E8A830` |
| v < 40 | `#E24B4A` |

### 5.3 Qualificador textual — `qualificadorTextoValorVar(valor)`

| Intervalo | Label | Cor |
|-----------|-------|-----|
| valor < 30 | Baixo | `#E24B4A` |
| 30 ≤ valor < 60 | Médio | `#E8A830` |
| valor ≥ 60 | Alto | `#1D9E75` |

---

## 6. Formato / estrutura (resumo)

- Ordem vertical: **título** → **perfil/pesos** → **3 dimensões** (cada uma: rótulo + valor + barra + opcional lista de variáveis) → **Pontuação final** → **Voltar**.
- Largura: fluxo em coluna única dentro do padding do painel; textos de dimensão com `minWidth: 0` no grupo do chevron + label para permitir encolher.

---

## 7. Arquivo de origem

- `src/components/dashboard/ProspeccaoResultados.tsx` — ramo `drilldownOpen === r.processoId` (painel com “Decomposição da Pontuação”, dimensões, rodapé e “Voltar”); cabeçalho do card no mesmo ficheiro, imediatamente acima do wrapper de flip.
- `src/lib/opportunityScore.ts` — `corFaixaOpportunity`, `corMiniBarraValor`.
