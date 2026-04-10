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

const TI_NOMES = [
  'Xingu',
  'Yanomami',
  'Kayapó',
  'Munduruku',
  'Apyterewa',
  'Cachoeira Seca',
]

const UC_PI_NOMES = [
  'Serra da Capivara',
  'Chapada dos Veadeiros',
  'Jaú',
  'Amazonas',
]

const UC_US_NOMES = [
  'Triunfo do Xingu',
  'Tapajós',
  'Gurupi',
]

const QUILOMBOS = ['Quilombo Rio dos Macacos', 'Quilombo Kalunga', 'Quilombo Ivaporunduva']

const AQUIFEROS = ['Alter do Chão', 'Bambuí', 'Urucuia', 'Guarani']

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

function pick<T>(arr: T[], id: string, salt: number): T {
  return arr[Math.floor(hashUnit(id, salt) * arr.length) % arr.length]!
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

function variaveisGeologicas(p: Processo, gScore: number): RiskDimensaoVariavel[] {
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

/** Semente determinística inteira a partir do id (para presença binária dos fatores). */
function seedIntFromId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/**
 * Mock ambiental: fatores binários com pesos fixos; score = min(100, soma).
 * Deve ser a única fonte de `risk_breakdown.ambiental` e da decomposição ambiental.
 */
export function ambientalDetalheMockFromId(id: string): RiskDimensaoDetalhe {
  const seed = seedIntFromId(id)

  const temTI = seed % 3 === 0
  const temUCPI = seed % 5 === 0
  const temAPP = seed % 4 === 0
  const temQuilombola = seed % 7 === 0
  const temUCUS = seed % 6 === 0
  const temAquifero = seed % 2 === 0
  const biomas = [
    'cerrado',
    'amazonia',
    'mata_atlantica',
    'pantanal',
    'caatinga',
  ] as const
  const bioma = biomas[seed % biomas.length]

  const tiNome = pick(TI_NOMES, id, 208)
  const ucPiNome = pick(UC_PI_NOMES, id, 209)
  const ucUsNome = pick(UC_US_NOMES, id, 210)
  const quil = pick(QUILOMBOS, id, 211)
  const aqu = pick(AQUIFEROS, id, 212)

  const tiPct = (seed % 30) + 5
  const ucPiPct = (seed % 20) + 5
  const ucUsPct = (seed % 12) + 3
  const appPct = (seed % 15) + 3
  const quarKm = (seed % 15) + 2
  const aquKm = (seed % 4) + 1

  const variaveis: RiskDimensaoVariavel[] = []

  if (temTI) {
    variaveis.push({
      nome: 'Sobreposição com TI',
      valor: 40,
      texto: `TI ${tiNome} (${tiPct}% da área do processo)`,
      fonte: 'FUNAI',
    })
  }
  if (temUCPI) {
    variaveis.push({
      nome: 'Sobreposição com UC PI',
      valor: 35,
      texto: `Parque Nacional ${ucPiNome} (${ucPiPct}% da área)`,
      fonte: 'ICMBio/MMA (CNUC)',
    })
  }
  if (temAPP) {
    variaveis.push({
      nome: 'Sobreposição com APP',
      valor: 25,
      texto: `APP margem de rio (${appPct}% da área)`,
      fonte: 'CAR/SICAR',
    })
  }
  if (temQuilombola) {
    variaveis.push({
      nome: 'Proximidade a quilombola',
      valor: 20,
      texto: `${quil} a ${quarKm}km`,
      fonte: 'INCRA',
    })
  }
  if (temUCUS) {
    variaveis.push({
      nome: 'Proximidade a UC US',
      valor: 15,
      texto: `APA ${ucUsNome} (${ucUsPct}% da área)`,
      fonte: 'ICMBio/MMA (CNUC)',
    })
  }
  if (temAquifero) {
    variaveis.push({
      nome: 'Proximidade a aquífero',
      valor: 10,
      texto: `Aquífero ${aqu} a ${aquKm}km`,
      fonte: 'ANA/CPRM',
    })
  }
  if (bioma === 'amazonia') {
    variaveis.push({
      nome: 'Bioma Amazônia',
      valor: 10,
      texto: 'Amazônia',
      fonte: 'IBGE',
    })
  } else if (bioma === 'mata_atlantica') {
    variaveis.push({
      nome: 'Bioma Mata Atlântica',
      valor: 8,
      texto: 'Mata Atlântica',
      fonte: 'IBGE',
    })
  } else if (bioma === 'pantanal') {
    variaveis.push({
      nome: 'Bioma Pantanal',
      valor: 8,
      texto: 'Pantanal',
      fonte: 'IBGE',
    })
  }

  const soma = variaveis.reduce((acc, v) => acc + v.valor, 0)
  const score = Math.min(100, soma)

  if (variaveis.length === 0) {
    return {
      score: 0,
      variaveis: [
        {
          nome: 'Resumo',
          valor: 0,
          texto: 'Nenhuma restrição ambiental identificada',
          fonte: 'Terrae',
        },
      ],
    }
  }

  return { score, variaveis }
}

function variaveisSociais(p: Processo, alvo: number): RiskDimensaoVariavel[] {
  const idh = idhProxyUf(p.uf)
  const u = hashUnit(p.id, 301)
  const idhRisk = Math.round((1 - idh) * 100)
  const dens = Math.round(15 + u * 50)
  const com = Math.round(10 + hashUnit(p.id, 302) * 45)
  const capMap: Record<string, number> = { A: 12, B: 28, C: 55, D: 85 }
  const capScore = capMap[p.fiscal.capag] ?? 40

  const idhStr = idh.toFixed(2)
  const densN = Math.round(8 + hashUnit(p.id, 303) * 45)
  const comKm = Math.round(4 + hashUnit(p.id, 304) * 15)

  const vars: RiskDimensaoVariavel[] = [
    {
      nome: 'IDH-M',
      valor: idhRisk,
      texto: `IDH ${idhStr} (${idhRisk >= 50 ? 'baixo desenvolvimento' : 'desenvolvimento moderado'})`,
      fonte: 'PNUD/Atlas Brasil',
    },
    {
      nome: 'Densidade populacional',
      valor: dens,
      texto: `${densN} hab/km² (${dens >= 45 ? 'média-alta' : 'baixa densidade'})`,
      fonte: 'IBGE/Censo',
    },
    {
      nome: 'Comunidades tradicionais',
      valor: com,
      texto:
        com > 25
          ? `Comunidade a ${comKm}km`
          : 'Nenhuma próxima',
      fonte: 'FUNAI, INCRA',
    },
    {
      nome: 'CAPAG município',
      valor: capScore,
      texto: `CAPAG ${p.fiscal.capag} (${p.fiscal.capag === 'A' || p.fiscal.capag === 'B' ? 'situação fiscal estável' : 'situação fiscal frágil'})`,
      fonte: 'STN/SICONFI',
    },
  ]
  const cur = vars.reduce((a, v) => a + v.valor, 0) / vars.length
  const factor = cur > 0 ? alvo / cur : 1
  return vars.map((v) => ({
    ...v,
    valor: Math.min(100, Math.max(0, Math.round(v.valor * factor))),
  }))
}

function variaveisRegulatorias(p: Processo, alvo: number): RiskDimensaoVariavel[] {
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
  const factor = cur > 0 ? alvo / cur : 1
  return vars.map((v) => ({
    ...v,
    valor: Math.min(100, Math.max(0, Math.round(v.valor * factor))),
  }))
}

/** Constrói a decomposição mock alinhada ao `risk_breakdown` do processo. */
export function gerarRiskDecomposicaoParaProcesso(
  p: Processo,
): RiskScoreDecomposicao | null {
  if (p.risk_score === null || !p.risk_breakdown) return null

  const rb = p.risk_breakdown
  const geo = variaveisGeologicas(p, rb.geologico)
  const ambFinal = ambientalDetalheMockFromId(p.id)

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
