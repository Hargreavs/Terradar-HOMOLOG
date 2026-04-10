import {
  ambientalDetalheMockFromId,
  gerarRiskDecomposicaoParaProcesso,
} from '../lib/riskScoreDecomposicao'
import type {
  AlertaLegislativo,
  DadosFiscais,
  GeoJSONPolygon,
  Processo,
  RiskBreakdown,
} from '../types'

type RawProcesso = Omit<Processo, 'geojson' | 'risk_decomposicao'>
type ProcessoSeed = Omit<
  RawProcesso,
  | 'risk_breakdown'
  | 'alertas'
  | 'fiscal'
  | 'valor_estimado_usd_mi'
  | 'ultimo_despacho_data'
>

/** [0, 1) determinístico a partir do id (hash simples). */
function hashUnit(id: string, salt: number): number {
  let h = 0
  const payload = `${id}\0${salt}`
  for (let i = 0; i < payload.length; i++) {
    h = (Math.imul(31, h) + payload.charCodeAt(i)) | 0
  }
  return (h >>> 0) / 0x1_0000_0000
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Converte vértices em offset (Δlng, Δlat) relativos ao centro para [lng, lat]. Fecha o anel. */
function closeRingLatLng(
  lat: number,
  lng: number,
  rel: [number, number][],
): [number, number][] {
  const ring = rel.map(([dx, dy]) => [lng + dx, lat + dy] as [number, number])
  const first = ring[0]!
  ring.push([first[0], first[1]])
  return ring
}

function rectRel(we: number, he: number): [number, number][] {
  return [
    [-we, -he],
    [we, -he],
    [we, he],
    [-we, he],
  ]
}

const N_SHAPE_KINDS = 12

/** Garante que cada `p1`…`p30` usa um tipo diferente em ciclo (não só hash → variância fraca). */
function shapeKindFromId(id: string): number {
  const m = /^p(\d+)$/.exec(id)
  const n = m ? parseInt(m[1], 10) : 1
  return ((n - 1) % N_SHAPE_KINDS + N_SHAPE_KINDS) % N_SHAPE_KINDS
}

/**
 * Ortogonal, simples, estável por id.
 * ~12 plantas + escala (we/he). Tipo vem do índice do id; parâmetros do hash.
 * Entalhes com amplitude forte para leitura ao zoom ~4–5.
 */
function makePolygon(lat: number, lng: number, id: string): GeoJSONPolygon {
  const u = (salt: number) => hashUnit(id, salt)

  const aspW = lerp(0.58, 1.42, u(10))
  const aspH = lerp(0.58, 1.42, u(11))
  const we = 0.25 * aspW
  const he = 0.2 * aspH

  const kind = shapeKindFromId(id)
  let rel: [number, number][]

  switch (kind) {
    case 0: {
      /* retângulo com proporção já dada por aspW/aspH */
      rel = rectRel(we, he)
      break
    }
    case 1: {
      /* L: entalhe à direita (x1 bem à esquerda de we → degrau visível) */
      const y1 = lerp(-0.45 * he, 0.48 * he, u(1))
      const x1 = lerp(-0.35 * we, 0.42 * we, u(2))
      rel = [
        [-we, -he],
        [we, -he],
        [we, y1],
        [x1, y1],
        [x1, he],
        [-we, he],
      ]
      break
    }
    case 2: {
      /* escadinha na base: patamar alto o suficiente */
      const xb = lerp(-0.48 * we, 0.12 * we, u(1))
      const yt = lerp(0.12 * he, 0.62 * he, u(2))
      const spanCore = lerp(0.22 * (2 * we), 0.48 * (2 * we), u(3))
      const xc = Math.min(we - 0.06 * we, xb + spanCore)
      rel = [
        [-we, -he],
        [xb, -he],
        [xb, yt],
        [xc, yt],
        [xc, -he],
        [we, -he],
        [we, he],
        [-we, he],
      ]
      break
    }
    case 3: {
      /* entalhe no topo */
      const xt = lerp(0.08 * we, 0.68 * we, u(1))
      const yt = lerp(-0.28 * he, 0.58 * he, u(2))
      rel = [
        [-we, -he],
        [we, -he],
        [we, he],
        [xt, he],
        [xt, yt],
        [-we, yt],
      ]
      break
    }
    case 4: {
      /* L espelhado: recorte na zona NW-interna */
      const xr = lerp(-0.08 * we, 0.58 * we, u(1))
      const ym = lerp(-0.42 * he, 0.52 * he, u(2))
      rel = [
        [-we, -he],
        [we, -he],
        [we, he],
        [xr, he],
        [xr, ym],
        [-we, ym],
      ]
      break
    }
    case 5: {
      /* duplo degrau na base: patamares bem separados */
      const p1 = -we + lerp(0.1 * (2 * we), 0.28 * (2 * we), u(1))
      const t1 = lerp(0.05 * he, 0.38 * he, u(2))
      const p2 = Math.min(
        we - 0.1 * we,
        p1 + lerp(0.16 * (2 * we), 0.32 * (2 * we), u(3)),
      )
      const t2 = Math.min(
        he - 0.1 * he,
        t1 + lerp(0.12 * (2 * he), 0.28 * (2 * he), u(4)),
      )
      const p3 = Math.min(
        we - 0.06 * we,
        p2 + lerp(0.12 * (2 * we), 0.3 * (2 * we), u(5)),
      )
      rel = [
        [-we, -he],
        [p1, -he],
        [p1, t1],
        [p2, t1],
        [p2, t2],
        [p3, t2],
        [p3, -he],
        [we, -he],
        [we, he],
        [-we, he],
      ]
      break
    }
    case 6: {
      /* quase quadrado: lado único (escala alinhada a we/he ~0,25) */
      const s = lerp(0.17, 0.3, u(12))
      rel = rectRel(s, s)
      break
    }
    case 7: {
      /* faixa horizontal larga e baixa */
      const ww = lerp(0.32, 0.42, u(13))
      const hh = lerp(0.065, 0.125, u(14))
      rel = rectRel(ww, hh)
      break
    }
    case 8: {
      /* faixa vertical alta e estreita */
      const ww = lerp(0.08, 0.14, u(15))
      const hh = lerp(0.28, 0.4, u(16))
      rel = rectRel(ww, hh)
      break
    }
    case 9: {
      /* escadinha no lado direito (degraus verticais) */
      const y1 = lerp(-0.32 * he, 0.12 * he, u(1))
      const dy = lerp(0.14 * (2 * he), 0.32 * (2 * he), u(2))
      const y2 = Math.min(he - 0.05 * he, y1 + dy)
      const x1 = lerp(0.22 * we, 0.55 * we, u(3))
      rel = [
        [-we, -he],
        [we, -he],
        [we, y1],
        [x1, y1],
        [x1, y2],
        [we, y2],
        [we, he],
        [-we, he],
      ]
      break
    }
    case 10: {
      /* “corte” num canto (bite retangular no NE) */
      const j = lerp(0.12 * (2 * we), 0.38 * (2 * we), u(1))
      const k = lerp(0.12 * (2 * he), 0.38 * (2 * he), u(2))
      rel = [
        [-we, -he],
        [we, -he],
        [we, he - k],
        [we - j, he - k],
        [we - j, he],
        [-we, he],
      ]
      break
    }
    default: {
      /* escadinha duplo no topo */
      const xa = lerp(-we + 0.02 * we, -we + 0.52 * (2 * we), u(17))
      const yu = lerp(0.22 * he, 0.78 * he, u(18))
      const xb = Math.min(
        we - 0.06 * we,
        xa + lerp(0.18 * (2 * we), 0.38 * (2 * we), u(19)),
      )
      const yv = Math.min(he - 0.06 * he, yu + lerp(0.1 * he, 0.26 * he, u(20)))
      if (xb <= xa + 1e-6 || yv <= yu + 1e-6) {
        rel = rectRel(we, he)
        break
      }
      rel = [
        [-we, -he],
        [we, -he],
        [we, he],
        [xb, he],
        [xb, yv],
        [xa, yv],
        [xa, yu],
        [-we, yu],
      ]
      break
    }
  }

  const ring = closeRingLatLng(lat, lng, rel)
  return {
    type: 'Feature' as const,
    id,
    properties: { id },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [ring],
    },
  } as GeoJSONPolygon
}

const CATALOGO_ALERTAS: Record<string, AlertaLegislativo> = {
  anm412: {
    id: 'anm-412-2025',
    fonte: 'ANM',
    fonte_diario: 'DOU',
    data: '2025-03-12',
    titulo: 'Portaria ANM nº 412/2025: lavra de minerais estratégicos',
    resumo:
      'Altera procedimentos para concessão de lavra de minerais estratégicos, com etapas adicionais de análise e documentação.',
    nivel_impacto: 1,
    tipo_impacto: 'restritivo',
    urgencia: 'imediata',
  },
  anm89: {
    id: 'anm-89-2025',
    fonte: 'ANM',
    fonte_diario: 'DOU',
    data: '2025-02-04',
    titulo: 'Resolução ANM nº 89/2025: área mínima em autorização de pesquisa',
    resumo:
      'Redefine critérios de área mínima e sobreposição para requerimentos de autorização de pesquisa mineral.',
    nivel_impacto: 1,
    tipo_impacto: 'neutro',
    urgencia: 'medio_prazo',
  },
  decretoMME: {
    id: 'mme-11892-2025',
    fonte: 'DOU',
    fonte_diario: 'DOU',
    data: '2025-01-28',
    titulo: 'Decreto MME 11.892/2025: minerais críticos',
    resumo:
      'Inclui cobre e bauxita na lista nacional de minerais críticos, com prioridade em políticas de suprimento e pesquisa.',
    nivel_impacto: 1,
    tipo_impacto: 'favoravel',
    urgencia: 'medio_prazo',
  },
  pec48: {
    id: 'pec-48-2023',
    fonte: 'Senado',
    fonte_diario: 'Senado',
    data: '2023-08-14',
    titulo: 'PEC 48/2023: marco temporal de terras indígenas',
    resumo:
      'Proposta em tramitação que restringe novos títulos minerários em áreas com sobreposição a terras indígenas não homologadas.',
    nivel_impacto: 2,
    tipo_impacto: 'restritivo',
    urgencia: 'longo_prazo',
  },
  lei15190: {
    id: 'lei-15190-2025',
    fonte: 'DOU',
    fonte_diario: 'DOU',
    data: '2025-04-02',
    titulo: 'Lei 15.190/2025: Lei Geral do Licenciamento',
    resumo:
      'Altera regras de consulta à FUNAI e licenciamento ambiental quando há sobreposição com TIs não homologadas.',
    nivel_impacto: 2,
    tipo_impacto: 'restritivo',
    urgencia: 'imediata',
  },
  ibama1234: {
    id: 'ibama-1234-2025',
    fonte: 'IBAMA',
    fonte_diario: 'DOU',
    data: '2025-05-18',
    titulo: 'Portaria IBAMA nº 1.234/2025: zona de amortecimento de UC',
    resumo:
      'Exige novo EIA ou complementação para empreendimentos em zona de amortecimento de unidades de conservação.',
    nivel_impacto: 2,
    tipo_impacto: 'restritivo',
    urgencia: 'medio_prazo',
  },
  pl2197: {
    id: 'pl-2197-2025',
    fonte: 'Câmara',
    fonte_diario: 'Câmara',
    data: '2025-03-25',
    titulo: 'PL 2.197/2025: Política Nacional de Minerais Críticos',
    resumo:
      'Prevê benefícios fiscais e linhas de crédito preferenciais para projetos de minerais críticos e cadeias de valor associadas.',
    nivel_impacto: 3,
    tipo_impacto: 'favoravel',
    urgencia: 'medio_prazo',
  },
  confaz88: {
    id: 'confaz-88-2025',
    fonte: 'DOU',
    fonte_diario: 'DOU',
    data: '2025-02-20',
    titulo: 'Convênio CONFAZ 88/2025: ICMS e terras raras (GO/MG)',
    resumo:
      'Redução de base de ICMS para exportação de concentrados de terras raras em operações sediadas em Goiás e Minas Gerais.',
    nivel_impacto: 3,
    tipo_impacto: 'favoravel',
    urgencia: 'imediata',
  },
  bndesFinep: {
    id: 'bndes-finep-2025-03',
    fonte: 'DOU',
    fonte_diario: 'DOU',
    data: '2025-03-05',
    titulo: 'Chamada pública BNDES/Finep: beneficiamento de minerais estratégicos',
    resumo:
      'Financiamento não reembolsável e subvenção para plantas de beneficiamento de minerais estratégicos e terras raras.',
    nivel_impacto: 3,
    tipo_impacto: 'favoravel',
    urgencia: 'imediata',
  },
  ferroviaNorteSul: {
    id: 'antt-norte-sul-2025',
    fonte: 'DOU',
    fonte_diario: 'DOU',
    data: '2025-06-10',
    titulo: 'Edital ANTT: Ferrovia Norte-Sul (Palmas–Anápolis)',
    resumo:
      'Concessão do trecho Palmas–Anápolis, com impacto positivo no escoamento de carga a granel nos entornos de GO e PA.',
    nivel_impacto: 4,
    tipo_impacto: 'favoravel',
    urgencia: 'longo_prazo',
  },
  aneelPA: {
    id: 'aneel-500kv-pa-2025',
    fonte: 'DOU',
    fonte_diario: 'DOU',
    data: '2025-04-30',
    titulo: 'Leilão ANEEL: linha de transmissão 500 kV no Pará',
    resumo:
      'Projeto de TLT em corredor estratégico no Pará, relevante para energização de projetos minerários e industriais.',
    nivel_impacto: 4,
    tipo_impacto: 'favoravel',
    urgencia: 'medio_prazo',
  },
}

/**
 * Sub-scores para o mock. O campo `ambiental` desta tabela é ignorado:
 * o valor usado é sempre `ambientalDetalheMockFromId(p.id).score` (soma binária com teto 100).
 */
const RISK_BY_ID: Record<string, RiskBreakdown> = {
  p1: { geologico: 35, ambiental: 45, social: 40, regulatorio: 48 },
  p2: { geologico: 44, ambiental: 80, social: 74, regulatorio: 68 },
  p3: { geologico: 30, ambiental: 35, social: 28, regulatorio: 32 },
  p4: { geologico: 22, ambiental: 16, social: 15, regulatorio: 18 },
  p5: { geologico: 40, ambiental: 64, social: 58, regulatorio: 60 },
  p6: { geologico: 34, ambiental: 54, social: 48, regulatorio: 56 },
  p7: { geologico: 38, ambiental: 86, social: 82, regulatorio: 78 },
  p8: { geologico: 28, ambiental: 42, social: 38, regulatorio: 50 },
  p9: { geologico: 48, ambiental: 72, social: 70, regulatorio: 52 },
  p10: { geologico: 10, ambiental: 72, social: 70, regulatorio: 12 },
  p11: { geologico: 42, ambiental: 64, social: 68, regulatorio: 34 },
  p12: { geologico: 36, ambiental: 78, social: 80, regulatorio: 24 },
  p13: { geologico: 4, ambiental: 62, social: 60, regulatorio: 8 },
  p14: { geologico: 56, ambiental: 85, social: 88, regulatorio: 62 },
  p15: { geologico: 75, ambiental: 84, social: 82, regulatorio: 84 },
  p16: { geologico: 65, ambiental: 72, social: 68, regulatorio: 72 },
  p17: { geologico: 72, ambiental: 82, social: 78, regulatorio: 78 },
  p18: { geologico: 48, ambiental: 44, social: 38, regulatorio: 35 },
  p19: { geologico: 35, ambiental: 28, social: 26, regulatorio: 28 },
  p20: { geologico: 55, ambiental: 50, social: 48, regulatorio: 54 },
  p21: { geologico: 96, ambiental: 97, social: 94, regulatorio: 40 },
  p22: { geologico: 95, ambiental: 93, social: 91, regulatorio: 24 },
  p23: { geologico: 100, ambiental: 100, social: 98, regulatorio: 39 },
  p24: { geologico: 97, ambiental: 93, social: 91, regulatorio: 37 },
  /* AM, bloqueio permanente: risco 85–95, TIs/UCs */
  p25: { geologico: 60, ambiental: 96, social: 92, regulatorio: 90 },
  p26: { geologico: 62, ambiental: 97, social: 93, regulatorio: 91 },
  p27: { geologico: 60, ambiental: 97, social: 94, regulatorio: 90 },
  /* MT, bloqueio provisório: 70–72 (cruza faixa MT 55–72 e provisório 70–82) */
  p28: { geologico: 56, ambiental: 83, social: 66, regulatorio: 73 },
  p29: { geologico: 56, ambiental: 85, social: 66, regulatorio: 74 },
  p30: { geologico: 58, ambiental: 85, social: 67, regulatorio: 76 },
}

function pontuacaoRiscoMedia(b: RiskBreakdown): number {
  return Math.round(
    b.geologico * 0.25 + b.ambiental * 0.3 + b.social * 0.25 + b.regulatorio * 0.2,
  )
}

function processoBloqueadoParaRisco(p: ProcessoSeed): boolean {
  return (
    p.situacao === 'bloqueado' ||
    p.regime === 'bloqueio_permanente' ||
    p.regime === 'bloqueio_provisorio'
  )
}

function riskBreakdownPara(p: ProcessoSeed): RiskBreakdown {
  const b = RISK_BY_ID[p.id]
  const ambScore = ambientalDetalheMockFromId(p.id).score
  if (b) return { ...b, ambiental: ambScore }
  return { geologico: 50, ambiental: ambScore, social: 50, regulatorio: 50 }
}

function pickAlertas(p: ProcessoSeed): AlertaLegislativo[] {
  const C = CATALOGO_ALERTAS

  if (p.regime === 'bloqueio_permanente') {
    return [C.lei15190, C.ibama1234, C.anm89]
  }
  if (p.regime === 'bloqueio_provisorio') {
    return [C.pec48, C.decretoMME]
  }

  if (processoBloqueadoParaRisco(p)) return []

  const pool: AlertaLegislativo[] = []

  pool.push(C.anm89, C.lei15190)

  if (p.uf === 'PA' || p.uf === 'AM') pool.push(C.pec48, C.ibama1234)
  if (p.uf === 'PA') pool.push(C.aneelPA)
  if (p.uf === 'PA' || p.uf === 'GO') pool.push(C.ferroviaNorteSul)
  if (p.uf === 'GO' || p.uf === 'MG') pool.push(C.confaz88)

  if (p.regime === 'mineral_estrategico' || p.is_mineral_estrategico) {
    pool.push(C.anm412, C.decretoMME, C.pl2197, C.bndesFinep)
  } else {
    pool.push(C.pl2197, C.bndesFinep)
  }

  if (p.uf === 'BA') pool.push(C.decretoMME)

  const seen = new Set<string>()
  const unique = pool.filter((a) =>
    seen.has(a.id) ? false : (seen.add(a.id), true),
  )

  unique.sort(
    (a, b) => hashUnit(`${p.id}:${a.id}`, 0) - hashUnit(`${p.id}:${b.id}`, 0),
  )

  const count = 1 + Math.floor(hashUnit(p.id, 88) * 4)
  return unique.slice(0, Math.min(count, unique.length))
}

function lerpMi(lo: number, hi: number, t: number): number {
  return Math.round((lo + (hi - lo) * t) * 10) / 10
}

function fiscalPara(p: ProcessoSeed): DadosFiscais {
  const u = (s: number) => hashUnit(p.id, s)
  const m = p.municipio

  const base = (
    capag: DadosFiscais['capag'],
    rLo: number,
    rHi: number,
    incentivos: string[],
    linhas: string[],
    observacao: string,
  ): DadosFiscais => {
    const receita = lerpMi(rLo, rHi, u(40))
    const divida = lerpMi(receita * 0.35, receita * 1.15, u(41))
    return {
      capag,
      receita_propria_mi: receita,
      divida_consolidada_mi: divida,
      incentivos_estaduais: [...incentivos],
      linhas_bndes: [...linhas],
      observacao,
    }
  }

  if (
    ['Marabá', 'Parauapebas', 'Redenção', 'Altamira', 'Tucuruí', 'Santarém'].includes(
      m,
    )
  ) {
    return base(
      u(42) < 0.55 ? 'B' : 'C',
      180,
      420,
      [
        'Redução de 60% na base de ICMS para mineração (programa estadual)',
        'Isenção de IPTU para instalações industriais vinculadas ao polo mineral',
      ],
      ['Finem Mineração', 'Nova Indústria Brasil', 'Finame Equipamentos'],
      'Município paraense com forte dependência de royalties de mineração e ferrovia; monitorar repasse de FPM e FEX.',
    )
  }

  if (
    ['Catalão', 'Minaçu', 'Niquelândia', 'Alto Horizonte', 'Barro Alto', 'Goiás'].includes(
      m,
    )
  ) {
    return base(
      u(42) < 0.45 ? 'A' : 'B',
      85,
      340,
      [
        'Convênio CONFAZ 88/2025: redução de ICMS para cadeia de terras raras',
        'PRODUZIR GO: apoio a projetos industriais com minerais metálicos',
      ],
      ['Finem Mineração', 'Finame', 'Nova Indústria Brasil'],
      'Capacidade fiscal estável; terras raras e níquel concentram incentivos estaduais e demanda por Finem.',
    )
  }

  if (
    [
      'Itabira',
      'Araxá',
      'Poços de Caldas',
      'Montes Claros',
      'Diamantina',
      'Paracatu',
      'Governador Valadares',
      'Uberlândia',
    ].includes(m)
  ) {
    return base(
      u(42) < 0.5 ? 'A' : 'B',
      120,
      890,
      [
        'ICMS Ecológico: redução para projetos com certificação ambiental',
        'Isenção parcial de ICMS para minerais estratégicos (convênio estadual)',
        'Linha BDMG mineração: garantias para capex de lavra e beneficiamento',
      ],
      ['Finem', 'Finame', 'Proesco', 'Nova Indústria Brasil'],
      'Base industrial madura; dívida consolidada histórica exige disciplina com novos incentivos.',
    )
  }

  if (['Irecê', 'Jacobina', 'Brumado', 'Caetité'].includes(m)) {
    return base(
      u(42) < 0.5 ? 'B' : 'C',
      65,
      180,
      [
        'DESENVOLVE BA: subvenção a investimentos em mineração e logística',
        'Redução de ICMS na exportação de minérios e concentrados',
      ],
      ['Finem Mineração', 'Nova Indústria Brasil'],
      'Receita própria sensível a commodities; minerais críticos ampliam janela de incentivos estaduais.',
    )
  }

  if (
    ['Presidente Figueiredo', 'Itacoatiara', 'Barcelos'].includes(m)
  ) {
    return base(
      u(42) < 0.4 ? 'C' : 'D',
      40,
      120,
      [
        'Zona Franca de Manaus: isenção de IPI e II para equipamentos importados',
        'Redução de ICMS estadual (55–100%) para insumos industriais na cadeia mineral',
      ],
      ['Finem', 'Finame', 'FNO Amazônia'],
      'Capacidade de pagamento limitada; projetos dependem de FNO e de garantias federais.',
    )
  }

  if (
    ['Guarantã do Norte', 'Peixoto de Azevedo', 'Alta Floresta'].includes(m)
  ) {
    return base(
      u(42) < 0.5 ? 'B' : 'C',
      75,
      160,
      [
        'PRODEI MT: apoio a instalações industriais no interior',
        'Redução de base de ICMS para mineração e logística associada',
      ],
      ['Finem Mineração', 'FCO Industrial', 'Finame'],
      'Municípios de fronteira agrícola-mineral; FCO é canal relevante para PME da cadeia.',
    )
  }

  return base(
    'B',
    90,
    280,
    ['Programas estaduais de apoio à mineração (genérico)'],
    ['Finem Mineração', 'Finame'],
    'Perfil fiscal genérico para município fora das matrizes regionais do mock.',
  )
}

const processosSeed: ProcessoSeed[] = [
  {
    id: 'p1',
    numero: '872.390/2012',
    regime: 'concessao_lavra',
    fase: 'lavra',
    substancia: 'FERRO',
    is_mineral_estrategico: false,
    titular: 'Vale Mineração S.A.',
    area_ha: 1240.5,
    uf: 'MG',
    municipio: 'Itabira',
    lat: -19.62,
    lng: -43.22,
    data_protocolo: '2012-03-14',
    ano_protocolo: 2012,
    situacao: 'ativo',
    risk_score: 42,
  },
  {
    id: 'p2',
    numero: '841.102/2008',
    regime: 'concessao_lavra',
    fase: 'lavra',
    substancia: 'OURO',
    is_mineral_estrategico: false,
    titular: 'St. George Mining Brasil',
    area_ha: 892.3,
    uf: 'MG',
    municipio: 'Araxá',
    lat: -19.59,
    lng: -46.94,
    data_protocolo: '2008-07-22',
    ano_protocolo: 2008,
    situacao: 'ativo',
    risk_score: 67,
  },
  {
    id: 'p3',
    numero: '910.445/2019',
    regime: 'concessao_lavra',
    fase: 'concessao',
    substancia: 'BAUXITA',
    is_mineral_estrategico: false,
    titular: 'Companhia Brasileira de Metalurgia',
    area_ha: 2104.0,
    uf: 'MG',
    municipio: 'Poços de Caldas',
    lat: -21.84,
    lng: -46.56,
    data_protocolo: '2019-11-05',
    ano_protocolo: 2019,
    situacao: 'ativo',
    risk_score: 31,
  },
  {
    id: 'p4',
    numero: '798.201/2001',
    regime: 'concessao_lavra',
    fase: 'encerrado',
    substancia: 'COBRE',
    is_mineral_estrategico: false,
    titular: 'Atlas Critical Minerals Brasil',
    area_ha: 456.7,
    uf: 'MG',
    municipio: 'Montes Claros',
    lat: -16.73,
    lng: -43.86,
    data_protocolo: '2001-04-18',
    ano_protocolo: 2001,
    situacao: 'inativo',
    risk_score: 18,
  },
  {
    id: 'p5',
    numero: '883.667/2015',
    regime: 'concessao_lavra',
    fase: 'lavra',
    substancia: 'QUARTZO',
    is_mineral_estrategico: false,
    titular: 'Serra Verde Mining Ltda.',
    area_ha: 334.2,
    uf: 'MG',
    municipio: 'Diamantina',
    lat: -18.24,
    lng: -43.6,
    data_protocolo: '2015-09-30',
    ano_protocolo: 2015,
    situacao: 'ativo',
    risk_score: 55,
  },
  {
    id: 'p6',
    numero: '756.012/1995',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'FERRO',
    is_mineral_estrategico: false,
    titular: 'Viridis Recursos Minerais Ltda.',
    area_ha: 982.0,
    uf: 'MG',
    municipio: 'Paracatu',
    lat: -17.22,
    lng: -46.87,
    data_protocolo: '1995-02-10',
    ano_protocolo: 1995,
    situacao: 'ativo',
    risk_score: 48,
  },
  {
    id: 'p7',
    numero: '901.223/2018',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'OURO',
    is_mineral_estrategico: false,
    titular: 'Vale Mineração S.A.',
    area_ha: 1205.4,
    uf: 'MG',
    municipio: 'Governador Valadares',
    lat: -18.86,
    lng: -41.94,
    data_protocolo: '2018-06-12',
    ano_protocolo: 2018,
    situacao: 'ativo',
    risk_score: 72,
  },
  {
    id: 'p8',
    numero: '822.556/2005',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'BAUXITA',
    is_mineral_estrategico: false,
    titular: 'Companhia Brasileira de Metalurgia',
    area_ha: 678.9,
    uf: 'MG',
    municipio: 'Uberlândia',
    lat: -18.92,
    lng: -48.28,
    data_protocolo: '2005-08-25',
    ano_protocolo: 2005,
    situacao: 'ativo',
    risk_score: 39,
  },
  {
    id: 'p9',
    numero: '934.881/2021',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'COBRE',
    is_mineral_estrategico: false,
    titular: 'St. George Mining Brasil',
    area_ha: 445.1,
    uf: 'PA',
    municipio: 'Marabá',
    lat: -5.37,
    lng: -49.12,
    data_protocolo: '2021-01-19',
    ano_protocolo: 2021,
    situacao: 'ativo',
    risk_score: 61,
  },
  {
    id: 'p10',
    numero: '888.334/2016',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'QUARTZO',
    is_mineral_estrategico: false,
    titular: 'Atlas Critical Minerals Brasil',
    area_ha: 512.6,
    uf: 'PA',
    municipio: 'Parauapebas',
    lat: -6.07,
    lng: -49.9,
    data_protocolo: '2016-10-03',
    ano_protocolo: 2016,
    situacao: 'ativo',
    risk_score: 44,
  },
  {
    id: 'p11',
    numero: '845.991/2009',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'FERRO',
    is_mineral_estrategico: false,
    titular: 'Serra Verde Mining Ltda.',
    area_ha: 1334.8,
    uf: 'PA',
    municipio: 'Redenção',
    lat: -8.03,
    lng: -50.03,
    data_protocolo: '2009-05-27',
    ano_protocolo: 2009,
    situacao: 'ativo',
    risk_score: 53,
  },
  {
    id: 'p12',
    numero: '912.007/2019',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'OURO',
    is_mineral_estrategico: false,
    titular: 'Viridis Recursos Minerais Ltda.',
    area_ha: 721.3,
    uf: 'PA',
    municipio: 'Altamira',
    lat: -3.2,
    lng: -52.21,
    data_protocolo: '2019-04-08',
    ano_protocolo: 2019,
    situacao: 'ativo',
    risk_score: 58,
  },
  {
    id: 'p13',
    numero: '771.448/1998',
    regime: 'autorizacao_pesquisa',
    fase: 'pesquisa',
    substancia: 'BAUXITA',
    is_mineral_estrategico: false,
    titular: 'Vale Mineração S.A.',
    area_ha: 889.0,
    uf: 'PA',
    municipio: 'Tucuruí',
    lat: -3.77,
    lng: -49.67,
    data_protocolo: '1998-12-14',
    ano_protocolo: 1998,
    situacao: 'ativo',
    risk_score: 36,
  },
  {
    id: 'p14',
    numero: '925.112/2020',
    regime: 'req_lavra',
    fase: 'requerimento',
    substancia: 'FERRO',
    is_mineral_estrategico: false,
    titular: 'Companhia Brasileira de Metalurgia',
    area_ha: 1567.2,
    uf: 'PA',
    municipio: 'Santarém',
    lat: -2.44,
    lng: -54.71,
    data_protocolo: '2020-08-21',
    ano_protocolo: 2020,
    situacao: 'ativo',
    risk_score: 74,
  },
  {
    id: 'p15',
    numero: '918.556/2020',
    regime: 'req_lavra',
    fase: 'requerimento',
    substancia: 'OURO',
    is_mineral_estrategico: false,
    titular: 'St. George Mining Brasil',
    area_ha: 623.5,
    uf: 'GO',
    municipio: 'Catalão',
    lat: -18.17,
    lng: -47.95,
    data_protocolo: '2020-03-02',
    ano_protocolo: 2020,
    situacao: 'ativo',
    risk_score: 81,
  },
  {
    id: 'p16',
    numero: '867.201/2013',
    regime: 'req_lavra',
    fase: 'requerimento',
    substancia: 'COBRE',
    is_mineral_estrategico: false,
    titular: 'Atlas Critical Minerals Brasil',
    area_ha: 412.8,
    uf: 'GO',
    municipio: 'Minaçu',
    lat: -13.53,
    lng: -48.22,
    data_protocolo: '2013-11-11',
    ano_protocolo: 2013,
    situacao: 'ativo',
    risk_score: 69,
  },
  {
    id: 'p17',
    numero: '806.778/2003',
    regime: 'req_lavra',
    fase: 'requerimento',
    substancia: 'BAUXITA',
    is_mineral_estrategico: false,
    titular: 'Vale Mineração S.A.',
    area_ha: 2341.0,
    uf: 'GO',
    municipio: 'Niquelândia',
    lat: -14.47,
    lng: -48.46,
    data_protocolo: '2003-07-07',
    ano_protocolo: 2003,
    situacao: 'ativo',
    risk_score: 77,
  },
  {
    id: 'p18',
    numero: '895.334/2017',
    regime: 'licenciamento',
    fase: 'lavra',
    substancia: 'NÍQUEL',
    is_mineral_estrategico: false,
    titular: 'Serra Verde Mining Ltda.',
    area_ha: 298.4,
    uf: 'GO',
    municipio: 'Alto Horizonte',
    lat: -14.2,
    lng: -49.34,
    data_protocolo: '2017-02-28',
    ano_protocolo: 2017,
    situacao: 'ativo',
    risk_score: 41,
  },
  {
    id: 'p19',
    numero: '879.901/2015',
    regime: 'licenciamento',
    fase: 'lavra',
    substancia: 'QUARTZO',
    is_mineral_estrategico: false,
    titular: 'Viridis Recursos Minerais Ltda.',
    area_ha: 156.2,
    uf: 'GO',
    municipio: 'Barro Alto',
    lat: -14.97,
    lng: -48.91,
    data_protocolo: '2015-12-01',
    ano_protocolo: 2015,
    situacao: 'ativo',
    risk_score: 29,
  },
  {
    id: 'p20',
    numero: '802.445/2002',
    regime: 'licenciamento',
    fase: 'lavra',
    substancia: 'FERRO',
    is_mineral_estrategico: false,
    titular: 'Companhia Brasileira de Metalurgia',
    area_ha: 887.6,
    uf: 'GO',
    municipio: 'Goiás',
    lat: -15.93,
    lng: -50.14,
    data_protocolo: '2002-09-09',
    ano_protocolo: 2002,
    situacao: 'ativo',
    risk_score: 52,
  },
  {
    id: 'p21',
    numero: '940.001/2022',
    regime: 'mineral_estrategico',
    fase: 'pesquisa',
    substancia: 'NEODÍMIO',
    is_mineral_estrategico: true,
    titular: 'Atlas Critical Minerals Brasil',
    area_ha: 198.3,
    uf: 'BA',
    municipio: 'Irecê',
    lat: -11.3,
    lng: -41.86,
    data_protocolo: '2022-05-16',
    ano_protocolo: 2022,
    situacao: 'ativo',
    risk_score: 84,
  },
  {
    id: 'p22',
    numero: '941.002/2022',
    regime: 'mineral_estrategico',
    fase: 'pesquisa',
    substancia: 'NÍOBIO',
    is_mineral_estrategico: true,
    titular: 'Viridis Recursos Minerais Ltda.',
    area_ha: 176.5,
    uf: 'BA',
    municipio: 'Jacobina',
    lat: -11.41,
    lng: -40.52,
    data_protocolo: '2022-06-20',
    ano_protocolo: 2022,
    situacao: 'ativo',
    risk_score: 79,
  },
  {
    id: 'p23',
    numero: '942.003/2023',
    regime: 'mineral_estrategico',
    fase: 'pesquisa',
    substancia: 'LÍTIO',
    is_mineral_estrategico: true,
    titular: 'St. George Mining Brasil',
    area_ha: 245.0,
    uf: 'BA',
    municipio: 'Brumado',
    lat: -14.2,
    lng: -41.67,
    data_protocolo: '2023-01-11',
    ano_protocolo: 2023,
    situacao: 'ativo',
    risk_score: 87,
  },
  {
    id: 'p24',
    numero: '943.004/2023',
    regime: 'mineral_estrategico',
    fase: 'pesquisa',
    substancia: 'DISPRÓSIO',
    is_mineral_estrategico: true,
    titular: 'Serra Verde Mining Ltda.',
    area_ha: 132.7,
    uf: 'BA',
    municipio: 'Caetité',
    lat: -14.07,
    lng: -42.49,
    data_protocolo: '2023-08-30',
    ano_protocolo: 2023,
    situacao: 'ativo',
    risk_score: 82,
  },
  {
    id: 'p25',
    numero: '650.100/1987',
    regime: 'bloqueio_permanente',
    fase: 'encerrado',
    substancia: 'OURO',
    is_mineral_estrategico: false,
    titular: 'Vale Mineração S.A.',
    area_ha: 88.0,
    uf: 'AM',
    municipio: 'Presidente Figueiredo',
    lat: -2.03,
    lng: -60.01,
    data_protocolo: '1987-04-22',
    ano_protocolo: 1987,
    situacao: 'bloqueado',
    risk_score: 85,
  },
  {
    id: 'p26',
    numero: '651.101/1991',
    regime: 'bloqueio_permanente',
    fase: 'encerrado',
    substancia: 'FERRO',
    is_mineral_estrategico: false,
    titular: 'Companhia Brasileira de Metalurgia',
    area_ha: 120.4,
    uf: 'AM',
    municipio: 'Itacoatiara',
    lat: -3.14,
    lng: -58.44,
    data_protocolo: '1991-09-05',
    ano_protocolo: 1991,
    situacao: 'bloqueado',
    risk_score: 86,
  },
  {
    id: 'p27',
    numero: '652.102/1994',
    regime: 'bloqueio_permanente',
    fase: 'encerrado',
    substancia: 'BAUXITA',
    is_mineral_estrategico: false,
    titular: 'Atlas Critical Minerals Brasil',
    area_ha: 64.2,
    uf: 'AM',
    municipio: 'Barcelos',
    lat: -0.97,
    lng: -62.93,
    data_protocolo: '1994-12-18',
    ano_protocolo: 1994,
    situacao: 'bloqueado',
    risk_score: 86,
  },
  {
    id: 'p28',
    numero: '960.501/2024',
    regime: 'bloqueio_provisorio',
    fase: 'lavra',
    substancia: 'COBRE',
    is_mineral_estrategico: false,
    titular: 'St. George Mining Brasil',
    area_ha: 310.9,
    uf: 'MT',
    municipio: 'Guarantã do Norte',
    lat: -10.9,
    lng: -54.9,
    data_protocolo: '2024-02-14',
    ano_protocolo: 2024,
    situacao: 'bloqueado',
    risk_score: 70,
  },
  {
    id: 'p29',
    numero: '961.502/2024',
    regime: 'bloqueio_provisorio',
    fase: 'pesquisa',
    substancia: 'QUARTZO',
    is_mineral_estrategico: false,
    titular: 'Viridis Recursos Minerais Ltda.',
    area_ha: 205.6,
    uf: 'MT',
    municipio: 'Peixoto de Azevedo',
    lat: -10.22,
    lng: -54.98,
    data_protocolo: '2024-05-22',
    ano_protocolo: 2024,
    situacao: 'bloqueado',
    risk_score: 71,
  },
  {
    id: 'p30',
    numero: '962.503/2024',
    regime: 'bloqueio_provisorio',
    fase: 'requerimento',
    substancia: 'OURO',
    is_mineral_estrategico: false,
    titular: 'Serra Verde Mining Ltda.',
    area_ha: 142.1,
    uf: 'MT',
    municipio: 'Alta Floresta',
    lat: -9.87,
    lng: -56.08,
    data_protocolo: '2024-10-01',
    ano_protocolo: 2024,
    situacao: 'bloqueado',
    risk_score: 72,
  },
  {
    id: 'p-garimpo-1',
    numero: '935.210/2021',
    regime: 'lavra_garimpeira',
    fase: 'lavra',
    substancia: 'OURO',
    is_mineral_estrategico: false,
    titular: 'Cooperativa Garimpeira do Tapajós',
    area_ha: 48.2,
    uf: 'PA',
    municipio: 'Itaituba',
    lat: -4.28,
    lng: -55.98,
    data_protocolo: '2021-06-14',
    ano_protocolo: 2021,
    situacao: 'ativo',
    risk_score: 78,
  },
  {
    id: 'p-disponibilidade-1',
    numero: '800.015/2005',
    regime: 'disponibilidade',
    fase: 'encerrado',
    substancia: 'COBRE',
    is_mineral_estrategico: false,
    titular: 'Área disponível (sem titular)',
    area_ha: 520,
    uf: 'PA',
    municipio: 'Canaã dos Carajás',
    lat: -6.5,
    lng: -49.87,
    data_protocolo: '2005-02-10',
    ano_protocolo: 2005,
    situacao: 'inativo',
    risk_score: null,
  },
  {
    id: 'p-registro-ext-1',
    numero: '960.880/2023',
    regime: 'registro_extracao',
    fase: 'lavra',
    substancia: 'AREIA',
    is_mineral_estrategico: false,
    titular: 'Prefeitura Municipal de Uberlândia',
    area_ha: 15.8,
    uf: 'MG',
    municipio: 'Uberlândia',
    lat: -18.92,
    lng: -48.28,
    data_protocolo: '2023-09-01',
    ano_protocolo: 2023,
    situacao: 'ativo',
    risk_score: 15,
  },
]

function valorEstimadoUsdMiPara(p: ProcessoSeed): number {
  const u = hashUnit(p.id, 77)
  switch (p.regime) {
    case 'concessao_lavra':
      return Math.round(150 + u * 650)
    case 'autorizacao_pesquisa':
      return Math.round(20 + u * 180)
    case 'req_lavra':
      return Math.round(80 + u * 320)
    case 'licenciamento':
      return Math.round(10 + u * 40)
    case 'lavra_garimpeira':
      return Math.round(15 + u * 90)
    case 'registro_extracao':
      return Math.round(2 + u * 15)
    case 'disponibilidade':
      return Math.round(40 + u * 120)
    case 'mineral_estrategico':
      return Math.round(200 + u * 1000)
    case 'bloqueio_permanente':
      return 0
    case 'bloqueio_provisorio':
      return Math.round(5 + u * 25)
    default:
      return 0
  }
}

/** YYYY-MM-DD plausível conforme regime, fase e situação. */
function ultimoDespachoDataPara(p: ProcessoSeed): string {
  const u = hashUnit(p.id, 99)
  const d = (salt: number, mx: number) =>
    1 + Math.floor(hashUnit(p.id, salt) * mx)

  if (p.regime === 'bloqueio_permanente' || p.regime === 'bloqueio_provisorio') {
    const y = u < 0.55 ? 2023 : 2024
    const m = 4 + Math.floor(hashUnit(p.id, 44) * 8)
    return `${y}-${String(m).padStart(2, '0')}-${String(d(45, 26)).padStart(2, '0')}`
  }

  if (p.situacao === 'inativo' || p.fase === 'encerrado') {
    const y = 2022 + Math.floor(hashUnit(p.id, 46) * 2)
    const m = 1 + Math.floor(hashUnit(p.id, 47) * 12)
    return `${y}-${String(m).padStart(2, '0')}-${String(d(48, 27)).padStart(2, '0')}`
  }

  if (p.regime === 'concessao_lavra' && p.situacao === 'ativo') {
    const m = 1 + Math.floor(u * 3)
    return `2026-${String(m).padStart(2, '0')}-${String(3 + Math.floor(u * 25)).padStart(2, '0')}`
  }

  if (p.regime === 'autorizacao_pesquisa' && p.situacao === 'ativo') {
    if (hashUnit(p.id, 50) < 0.55) {
      const m = 10 + Math.floor(hashUnit(p.id, 51) * 3)
      const mo = m > 12 ? m - 12 : m
      const yr = m > 12 ? 2026 : 2025
      return `${yr}-${String(mo).padStart(2, '0')}-${String(d(52, 26)).padStart(2, '0')}`
    }
    const m = 1 + Math.floor(u * 3)
    return `2026-${String(m).padStart(2, '0')}-${String(d(53, 25)).padStart(2, '0')}`
  }

  const m = 1 + Math.floor(hashUnit(p.id, 54) * 12)
  return `2025-${String(m).padStart(2, '0')}-${String(d(55, 26)).padStart(2, '0')}`
}

const rawProcessos: RawProcesso[] = processosSeed.map((p) => {
  const risk_breakdown = riskBreakdownPara(p)
  return {
    ...p,
    risk_breakdown,
    risk_score:
      p.risk_score === null
        ? null
        : pontuacaoRiscoMedia(risk_breakdown),
    valor_estimado_usd_mi: valorEstimadoUsdMiPara(p),
    ultimo_despacho_data: ultimoDespachoDataPara(p),
    alertas: pickAlertas(p),
    fiscal: fiscalPara(p),
  }
})

export const processosMock: Processo[] = rawProcessos.map((p) => {
  const base: Processo = {
    ...p,
    geojson: makePolygon(p.lat, p.lng, p.id),
    risk_decomposicao: null,
  }
  return {
    ...base,
    risk_decomposicao: gerarRiskDecomposicaoParaProcesso(base),
  }
})

export const PROCESSOS_MOCK = processosMock
