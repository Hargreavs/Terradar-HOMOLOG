/**
 * S31 v3 - Risk + OS motor (Node + postgres.js + config_scores).
 * Modelo: S31_REFATOR_FINAL_RISK_OPP_v3.md
 */
import './env'
import postgres, { type JSONValue } from 'postgres'
import type { ScoreResult } from './scoreEngine'
import type { DimensaoOutput, SubfatorOutput } from './scoringS31BreakdownTypes'

export type { DimensaoOutput, SubfatorOutput } from './scoringS31BreakdownTypes'

function fmtKm(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function classifyLabelRisk(bruto0_100: number): string {
  if (bruto0_100 < 40) return 'Risco baixo'
  if (bruto0_100 < 70) return 'Risco médio'
  return 'Risco alto'
}

function classifyLabelOpp(bruto0_100: number): string {
  if (bruto0_100 < 25) return 'Oportunidade baixa'
  if (bruto0_100 < 50) return 'Oportunidade média'
  if (bruto0_100 < 75) return 'Oportunidade alta'
  return 'Oportunidade muito alta'
}

function biomaCoef(b: string | null | undefined): number {
  if (!b) return 1
  const k = b.trim()
  const o: Record<string, number> = {
    Amazonia: 1.3,
    'Amazônia': 1.3,
    'MATA ATLANTICA': 1.2,
    'MATA ATLÂNTICA': 1.2,
    Pantanal: 1.25,
    Cerrado: 1.1,
    Caatinga: 1,
    Pampa: 1,
  }
  return o[k] ?? 1
}

function warnCoerenciaDimensao(label: string, d: DimensaoOutput) {

  const ponderados = d.subfatores.filter((r) => r.peso_pct != null)

  const residuais = d.subfatores.filter((r) => r.peso_pct == null)

  const somaPond = ponderados.reduce((s, r) => s + r.valor, 0)

  const somaResidual = residuais.reduce((s, r) => s + r.valor, 0)

  if (Math.abs(somaPond + somaResidual - d.valor) > 0.501)

    console.warn(

      '[scoringMotorS31] Coerência ' +

        label +

        ': ponderados=' +

        somaPond.toFixed(3) +

        ' + ajuste=' +

        somaResidual.toFixed(3) +

        ' vs dimensão.valor=' +

        d.valor,

    )

}



const fmtBr1 = (n: number) =>

  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(n)



function textoRegulPendencias(n: number | null): string {

  const c =

    n != null && Number.isFinite(Number(n)) ? Math.max(0, Math.floor(Number(n))) : null

  if (c == null || c <= 0) return 'Sem pendências administrativas em aberto no retrato atual do cadastro.'

  if (c === 1)

    return 'Há uma pendência administrativa em aberto segundo o retrato atual do cadastro público.'

  return `Há ${c} pendências administrativas em aberto segundo o retrato atual do cadastro público.`

}



function textoRegulCaducidade(dCad: number | null): string {

  if (dCad == null)

    return 'Prazos de validade incompletos no cadastro ou sem data objetiva aqui — situação examinada com o regime declarado.'

  if (dCad < 0) return 'Documentação obrigatória aparece já vencida na linha temporal do cadastro.'

  return `Documentação obrigatória com cerca de ${Math.round(dCad)} dias até a data‑limite tratada pelo cadastro.`

}



function textoRegulUltimaMov(dias: number | null): string {

  if (dias == null) return 'Data do último evento público não consolidada aqui.'

  return `Última movimentação pública há cerca de ${Math.round(dias)} dias segundo o último evento disponível.`

}



function textoRegulCapag(notaRaw: string | null | undefined): string {

  if (notaRaw != null && String(notaRaw).trim().length > 0)

    return `Situação fiscal municipal segundo nota declarada (${String(notaRaw).trim()}) nos critérios oficiais de capacidade de pagamento do ente.`

  return 'Nota técnico‑fiscal do ente local não declarada aqui; cenário tratado como neutro.'

}



const dbUrl = process.env.DATABASE_URL ?? process.env.VITE_DATABASE_URL
let _sql: ReturnType<typeof postgres> | null = null
function getSql() {
  if (!dbUrl) throw new Error('DATABASE_URL or VITE_DATABASE_URL required for S31')
  if (!_sql) {
    _sql = postgres(dbUrl, {
      max: 20,
      idle_timeout: 0,
      connect_timeout: 60,
      prepare: false,
      ssl: /supabase|amazonaws/i.test(dbUrl) ? 'require' : false,
    })
  }
  return _sql
}

export type ProcessoMotorRow = {
  id: string
  numero: string
  uf: string | null
  municipio_ibge: string | null
  substancia: string | null
  substancia_familia: string | null
  fase: string | null
  regime: string | null
  area_ha: number | null
  app_overlap_pct: number | null
  bioma_territorial: string | null
  ativo_derivado: boolean
  situacao: string | null
  geog: unknown
  amb_ti_sobrepoe: boolean | null
  amb_quilombola_sobrepoe: boolean | null
  amb_uc_pi_sobrepoe: boolean | null
  amb_assentamento_sobrepoe: boolean | null
  amb_assentamento_2km: boolean | null
  amb_app_sobrepoe: boolean | null
  amb_uc_us_5km: boolean | null
  amb_aquifero_5km: boolean | null
  alvara_validade: string | null
  gu_validade: string | null
  ral_ultimo_data: string | null
  inicio_lavra_data: string | null
  portaria_lavra_data: string | null
  pendencias_abertas: number | null
  ultimo_evento_data: string | null
  capag_nota: string | null
  idh_municipio: number | null
  pib_pc_municipio: number | null
  densidade_demografica: number | null
  autonomia_fiscal_ratio: number | null
  incentivo_b7: number | null
  receita_tributaria: number | null
  divida_consolidada: number | null
}

export type LayerRow = {
  tipo: string
  nome: string
  distancia_km: number
  sobreposicao_pct: number | null
}

export type SubData = {
  gap_pp: number | null
  preco_brl: number | null
  preco_usd: number | null
  tendencia: string | null
  val_reserva_brl_ha: number | null
  mineral_critico_2025: boolean | null
}

/** Caches de leitura para recálculo em massa (config, substâncias, CPT, incentivos, BNDES). */
export type S31MassCaches = {
  configByAba: Record<string, unknown>
  subByUpper: Map<string, SubData>
  cptByUf: Map<string, number>
  incentivoB7ByUf: Map<string, number | null>
  linhasBndes: Array<{ minerais_elegiveis?: string | null; linha?: string | null }>
}

let sessionMassCaches: S31MassCaches | null = null

const FASE_MAP: Record<string, string> = {
  'CONCESSAO DE LAVRA': 'lavra',
  LAVRA: 'lavra',
  'LAVRA GARIMPEIRA': 'lavra',
  'REQUERIMENTO DE LAVRA': 'concessao',
  'DIREITO DE REQUERER A LAVRA': 'concessao',
  LICENCIAMENTO: 'concessao',
  'AUTORIZACAO DE PESQUISA': 'pesquisa',
  PESQUISA: 'pesquisa',
  'REQUERIMENTO DE PESQUISA': 'requerimento',
  DISPONIBILIDADE: 'encerrado',
  'APTO PARA DISPONIBILIDADE': 'encerrado',
}

function mapFase(f: string): string {
  return FASE_MAP[f.toUpperCase().trim()] ?? 'requerimento'
}

const MS_DIA = 86_400_000
function diasDesde(iso: string | null | undefined): number | null {
  if (iso == null || iso === '') return null
  const d = new Date(String(iso))
  if (Number.isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / MS_DIA)
}
function semPrazoAlvara(r: string | null): boolean {
  if (!r) return false
  const x = r.toLowerCase()
  return x.includes('disponibilidade') || (x.includes('concess') && x.includes('lavra'))
}
function diasAteCaducidade(al: string | null, regime: string | null): number | null {
  if (semPrazoAlvara(regime)) return null
  if (!al) return null
  const v = new Date(al)
  if (Number.isNaN(v.getTime())) return null
  return Math.floor((v.getTime() - Date.now()) / MS_DIA)
}

const SCORE_SUB: Record<string, number> = { OURO: 50, 'MINERIO DE OURO': 50, FERRO: 25, 'TERRAS RARAS': 68 }
const SCORE_FASE_OS: Record<string, number> = {
  lavra: 100,
  concessao: 80,
  pesquisa: 50,
  requerimento: 25,
  encerrado: 5,
}

let cfgCache: Record<string, unknown> | null = null
export async function loadConfigScores(): Promise<Record<string, unknown>> {
  if (sessionMassCaches) return sessionMassCaches.configByAba
  if (cfgCache) return cfgCache
  const s = getSql()
  const rows = await s`SELECT aba, dados FROM config_scores`
  cfgCache = {}
  for (const r of rows as unknown as { aba: string; dados: unknown }[]) {
    cfgCache[r.aba] = r.dados
  }
  return cfgCache
}

function pickSubScore(n: string | null, cfg: Record<string, unknown> | null): number {
  if (!n) return 50
  const u = n.replace(/^MIN[EI]RIO DE /i, '').trim().toUpperCase()
  if (SCORE_SUB[u] != null) return SCORE_SUB[u]!
  const t = cfg && cfg['2_RS_GEOLOGICO']
  if (Array.isArray(t)) {
    for (const row of t) {
      if (Array.isArray(row) && row.length >= 2) {
        const a = String(row[0] ?? '').toUpperCase()
        const b = Number(row[1])
        if (a && (a.includes(u) || u.includes(a))) return Number.isFinite(b) ? b : 50
      }
    }
  }
  return 50
}

function capagScore(n: string | null | undefined): number {
  if (n == null || n === '') return 30
  const t = n.trim()
  const m: Record<string, number> = {
    'A+': 0, A: 5, 'B+': 10, B: 15, C: 50, D: 80, 'n.d.': 30, 'N.D.': 30, 'N.E.': 50, 'n.e.': 50,
  }
  return m[t] ?? 30
}

function biomaMult(s: number, b: string | null | undefined): number {
  if (!b) return Math.min(100, Math.round(s))
  const k = b.trim()
  const o: Record<string, number> = {
    'Amazonia': 1.3, 'Amazônia': 1.3, 'MATA ATLANTICA': 1.2, 'MATA ATLÂNTICA': 1.2, Pantanal: 1.25, Cerrado: 1.1,
    Caatinga: 1, Pampa: 1,
  }
  return Math.min(100, Math.round(s * (o[k] ?? 1)))
}

const ti = (l: LayerRow) => /ind[ií]gena|terra\s*ind/i.test(l.tipo)
const qx = (l: LayerRow) => /quilombol/i.test(l.tipo)
const ucpi = (l: LayerRow) => /uc\s*pi|PARNA|integral/i.test(l.tipo)
const uucs = (l: LayerRow) => /uc\s*us|apa|flona/i.test(l.tipo) && !ucpi(l)
const aqu = (l: LayerRow) => /aqu[ií]fer/i.test(l.tipo)
const mine = (ls: LayerRow[], p: (l: LayerRow) => boolean) => {
  const d = ls.filter(p).map((l) => l.distancia_km)
  return d.length ? Math.min(...d) : Number.POSITIVE_INFINITY
}
const ovl = (ls: LayerRow[], p: (l: LayerRow) => boolean, x: number) =>
  ls.some((l) => p(l) && (l.sobreposicao_pct ?? 0) >= x)

export function dimGeologico(
  p: ProcessoMotorRow,
  cfg: Record<string, unknown> | null,
  options?: { returnSubfatores?: boolean },
): number | DimensaoOutput {
  const scoreSubst = pickSubScore(p.substancia, cfg)
  const scoreQual = 50
  const valor = Math.min(100, Math.round(0.5 * scoreSubst + scoreQual * 0.5))
  if (!options?.returnSubfatores) return valor
  const sf: SubfatorOutput[] = [
    {
      nome: 'Substância mineral',
      fonte: 'ANM/config_scores (2_RS_GEOLOGICO)',
      label: classifyLabelRisk(scoreSubst),
      texto:
        p.substancia != null && String(p.substancia).trim().length > 0
          ? `Substância declarada: "${String(p.substancia)}". Índice de relevância minerária ${fmtKm(scoreSubst)}.`
          : 'Substância não informada; cadastro tratado aqui como neutro.',
      valor: scoreSubst * 0.5,
      peso_pct: 0.5,
      valor_bruto: scoreSubst,
    },
    {
      nome: 'Qualidade da informação cadastral',
      fonte: 'Baseline cadastro S31 (50)',
      label: classifyLabelRisk(scoreQual),
      texto:
        scoreQual >= 40
          ? `Qualidade cadastral documental (${fmtKm(scoreQual)}) segundo o referencial uniforme do motor.`
          : 'Qualidade documental granular indisponível; referência intermediária uniforme quando o detalhe não veio no extrato.',
      valor: scoreQual * 0.5,
      peso_pct: 0.5,
      valor_bruto: scoreQual,
    },
  ]
  const out: DimensaoOutput = { valor, subfatores: sf }
  warnCoerenciaDimensao('Geológico', out)
  return out
}

export async function dimAmbiental(
  p: ProcessoMotorRow,
  ls: LayerRow[],
  options?: { returnSubfatores?: boolean },
): Promise<number | DimensaoOutput> {
  const want = !!options?.returnSubfatores
  const subs: SubfatorOutput[] = []
  const s = getSql()
  const t1 = ls.find(ti)
  const q1 = ls.find(qx)
  const ucp = ls.filter(ucpi)
  const tiS = p.amb_ti_sobrepoe === true || ovl(ls, ti, 100)
  const qS = p.amb_quilombola_sobrepoe === true || ovl(ls, qx, 100)
  const uS = p.amb_uc_pi_sobrepoe === true || ucp.some((u) => (u.sobreposicao_pct ?? 0) >= 100)

  const fonteMix = 'ICMBio/FUNAI/INCRA/ANA + territorial_layers + SQL interno'
  const pushBio = (preBio: number, valorFinal: number) => {
    if (!want) return
    const coef = biomaCoef(p.bioma_territorial)
    subs.push({
            nome: 'Multiplicador de bioma',

      fonte: 'IBGE/bioma_territorial',

      label: '',

      texto:

        p.bioma_territorial != null && String(p.bioma_territorial).trim().length > 0

          ? `${String(p.bioma_territorial).trim()}: multiplicador ${fmtBr1(coef)}× sobre os pontos ambientais brutos (antes do teto aplicado).`

          : `Bioma não informado ao cadastro; multiplicador 1,0× sobre os pontos ambientais brutos.`,

      valor: valorFinal - preBio,

      peso_pct: null,

      valor_bruto: coef,

    })
  }

  if (tiS || qS || uS) {
    const preBio = 100
    const valorFinal = biomaMult(100, p.bioma_territorial)
    if (!want) return valorFinal
    const partes: string[] = []
    if (tiS) partes.push('sobreposição com Terra Indígena homologada ou camada equivalente')
    if (qS) partes.push('sobreposição com comunidade quilombola ou camada equivalente')
    if (uS) partes.push('sobreposição com UC de Proteção Integral ou camada equivalente')
    subs.push({
      nome: 'Sobreposição ambiental (teto 100 antes do bioma)',
      fonte: fonteMix,
      label: classifyLabelRisk(100),
      texto: partes.length > 0 ? partes.join('; ') + '.' : 'Vetor de sobreposição calculado.',
      valor: preBio,
      peso_pct: 1,
      valor_bruto: 100,
    })
    pushBio(preBio, valorFinal)
    const out: DimensaoOutput = { valor: valorFinal, subfatores: subs }
    warnCoerenciaDimensao('Ambiental', out)
    return out
  }

  let pt = 0

  const pushDelta = (row: SubfatorOutput) => {
    if (row.valor === 0) return
    pt += row.valor
    if (want) subs.push(row)
  }

  if (t1 && !tiS) {
    let delta = 0
    let bruto = 0
    let txt = ''
    if (t1.distancia_km <= 5) {
      delta = 50
      bruto = 50
      txt = `${t1.nome ?? 'Terra Indígena'} a ${fmtKm(t1.distancia_km)} km (≤ 5 km).`
    } else if (t1.distancia_km <= 10) {
      delta = 30
      bruto = 30
      txt = `${t1.nome ?? 'Terra Indígena'} a ${fmtKm(t1.distancia_km)} km (≤ 10 km).`
    } else if (t1.distancia_km <= 20) {
      delta = 15
      bruto = 15
      txt = `${t1.nome ?? 'Terra Indígena'} a ${fmtKm(t1.distancia_km)} km (≤ 20 km).`
    }
    pushDelta({
      nome: 'Proximidade a Terra Indígena',
      fonte: 'FUNAI/territorial_layers',
      label: classifyLabelRisk(bruto),
      texto:
        delta > 0
          ? txt
          : `Sem proximidade em faixa de pontuação; mais próximo: ${fmtKm(t1.distancia_km)} km.`,
      valor: delta,
      peso_pct: 1,
      valor_bruto: bruto,
    })
  }

  const umin = ucp.length ? Math.min(...ucp.map((u) => u.distancia_km)) : Number.POSITIVE_INFINITY
  const ucNear = ucp.length ? ucp.reduce((a, b) => (a.distancia_km <= b.distancia_km ? a : b)) : null
  if (Number.isFinite(umin) && !uS) {
    let delta = 0
    let bruto = 0
    let txt = ''
    if (umin <= 5) {
      delta = 40
      bruto = 40
      txt = `${ucNear?.nome ?? 'UC PI'} a ${fmtKm(umin)} km (≤ 5 km).`
    } else if (umin <= 10) {
      delta = 20
      bruto = 20
      txt = `${ucNear?.nome ?? 'UC PI'} a ${fmtKm(umin)} km (≤ 10 km).`
    } else txt = `Sem UC de Proteção Integral próxima em faixa pontuada (${fmtKm(umin)} km).`
    pushDelta({
      nome: 'UC Proteção Integral próxima',
      fonte: 'ICMBio/territorial_layers',
      label: classifyLabelRisk(bruto),
      texto: delta > 0 ? txt : `Sem pontos: distância ${fmtKm(umin)} km.`,
      valor: delta,
      peso_pct: 1,
      valor_bruto: bruto,
    })
  }

  if (q1 && !qS) {
    let delta = 0
    let bruto = 0
    let txt = ''
    if (q1.distancia_km <= 5) {
      delta = 45
      bruto = 45
      txt = `${q1.nome ?? 'Território quilombola'} a ${fmtKm(q1.distancia_km)} km (≤ 5 km).`
    } else if (q1.distancia_km <= 10) {
      delta = 25
      bruto = 25
      txt = `${q1.nome ?? 'Território quilombola'} a ${fmtKm(q1.distancia_km)} km (≤ 10 km).`
    }
    pushDelta({
      nome: 'Proximidade a território quilombola',
      fonte: 'INCRA/territorial_layers',
      label: classifyLabelRisk(bruto),
      texto: delta > 0 ? txt : `Sem quilombola em faixa pontuada (${fmtKm(q1.distancia_km)} km).`,
      valor: delta,
      peso_pct: 1,
      valor_bruto: bruto,
    })
  }

  // Usa coluna geog precomputada (4326) + GIST em geo_sitios_arqueologicos — evita ST_Transform por linha
  if (p.geog != null) {
    const d0 = (await s`
      SELECT MIN(ST_Distance(p.geog, s.geog)) / 1000 AS d
      FROM processos p
      CROSS JOIN geo_sitios_arqueologicos s
      WHERE p.id = ${p.id}
        AND ST_DWithin(p.geog, s.geog, 5000)
    `) as { d: string | null }[]
    const dk = d0[0]?.d != null ? Number(d0[0].d) : null
    let dkPts = 0
    if (dk != null && Number.isFinite(dk)) {
      if (dk <= 1) dkPts = 30
      else if (dk <= 5) dkPts = 15
    }
    if (dkPts > 0 && dk != null)
      pushDelta({
        nome: 'Sítios arqueológicos próximos',
        fonte: 'IPHAN/geo_sitios_arqueologicos',
        label: classifyLabelRisk(dkPts),
        texto: `Sítio arqueológico a ${fmtKm(dk)} km (≤ ${dkPts === 30 ? '1' : '5'} km).`,
        valor: dkPts,
        peso_pct: 1,
        valor_bruto: dkPts,
      })
  }

  const ap = p.app_overlap_pct
  if (ap != null) {
    let delta = 0
    if (ap > 10) delta = 25
    else if (ap >= 1) delta = 15
    else if (ap > 0) delta = 8
    pushDelta({
      nome: 'APP hídrica',
      fonte: 'ANA/geo_processos/overlap_pct',
      label: classifyLabelRisk(delta),
      texto:
        delta > 0
          ? `Sobreposição com APP ${fmtKm(ap)}%`
          : 'Sem sobreposição APP registrada sobre limiares de pontuação.',
      valor: delta,
      peso_pct: 1,
      valor_bruto: delta,
    })
  } else if (p.amb_app_sobrepoe)
    pushDelta({
      nome: 'APP hídrica',
      fonte: 'flags processo/motor',
      label: classifyLabelRisk(8),
      texto: 'Flag de sobreposição com APP.',
      valor: 8,
      peso_pct: 1,
      valor_bruto: 8,
    })

  const usL = ls.filter((l) => uucs(l))
  if (usL.some((u) => (u.sobreposicao_pct ?? 0) > 0))
    pushDelta({
      nome: 'UC Uso Sustentável próxima (sobreposição)',
      fonte: 'ICMBio/territorial_layers',
      label: classifyLabelRisk(20),
      texto: 'Sobreposição com UC Uso Sustentável / APA etc.',
      valor: 20,
      peso_pct: 1,
      valor_bruto: 20,
    })
  else {
    const x = mine(ls, (l) => uucs(l) && !ucpi(l))
    if (Number.isFinite(x) && x <= 5)
      pushDelta({
        nome: 'UC Uso Sustentável próxima',
        fonte: 'ICMBio/territorial_layers',
        label: classifyLabelRisk(10),
        texto: `Infraestrutura UC/US a ${fmtKm(x)} km (≤ 5 km); sem sobrep. positiva.`,
        valor: 10,
        peso_pct: 1,
        valor_bruto: 10,
      })
  }

  const beforeFloor = pt
  if (p.amb_uc_us_5km) pt = Math.max(pt, 10)
  const flo = pt - beforeFloor
  if (want && flo > 0)
    subs.push({
      nome: 'Piso de proximidade UC Uso Sustentável (5 km)',
      fonte: 'flags territorial',
      label: classifyLabelRisk(10),
      texto: `Flag amb_uc_us_5km aplica piso mínimo (+${fmtKm(flo)}) sem alteração da soma além da própria regra.`,
      valor: flo,
      peso_pct: 1,
      valor_bruto: 10,
    })

  const a = ls.find(aqu)
  if (a) {
    let delta = 0
    let bruto = 0
    let txt = ''
    if ((a.sobreposicao_pct ?? 0) > 0) {
      delta = 15
      bruto = 15
      txt = 'Sobreposição com aquífero.'
    } else if (a.distancia_km <= 1) {
      delta = 10
      bruto = 10
      txt = `Aquífero a ${fmtKm(a.distancia_km)} km (≤ 1 km).`
    } else if (a.distancia_km <= 5) {
      delta = 5
      bruto = 5
      txt = `Aquífero a ${fmtKm(a.distancia_km)} km (≤ 5 km).`
    }
    pushDelta({
      nome: 'Aquífero subjacente',
      fonte: 'ANA/camadas hidrogeológicas',
      label: classifyLabelRisk(bruto),
      texto: delta > 0 ? txt : 'Sem aquífero em faixa pontuada.',
      valor: delta,
      peso_pct: 1,
      valor_bruto: bruto,
    })
  } else if (p.amb_aquifero_5km)
    pushDelta({
      nome: 'Aquífero subjacente',
      fonte: 'flags territorial',
      label: classifyLabelRisk(5),
      texto: 'Flag amb_aquifero_5km.',
      valor: 5,
      peso_pct: 1,
      valor_bruto: 5,
    })

  const rawLin = pt
  const preBio = Math.min(100, rawLin)
  if (want && rawLin > 100)
    subs.push({
      nome: 'Teto da soma linear (100 pontos)',
      fonte: 'Regra motor S31 ambiental',
      label: '',
      texto: `Soma linear ${fmtKm(rawLin)} limitada a 100 antes do bioma.`,
      valor: preBio - rawLin,
      peso_pct: 1,
      valor_bruto: preBio - rawLin,
    })

  const valorFinal = biomaMult(preBio, p.bioma_territorial)
  if (!want) return valorFinal

  pushBio(preBio, valorFinal)
  const out: DimensaoOutput = { valor: valorFinal, subfatores: subs }
  warnCoerenciaDimensao('Ambiental', out)
  return out
}

function cmu(p: ProcessoMotorRow, ls: LayerRow[]) {
  if (p.amb_assentamento_sobrepoe) return 85
  if (p.amb_assentamento_2km) return 60
  const a = Math.min(mine(ls, ti) || 9e9, mine(ls, qx) || 9e9)
  if (a < 5) return 65
  if (a < 10) return 35
  if (a < 20) return 15
  return 5
}
function idh0(x: number | null) {
  if (x == null) return 35
  if (x < 0.5) return 80
  if (x < 0.6) return 60
  if (x < 0.7) return 35
  if (x < 0.8) return 15
  return 5
}
function dns(x: number | null) {
  if (x == null) return 5
  if (x > 100) return 60
  if (x > 50) return 35
  if (x > 10) return 15
  return 5
}
function pib0(x: number | null) {
  if (x == null || x <= 0) return 35
  if (x < 8e4) return 20
  if (x < 1e5) return 50
  if (x < 15e4) return 60
  return 75
}

export function dimSocial(
  p: ProcessoMotorRow,
  ls: LayerRow[],
  cpt: number,
  options?: { returnSubfatores?: boolean },
): number | DimensaoOutput {
  const c1 = cmu(p, ls)
  const c2 = Math.round(0.5 * idh0(p.idh_municipio) + 0.5 * pib0(p.pib_pc_municipio))
  const c3 = Math.min(100, Math.max(0, 30 + 70 * (cpt - 1)))
  const c4 = dns(p.densidade_demografica)
  const valor = Math.min(100, Math.round(c1 * 0.45 + c2 * 0.2 + c3 * 0.2 + c4 * 0.15))
  if (!options?.returnSubfatores) return valor
  const v1 = c1 * 0.45
  const v2 = c2 * 0.2
  const v3 = c3 * 0.2
  const v4 = c4 * 0.15
  const sumW = v1 + v2 + v3 + v4
  const adj = valor - sumW
  const ufS = (p.uf ?? '').trim()

  const den = p.densidade_demografica

  const textoDen =

    den != null && Number.isFinite(den)

      ? `Adensamento humano na área urbana habitual (~${fmtBr1(den)} hab/km²).`

      : 'Densidade municipal não declarada ao motor; cenário tratado aqui como adensamento baixo‑moderado.'



  const sf: SubfatorOutput[] = [

    {

      nome: 'Comunidades vulneráveis',

      fonte: 'FUNAI/INCRA/ICMBio — malhas territoriais',

      label: classifyLabelRisk(c1),

      texto:

        `Proximidade ou sobreposição com terras indígenas, quilombolas e demais territórios em situação de vulnerabilidade institucional, segundo distâncias calculadas sobre a malha vigente.`,

      valor: v1,

      peso_pct: 0.45,

      valor_bruto: c1,

    },

    {

      nome: 'Socioeconômico do município',

      fonte: 'IBGE — IDH municipal e PIB/hab.',

      label: classifyLabelRisk(c2),

      texto:

        `Condição socioeconômica sintetizada pelo IDH municipal e pela renda per capita oficialmente divulgada.`,

      valor: v2,

      peso_pct: 0.2,

      valor_bruto: c2,

    },

    {

      nome: 'Conflitos territoriais (CPT)',

      fonte: 'CPT — registros estaduais',

      label: classifyLabelRisk(c3),

      texto:

        ufS.length > 0

          ? `Incidentes de conflitos no campo listados pelo CPT para o estado ${ufS.toUpperCase()}.`

          : `Incidentes de conflitos no campo segundo cadastro CPT (UF não informada).`,

      valor: v3,

      peso_pct: 0.2,

      valor_bruto: c3,

    },

    {

      nome: 'Densidade demográfica',

      fonte: 'IBGE — densidade municipal',

      label: classifyLabelRisk(c4),

      texto: textoDen,

      valor: v4,

      peso_pct: 0.15,

      valor_bruto: c4,

    },

  ]

  if (Math.abs(adj) > 1e-6) {

    sf.push({

      nome: 'Ajuste consolidador social',

      fonte: 'arredondamento do índice da dimensão',

      label: '',

      texto: `Diferença de ${fmtBr1(adj)} para reconciliar o índice exibido com o arredondamento aplicado à combinação anterior (${fmtBr1(sumW)}).`,

      valor: adj,

      peso_pct: null,

      valor_bruto: adj,

    })

  }

  const out: DimensaoOutput = { valor, subfatores: sf }
  warnCoerenciaDimensao('Social', out)
  return out
}

function t0(d: number | null) { if (d == null) return 50; if (d > 365) return 80; if (d >= 180) return 50; if (d >= 30) return 20; return 5 }
function p0(n: number | null) { if (n == null) return 5; if (n >= 3) return 75; if (n === 2) return 50; if (n === 1) return 30; return 5 }
function c0(d: number | null, r: string | null, f: string) {
  if (d == null) return semPrazoAlvara(r) || f === 'encerrado' ? 5 : 50
  if (d < 0) return 90
  if (d < 180) return 85
  if (d <= 365) return 50
  return 10
}
function aut0(n: number, t: number) { return Math.min(100, n * 18 + Math.min(50, t / 5e4)) }

export function dimRegul(

  p: ProcessoMotorRow,

  aut: { count: number; total: number },

  options?: { returnSubfatores?: boolean },

): number | DimensaoOutput {

  const f = mapFase(p.fase ?? '')

  const pendN = p.pendencias_abertas != null ? Number(p.pendencias_abertas) : null

  const sp = p0(pendN != null ? pendN : 0)

  const dCad = diasAteCaducidade(p.alvara_validade, p.regime)

  const diasUlt = diasDesde(p.ultimo_evento_data)

  const sc = c0(dCad, p.regime, f)

  const st = t0(diasUlt)

  const sa = aut0(aut.count, aut.total)

  const sa2 = 5

  const cp = capagScore(p.capag_nota)

  let v = sp * 0.25 + sc * 0.2 + sa * 0.2 + st * 0.1 + sa2 * 0.1 + cp * 0.15

  if (sc >= 90 || sa >= 60) v = Math.max(v, 70)

  const valor = Math.min(100, Math.round(v * 10) / 10)

  if (!options?.returnSubfatores) return valor

  const p1 = sp * 0.25

  const p2 = sc * 0.2

  const p3 = sa * 0.2

  const p4 = st * 0.1

  const p5 = sa2 * 0.1

  const p6 = cp * 0.15

  const sumP = p1 + p2 + p3 + p4 + p5 + p6

  const adj = valor - sumP

  const sf: SubfatorOutput[] = [

    {

      nome: 'Pendências abertas',

      fonte: 'cadastro público da ANM',

      label: classifyLabelRisk(sp),

      texto: textoRegulPendencias(pendN),

      valor: p1,

      peso_pct: 0.25,

      valor_bruto: sp,

    },

    {

      nome: 'Caducidade documental',

      fonte: 'eventos públicos — licença/alvará',

      label: classifyLabelRisk(sc),

      texto: textoRegulCaducidade(dCad),

      valor: p2,

      peso_pct: 0.2,

      valor_bruto: sc,

    },

    {

      nome: 'Autuações e débitos',

      fonte: 'ANM — autuações',

      label: classifyLabelRisk(sa),

      texto: `Autuações registradas (${aut.count}); volume econômico associado (${fmtKm(aut.total)}).`,

      valor: p3,

      peso_pct: 0.2,

      valor_bruto: sa,

    },

    {

      nome: 'Tempo do processo',

      fonte: 'último movimento público',

      label: classifyLabelRisk(st),

      texto: textoRegulUltimaMov(diasUlt),

      valor: p4,

      peso_pct: 0.1,

      valor_bruto: st,

    },

    {

      nome: 'Alertas Adoo',

      fonte: 'Adoo / receita estadual (integrações)',

      label: '',

      texto:

        'Integração aos alertas externos ainda em curso nesta pilha; nenhum alerta consolidado retornado pela conexão vigente.',

      valor: p5,

      peso_pct: 0.1,

      valor_bruto: sa2,

    },

    {

      nome: 'CAPAG do município',

      fonte: 'Tesouro Nacional — CAPAG',

      label: classifyLabelRisk(cp),

      texto: textoRegulCapag(p.capag_nota),

      valor: p6,

      peso_pct: 0.15,

      valor_bruto: cp,

    },

  ]

  if (Math.abs(adj) > 1e-8) {

    sf.push({

      nome: 'Ajuste consolidador regulatório',

      fonte: 'arredondamento do índice da dimensão',

      label: '',

      texto: `Diferença de ${fmtBr1(adj)} entre a combinação numérica imediatamente anterior (${fmtBr1(

        sumP,

      )}) e o valor exibido (${fmtBr1(valor)}) após arredondar a uma casa decimal.`,

      valor: adj,

      peso_pct: null,

      valor_bruto: adj,

    })

  }

  const out: DimensaoOutput = { valor, subfatores: sf }

  warnCoerenciaDimensao('Regulatório', out)

  return out

}


function b7(x: number | null) { if (x == null) return 15; if (x >= 3) return 90; if (x >= 2) return 70; if (x >= 1) return 45; return 15 }
function b3(ls: LayerRow[]) {
  let b = 20
  const f = mine(ls, (l) => /ferrov|porto|hidrovi/i.test(l.tipo) || l.tipo.toUpperCase().includes('FERRO'))
  if (f <= 50) b = 90
  else if (f <= 100) b = 70
  else if (f <= 200) b = 45
  return b
}
function fiscalB6(p: ProcessoMotorRow) {
  const r = p.autonomia_fiscal_ratio, rv = p.receita_tributaria, d = p.divida_consolidada
  if (r == null && rv == null && d == null) return 35
  if (r != null) { if (r > 1.2) return 90; if (r > 0.8) return 60; if (r > 0.4) return 35; return 15 }
  if (rv != null && (d == null || d === 0) && rv > 0) return 80
  return 40
}
function cf0(t: number) { if (t <= 0) return 20; if (t < 1e6) return 40; if (t < 2e7) return 60; if (t < 2e8) return 80; return 90 }
function ar0(a: number | null) { if (a == null) return 15; if (a > 2e3) return 90; if (a >= 500) return 70; if (a >= 100) return 50; if (a >= 50) return 30; return 15 }
function bm0(b: string | null) { if (!b) return 50; const u = b.toUpperCase(); if (u.includes('AMAZ') || u.includes('PANTAN')) return 30; if (u.includes('MATA')) return 40; return 60 }

function opAtr(
  p: ProcessoMotorRow,
  sub: SubData | null,
  cfg: Record<string, unknown> | null,
  options?: { returnSubfatores?: boolean },
): number | DimensaoOutput {
  const a1 = pickSubScore(p.substancia, cfg)
  const g = sub?.gap_pp
  let a2 = 40
  if (g != null) {
    if (g > 15) a2 = 95
    else if (g >= 10) a2 = 80
    else if (g >= 5) a2 = 60
    else if (g >= 1) a2 = 40
    else a2 = 15
  }
  const pr = sub?.preco_brl
  let a3 = 30
  if (pr != null && pr > 0) {
    const lg = Math.log10(pr)
    if (lg > 5) a3 = 95
    else if (lg >= 4) a3 = 80
    else if (lg >= 3) a3 = 65
    else if (lg >= 2) a3 = 45
    else if (lg >= 1) a3 = 25
    else a3 = 10
  }
  const M: Record<string, number> = { 'Alta (demanda)': 95, Alta: 90, Estavel: 50, Estável: 50, Queda: 15 }
  const a4 = sub?.tendencia != null ? (M[sub.tendencia] ?? 50) : 50
  let a5 = 10
  const vh = sub?.val_reserva_brl_ha,
    ah = p.area_ha
  if (vh != null && ah != null && ah > 0) {
    const vt = vh * ah
    if (vt >= 1e9) a5 = 95
    else if (vt >= 1e8) a5 = 80
    else if (vt >= 1e7) a5 = 60
    else if (vt >= 1e6) a5 = 35
  }
  let t = Math.round(a1 * 0.25 + a2 * 0.25 + a3 * 0.2 + a4 * 0.15 + a5 * 0.15)
  const mc = !!sub?.mineral_critico_2025
  if (mc) t = Math.min(100, t + 10)
  if (!options?.returnSubfatores) return t
  const w1 = a1 * 0.25
  const w2 = a2 * 0.25
  const w3 = a3 * 0.2
  const w4 = a4 * 0.15
  const w5 = a5 * 0.15
  const baseR = Math.round(a1 * 0.25 + a2 * 0.25 + a3 * 0.2 + a4 * 0.15 + a5 * 0.15)
  const sumW = w1 + w2 + w3 + w4 + w5
  const adjBase = baseR - sumW
  const bonus = mc ? Math.min(100, baseR + 10) - baseR : 0
  const sf: SubfatorOutput[] = [
    {
      nome: 'Relevância da substância (A1)',
      fonte: 'ANM/config_scores master_substâncias',
      label: classifyLabelOpp(a1),
      texto: `Substância ${p.substancia ?? '—'} mapeada com índice sintético ${fmtKm(a1)} no quadro atual.`,
      valor: w1 + adjBase / 5,
      peso_pct: 0.25,
      valor_bruto: a1,
    },
    {
      nome: 'Espaço de mercado (gap) (A2)',
      fonte: 'master_substancias.gap_pp',
      label: classifyLabelOpp(a2),
      texto:
        g != null
          ? `Gap de mercado (${fmtKm(g)} p.p.) entre substância e benchmark interno.`
          : 'Mercado não informado; cenário econômico marcado aqui como referência média.',
      valor: w2 + adjBase / 5,
      peso_pct: 0.25,
      valor_bruto: a2,
    },
    {
      nome: 'Preço de mercado (A3)',
      fonte: 'séries mercado interno',
      label: classifyLabelOpp(a3),
      texto:
        pr != null && pr > 0
          ? `Preço médio monitorado (${fmtKm(pr)} BRL/t).`
          : 'Preço externo não informado; posição econômica marcada aqui como fraca até nova evidência.',
      valor: w3 + adjBase / 5,
      peso_pct: 0.2,
      valor_bruto: a3,
    },
    {
      nome: 'Tendência de demanda (A4)',
      fonte: 'curvas de mercado',
      label: classifyLabelOpp(a4),
      texto:
        sub?.tendencia != null
          ? `Tendência de mercado registrada: ${sub.tendencia}.`
          : 'Tendência não informada; trajetória assumida estável até novo dado.',
      valor: w4 + adjBase / 5,
      peso_pct: 0.15,
      valor_bruto: a4,
    },
    {
      nome: 'Valor da reserva por hectare (A5)',
      fonte: 'val_reserva × área',
      label: classifyLabelOpp(a5),
      texto:
        vh != null && ah != null && ah > 0
          ? `Valor reserva/ha × área (${fmtKm(vh)} × ${fmtKm(ah)} ha).`
          : 'Sem valores de reserva econômica nem áreas declaradas; cenário econômico marcado aqui como muito restrito.',
      valor: w5 + adjBase / 5,
      peso_pct: 0.15,
      valor_bruto: a5,
    },
  ]

    sf.push({
      nome: 'Bônus mineral crítico',
      fonte: 'master_substancias.mineral_critico_2025',
      label: '',
      texto: mc ? 'Substância marcada como mineral crítico 2025: +10 pontos (fora da média ponderada).' : 'Substância sem flag de criticidade: sem bônus.',
      valor: bonus,
      peso_pct: null,
      valor_bruto: mc ? 10 : 0,
    })
  const out: DimensaoOutput = { valor: t, subfatores: sf }
  warnCoerenciaDimensao('Atratividade', out)
  return out
}

function b3InfraText(ls: LayerRow[]): string {
  const pred = (l: LayerRow) => /ferrov|porto|hidrovi/i.test(l.tipo) || l.tipo.toUpperCase().includes('FERRO')
  const cand = ls.filter(pred)
  if (!cand.length) return 'Nenhuma ferrovia, porto ou hidrovia identificada na malha listada; distância de referência neutra usada (20 em escala interna).'
  const best = cand.reduce((a, b) => (a.distancia_km <= b.distancia_km ? a : b))
  return `${best.tipo} a ${fmtKm(best.distancia_km)} km (menor distância).`
}

function opVab(
  p: ProcessoMotorRow,
  ls: LayerRow[],
  cf: number,
  bnd: boolean,
  options?: { returnSubfatores?: boolean },
): number | DimensaoOutput {
  const f = mapFase(p.fase ?? '')
  const b1 = SCORE_FASE_OS[f] ?? 25,
    b2 = 50,
    b3m = b3(ls),
    b4 = p.ativo_derivado === false || f === 'encerrado' ? 5 : 90,
    b5 = cf0(cf)
  const b6m = fiscalB6(p)
  const b7Base = b7(p.incentivo_b7)
  const b7n = Math.min(100, b7Base + (bnd ? 5 : 0))
  const b8m = bm0(p.bioma_territorial)
  const b9m = ar0(p.area_ha)
  const valor = Math.round(
    b1 * 0.2 + b2 * 0.15 + b3m * 0.15 + b4 * 0.15 + b5 * 0.1 + b6m * 0.1 + b7n * 0.05 + b8m * 0.05 + b9m * 0.05,
  )
  if (!options?.returnSubfatores) return valor
  const p1 = b1 * 0.2
  const p2 = b2 * 0.15
  const p3 = b3m * 0.15
  const p4 = b4 * 0.15
  const p5 = b5 * 0.1
  const p6 = b6m * 0.1
  const p7 = b7n * 0.05
  const p8 = b8m * 0.05
  const p9 = b9m * 0.05
  const sumP = p1 + p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9
  const adj = valor - sumP
  const sf: SubfatorOutput[] = [
    {
      nome: 'Fase do processo (B1)',
      fonte: 'ANM/fase',
      label: classifyLabelOpp(b1),
      texto: `Fase declarada ${p.fase ?? '—'}; posição no quadro de fases ${fmtKm(b1)}.`,
      valor: p1 + adj / 9,
      peso_pct: 0.2,
      valor_bruto: b1,
    },
    {
      nome: 'Profundidade do dado geológico (B2)',
      fonte: 'parâmetros internos de profundidade',
      label: classifyLabelOpp(b2),
      texto: 'Profundidade geológica conforme modelagem interna; referência central em 50 na escala adotada.',
      valor: p2 + adj / 9,
      peso_pct: 0.15,
      valor_bruto: b2,
    },
    {
      nome: 'Infraestrutura logística (B3)',
      fonte: 'IBGE/ports + malha logística',
      label: classifyLabelOpp(b3m),
      texto: `${b3InfraText(ls)}; posição infraestrutural ${fmtKm(b3m)} no mesmo quadro.`,
      valor: p3 + adj / 9,
      peso_pct: 0.15,
      valor_bruto: b3m,
    },
    {
      nome: 'Situação atual (B4)',
      fonte: 'ativo/situação',
      label: classifyLabelOpp(b4),
      texto: p.ativo_derivado === false || f === 'encerrado' ? 'Processo inativo ou encerrado.' : 'Processo ativo.',
      valor: p4 + adj / 9,
      peso_pct: 0.15,
      valor_bruto: b4,
    },
    {
      nome: 'CFEM histórica produzida (B5)',
      fonte: 'ANM/CFEM',
      label: classifyLabelOpp(b5),
      texto: `CFEM acumulada ${fmtKm(cf)} → faixa ${fmtKm(b5)}.`,
      valor: p5 + adj / 9,
      peso_pct: 0.1,
      valor_bruto: b5,
    },
    {
      nome: 'Autonomia fiscal do município (B6)',
      fonte: 'RGF/receitas',
      label: classifyLabelOpp(b6m),
      texto: 'Indicadores de autonomia e dívida consolidada.',
      valor: p6 + adj / 9,
      peso_pct: 0.1,
      valor_bruto: b6m,
    },
    {
      nome: 'Incentivos regionais (B7)',
      fonte: 'config incentivo_b7 + linhas BNDES',
      label: classifyLabelOpp(b7n),
      texto: `Incentivo estadual ${fmtKm(b7Base)}${bnd ? ' + bônus BNDES +5' : ''} → ${fmtKm(b7n)}.`,
      valor: p7 + adj / 9,
      peso_pct: 0.05,
      valor_bruto: b7n,
    },
    {
      nome: 'Bioma operacional (B8)',
      fonte: 'IBGE/bioma',
      label: classifyLabelOpp(b8m),
      texto: `Bioma ${p.bioma_territorial ?? '—'} → ${fmtKm(b8m)}.`,
      valor: p8 + adj / 9,
      peso_pct: 0.05,
      valor_bruto: b8m,
    },
    {
      nome: 'Área do processo (B9)',
      fonte: 'declarada ANM',
      label: classifyLabelOpp(b9m),
      texto: `Área ${p.area_ha != null ? fmtKm(p.area_ha) + ' ha' : 'não informada'}.`,
      valor: p9 + adj / 9,
      peso_pct: 0.05,
      valor_bruto: b9m,
    },
  ]
  const out: DimensaoOutput = { valor, subfatores: sf }
  warnCoerenciaDimensao('Viabilidade', out)
  return out
}

function opSeg(
  risk: number,
  p: ProcessoMotorRow,
  aut: { count: number },
  options?: { returnSubfatores?: boolean },
): number | DimensaoOutput {
  const c1 = 100 - risk,
    c2 = p.gu_validade ? 75 : 50,
    c3 = aut.count ? 50 : 75,
    c4 = 50
  const valor = Math.round(c1 * 0.5 + c2 * 0.25 + c3 * 0.2 + c4 * 0.05)
  if (!options?.returnSubfatores) return valor
  const w1 = c1 * 0.5
  const w2 = c2 * 0.25
  const w3 = c3 * 0.2
  const w4 = c4 * 0.05
  const sumW = w1 + w2 + w3 + w4
  const adj = valor - sumW
  const sf: SubfatorOutput[] = [
    {
      nome: 'Solidez geral (100 − Risk)',
      fonte: 'consolidador risk_score',
      label: classifyLabelOpp(c1),
      texto: `Risco consolidado ${fmtKm(risk)} → complemento ${fmtKm(c1)}.`,
      valor: w1 + adj / 4,
      peso_pct: 0.5,
      valor_bruto: c1,
    },
    {
      nome: 'Estabilidade documental',
      fonte: 'gu_validade',
      label: classifyLabelOpp(c2),
      texto: p.gu_validade ? 'GU dentro da validade (75).' : 'GU ausente/expirada (50).',
      valor: w2 + adj / 4,
      peso_pct: 0.25,
      valor_bruto: c2,
    },
    {
      nome: 'Histórico de cumprimento',
      fonte: 'autuações/aut.count',
      label: classifyLabelOpp(c3),
      texto: aut.count ? 'Há autuações registradas (50).' : 'Sem autuações mapeadas (75).',
      valor: w3 + adj / 4,
      peso_pct: 0.2,
      valor_bruto: c3,
    },
    {
      nome: 'Bônus alertas Adoo',
      fonte: 'Adoo/integration',
      label: '',
      texto: 'Integração pendente (placeholder 50).',
      valor: w4 + adj / 4,
      peso_pct: 0.05,
      valor_bruto: c4,
    },
  ]
  const out: DimensaoOutput = { valor, subfatores: sf }
  warnCoerenciaDimensao('Segurança', out)
  return out
}

function pen(v: number, p: ProcessoMotorRow, risk: number, a: number, s: number, g: number, rec: string[], first: boolean) {
  const f = mapFase(p.fase ?? ''), t = (p.situacao ?? '').toLowerCase()
  let o = v
  if (/bloqueio\s*perma|permanen/.test(t)) { o = Math.min(o, 10); if (first) rec.push('Bloqueio permanente (cap 10)') }
  if (f === 'encerrado' || p.ativo_derivado === false) { o = Math.min(o, 20); if (first) rec.push('Encerrado/inativo (cap 20)') }
  if (a >= 95 || s >= 95) { o = Math.min(o, 25); if (first) rec.push('Veto socioambiental (cap 25)') }
  if (t.includes('bloqueio prov')) o *= 0.6
  if (g >= 85) o *= 0.5
  if (t.includes('bloquead')) o *= 0.7
  if (risk >= 80) o *= 0.6
  if (risk >= 90) o *= 0.5
  return Math.min(100, Math.round(o * 10) / 10)
}

function rLab(n: number, ativo: boolean) {
  if (!ativo) return { l: 'Processo extinto', c: '#6B7280' }
  if (n <= 39) return { l: 'Risco baixo', c: '#1D9E75' }
  if (n <= 69) return { l: 'Risco médio', c: '#E8A830' }
  return { l: 'Risco alto', c: '#E24B4A' }
}
function oLab(n: number, ativo: boolean) {
  if (!ativo) return { l: 'N/A - Processo extinto', c: '#6B7280' }
  if (n >= 75) return { l: 'Alta', c: '#1D9E75' }
  if (n >= 50) return { l: 'Moderada', c: '#E8A830' }
  if (n >= 25) return { l: 'Baixa', c: '#888780' }
  return { l: 'Nao recomendado', c: '#E24B4A' }
}

export async function loadProcesso(id: string): Promise<ProcessoMotorRow | null> {
  const s = getSql()
  const rows = (await s`
    SELECT
      p.id, p.numero, p.uf, p.municipio_ibge, p.substancia, p.substancia_familia, p.fase, p.regime,
      p.area_ha, p.app_overlap_pct, p.bioma_territorial, p.ativo_derivado,
      NULL::text AS situacao,
      p.geog,
      p.amb_ti_sobrepoe, p.amb_quilombola_sobrepoe, p.amb_uc_pi_sobrepoe,
      p.amb_assentamento_sobrepoe, p.amb_assentamento_2km,
      p.amb_app_sobrepoe, p.amb_uc_us_5km, p.amb_aquifero_5km,
      p.alvara_validade, p.gu_validade, p.ral_ultimo_data, p.inicio_lavra_data, p.portaria_lavra_data,
      p.pendencias_abertas, p.ultimo_evento_data,
      (SELECT c.nota FROM capag_municipios c WHERE c.municipio_ibge = p.municipio_ibge ORDER BY c.ano DESC NULLS LAST LIMIT 1) AS capag_nota,
      (SELECT f.idh FROM fiscal_municipios f WHERE f.municipio_ibge = p.municipio_ibge ORDER BY f.exercicio DESC NULLS LAST LIMIT 1) AS idh_municipio,
      (SELECT (f2.pib_municipal_mi * 1e6 / NULLIF(f2.populacao,0))::float8 FROM fiscal_municipios f2
        WHERE f2.municipio_ibge = p.municipio_ibge ORDER BY f2.exercicio DESC NULLS LAST LIMIT 1) AS pib_pc_municipio,
      (SELECT f3.densidade FROM fiscal_municipios f3 WHERE f3.municipio_ibge = p.municipio_ibge ORDER BY f3.exercicio DESC NULLS LAST LIMIT 1) AS densidade_demografica,
      (SELECT f4.autonomia_ratio FROM fiscal_municipios f4 WHERE f4.municipio_ibge = p.municipio_ibge ORDER BY f4.exercicio DESC NULLS LAST LIMIT 1) AS autonomia_fiscal_ratio,
      (SELECT f5.receita_tributaria FROM fiscal_municipios f5 WHERE f5.municipio_ibge = p.municipio_ibge ORDER BY f5.exercicio DESC NULLS LAST LIMIT 1) AS receita_tributaria,
      (SELECT f6.divida_consolidada FROM fiscal_municipios f6 WHERE f6.municipio_ibge = p.municipio_ibge ORDER BY f6.exercicio DESC NULLS LAST LIMIT 1) AS divida_consolidada,
      COALESCE(iu.score_b7, (iu.score_incentivo)::float8) AS incentivo_b7
    FROM processos p
    LEFT JOIN incentivos_uf iu ON iu.uf = p.uf
    WHERE p.id = ${id}
  `) as ProcessoMotorRow[]
  return rows[0] ?? null
}
export async function loadLayers(id: string) {
  const s2 = getSql()
  return (await s2`
    SELECT tipo, nome, distancia_km, sobreposicao_pct FROM territorial_layers WHERE processo_id = ${id}
  `) as LayerRow[]
}
export async function loadSub(n: string | null) {
  if (!n?.trim()) return null
  const k = n.trim().toUpperCase()
  if (sessionMassCaches?.subByUpper.size) {
    return sessionMassCaches.subByUpper.get(k) ?? null
  }
  const sx = getSql()
  const r = (await sx`
    SELECT gap_pp, preco_brl, preco_usd, tendencia, val_reserva_brl_ha, mineral_critico_2025
    FROM master_substancias WHERE UPPER(substancia_anm) = UPPER(${n}) LIMIT 1
  `) as SubData[]
  return r[0] ?? null
}
export async function loadCpt(uf: string | null) {
  if (!uf?.trim()) return 1
  const u = uf.trim()
  if (sessionMassCaches?.cptByUf.has(u)) {
    const m = sessionMassCaches.cptByUf.get(u)
    return m != null && Number.isFinite(m) ? m : 1
  }
  try {
    const sx = getSql()
    const r = (await sx`SELECT public.fn_cpt_multiplicador_uf(${uf}::text) AS m`) as { m: string }[]
    return r[0]?.m != null ? Number(r[0].m) : 1
  } catch {
    return 1
  }
}
export async function loadCfem(numero: string) {
  const sx = getSql()
  const r = (await sx`
    SELECT COALESCE(SUM(valor_recolhido),0)::float8 AS t FROM cfem_arrecadacao WHERE processo_numero = ${numero}
  `) as { t: string }[]
  return Number(r[0]?.t ?? 0)
}
export async function loadAutu(num: string) {
  const sx = getSql()
  const r = (await sx`
    SELECT COUNT(*)::int AS c, COALESCE(SUM(COALESCE(valor,0)),0)::float8 AS t FROM cfem_autuacao
    WHERE processo_minerario = ${num} AND (ano_publicacao IS NULL OR ano_publicacao >= EXTRACT(YEAR FROM NOW())::int - 2)
  `) as { c: number; t: string }[]
  return { count: r[0]?.c ?? 0, total: Number(r[0]?.t ?? 0) }
}
type BndesRow = { minerais_elegiveis?: string | null; linha?: string | null }
function bndesRowMatch(sub: string, row: BndesRow): boolean {
  const t = sub.trim()
  if (!t) return false
  const low = t.toLowerCase()
  if (row.minerais_elegiveis != null && String(row.minerais_elegiveis).toLowerCase().includes(low)) return true
  if (row.linha != null && String(row.linha).toLowerCase().includes(low)) return true
  return false
}
export async function loadBndes(sub: string | null) {
  if (!sub?.trim()) return false
  if (sessionMassCaches?.linhasBndes.length) {
    return sessionMassCaches.linhasBndes.some((r) => bndesRowMatch(sub, r))
  }
  const sx = getSql()
  const t = await sx`
    SELECT 1 FROM linhas_bndes WHERE
      (minerais_elegiveis IS NOT NULL AND minerais_elegiveis ILIKE ${'%' + sub + '%'})
      OR (linha IS NOT NULL AND linha ILIKE ${'%' + sub + '%'})
    LIMIT 1
  `
  return (t as unknown[]).length > 0
}

export async function runS31MotorAndPersist(
  processoId: string,
  opts: { persist?: boolean; massCaches?: S31MassCaches; returnSubfatores?: boolean } = {},
): Promise<ScoreResult> {
  const prevSess = sessionMassCaches
  const prevCfg = cfgCache
  sessionMassCaches = opts.massCaches ?? null
  const wantSub = opts.returnSubfatores === true
  const persist = opts.persist === true && !wantSub
  let p: ProcessoMotorRow | null
  let ls: LayerRow[], sub: SubData | null, cpt: number, cfg: Record<string, unknown>, aut: { count: number; total: number }
  let cfe: number, bnd: boolean
  try {
  p = await loadProcesso(processoId)
  if (!p) throw new Error('Processo nao encontrado: ' + processoId)
  if (sessionMassCaches?.incentivoB7ByUf.size && p.uf) {
    const u = p.uf.trim()
    if (sessionMassCaches.incentivoB7ByUf.has(u)) p.incentivo_b7 = sessionMassCaches.incentivoB7ByUf.get(u) ?? null
  }
  ;[ls, sub, cpt, cfg, aut, cfe, bnd] = await Promise.all([
    loadLayers(processoId), loadSub(p.substancia), loadCpt(p.uf), loadConfigScores(),
    loadAutu(p.numero), loadCfem(p.numero), loadBndes(p.substancia),
  ])
  const dgR = dimGeologico(p, cfg, { returnSubfatores: wantSub })
  const dg = typeof dgR === 'number' ? dgR : dgR.valor
  const daR = await dimAmbiental(p, ls, { returnSubfatores: wantSub })
  const da = typeof daR === 'number' ? daR : daR.valor
  const dsR = dimSocial(p, ls, cpt, { returnSubfatores: wantSub })
  const ds = typeof dsR === 'number' ? dsR : dsR.valor
  const drR = dimRegul(p, aut, { returnSubfatores: wantSub })
  const dr = typeof drR === 'number' ? drR : drR.valor
  let risk = dg * 0.25 + da * 0.3 + ds * 0.25 + dr * 0.2

  // PISOs ambientais/sociais (mais restritivos primeiro)
  if (da >= 95 || ds >= 95) risk = Math.max(risk, 80)
  else if (da >= 75 || ds >= 75) risk = Math.max(risk, 60)

  // PISOs regulatórios (calibrado pós-smoke BEMISA 864.231/2017)
  if (dr >= 95) risk = Math.max(risk, 75)
  else if (dr >= 85) risk = Math.max(risk, 65)
  else if (dr >= 70) risk = Math.max(risk, 55)

  risk = Math.min(100, Math.round(risk))
  const oaR = opAtr(p, sub, cfg, { returnSubfatores: wantSub })
  const ovR = opVab(p, ls, cfe, bnd, { returnSubfatores: wantSub })
  const osR = opSeg(risk, p, aut, { returnSubfatores: wantSub })
  const oa = typeof oaR === 'number' ? oaR : oaR.valor
  const ov = typeof ovR === 'number' ? ovR : ovR.valor
  const os0 = typeof osR === 'number' ? osR : osR.valor
  const pr = 0.2 * oa + 0.3 * ov + 0.5 * os0, pm = 0.4 * oa + 0.3 * ov + 0.3 * os0, pa = 0.55 * oa + 0.25 * ov + 0.2 * os0
  const R: string[] = []
  const at = p.ativo_derivado !== false
  const oc = pen(pr, p, risk, da, ds, dr, R, true), om = pen(pm, p, risk, da, ds, dr, R, false), oa2 = pen(pa, p, risk, da, ds, dr, R, false)
  // Colunas `scores.os_*` no Postgres: inteiro 0-100
  const ocI = Math.round(oc), omI = Math.round(om), oa2I = Math.round(oa2)
  const rI = rLab(risk, at)
  const cL = oLab(oc, at), mL = oLab(om, at), aL = oLab(oa2, at)
  const osU = om >= 70 ? 'Alta' : om >= 40 ? 'Média' : 'Baixa'
  const dimR = { geologico: { valor: dg, subfatores: [] as unknown[] }, ambiental: { valor: da, subfatores: [] }, social: { valor: ds, subfatores: [] }, regulatorio: { valor: dr, subfatores: [] } }
  const dimO = { atratividade: { valor: oa, subfatores: [] }, viabilidade: { valor: ov, subfatores: [] }, seguranca: { valor: os0, subfatores: [] }, penalidades: R }
  const dimRJson = JSON.parse(JSON.stringify(dimR)) as JSONValue
  const dimOJson = JSON.parse(JSON.stringify(dimO)) as JSONValue
  const s = getSql()
  if (persist) {
    const ex = (await s`SELECT scores_fonte FROM scores WHERE processo_id = ${processoId} LIMIT 1`) as { scores_fonte: string | null }[]
    const skip = ex[0]?.scores_fonte?.startsWith('manual_') ?? false
    if (!skip) {
      await s`
        INSERT INTO scores (processo_id, risk_score, risk_label, risk_cor, os_conservador, os_moderado, os_arrojado, os_label, os_classificacao,
          dimensoes_risco, dimensoes_oportunidade, calculated_at, scores_fonte)
        VALUES (${processoId}::uuid, ${risk}, ${rI.l}, ${rI.c}, ${ocI}, ${omI}, ${oa2I}, ${osU}, ${osU},
          ${s.json(dimRJson)}::jsonb, ${s.json(dimOJson)}::jsonb, NOW(), 's31_v3_20260427')
        ON CONFLICT (processo_id) DO UPDATE SET
          risk_score = EXCLUDED.risk_score, risk_label = EXCLUDED.risk_label, risk_cor = EXCLUDED.risk_cor,
          os_conservador = EXCLUDED.os_conservador, os_moderado = EXCLUDED.os_moderado, os_arrojado = EXCLUDED.os_arrojado,
          os_label = EXCLUDED.os_label, os_classificacao = EXCLUDED.os_classificacao,
          dimensoes_risco = EXCLUDED.dimensoes_risco, dimensoes_oportunidade = EXCLUDED.dimensoes_oportunidade,
          calculated_at = NOW(), scores_fonte = 's31_v3_20260427'
      `
    }
  }
  return {
    risk_score: risk, risk_label: rI.l, risk_cor: rI.c,
    risk_breakdown: { geologico: dg, ambiental: da, social: ds, regulatorio: dr },
    ...(wantSub
      ? {
          dimensoes_risco: {
            geologico: dgR as DimensaoOutput,
            ambiental: daR as DimensaoOutput,
            social: dsR as DimensaoOutput,
            regulatorio: drR as DimensaoOutput,
          },
          dimensoes_oportunidade: {
            atratividade: oaR as DimensaoOutput,
            viabilidade: ovR as DimensaoOutput,
            seguranca: osR as DimensaoOutput,
            penalidades: R,
          },
        }
      : {}),
    os_conservador: ocI, os_moderado: omI, os_arrojado: oa2I,
    os_label_conservador: cL.l, os_label_moderado: mL.l, os_label_arrojado: aL.l,
    os_breakdown: { atratividade: oa, viabilidade: ov, seguranca: os0 },
    detail: {
      scoreSubstancia: pickSubScore(p.substancia, null), scoreFase: SCORE_FASE_OS[mapFase(p.fase ?? '')] ?? 25, scoreQualidade: 50,
      scoreComunidades: 0, scoreCAPAG_rs: 0, scoreCaducidade: 0, scoreRegTempo: 0, scoreRegPendencias: 0, scoreRegAlertas: 0,
      a1:0,a2:0,a3:0,a4:0,a5:0, b1:0,b2:0,b3:0,b4:0,b5:0,b6:0,b7:0, c1:0,c2:0,c3:0,c4:0,c5:0,c6:0,
    },
    fallbacks_usados: ['s31_v3_20260427'],
  }
  } finally {
    sessionMassCaches = prevSess
    cfgCache = prevCfg
  }
}

export async function computeProcessoComBreakdown(processoId: string): Promise<ScoreResult> {
  return runS31MotorAndPersist(processoId, { returnSubfatores: true, persist: false })
}
