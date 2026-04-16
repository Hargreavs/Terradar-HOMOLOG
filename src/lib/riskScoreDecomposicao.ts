import { CAMADAS_GEO_JSON } from '../data/camadas/geoImport'
import { normalizeSubstanciaKey } from './substancias'
import type {
  Fase,
  Processo,
  RiskDimensaoDetalhe,
  RiskDimensaoVariavel,
  RiskScoreDecomposicao,
} from '../types'

/** Faixa de risco (alto score = ruim). */
export function corFaixaRiscoValor(v: number): string {
  if (v < 40) return '#1D9E75'
  if (v <= 69) return '#E8A830'
  return '#E24B4A'
}

export function qualificadorRiscoVariavel(
  valor: number,
): { label: string; color: string } {
  if (valor <= 0) return { label: '-', color: '#5F5E5A' }
  if (valor < 40) return { label: 'Risco baixo', color: '#1D9E75' }
  if (valor <= 69) return { label: 'Risco médio', color: '#E8A830' }
  return { label: 'Risco alto', color: '#E24B4A' }
}

/** Identidade visual das dimensões no gráfico de pesos (independente do valor). */
export const CORES_DIMENSAO_RISK = {
  geologico: '#7EADD4',
  ambiental: '#4A9E4A',
  social: '#C87C5B',
  regulatorio: '#E8A830',
} as const

export const PESOS_RISK_DIMENSAO = {
  geologico: 25,
  ambiental: 30,
  social: 25,
  regulatorio: 20,
} as const

export const SUBSTANCIA_RISK_LOOKUP: Record<string, number> = {
  QUARTZO: 15,
  FERRO: 25,
  BAUXITA: 30,
  MANGANES: 35,
  NIOBIO: 40,
  COBRE: 45,
  OURO: 50,
  /** Mesmo perfil de risco geológico que OURO (SIGMINE “minério de ouro”). */
  'MINERIO DE OURO': 50,
  NIQUEL: 55,
  GRAFITA: 55,
  ESTANHO: 45,
  LITIO: 65,
  NEODIMIO: 70,
  DISPROSIO: 75,
  DIAMANTE: 50,
}

const FASE_RISK_LOOKUP: Record<Fase, number> = {
  lavra: 15,
  concessao: 25,
  pesquisa: 55,
  requerimento: 75,
  encerrado: 90,
}

const FASE_LABEL_POPOVER: Record<Fase, string> = {
  requerimento: 'requerimento',
  pesquisa: 'pesquisa em andamento',
  concessao: 'concessão',
  lavra: 'lavra ativa',
  encerrado: 'processo encerrado',
}

function hashUnit(id: string, salt: number): number {
  let h = 0
  const payload = `${id}\0${salt}`
  for (let i = 0; i < payload.length; i++) {
    h = (Math.imul(31, h) + payload.charCodeAt(i)) | 0
  }
  return (h >>> 0) / 0x1_0000_0000
}

function idhProxyUf(uf: string): number {
  const t: Record<string, number> = {
    SP: 0.83,
    SC: 0.81,
    PR: 0.8,
    RS: 0.79,
    DF: 0.85,
    GO: 0.77,
    MG: 0.78,
    RJ: 0.76,
    ES: 0.75,
    MT: 0.76,
    MS: 0.75,
    BA: 0.66,
    CE: 0.72,
    PE: 0.71,
    PA: 0.69,
    AM: 0.67,
    RO: 0.69,
    AP: 0.71,
    RR: 0.71,
    TO: 0.73,
    PI: 0.66,
    MA: 0.65,
    RN: 0.72,
    PB: 0.71,
    SE: 0.69,
    AL: 0.68,
    AC: 0.7,
  }
  return t[uf] ?? 0.68
}

function diasDesdeIso(iso: string): number {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return 120
  const now = Date.now()
  return Math.max(0, Math.round((now - t) / 86400000))
}

export function gerarDescricaoRiskDimensao(
  dim: 'geologico' | 'ambiental' | 'social' | 'regulatorio',
  detalhe: RiskDimensaoDetalhe,
  ctx: { fase: Fase; fiscalCapag: string },
): string {
  const s = detalhe.score
  const vars = detalhe.variaveis
  const dom =
    vars.length === 0
      ? null
      : [...vars].sort((a, b) => b.valor - a.valor)[0]

  const fasePhr = FASE_LABEL_POPOVER[ctx.fase]

  if (dim === 'geologico') {
    const subV = vars.find((v) => v.nome === 'Substância')
    const geoComplexa =
      (subV?.valor ?? 0) >= 55 ? 'complexa' : 'incerta'
    if (s >= 70) {
      return `Fase de ${fasePhr}, substância com geologia ${geoComplexa}`
    }
    if (s < 40) {
      if (ctx.fase === 'lavra') {
        return 'Lavra ativa, substância bem mapeada'
      }
      return 'Concessão consolidada, substância bem mapeada'
    }
    const qualSub =
      (subV?.valor ?? 0) >= 55 ? 'de maior complexidade' : 'com perfil intermediário'
    return `${fasePhr.charAt(0).toUpperCase() + fasePhr.slice(1)}, substância ${qualSub}`
  }

  if (dim === 'ambiental') {
    if (s === 0) {
      return 'Nenhuma restrição ambiental identificada'
    }
    if (s < 40) {
      return 'Sem sobreposições com áreas protegidas'
    }
    if (s >= 70 && dom) {
      return dom.texto.length > 52 ? `${dom.texto.slice(0, 49)}...` : dom.texto
    }
    const prox = vars.find(
      (v) =>
        v.valor > 0 &&
        (v.nome === 'Proximidade a aquífero' || v.nome === 'Proximidade a quilombola'),
    )
    if (prox) {
      const km = prox.texto.match(/(\d+\.?\d*)\s*km/)
      const tipo =
        prox.nome === 'Proximidade a aquífero' ? 'aquífero' : 'quilombo'
      return `Proximidade a ${tipo}${km ? ` (${km[1]}km)` : ''}`
    }
    return dom ? (dom.texto.length > 52 ? `${dom.texto.slice(0, 49)}...` : dom.texto) : 'Restrições ambientais moderadas'
  }

  if (dim === 'social') {
    const idhV = vars.find((v) => v.nome === 'IDH-M')
    const idhTxt = idhV?.texto.match(/([\d.]+)/)
    const idhVal = idhTxt ? idhTxt[1] : '0,66'
    if (s >= 70) {
      const sec = vars.find((v) => v.nome === 'Comunidades tradicionais' && v.valor > 30)
      const sec2 = vars.find((v) => v.nome === 'CAPAG município' && v.valor > 40)
      const tail = sec
        ? sec.texto.toLowerCase().includes('comunidade')
          ? sec.texto.replace(/\(.*\)/, '').trim()
          : `CAPAG ${ctx.fiscalCapag}`
        : sec2
          ? `CAPAG ${ctx.fiscalCapag} frágil`
          : 'densidade populacional moderada'
      return `IDH municipal ${idhVal}, ${tail}`
    }
    if (s < 40) {
      return `Município com bom desenvolvimento (IDH ${idhVal})`
    }
    const cap = vars.find((v) => v.nome === 'CAPAG município')
    const com = vars.find((v) => v.nome === 'Comunidades tradicionais')
    const bit =
      (com?.valor ?? 0) >= (cap?.valor ?? 0)
        ? com?.texto ?? 'perfil social intermediário'
        : `CAPAG ${ctx.fiscalCapag}`
    return `IDH ${idhVal}, ${bit}`
  }

  /* regulatorio */
  const tempo = vars.find((v) => v.nome === 'Tempo sem despacho')
  const pend = vars.find((v) => v.nome === 'Pendências')
  if (s >= 70) {
    const dias = tempo?.texto.match(/(\d+)\s*dias/)
    const n = dias ? dias[1] : '180'
    const p = pend?.valor && pend.valor > 50 ? 'com pendências' : 'risco de caducidade'
    return `Sem despacho há ${n} dias, ${p}`
  }
  if (s < 40) {
    return 'Despacho recente, sem pendências'
  }
  const a = dom?.texto ?? 'cronograma moderado'
  const b =
    vars.find((v) => v !== dom && v.valor > 35)?.texto ?? 'acompanhar alertas'
  return `${a}, ${b}`
}

function variaveisGeologicas(p: Processo, _gScore: number): RiskDimensaoVariavel[] {
  const key = normalizeSubstanciaKey(p.substancia)
  const subScore =
    SUBSTANCIA_RISK_LOOKUP[key] ??
    SUBSTANCIA_RISK_LOOKUP[key.split(/\s+/)[0] ?? ''] ??
    50
  const fScore = FASE_RISK_LOOKUP[p.fase] ?? 50
  const qScore = p.fase === 'lavra' ? 20 : p.fase === 'pesquisa' ? 50 : 80

  const substLabel = p.substancia.trim() || 'Substância'
  const subTextoHigh = `${substLabel}, geologia complexa e pouco explorada`
  const subTextoLow = `${substLabel.split(/\s+/)[0]}, geologia bem mapeada no Brasil`

  const faseTextoHigh =
    p.fase === 'requerimento'
      ? 'Requerimento de pesquisa, sem dados geológicos'
      : 'Pesquisa em andamento, dados incompletos'
  const faseTextoLow =
    p.fase === 'lavra'
      ? 'Concessão de lavra, reserva comprovada'
      : 'Concessão consolidada, dados consistentes'

  const qualTextoHigh = 'Sem relatório de pesquisa aprovado'
  const qualTextoLow = 'Relatório de pesquisa aprovado pela ANM'

  return [
    {
      nome: 'Substância',
      valor: Math.min(100, Math.max(0, subScore)),
      texto: subScore >= 55 ? subTextoHigh : subTextoLow,
      fonte: 'ANM/SIGMINE',
    },
    {
      nome: 'Fase do processo',
      valor: Math.min(100, Math.max(0, fScore)),
      texto: fScore >= 55 ? faseTextoHigh : faseTextoLow,
      fonte: 'ANM/SIGMINE',
    },
    {
      nome: 'Qualidade da informação',
      valor: Math.min(100, Math.max(0, qScore)),
      texto: qScore >= 55 ? qualTextoHigh : qualTextoLow,
      fonte: 'ANM/Cadastro Mineiro',
    },
  ]
}

type LngLatBBox = {
  minLng: number
  maxLng: number
  minLat: number
  maxLat: number
}

function bboxFromRing(ring: [number, number][]): LngLatBBox {
  let minLng = Infinity
  let maxLng = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  return { minLng, maxLng, minLat, maxLat }
}

function bboxOverlap(a: LngLatBBox, b: LngLatBBox): boolean {
  return (
    a.minLng < b.maxLng &&
    a.maxLng > b.minLng &&
    a.minLat < b.maxLat &&
    a.maxLat > b.minLat
  )
}

/** Área da interseção de duas caixas em graus² (mock cartográfico). */
function bboxIntersectionArea(a: LngLatBBox, b: LngLatBBox): number {
  const x0 = Math.max(a.minLng, b.minLng)
  const x1 = Math.min(a.maxLng, b.maxLng)
  const y0 = Math.max(a.minLat, b.minLat)
  const y1 = Math.min(a.maxLat, b.maxLat)
  if (x0 >= x1 || y0 >= y1) return 0
  return (x1 - x0) * (y1 - y0)
}

type CamadaGeoFeat = {
  properties?: Record<string, unknown>
  geometry: { type: string; coordinates: unknown }
}

/** Quando várias feições interceptam o processo, usa a de maior área (desempate estável por nome). */
function pickFeatureWithMaxOverlap(
  features: CamadaGeoFeat[],
  proc: LngLatBBox,
  include: (f: CamadaGeoFeat) => boolean,
  tieKey: (f: CamadaGeoFeat) => string,
): CamadaGeoFeat | null {
  let best: { f: CamadaGeoFeat; area: number } | null = null
  for (const f of features) {
    if (!include(f)) continue
    const gb = geometryBBox(f.geometry)
    if (!gb || !bboxOverlap(proc, gb)) continue
    const area = bboxIntersectionArea(proc, gb)
    const key = tieKey(f)
    if (
      !best ||
      area > best.area ||
      (area === best.area && key.localeCompare(tieKey(best.f)) < 0)
    ) {
      best = { f, area }
    }
  }
  return best?.f ?? null
}

/** Para aquíferos sobrepostos: prefere o polígono mais “local” (menor área de interseção). */
function pickFeatureWithMinOverlap(
  features: CamadaGeoFeat[],
  proc: LngLatBBox,
  include: (f: CamadaGeoFeat) => boolean,
  tieKey: (f: CamadaGeoFeat) => string,
): CamadaGeoFeat | null {
  let best: { f: CamadaGeoFeat; area: number } | null = null
  for (const f of features) {
    if (!include(f)) continue
    const gb = geometryBBox(f.geometry)
    if (!gb || !bboxOverlap(proc, gb)) continue
    const area = bboxIntersectionArea(proc, gb)
    const key = tieKey(f)
    if (
      !best ||
      area < best.area ||
      (area === best.area && key.localeCompare(tieKey(best.f)) < 0)
    ) {
      best = { f, area }
    }
  }
  return best?.f ?? null
}

/** Mesma escala que `makePolygon` em `processos.mock.ts` (footprint ~0,15–0,35°). */
function processFootprintBBox(id: string, lat: number, lng: number): LngLatBBox {
  const u = (salt: number) => hashUnit(id, salt)
  const aspW = 0.58 + (1.42 - 0.58) * u(10)
  const aspH = 0.58 + (1.42 - 0.58) * u(11)
  const we = 0.25 * aspW
  const he = 0.2 * aspH
  return {
    minLng: lng - we,
    maxLng: lng + we,
    minLat: lat - he,
    maxLat: lat + he,
  }
}

function geometryBBox(
  geom: { type: string; coordinates: unknown },
): LngLatBBox | null {
  if (geom.type === 'Polygon') {
    const rings = geom.coordinates as [number, number][][]
    const outer = rings[0]
    if (!outer?.length) return null
    return bboxFromRing(outer)
  }
  if (geom.type === 'Point') {
    const [lng, lat] = geom.coordinates as [number, number]
    const e = 0.04
    return {
      minLng: lng - e,
      maxLng: lng + e,
      minLat: lat - e,
      maxLat: lat + e,
    }
  }
  return null
}

function tiNomeCurto(nomeCompleto: string): string {
  return nomeCompleto.replace(/^Terra Indígena\s+/i, '').trim() || nomeCompleto
}

function ucPiTexto(nome: string): string {
  const n = nome.trim()
  if (/^parque nacional/i.test(n)) return `${n}`
  return `Parque Nacional ${n}`
}

const UF_AMAZONIA_LEGAL = new Set(['AM', 'PA', 'RR', 'AP', 'AC', 'RO'])

/**
 * Mock ambiental: só entra fator se a área do processo (bbox) intercepta a feição
 * das camadas GeoJSON usadas no mapa; alinha texto de risco ao desenho das camadas.
 * Score = min(100, soma dos pesos dos fatores presentes).
 */
export function ambientalDetalheMockFromProcesso(p: {
  id: string
  lat: number
  lng: number
  uf: string
}): RiskDimensaoDetalhe {
  /** Processo real 864.231/2017: score ambiental auditado (aquífero / unidade granular). */
  if (p.id === 'p_864231') {
    return {
      score: 10,
      variaveis: [
        {
          nome: 'Proximidade a aquífero',
          valor: 10,
          texto:
            'Depósito Aluvionar (Qa), Unidade Granular (Gr): sobreposição (0 km; CPRM/SGB + SIGMINE 12/04/2026)',
          fonte: 'CPRM/SGB + SIGMINE',
        },
      ],
    }
  }

  const proc = processFootprintBBox(p.id, p.lat, p.lng)
  const id = p.id

  const tiPct = 5 + Math.floor(hashUnit(id, 208) * 26)
  const ucPiPct = 5 + Math.floor(hashUnit(id, 209) * 21)
  const ucUsPct = 3 + Math.floor(hashUnit(id, 210) * 13)
  const appPct = 3 + Math.floor(hashUnit(id, 211) * 14)
  const quarKm = 2 + Math.floor(hashUnit(id, 212) * 14)

  const variaveis: RiskDimensaoVariavel[] = []

  const tiFeat = pickFeatureWithMaxOverlap(
    CAMADAS_GEO_JSON.terras_indigenas.features as CamadaGeoFeat[],
    proc,
    () => true,
    (f) => String(f.properties?.nome ?? 'TI'),
  )
  if (tiFeat) {
    const nome = String(tiFeat.properties?.nome ?? 'TI')
    variaveis.push({
      nome: 'Sobreposição com TI',
      valor: 40,
      texto: `TI ${tiNomeCurto(nome)} (${tiPct}% da área do processo)`,
      fonte: 'FUNAI',
    })
  }

  const ucPiFeat = pickFeatureWithMaxOverlap(
    CAMADAS_GEO_JSON.unidades_conservacao.features as CamadaGeoFeat[],
    proc,
    (f) => /integral|proteção integral/i.test(String(f.properties?.categoria ?? '')),
    (f) => String(f.properties?.nome ?? 'UC'),
  )
  if (ucPiFeat) {
    const nome = String(ucPiFeat.properties?.nome ?? 'UC')
    variaveis.push({
      nome: 'Sobreposição com UC PI',
      valor: 35,
      texto: `${ucPiTexto(nome)} (${ucPiPct}% da área)`,
      fonte: 'ICMBio/MMA (CNUC)',
    })
  }

  const appFeat = pickFeatureWithMaxOverlap(
    CAMADAS_GEO_JSON.app_car.features as CamadaGeoFeat[],
    proc,
    () => true,
    (f) =>
      `${f.properties?.municipio ?? ''}|${f.properties?.tipo ?? ''}|${f.properties?.uf ?? ''}`,
  )
  if (appFeat) {
    const tipo = String(appFeat.properties?.tipo ?? 'APP')
    variaveis.push({
      nome: 'Sobreposição com APP',
      valor: 25,
      texto: `${tipo} (${appPct}% da área; ${String(appFeat.properties?.municipio ?? 'N/D')}/${String(appFeat.properties?.uf ?? 'N/D')})`,
      fonte: 'CAR/SICAR',
    })
  }

  const quilFeat = pickFeatureWithMaxOverlap(
    CAMADAS_GEO_JSON.quilombolas.features as CamadaGeoFeat[],
    proc,
    () => true,
    (f) => String(f.properties?.nome ?? 'Quilombo'),
  )
  if (quilFeat) {
    const nome = String(quilFeat.properties?.nome ?? 'Quilombo')
    variaveis.push({
      nome: 'Proximidade a quilombola',
      valor: 20,
      texto: `${nome}: intersecta ou margeia a área (referência cartográfica ~${quarKm}km)`,
      fonte: 'INCRA',
    })
  }

  const ucUsFeat = pickFeatureWithMaxOverlap(
    CAMADAS_GEO_JSON.unidades_conservacao.features as CamadaGeoFeat[],
    proc,
    (f) =>
      /sustentável|sustentavel|uso sustent/i.test(
        String(f.properties?.categoria ?? ''),
      ),
    (f) => String(f.properties?.nome ?? 'UC'),
  )
  if (ucUsFeat) {
    const nome = String(ucUsFeat.properties?.nome ?? 'UC')
    variaveis.push({
      nome: 'Proximidade a UC US',
      valor: 15,
      texto: `${nome} (${ucUsPct}% da área em zona de amortecimento)`,
      fonte: 'ICMBio/MMA (CNUC)',
    })
  }

  const aqFeat = pickFeatureWithMinOverlap(
    CAMADAS_GEO_JSON.aquiferos.features as CamadaGeoFeat[],
    proc,
    () => true,
    (f) => String(f.properties?.nome ?? 'Aquífero'),
  )
  if (aqFeat) {
    const nome = String(aqFeat.properties?.nome ?? 'Aquífero')
    variaveis.push({
      nome: 'Proximidade a aquífero',
      valor: 10,
      texto: `${nome}: manancial subjacente ou adjacente à área`,
      fonte: 'ANA/CPRM',
    })
  }

  let soma = variaveis.reduce((acc, v) => acc + v.valor, 0)
  if (soma < 100 && UF_AMAZONIA_LEGAL.has(p.uf) && soma < 92) {
    variaveis.push({
      nome: 'Bioma Amazônia',
      valor: 10,
      texto: 'Amazônia Legal: contexto regional de sensibilidade ambiental',
      fonte: 'IBGE',
    })
    soma += 10
  }

  const score = Math.min(100, soma)

  if (variaveis.length === 0) {
    return {
      score: 0,
      variaveis: [
        {
          nome: 'Resumo',
          valor: 0,
          texto: 'Nenhuma restrição ambiental identificada nas camadas ativas do mock',
          fonte: 'Terrae',
        },
      ],
    }
  }

  return { score, variaveis }
}

const W_SOC_IDH = 0.35
const W_SOC_DENS = 0.2
const W_SOC_COM = 0.25
const W_SOC_CAP = 0.2

function clampInt(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.round(n)))
}

function socialWeighted(i: number, d: number, c: number, cap: number): number {
  return Math.round(
    W_SOC_IDH * i +
      W_SOC_DENS * d +
      W_SOC_COM * c +
      W_SOC_CAP * cap,
  )
}

function variaveisSociais(p: Processo, alvo: number): RiskDimensaoVariavel[] {
  if (p.id === 'p_864231') {
    return [
      {
        nome: 'IDH-M',
        valor: 35,
        texto: 'IDH 0,662 (Jaú do Tocantins/TO)',
        fonte: 'PNUD/Atlas Brasil',
      },
      {
        nome: 'Densidade populacional',
        valor: 5,
        texto: '1,54 hab/km² (baixa densidade)',
        fonte: 'IBGE/Censo',
      },
      {
        nome: 'Comunidades tradicionais',
        valor: 5,
        texto: '112,5 km (TI Avá-Canoeiro, referência FUNAI)',
        fonte: 'FUNAI',
      },
      {
        nome: 'CAPAG município',
        valor: 40,
        texto: 'CAPAG C (situação fiscal frágil)',
        fonte: 'STN/SICONFI',
      },
    ]
  }

  const idh = idhProxyUf(p.uf)
  const idhStr = idh.toFixed(2)
  const capMap: Record<string, number> = { A: 12, B: 28, C: 55, D: 85 }
  const capVal = clampInt(capMap[p.fiscal.capag] ?? 40, 0, 100)

  const u = hashUnit(p.id, 301)
  let idhRisk = Math.round((1 - idh) * 100)
  let dens = Math.round(15 + u * 50)
  let com = Math.round(10 + hashUnit(p.id, 302) * 45)
  const comKm = Math.round(5 + hashUnit(p.id, 304) * 22)

  const restAlvo = alvo - W_SOC_CAP * capVal
  const wr =
    W_SOC_IDH * idhRisk + W_SOC_DENS * dens + W_SOC_COM * com

  if (restAlvo <= 0) {
    idhRisk = dens = com = 0
  } else if (wr < 1e-6) {
    idhRisk = clampInt(restAlvo / W_SOC_IDH, 0, 100)
    dens = com = 0
  } else {
    const f = restAlvo / wr
    idhRisk = clampInt(idhRisk * f, 0, 100)
    dens = clampInt(dens * f, 0, 100)
    com = clampInt(com * f, 0, 100)
  }

  let guard = 0
  let s = socialWeighted(idhRisk, dens, com, capVal)
  while (s !== alvo && guard < 500) {
    guard++
    if (s < alvo) {
      if (idhRisk < 100) idhRisk++
      else if (com < 100) com++
      else if (dens < 100) dens++
      else break
    } else {
      if (idhRisk > 0) idhRisk--
      else if (com > 0) com--
      else if (dens > 0) dens--
      else break
    }
    s = socialWeighted(idhRisk, dens, com, capVal)
  }

  const idhQual =
    idh < 0.65
      ? 'abaixo da média nacional'
      : idh < 0.75
        ? 'desenvolvimento moderado'
        : 'relativamente elevado para o contexto regional'

  const densN = clampInt(10 + (dens / 100) * 58, 8, 95)
  const densLabel =
    dens < 34 ? 'baixa densidade' : dens < 58 ? 'densidade moderada' : 'média-alta'

  const comTxt =
    com < 22
      ? 'Sem sobreposição com terras de comunidades tradicionais mapeadas'
      : `Comunidades tradicionais a ~${comKm}km (eixo de sensibilidade social)`

  const capTxtStable =
    p.fiscal.capag === 'A' || p.fiscal.capag === 'B'
      ? 'situação fiscal estável'
      : 'situação fiscal frágil'

  return [
    {
      nome: 'IDH-M',
      valor: idhRisk,
      texto: `IDH ${idhStr} (${idhQual})`,
      fonte: 'PNUD/Atlas Brasil',
    },
    {
      nome: 'Densidade populacional',
      valor: dens,
      texto: `${densN} hab/km² (${densLabel})`,
      fonte: 'IBGE/Censo',
    },
    {
      nome: 'Comunidades tradicionais',
      valor: com,
      texto: comTxt,
      fonte: 'FUNAI, INCRA',
    },
    {
      nome: 'CAPAG município',
      valor: capVal,
      texto: `CAPAG ${p.fiscal.capag} (${capTxtStable})`,
      fonte: 'STN/SICONFI',
    },
  ]
}

function variaveisRegulatorias(p: Processo, _alvo: number): RiskDimensaoVariavel[] {
  /** 864.231/2017: decomposição alinhada ao recálculo SEI (GU vencida, alvará 2028). */
  if (p.id === 'p_864231') {
    return [
      {
        nome: 'Tempo sem despacho',
        valor: 20,
        texto:
          '30 dias desde despacho 13/03/2026 (faixa 30–180d; ANM/SEI)',
        fonte: 'ANM/SEI',
      },
      {
        nome: 'Pendências',
        valor: 30,
        texto:
          'GU vencida em 12/07/2025; pedido de renovação 10/05/2025 aguardando ANM (SEI)',
        fonte: 'SEI-ANM',
      },
      {
        nome: 'Alertas restritivos',
        valor: 5,
        texto: '0 alertas restritivos (neutro)',
        fonte: 'Adoo',
      },
      {
        nome: 'Proximidade de caducidade',
        valor: 10,
        texto:
          'Alvará prorrogado até 24/11/2028; >365 dias restantes (ANM/SEI)',
        fonte: 'ANM/SEI',
      },
    ]
  }

  const dias = diasDesdeIso(p.ultimo_despacho_data)
  const tempoScore = Math.min(100, Math.round((dias / 360) * 55))
  const pendN =
    p.situacao === 'bloqueado' ? 2 : p.situacao === 'inativo' ? 1 : 0
  const pendScore = pendN === 0 ? 15 : pendN === 1 ? 55 : 85
  const restritivos = p.alertas.filter((a) => a.tipo_impacto === 'restritivo').length
  const alertScore = Math.min(100, restritivos * 28 + hashUnit(p.id, 401) * 15)
  const cadScore =
    p.regime === 'concessao_lavra' && p.situacao === 'ativo'
      ? Math.round(25 + hashUnit(p.id, 402) * 35)
      : Math.round(hashUnit(p.id, 403) * 30)

  const vars: RiskDimensaoVariavel[] = [
    {
      nome: 'Tempo sem despacho',
      valor: tempoScore,
      texto:
        dias > 120
          ? `Último despacho há ${dias} dias`
          : `Despacho há ${dias} dias`,
      fonte: 'ANM/SEI',
    },
    {
      nome: 'Pendências',
      valor: pendScore,
      texto:
        pendN === 0
          ? 'Sem pendências'
          : `${pendN} pendência${pendN > 1 ? 's' : ''} não cumprida${pendN > 1 ? 's' : ''}`,
      fonte: 'ANM/SEI',
    },
    {
      nome: 'Alertas restritivos',
      valor: Math.round(alertScore),
      texto:
        restritivos === 0
          ? 'Nenhum em 12 meses'
          : `${restritivos} alertas restritivos em 12 meses`,
      fonte: 'Adoo',
    },
    {
      nome: 'Proximidade de caducidade',
      valor: cadScore,
      texto:
        cadScore > 45
          ? `Vence em ${6 + Math.floor(hashUnit(p.id, 404) * 10)} meses`
          : 'Sem prazo definido',
      fonte: 'ANM/Cadastro Mineiro',
    },
  ]

  const cur = vars.reduce((a, v) => a + v.valor, 0) / vars.length
  const factor = cur > 0 ? _alvo / cur : 1
  return vars.map((v) => ({
    ...v,
    valor: Math.min(100, Math.max(0, Math.round(v.valor * factor))),
  }))
}

function mapSubfatorPersistidoToVariavel(
  s: Record<string, unknown>,
): RiskDimensaoVariavel {
  return {
    nome: String(s.nome ?? ''),
    valor: Number(s.valor ?? 0),
    texto: String(s.texto ?? ''),
    fonte: String(s.fonte ?? 'scores'),
  }
}

function converterDimPersistidaParaDetalhe(
  d: Record<string, unknown> | undefined,
): RiskDimensaoDetalhe {
  if (!d) return { score: 0, variaveis: [] }
  const subfatores = Array.isArray(d.subfatores)
    ? (d.subfatores as Record<string, unknown>[])
    : []
  return {
    score: Number(d.valor ?? 0),
    variaveis: subfatores.map(mapSubfatorPersistidoToVariavel),
  }
}

/**
 * Converte `scores.dimensoes_risco` (JSONB) para `RiskScoreDecomposicao` da UI.
 * `fonte: 'scores'` permite ao painel exibir subfatores ambientais com valor 0.
 */
function converterDimensoesPersistidasParaDecomposicao(
  p: Processo,
  dim: NonNullable<Processo['dimensoes_risco_persistido']>,
): RiskScoreDecomposicao | null {
  if (p.risk_score == null) return null
  const dg = dim as Record<string, unknown>
  return {
    total: p.risk_score,
    geologico: converterDimPersistidaParaDetalhe(
      dg.geologico as Record<string, unknown>,
    ),
    ambiental: converterDimPersistidaParaDetalhe(
      dg.ambiental as Record<string, unknown>,
    ),
    social: converterDimPersistidaParaDetalhe(
      dg.social as Record<string, unknown>,
    ),
    regulatorio: converterDimPersistidaParaDetalhe(
      dg.regulatorio as Record<string, unknown>,
    ),
  }
}

/** Constrói a decomposição mock alinhada ao `risk_breakdown` do processo. */
export function gerarRiskDecomposicaoParaProcesso(
  p: Processo,
): RiskScoreDecomposicao | null {
  if (p.risk_score === null) return null

  if (p.dimensoes_risco_persistido) {
    const dg = p.dimensoes_risco_persistido
    const hasAny =
      dg.geologico != null ||
      dg.ambiental != null ||
      dg.social != null ||
      dg.regulatorio != null
    if (hasAny) {
      const converted = converterDimensoesPersistidasParaDecomposicao(
        p,
        p.dimensoes_risco_persistido,
      )
      if (converted) return converted
    }
  }

  if (!p.risk_breakdown) return null

  const rb = p.risk_breakdown
  const geo = variaveisGeologicas(p, rb.geologico)
  const ambFinal = ambientalDetalheMockFromProcesso(p)

  const soc = variaveisSociais(p, rb.social)
  const reg = variaveisRegulatorias(p, rb.regulatorio)

  return {
    total: p.risk_score,
    geologico: { score: rb.geologico, variaveis: geo },
    ambiental: ambFinal,
    social: { score: rb.social, variaveis: soc },
    regulatorio: { score: rb.regulatorio, variaveis: reg },
  }
}
