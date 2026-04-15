# localStorage e persistência (Terrae / Terradar)

Este repositório é o frontend **Terrae** (remoto `Terradar-HOMOLOG` no GitHub). Não existe pasta ou nome de produto **Terramar** no código: as chaves usam o prefixo **`terrae-`**. Se o objetivo for renomear o produto para “Terramar”, o passo natural é alterar o `name` do `persist` no Zustand e as chamadas `removeItem` para um prefixo novo (ex.: `terramar-filtros`) e documentar uma migração ou limpeza única no browser.

---

## 1. Chaves `localStorage` usadas

| Chave | Uso |
|--------|-----|
| **`terrae-filtros`** | Única chave de **persistência real** (Zustand `persist` no `useMapStore`). Contém um subconjunto de filtros do mapa + visibilidade das camadas geográficas. |
| **`terrae-processos`** | **Não é escrita** pela app atual. É **removida** ao iniciar o store (`loadProcessos`) para evitar estado antigo de processos; a lista vem sempre de `PROCESSOS_MOCK`. |

Não há `sessionStorage` nem outros `localStorage` nos ficheiros sob `src/` (além do que o próprio Zustand middleware grava na chave `terrae-filtros`).

---

## 2. Onde está o código

Ficheiro principal: `src/store/useMapStore.ts`.

Trechos relevantes:

- **Remoção da chave legada** (se existir):

```ts
function loadProcessos(): Processo[] {
  localStorage.removeItem('terrae-processos')
  return PROCESSOS_MOCK
}
```

- **Nome da chave de persistência** e **o que entra no JSON**:

```ts
persist(
  (set, get) => ({ /* estado */ }),
  {
    name: 'terrae-filtros',
    partialize: (s) => ({
      filtros: {
        camadas: s.filtros.camadas,
        periodo: s.filtros.periodo,
        riskScoreMin: s.filtros.riskScoreMin,
        riskScoreMax: s.filtros.riskScoreMax,
      },
      camadasGeo: s.camadasGeo,
    }),
    merge: (persistedState, currentState) => { /* ... */ },
  },
)
```

**Importante:** o comentário no ficheiro diz que só filtros “parciais” vão para o LS, mas na prática **`camadasGeo`** (overlays TI, UC, aquíferos, etc.) **também é persistido** no mesmo objeto.

---

## 3. Formato JSON guardado em `terrae-filtros`

O Zustand `persist` serializa o estado parcial. A forma típica (v3) é um objeto com `state` e `version`:

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

### 3.1 Campos de `filtros` **não** guardados no LS

Estes existem em memória e **reiniciam** ao recarregar a página (valores vêm de `defaultFiltros()` no `merge`):

- `substancias` — array (filtro multi-substância)
- `uf` — `string | null` (inclui `UF_FILTRO_NENHUM` quando “nenhum estado”)
- `municipio` — `string | null`
- `searchQuery` — texto da busca no mapa

Motivo (comentário no código): evitar que um F5 com busca/UF/etc. “partido” deixe o mapa vazio ou confuso.

### 3.2 `camadas` (regimes)

Chaves: union `Regime` em `src/types/index.ts`:

`concessao_lavra` | `autorizacao_pesquisa` | `req_lavra` | `licenciamento` | `lavra_garimpeira` | `registro_extracao` | `disponibilidade` | `mineral_estrategico` | `bloqueio_provisorio` | `bloqueio_permanente`

### 3.3 `camadasGeo` (overlays do mapa)

IDs estáveis (`CamadaGeoId` em `src/lib/mapCamadasGeo.ts`):

| ID persistido | Legenda UI |
|---------------|------------|
| `terras_indigenas` | Terras Indígenas |
| `unidades_conservacao` | Unidades de Conservação |
| `quilombolas` | Quilombolas |
| `app_car` | Áreas de Preservação |
| `aquiferos` | Aquíferos |
| `ferrovias` | Ferrovias |
| `portos` | Portos |

Ao renomear estes IDs no TypeScript, é obrigatório migrar ou limpar `localStorage` para não ficarem chaves órfãs no JSON.

---

## 4. Reidratação (`merge`)

No `merge`, o código:

1. Garante `camadas` de regime com `mergeCamadas`.
2. Garante `periodo` com `mergePeriodo`.
3. Garante `riskScoreMin` / `riskScoreMax` com `mergeRiskRange`.
4. Preenche `substancias`, `uf`, `municipio`, `searchQuery` a partir de **`defaultFiltros()`**.
5. Mescla `camadasGeo` com `mergeCamadasGeoPersisted`.
6. **Sempre** chama `loadProcessos()` → repõe `processos` a partir do mock e remove `terrae-processos`.

Ou seja: **não** há como persistir lista de processos via LS neste fluxo sem alterar código.

---

## 5. Estado que **nunca** vai para `localStorage`

Gerido só em memória (Zustand sem `partialize`):

- `processoSelecionado`, `flyTo`, `hoveredProcessoId`
- `relatorioDrawerAberto` (drawer “Relatório completo”)
- `pendingNavigation`, `intelTitularFilter`, `intelDrillRestoreFiltros`, `intelDrillExpectedFiltrosJson`

`useAppStore` (`src/store/useAppStore.ts`) também é só memória (tela ativa, Radar pendente, etc.).

---

## 6. Para o Claude ajustar: dados, polígonos e “cálculo” de simulação

### 6.1 Processos no mapa e risco

| Ficheiro | Conteúdo |
|----------|-----------|
| `src/data/processos.mock.ts` | Seeds `p1`…, `geojson` via `makePolygon`, `fiscal`, `risk_breakdown`, montagem de `PROCESSOS_MOCK`. |
| `src/lib/riskScoreDecomposicao.ts` | Decomposição do risk score (ambiental alinhado a camadas GeoJSON, social com CAPAG fixo, etc.). |

### 6.2 Polígonos das camadas (TI, UC, APP, …)

| Ficheiro / pasta | Conteúdo |
|------------------|----------|
| `src/data/camadas/geoImport.ts` | Importa os `.geojson` como raw string. |
| `src/data/camadas/terras-indigenas.geojson` | Feições TI (`properties.nome`, `etnia`, …). |
| `src/data/camadas/unidades-conservacao.geojson` | UC (`nome`, `categoria`, …). |
| `src/data/camadas/aquiferos.geojson`, `app-car.geojson`, `quilombolas.geojson`, `ferrovias.geojson`, `portos.geojson` | Idem. |

Coordenadas são **`[lng, lat]`** (GeoJSON). O mock ambiental cruza **bbox do processo** com bbox dessas feições (ver `ambientalDetalheMockFromProcesso`).

### 6.3 Relatório completo (simulação rica por processo)

| Ficheiro | Conteúdo |
|----------|-----------|
| `src/data/relatorio.mock.ts` | `relatoriosMock` — objeto indexado por **`processo.id`** (ex.: `p1`, `p20`), com ANM, territorial, fiscal rico, CFEM, textos, etc. |
| `src/components/map/RelatorioCompleto.tsx` | `relatoriosMock[processo.id]` para obter dados do relatório. |

Para “simulação de cálculo real” apresentada no relatório: estender interfaces em `relatorio.mock.ts` (ex.: novos blocos numéricos), preencher por `id`, e depois ligar novos campos na UI em `RelatorioCompleto.tsx`. Manter **o mesmo `id`** que em `processos.mock.ts`.

### 6.4 Renomear produto (ex.: Terramar)

Checklist sugerido:

1. `useMapStore` → `name: 'terramar-filtros'` (ou outro prefixo).
2. `localStorage.removeItem('terrae-processos')` → alinhar nome legado ou remover se não for usado.
3. Atualizar este documento e qualquer doc que cite `terrae-filtros`.
4. Opcional: `UF_FILTRO_NENHUM` e prefixos CSS `terrae-*` são outra camada (branding); não ficam no LS.

---

## 7. Inspeção manual no browser

1. Abrir DevTools → Application → Local Storage → origem da app.
2. Ler chave **`terrae-filtros`**.
3. Para “reset duro” de filtros/overlays: apagar a chave e recarregar (volta a defaults + mock de processos).

---

## 8. Referência rápida de tipos (`FiltrosState`)

Definido em `src/types/index.ts` (campos completos). O que **persiste** hoje é subconjunto + `camadasGeo`, conforme secção 2–3.
