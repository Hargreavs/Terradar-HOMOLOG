# Tamanhos de fonte — card de oportunidade (Prospecção)

Referência exportada do componente `src/components/dashboard/ProspeccaoResultados.tsx`, bloco do grid de resultados (`resultados.map`), incluindo cabeçalho do card, corpo, mini-barras, fatores, painel de drilldown (“Decomposição do Opportunity Score”) e ações quando o card está selecionado.

Valores em **px** (React `fontSize` numérico = pixels no DOM).

---

## Resumo por tamanho

| px  | Peso (quando fixo) | Onde aparece |
|-----|-------------------|--------------|
| 32  | 700               | Ranking `#1`, `#2`, … (canto superior esquerdo) |
| 21  | 700               | Score total dentro do círculo à direita do cabeçalho |
| 18  | 700               | Valor “Score final” no rodapé do drilldown (`{score}/100`) |
| 17  | 500               | Número do processo |
| 16  | 600 (só “Ver Relatório”) | Botões “Ver no Mapa” e “Ver Relatório” |
| 15  | herdado / texto   | Titular; linha município · UF · área (ha) |
| 14  | varia (500–700)   | Faixa (ALTA/MODERADA/…); chip substância; labels e valores das mini-barras; lista de fatores positivos/atenção; título do drilldown; marcadores ✓ e ● |
| 13  | varia             | Texto explicativo sob cada mini-barra (tooltip); texto de perfil/pesos no drilldown; linhas de dimensão no drilldown; label “Score final” |

---

## Detalhe por região do card

### Cabeçalho (faixa gradiente)

- **32px / 700** — Texto de posição `#n`
- **21px / 700** — Score numérico no círculo (`r.scoreTotal`)
- **14px / 600** — Label da faixa em maiúsculas (Alta, Moderada, …)

### Identificação do processo

- **17px / 500** — Número do processo
- **14px / 500** — Chip da substância (pill colorido)
- **15px** (sem peso explícito) — Titular
- **15px** — Município, UF e hectare

### Mini-barras (Atratividade, Viabilidade, Segurança)

- **14px / 700** — Nome da dimensão (coluna esquerda)
- **14px / 700** — Valor percentual à direita da barra
- **13px** — Texto descritivo logo abaixo da barra (uma linha por dimensão)

### Fatores (check e alerta)

- Container com **14px** — Textos dos fatores positivos e de atenção herdam este tamanho
- **14px** — Símbolos “✓” (positivo) e “●” (atenção)

### Drilldown (expandido — “Decomposição do Opportunity Score”)

- **14px / 600** — Título “Decomposição do Opportunity Score”
- **13px** — Parágrafo com perfil e percentuais de peso
- **13px / 500** — Linha “Dimensão (peso%)”
- **13px / 600** — Linha “valor/100 → contribui … pts”
- **13px** — Label “Score final”
- **18px / 700** — Valor final `…/100`

### Ações (card selecionado)

- **16px** — Botão “Ver no Mapa” (sem `fontWeight` explícito no estilo)
- **16px / 600** — Botão “Ver Relatório”

---

## Herança

- Nos blocos de fatores positivos/atenção, o texto após ✓/● não define `fontSize` próprio: usa **14px** do elemento pai.

---

## Arquivo de origem

- `src/components/dashboard/ProspeccaoResultados.tsx` — render do card a partir de `resultados.map` (aprox. linhas 544–932).
