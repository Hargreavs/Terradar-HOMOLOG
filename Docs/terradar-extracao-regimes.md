# TERRADAR - Extração de Código: Regimes

Documento gerado para análise externa. Conteúdo copiado do repositório sem alterações ao código-fonte.

---

## 1. Definições de Regimes

**Arquivo:** `src/lib/regimes.ts`

```ts
import type { Regime } from '../types'

export const REGIME_COLORS: Record<Regime, string> = {
  concessao_lavra: '#4A90B8',
  autorizacao_pesquisa: '#5B9A6F',
  req_lavra: '#8B7CB8',
  licenciamento: '#7A9B5A',
  mineral_estrategico: '#2D8B70',
  bloqueio_permanente: '#A85C5C',
  bloqueio_provisorio: '#C4915A',
}

/** Cores mais saturadas/brilhantes só para polígonos no mapa (contraste sobre satellite). */
export const REGIME_COLORS_MAP: Record<Regime, string> = {
  concessao_lavra: '#5AA3D4',
  autorizacao_pesquisa: '#6DBF82',
  req_lavra: '#A08FD4',
  licenciamento: '#8DB86A',
  mineral_estrategico: '#35B88A',
  bloqueio_provisorio: '#E0A96A',
  bloqueio_permanente: '#CC6B6B',
}

export const REGIME_LABELS: Record<Regime, string> = {
  concessao_lavra: 'Concessão de Lavra',
  autorizacao_pesquisa: 'Autorização de Pesquisa',
  req_lavra: 'Req. de Lavra',
  licenciamento: 'Licenciamento',
  mineral_estrategico: 'Mineral Estratégico',
  bloqueio_permanente: 'Bloqueio Permanente',
  bloqueio_provisorio: 'Bloqueio Provisório',
}

/** Ordem de pintura: primeiro = fundo */
export const REGIME_LAYER_ORDER: Regime[] = [
  'concessao_lavra',
  'autorizacao_pesquisa',
  'req_lavra',
  'licenciamento',
  'mineral_estrategico',
  'bloqueio_provisorio',
  'bloqueio_permanente',
]

/** Textos explicativos dos badges de regime (popup, relatório, dashboard, legenda). */
export const REGIME_BADGE_TOOLTIP: Record<Regime, string> = {
  concessao_lavra:
    'Autorização definitiva para exploração mineral, concedida pela ANM após aprovação do plano de aproveitamento econômico. Publicada no DOU. Representa o estágio mais avançado do processo minerário.',
  autorizacao_pesquisa:
    'Permissão para realizar pesquisa mineral na área, concedida pela ANM. Publicada no DOU. O titular tem prazo para apresentar relatório de pesquisa com os resultados. Etapa anterior à requisição de lavra.',
  req_lavra:
    'Pedido de concessão de lavra em análise pela ANM, após aprovação do relatório de pesquisa. Publicada no DOU. Etapa intermediária entre a pesquisa e a concessão definitiva.',
  licenciamento:
    'Regime simplificado para minerais de uso imediato na construção civil (areia, cascalho, argila, brita). A autorização é concedida pela prefeitura municipal, não pela ANM. O titular apenas registra na ANM. Publicada no diário oficial do município.',
  mineral_estrategico:
    'Área com ocorrência de minerais classificados como estratégicos pelo governo federal (nióbio, terras raras, lítio, entre outros). Sujeita a regras especiais de exploração e eventual prioridade governamental.',
  bloqueio_provisorio:
    'Área temporariamente impedida de avançar no processo de titularidade. Pode ser por pendência administrativa, sobreposição com terra indígena ou unidade de conservação, ou disputa judicial. A situação pode ser revertida, representando potencial oportunidade futura para outros investidores.',
  bloqueio_permanente:
    'A ANM indeferiu definitivamente o requerimento para esta área. O bloqueio pode ter sido por irregularidade específica do titular anterior (pendência judicial, questão ambiental) e não necessariamente da área em si. A área pode ficar disponível para novo requerimento por outra empresa.',
}
```

---

## 2. Cores e Ordem no Sidebar

**Arquivo:** `src/components/map/MapFiltersOverlay.tsx`

```tsx
import { useEffect, useLayoutEffect, useState } from 'react'
import type { Regime } from '../../types'

export const MIN_Y = 1960
export const MAX_Y = 2026

export const REGIME_PILL_ORDER: Regime[] = [
  'concessao_lavra',
  'autorizacao_pesquisa',
  'req_lavra',
  'licenciamento',
  'mineral_estrategico',
  'bloqueio_provisorio',
  'bloqueio_permanente',
]

export const REGIME_PILL_COLORS: Record<Regime, string> = {
  concessao_lavra: '#4A90B8',
  autorizacao_pesquisa: '#5B9A6F',
  req_lavra: '#8B7CB8',
  licenciamento: '#7A9B5A',
  mineral_estrategico: '#2D8B70',
  bloqueio_provisorio: '#C4915A',
  bloqueio_permanente: '#A85C5C',
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

const PAINEL_SLIDE_MS = 200

/**
 * Abertura: useLayoutEffect garante commit com o painel fora da tela antes do 1.º paint;
 * dois rAF marcam setAnimar(true) só depois desse frame (transição estável).
 * Fecho: useEffect deixa correr a animação de saída antes de desmontar.
 */
export function usePainelFiltrosAnimation(aberto: boolean) {
  const [montado, setMontado] = useState(false)
  const [animar, setAnimar] = useState(false)

  useLayoutEffect(() => {
    if (!aberto) return
    setMontado(true)
    setAnimar(false)
    let cancelled = false
    let innerRaf = 0
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => {
        if (!cancelled) setAnimar(true)
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(outerRaf)
      if (innerRaf) cancelAnimationFrame(innerRaf)
    }
  }, [aberto])

  useEffect(() => {
    if (aberto) return
    setAnimar(false)
    const t = window.setTimeout(() => setMontado(false), PAINEL_SLIDE_MS)
    return () => clearTimeout(t)
  }, [aberto])

  return { montado, animar }
}
```

---

## 3. Tipo Regime

**Arquivo:** `src/types/index.ts`

```ts
export type Regime =
  | 'concessao_lavra'
  | 'autorizacao_pesquisa'
  | 'req_lavra'
  | 'licenciamento'
  | 'mineral_estrategico'
  | 'bloqueio_permanente'
  | 'bloqueio_provisorio'

export type Fase =
  | 'requerimento'
  | 'pesquisa'
  | 'concessao'
  | 'lavra'
  | 'encerrado'

export interface RiskBreakdown {
  geologico: number
  ambiental: number
  social: number
  regulatorio: number
}

export type NivelImpacto = 1 | 2 | 3 | 4

export interface AlertaLegislativo {
  id: string
  fonte: 'DOU' | 'Câmara' | 'Senado' | 'DOE' | 'IBAMA' | 'ANM'
  /** Diário de publicação de origem (ex.: DOU, DOE-PA, DOM-Parauapebas), exibido como “via …”. */
  fonte_diario: string
  data: string
  titulo: string
  resumo: string
  nivel_impacto: NivelImpacto
  tipo_impacto: 'restritivo' | 'favoravel' | 'neutro' | 'incerto'
  urgencia: 'imediata' | 'medio_prazo' | 'longo_prazo'
}

export interface DadosFiscais {
  capag: 'A' | 'B' | 'C' | 'D'
  receita_propria_mi: number
  divida_consolidada_mi: number
  incentivos_estaduais: string[]
  linhas_bndes: string[]
  observacao: string
}

export interface Processo {
  id: string
  numero: string
  regime: Regime
  fase: Fase
  substancia: string
  is_mineral_estrategico: boolean
  titular: string
  area_ha: number
  uf: string
  municipio: string
  lat: number
  lng: number
  data_protocolo: string
  ano_protocolo: number
  situacao: 'ativo' | 'inativo' | 'bloqueado'
  risk_score: number | null
  risk_breakdown: RiskBreakdown | null
  /** Valor estimado das reservas (milhões USD). */
  valor_estimado_usd_mi: number
  /** Data do último despacho ANM (YYYY-MM-DD). */
  ultimo_despacho_data: string
  alertas: AlertaLegislativo[]
  fiscal: DadosFiscais
  geojson: GeoJSONPolygon
}

export interface GeoJSONPolygon {
  type: 'Feature'
  properties: { id: string }
  geometry: {
    type: 'Polygon'
    coordinates: number[][][]
  }
}

/** Valor de `filtros.uf` que exclui todos os processos do mapa. */
export const UF_FILTRO_NENHUM = '__TERRAE_UF_NENHUM__' as const

export interface FiltrosState {
  camadas: Record<Regime, boolean>
  substancias: string[]
  periodo: [number, number]
  uf: string | null
  municipio: string | null
  riskScoreMin: number
  riskScoreMax: number
  searchQuery: string
}
```

---

## 4. Dados Mock (amostra + valores únicos de regime)

**Arquivo:** `src/data/processos.mock.ts`

O ficheiro é extenso (funções de geração de polígonos, seeds, `processosMock`, etc.). O export público é:

```ts
export const processosMock: Processo[] = rawProcessos.map((p) => ({
  ...p,
  geojson: makePolygon(p.lat, p.lng, p.id),
}))

export const PROCESSOS_MOCK = processosMock
```

### Primeiros 3 processos completos (`PROCESSOS_MOCK[0]`, `[1]`, `[2]`)

Valores obtidos por execução do módulo (campos calculados incluídos). O campo `geojson.geometry.coordinates` é volumoso no código-fonte; abaixo usa-se o texto literal `[coordenadas omitidas nesta extração — ver ficheiro fonte]` apenas para legibilidade; na aplicação cada entrada contém o polígono completo.

```json
[
  {
    "id": "p1",
    "numero": "872.390/2012",
    "regime": "concessao_lavra",
    "fase": "lavra",
    "substancia": "FERRO",
    "is_mineral_estrategico": false,
    "titular": "Vale Mineração S.A.",
    "area_ha": 1240.5,
    "uf": "MG",
    "municipio": "Itabira",
    "lat": -19.62,
    "lng": -43.22,
    "data_protocolo": "2012-03-14",
    "ano_protocolo": 2012,
    "situacao": "ativo",
    "risk_score": 42,
    "risk_breakdown": {
      "geologico": 35,
      "ambiental": 45,
      "social": 40,
      "regulatorio": 48
    },
    "valor_estimado_usd_mi": 166,
    "ultimo_despacho_data": "2026-01-03",
    "alertas": [
      {
        "id": "bndes-finep-2025-03",
        "fonte": "DOU",
        "fonte_diario": "DOU",
        "data": "2025-03-05",
        "titulo": "Chamada pública BNDES/Finep: beneficiamento de minerais estratégicos",
        "resumo": "Financiamento não reembolsável e subvenção para plantas de beneficiamento de minerais estratégicos e terras raras.",
        "nivel_impacto": 3,
        "tipo_impacto": "favoravel",
        "urgencia": "imediata"
      }
    ],
    "fiscal": {
      "capag": "A",
      "receita_propria_mi": 138.8,
      "divida_consolidada_mi": 51.3,
      "incentivos_estaduais": [
        "ICMS Ecológico: redução para projetos com certificação ambiental",
        "Isenção parcial de ICMS para minerais estratégicos (convênio estadual)",
        "Linha BDMG mineração: garantias para capex de lavra e beneficiamento"
      ],
      "linhas_bndes": [
        "Finem",
        "Finame",
        "Proesco",
        "Nova Indústria Brasil"
      ],
      "observacao": "Base industrial madura; dívida consolidada histórica exige disciplina com novos incentivos."
    },
    "geojson": "[Feature com Polygon completo — ver src/data/processos.mock.ts]"
  },
  {
    "id": "p2",
    "numero": "841.102/2008",
    "regime": "concessao_lavra",
    "fase": "lavra",
    "substancia": "OURO",
    "is_mineral_estrategico": false,
    "titular": "St. George Mining Brasil",
    "area_ha": 892.3,
    "uf": "MG",
    "municipio": "Araxá",
    "lat": -19.59,
    "lng": -46.94,
    "data_protocolo": "2008-07-22",
    "ano_protocolo": 2008,
    "situacao": "ativo",
    "risk_score": 67,
    "risk_breakdown": {
      "geologico": 44,
      "ambiental": 80,
      "social": 74,
      "regulatorio": 68
    },
    "valor_estimado_usd_mi": 166,
    "ultimo_despacho_data": "2026-01-03",
    "alertas": [
      {
        "id": "lei-15190-2025",
        "fonte": "DOU",
        "fonte_diario": "DOU",
        "data": "2025-04-02",
        "titulo": "Lei 15.190/2025: Lei Geral do Licenciamento",
        "resumo": "Altera regras de consulta à FUNAI e licenciamento ambiental quando há sobreposição com TIs não homologadas.",
        "nivel_impacto": 2,
        "tipo_impacto": "restritivo",
        "urgencia": "imediata"
      }
    ],
    "fiscal": {
      "capag": "A",
      "receita_propria_mi": 138.8,
      "divida_consolidada_mi": 51.3,
      "incentivos_estaduais": [
        "ICMS Ecológico: redução para projetos com certificação ambiental",
        "Isenção parcial de ICMS para minerais estratégicos (convênio estadual)",
        "Linha BDMG mineração: garantias para capex de lavra e beneficiamento"
      ],
      "linhas_bndes": [
        "Finem",
        "Finame",
        "Proesco",
        "Nova Indústria Brasil"
      ],
      "observacao": "Base industrial madura; dívida consolidada histórica exige disciplina com novos incentivos."
    },
    "geojson": "[Feature com Polygon completo — ver src/data/processos.mock.ts]"
  },
  {
    "id": "p3",
    "numero": "910.445/2019",
    "regime": "concessao_lavra",
    "fase": "concessao",
    "substancia": "BAUXITA",
    "is_mineral_estrategico": false,
    "titular": "Companhia Brasileira de Metalurgia",
    "area_ha": 2104,
    "uf": "MG",
    "municipio": "Poços de Caldas",
    "lat": -21.84,
    "lng": -46.56,
    "data_protocolo": "2019-11-05",
    "ano_protocolo": 2019,
    "situacao": "ativo",
    "risk_score": 31,
    "risk_breakdown": {
      "geologico": 30,
      "ambiental": 35,
      "social": 28,
      "regulatorio": 32
    },
    "valor_estimado_usd_mi": 166,
    "ultimo_despacho_data": "2026-01-03",
    "alertas": [
      {
        "id": "pl-2197-2025",
        "fonte": "Câmara",
        "fonte_diario": "Câmara",
        "data": "2025-03-25",
        "titulo": "PL 2.197/2025: Política Nacional de Minerais Críticos",
        "resumo": "Prevê benefícios fiscais e linhas de crédito preferenciais para projetos de minerais críticos e cadeias de valor associadas.",
        "nivel_impacto": 3,
        "tipo_impacto": "favoravel",
        "urgencia": "medio_prazo"
      }
    ],
    "fiscal": {
      "capag": "A",
      "receita_propria_mi": 138.8,
      "divida_consolidada_mi": 51.3,
      "incentivos_estaduais": [
        "ICMS Ecológico: redução para projetos com certificação ambiental",
        "Isenção parcial de ICMS para minerais estratégicos (convênio estadual)",
        "Linha BDMG mineração: garantias para capex de lavra e beneficiamento"
      ],
      "linhas_bndes": [
        "Finem",
        "Finame",
        "Proesco",
        "Nova Indústria Brasil"
      ],
      "observacao": "Base industrial madura; dívida consolidada histórica exige disciplina com novos incentivos."
    },
    "geojson": "[Feature com Polygon completo — ver src/data/processos.mock.ts]"
  }
]
```

### Valores únicos de `regime` encontrados em `processosSeed` (array completo no ficheiro)

```ts
[
  'concessao_lavra',
  'autorizacao_pesquisa',
  'req_lavra',
  'licenciamento',
  'mineral_estrategico',
  'bloqueio_permanente',
  'bloqueio_provisorio',
]
```

*(Todos os valores literais de `Regime` aparecem pelo menos uma vez no seed.)*
