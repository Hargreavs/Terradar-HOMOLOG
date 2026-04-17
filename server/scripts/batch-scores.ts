/**
 * Recalcula Risk/OS (motor scoreEngine) e persiste em `scores` (Supabase)
 * com o SHAPE completo `dimensoes_risco.{dim}.subfatores[]` + `dimensoes_oportunidade.{dim}.subfatores[]`
 * — compatível com processos batch_fase1 já persistidos (consumido por
 * `src/lib/riskScoreDecomposicao.ts` e `RelatorioCompleto.tsx`).
 *
 * Uso:
 *   npx tsx server/scripts/batch-scores.ts --numero "864.016/2026" --force
 *
 * Requer `.env` / `.env.local` com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
 */
import { supabase } from '../supabase'
import {
  computeAllScores,
  type ScoreInput,
  type ScoreResult,
} from '../scoreEngine'
import {
  getCapag,
  getFiscal,
  getProcesso,
  getScores,
  getSubstancia,
  getTerritoralAnalysis,
  type TerritorialAnalysis,
} from '../db'
import { parseCliArgs } from './utils/cli-args'

// ══════════════════════════════════════════════════
// SHAPE EXPORTADO PARA `scores.dimensoes_*`
// ══════════════════════════════════════════════════

interface Subfator {
  nome: string
  label: string
  texto: string
  valor: number
  peso_pct: number
  valor_bruto: number
  fonte?: string
}

interface Dimensao {
  valor: number
  subfatores: Subfator[]
}

interface DimensoesRisco {
  geologico: Dimensao
  ambiental: Dimensao
  social: Dimensao
  regulatorio: Dimensao
}

interface DimensoesOportunidade {
  atratividade: Dimensao
  viabilidade: Dimensao
  seguranca: Dimensao
}

// ══════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════

const round1 = (n: number) => Math.round(n * 10) / 10

function labelRs(valor: number): string {
  if (valor <= 0) return '-'
  if (valor < 40) return 'Risco baixo'
  if (valor <= 69) return 'Risco médio'
  return 'Risco alto'
}

function labelOs(valor: number): string {
  if (valor >= 75) return 'Alta'
  if (valor >= 50) return 'Moderada'
  if (valor >= 25) return 'Baixa'
  return 'Não recomendado'
}

function rsSub(
  nome: string,
  valor_bruto: number,
  peso_pct: number,
  texto: string,
  fonte?: string,
): Subfator {
  const valor = round1(valor_bruto * peso_pct)
  return {
    nome,
    label: labelRs(valor),
    texto,
    valor,
    peso_pct,
    valor_bruto,
    fonte,
  }
}

function osSub(
  nome: string,
  valor_bruto: number,
  peso_pct: number,
  texto: string,
  fonte?: string,
): Subfator {
  const valor = round1(valor_bruto * peso_pct)
  return {
    nome,
    label: labelOs(valor_bruto),
    texto,
    valor,
    peso_pct,
    valor_bruto,
    fonte,
  }
}

function capagToLetter(
  capag: Record<string, unknown> | null,
): string | null {
  if (!capag) return null
  const raw = capag.nota ?? capag.capag
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  const up = s.toUpperCase()
  if (up.startsWith('N.D') || up.startsWith('N.E')) return up.replace(/\s/g, '')
  const m = s.match(/[ABCD]/i)
  return m ? m[0].toUpperCase() : null
}

// ── Derivações internas do scoreEngine que não vêm expostas em ScoreResult.detail ──

function deriveScoreIDH(idh: number | null): number {
  if (idh == null) return 35
  if (idh < 0.5) return 80
  if (idh < 0.6) return 60
  if (idh < 0.7) return 35
  if (idh < 0.8) return 15
  return 5
}

function deriveDensidadeHab(input: ScoreInput): number | null {
  if (input.densidade != null && !Number.isNaN(input.densidade)) return input.densidade
  if (
    input.populacao != null &&
    input.area_km2 != null &&
    input.area_km2 > 0
  ) {
    return input.populacao / input.area_km2
  }
  return null
}

function deriveScoreDensidade(densidadeHab: number | null): number {
  if (densidadeHab == null) return 5
  if (densidadeHab > 100) return 60
  if (densidadeHab > 50) return 35
  if (densidadeHab > 10) return 15
  return 5
}

// ══════════════════════════════════════════════════
// BUILDERS POR DIMENSÃO
// ══════════════════════════════════════════════════

function buildGeologicoSubs(
  input: ScoreInput,
  d: ScoreResult['detail'],
): Subfator[] {
  const sub = input.substancia.trim() || '—'
  const fase = input.fase.trim() || '—'
  return [
    rsSub(
      'Substância',
      d.scoreSubstancia,
      0.3,
      `Substância ${sub} (score ${d.scoreSubstancia})`,
      'Terrae/master substâncias',
    ),
    rsSub(
      'Fase do processo',
      d.scoreFase,
      0.45,
      `Fase ${fase} (score ${d.scoreFase})`,
      'ANM/SIGMINE',
    ),
    rsSub(
      'Qualidade da informação',
      d.scoreQualidade,
      0.25,
      `Qualidade inferida pela fase (score ${d.scoreQualidade})`,
      'ANM/Cadastro Mineiro',
    ),
  ]
}

function buildAmbientalSubs(input: ScoreInput): Subfator[] {
  const subs: Subfator[] = []
  const pushHit = (
    nome: string,
    pontos: number,
    texto: string,
    fonte?: string,
  ) => {
    subs.push({
      nome,
      label: labelRs(pontos),
      texto,
      valor: pontos,
      peso_pct: 1,
      valor_bruto: pontos,
      fonte,
    })
  }

  const ti = input.areas_protegidas.find(
    (ap) => ap.tipo === 'TI' && ap.distancia_km <= 0.5,
  )
  if (ti) {
    pushHit(
      'Sobreposição com TI',
      40,
      `TI ${ti.nome} (intersecta; ${ti.distancia_km.toFixed(1)} km)`,
      ti.orgao ?? 'FUNAI',
    )
  }

  const ucPi = input.areas_protegidas.find((ap) => {
    const c = ap.categoria?.trim().toUpperCase()
    return ap.tipo === 'UC' && ap.distancia_km <= 0.5 && (c?.startsWith('PI') ?? false)
  })
  if (ucPi) {
    pushHit(
      'Sobreposição com UC PI',
      35,
      `${ucPi.nome} (${ucPi.categoria ?? 'UC PI'}; intersecta)`,
      ucPi.orgao ?? 'ICMBio/MMA',
    )
  }

  const quil = input.areas_protegidas.find(
    (ap) => ap.tipo === 'QUILOMBOLA' && ap.distancia_km <= 0.5,
  )
  if (quil) {
    pushHit(
      'Sobreposição com quilombo',
      20,
      `${quil.nome} (intersecta)`,
      quil.orgao ?? 'INCRA',
    )
  }

  const ucUs = input.areas_protegidas.find((ap) => {
    const c = ap.categoria?.trim().toUpperCase()
    return (
      ap.tipo === 'UC' &&
      ap.distancia_km <= 5.0 &&
      ap.distancia_km > 0.5 &&
      (c?.startsWith('US') ?? false)
    )
  })
  if (ucUs) {
    pushHit(
      'Proximidade a UC US',
      15,
      `${ucUs.nome} (${ucUs.categoria ?? 'UC US'}; ${ucUs.distancia_km.toFixed(1)} km)`,
      ucUs.orgao ?? 'ICMBio/MMA',
    )
  }

  if (input.aquiferos.length > 0) {
    const nomes = input.aquiferos.map((a) => a.nome).filter(Boolean).slice(0, 2).join(', ')
    pushHit(
      'Aquíferos subjacentes',
      10,
      `${input.aquiferos.length} aquífero(s)${nomes ? `: ${nomes}` : ''}`,
      'ANA/CPRM',
    )
  }

  const biomas = input.bioma.map((b) => b.nome.toUpperCase())
  if (biomas.some((b) => b.includes('AMAZÔNIA') || b.includes('AMAZONIA'))) {
    pushHit('Bioma Amazônia', 10, 'Bioma Amazônia', 'IBGE')
  }
  if (
    biomas.some((b) => b.includes('MATA ATLÂNTICA') || b.includes('MATA ATLANTICA'))
  ) {
    pushHit('Bioma Mata Atlântica', 8, 'Bioma Mata Atlântica', 'IBGE')
  }
  if (biomas.some((b) => b.includes('PANTANAL'))) {
    pushHit('Bioma Pantanal', 8, 'Bioma Pantanal', 'IBGE')
  }

  if (subs.length === 0) {
    subs.push({
      nome: 'Resumo',
      label: '-',
      texto: 'Nenhuma restrição ambiental identificada',
      valor: 0,
      peso_pct: 1,
      valor_bruto: 0,
      fonte: 'Terrae',
    })
  }
  return subs
}

function buildSocialSubs(
  input: ScoreInput,
  d: ScoreResult['detail'],
): Subfator[] {
  const scoreIDH = deriveScoreIDH(input.idh)
  const densidadeHab = deriveDensidadeHab(input)
  const scoreDens = deriveScoreDensidade(densidadeHab)

  const distsCom = input.areas_protegidas
    .filter((ap) => ap.tipo === 'TI' || ap.tipo === 'QUILOMBOLA')
    .map((ap) => ap.distancia_km)
  const minDistCom = distsCom.length > 0 ? Math.min(...distsCom) : null

  const idhTxt =
    input.idh != null
      ? `IDH ${input.idh.toFixed(3)}`
      : 'IDH não disponível (fallback 35)'

  const densTxt =
    densidadeHab != null
      ? `${densidadeHab.toFixed(2)} hab/km²`
      : 'Densidade não disponível (fallback 5)'

  const comTxt =
    minDistCom == null
      ? 'Sem TI/Quilombo no raio analisado'
      : minDistCom < 5
        ? `TI/Quilombo a ${minDistCom.toFixed(1)} km (intersecta ou próximo)`
        : minDistCom < 10
          ? `TI/Quilombo a ${minDistCom.toFixed(1)} km`
          : minDistCom < 20
            ? `TI/Quilombo a ${minDistCom.toFixed(1)} km (zona intermediária)`
            : `TI/Quilombo a ${minDistCom.toFixed(1)} km (distante)`

  const capagTxt =
    input.capag && input.capag.trim() !== ''
      ? `CAPAG ${input.capag}`
      : 'CAPAG indisponível (fallback)'

  return [
    rsSub('IDH-M', scoreIDH, 0.35, idhTxt, 'PNUD/Atlas Brasil'),
    rsSub('Densidade populacional', scoreDens, 0.2, densTxt, 'IBGE/Censo'),
    rsSub(
      'Comunidades tradicionais',
      d.scoreComunidades,
      0.25,
      comTxt,
      'FUNAI/INCRA',
    ),
    rsSub('CAPAG município', d.scoreCAPAG_rs, 0.2, capagTxt, 'STN/SICONFI'),
  ]
}

function buildRegulatorioSubs(
  input: ScoreInput,
  d: ScoreResult['detail'],
): Subfator[] {
  let cadTxt: string
  if (input.alvara_validade) {
    const hoje = new Date()
    const validade = new Date(input.alvara_validade)
    const dias = Math.floor(
      (validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24),
    )
    cadTxt =
      dias < 0
        ? `Alvará vencido há ${Math.abs(dias)} dias`
        : `Alvará expira em ${dias} dias`
  } else {
    const r = (input.regime ?? '').toLowerCase()
    if (r.includes('disponibilidade') || r.includes('concess')) {
      cadTxt = 'Regime sem prazo de alvará (caducidade 5)'
    } else {
      cadTxt = 'Alvará/validade não disponível (fallback 50)'
    }
  }

  return [
    rsSub(
      'Tempo sem despacho',
      50,
      0.3,
      'Fallback 50 (sem ult_evento no cadastro)',
      'ANM/SEI',
    ),
    rsSub(
      'Pendências',
      5,
      0.25,
      'Fallback 5 (sem SEI parseado)',
      'ANM/SEI',
    ),
    rsSub(
      'Alertas restritivos',
      5,
      0.25,
      'Fallback 5 (sem Adoo)',
      'Adoo',
    ),
    rsSub(
      'Proximidade de caducidade',
      d.scoreCaducidade,
      0.2,
      cadTxt,
      'ANM/Cadastro Mineiro',
    ),
  ]
}

function buildAtratividadeSubs(
  input: ScoreInput,
  d: ScoreResult['detail'],
): Subfator[] {
  const m = input.mercado
  const precoTxt =
    m?.preco_usd != null ? `USD ${m.preco_usd.toLocaleString('en-US')}/t` : 'Sem preço spot'
  const gapTxt = m?.gap_pp != null ? `Gap ${m.gap_pp}pp` : 'Sem gap oferta/demanda'
  const tendTxt = m?.tendencia ? `Tendência ${m.tendencia}` : 'Tendência n/d'
  const teorTxt = m?.teor_pct != null ? `Teor ${m.teor_pct}%` : 'Teor n/d'

  return [
    osSub(
      'Relevância estratégica',
      d.a1,
      0.25,
      `Substância ${input.substancia || '—'}`,
      'Terrae/master substâncias',
    ),
    osSub('Gap oferta/demanda', d.a2, 0.25, gapTxt, 'master_substancias'),
    osSub('Preço spot', d.a3, 0.2, precoTxt, 'master_substancias'),
    osSub('Tendência de demanda', d.a4, 0.15, tendTxt, 'master_substancias'),
    osSub(
      'Valor estimado (reserva × preço)',
      d.a5,
      0.15,
      `Área ${input.area_ha.toLocaleString('pt-BR')} ha · ${teorTxt}`,
      'Terrae',
    ),
  ]
}

function buildViabilidadeSubs(
  input: ScoreInput,
  d: ScoreResult['detail'],
): Subfator[] {
  const capagTxt =
    input.capag && input.capag.trim() !== ''
      ? `CAPAG ${input.capag}`
      : 'CAPAG indisponível (fallback 25)'

  const ferrovias = input.infraestrutura
    .filter((i) => i.tipo === 'FERROVIA')
    .map((i) => i.distancia_km)
  const minFerro = ferrovias.length > 0 ? Math.min(...ferrovias) : null
  const portoProx = input.portos.find((p) => p.distancia_km <= 200)
  const infraTxt = [
    minFerro != null
      ? `Ferrovia a ${minFerro.toFixed(1)} km`
      : 'Sem ferrovia próxima',
    portoProx ? `Porto ${portoProx.nome} a ${portoProx.distancia_km.toFixed(1)} km` : null,
  ]
    .filter(Boolean)
    .join('; ')

  let areaTxt: string
  if (input.area_ha > 2000) areaTxt = 'Área grande (> 2.000 ha)'
  else if (input.area_ha >= 500) areaTxt = 'Área média-grande (500–2.000 ha)'
  else if (input.area_ha >= 100) areaTxt = 'Área média (100–500 ha)'
  else if (input.area_ha >= 50) areaTxt = 'Área pequena (50–100 ha)'
  else areaTxt = 'Área muito pequena (< 50 ha)'

  const r = input.receita_tributaria
  const dv = input.divida_consolidada
  const autTxt =
    r == null && dv == null
      ? 'Fiscal indisponível (fallback 35)'
      : dv === 0 || dv == null
        ? r != null && r > 0
          ? 'Sem dívida consolidada, com receita'
          : 'Sem dívida consolidada'
        : r == null || r === 0
          ? 'Dívida sem receita declarada'
          : `Razão receita/dívida ${(r / dv).toFixed(2)}`

  const incTxt =
    input.score_incentivo == null
      ? 'Sem incentivo mapeado (fallback 15)'
      : `Score incentivo UF: ${input.score_incentivo}`

  return [
    osSub('CAPAG município', d.b1, 0.2, capagTxt, 'STN/SICONFI'),
    osSub(
      'Fase do processo',
      d.b2,
      0.2,
      `Fase ${input.fase || '—'}`,
      'ANM/SIGMINE',
    ),
    osSub(
      'Infraestrutura logística',
      d.b3,
      0.15,
      infraTxt || 'Sem infraestrutura próxima mapeada',
      'Terrae/OSM + ANTT/Antaq',
    ),
    osSub(
      'Situação do processo',
      d.b4,
      0.15,
      `Fase ${input.fase || '—'}`,
      'ANM/SIGMINE',
    ),
    osSub(
      'Área do processo',
      d.b5,
      0.1,
      `${input.area_ha.toLocaleString('pt-BR')} ha · ${areaTxt}`,
      'ANM/SIGMINE',
    ),
    osSub(
      'Autonomia fiscal municipal',
      d.b6,
      0.1,
      autTxt,
      'SICONFI/STN',
    ),
    osSub('Incentivos regionais', d.b7, 0.1, incTxt, 'Terrae/incentivos_uf'),
  ]
}

function buildSegurancaSubs(
  result: ScoreResult,
  d: ScoreResult['detail'],
): Subfator[] {
  return [
    osSub(
      'Solidez geral (100 − Risk Score)',
      d.c1,
      0.35,
      `Risk Score ${result.risk_score}`,
      'Terrae/motor RS',
    ),
    osSub(
      'Conformidade ambiental (100 − RS ambiental)',
      d.c2,
      0.2,
      `RS ambiental ${result.risk_breakdown.ambiental}`,
      'Terrae/motor RS',
    ),
    osSub(
      'Regularidade (100 − RS regulatório)',
      d.c3,
      0.15,
      `RS regulatório ${result.risk_breakdown.regulatorio}`,
      'Terrae/motor RS',
    ),
    osSub(
      'Recência de despacho',
      d.c4,
      0.15,
      'Fallback 25 (sem ult_evento)',
      'ANM/SEI',
    ),
    osSub(
      'Ausência de alertas restritivos',
      d.c5,
      0.1,
      'Fallback 100 (sem Adoo)',
      'Adoo',
    ),
    osSub(
      'Alertas favoráveis',
      d.c6,
      0.05,
      'Fallback 15 (sem Adoo)',
      'Adoo',
    ),
  ]
}

function buildDimensoes(
  input: ScoreInput,
  result: ScoreResult,
): {
  dimensoes_risco: DimensoesRisco
  dimensoes_oportunidade: DimensoesOportunidade
} {
  const d = result.detail
  return {
    dimensoes_risco: {
      geologico: {
        valor: result.risk_breakdown.geologico,
        subfatores: buildGeologicoSubs(input, d),
      },
      ambiental: {
        valor: result.risk_breakdown.ambiental,
        subfatores: buildAmbientalSubs(input),
      },
      social: {
        valor: result.risk_breakdown.social,
        subfatores: buildSocialSubs(input, d),
      },
      regulatorio: {
        valor: result.risk_breakdown.regulatorio,
        subfatores: buildRegulatorioSubs(input, d),
      },
    },
    dimensoes_oportunidade: {
      atratividade: {
        valor: result.os_breakdown.atratividade,
        subfatores: buildAtratividadeSubs(input, d),
      },
      viabilidade: {
        valor: result.os_breakdown.viabilidade,
        subfatores: buildViabilidadeSubs(input, d),
      },
      seguranca: {
        valor: result.os_breakdown.seguranca,
        subfatores: buildSegurancaSubs(result, d),
      },
    },
  }
}

// ══════════════════════════════════════════════════
// INPUT BUILDER (replica `computeScoresAuto` de server/db.ts, mas expõe o input)
// ══════════════════════════════════════════════════

async function buildScoreInput(
  processo: Record<string, unknown>,
  analise: TerritorialAnalysis,
  mercado: Record<string, unknown> | null,
  capagData: Record<string, unknown> | null,
  fiscalData: Record<string, unknown> | null,
): Promise<ScoreInput> {
  const uf = String(processo.uf ?? '').trim()

  const { data: incentivosRow } = await supabase
    .from('incentivos_uf')
    .select('score_incentivo')
    .eq('uf', uf)
    .maybeSingle()

  const capagStr = capagToLetter(capagData)
  const precoUsd =
    mercado?.preco_usd != null ? Number(mercado.preco_usd) : null
  const gapPp = mercado?.gap_pp != null ? Number(mercado.gap_pp) : null
  const teorPct =
    mercado?.teor_pct != null ? Number(mercado.teor_pct) : null

  const f = fiscalData

  return {
    substancia: String(processo.substancia ?? ''),
    substancia_familia: String(processo.substancia_familia ?? 'outros') || 'outros',
    fase: String(processo.fase ?? ''),
    regime: processo.regime != null ? String(processo.regime) : null,
    area_ha: Number(processo.area_ha) || 0,
    alvara_validade:
      processo.alvara_validade != null ? String(processo.alvara_validade) : null,
    uf,
    areas_protegidas: analise.areas_protegidas,
    infraestrutura: analise.infraestrutura,
    portos: analise.portos,
    bioma: analise.bioma,
    aquiferos: analise.aquiferos,
    mercado: mercado
      ? {
          preco_usd:
            precoUsd != null && !Number.isNaN(precoUsd) ? precoUsd : null,
          gap_pp: gapPp != null && !Number.isNaN(gapPp) ? gapPp : null,
          tendencia: mercado.tendencia != null ? String(mercado.tendencia) : null,
          teor_pct:
            teorPct != null && !Number.isNaN(teorPct) ? teorPct : null,
          mineral_critico_2025: Boolean(mercado.mineral_critico_2025),
        }
      : null,
    capag: capagStr,
    score_incentivo:
      incentivosRow?.score_incentivo != null
        ? Number(incentivosRow.score_incentivo)
        : null,
    idh: f?.idh != null ? Number(f.idh) : null,
    populacao: f?.populacao != null ? Number(f.populacao) : null,
    area_km2: f?.area_km2 != null ? Number(f.area_km2) : null,
    densidade: f?.densidade != null ? Number(f.densidade) : null,
    receita_tributaria:
      f?.receita_tributaria != null ? Number(f.receita_tributaria) : null,
    divida_consolidada:
      f?.divida_consolidada != null && String(f.divida_consolidada).trim() !== ''
        ? Number(f.divida_consolidada)
        : f?.passivo_nao_circulante != null
          ? Number(f.passivo_nao_circulante)
          : null,
  }
}

// ══════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════

function hasManualRiskScore(
  scores: Record<string, unknown> | null,
): boolean {
  if (scores == null) return false
  const rs = scores.risk_score
  return typeof rs === 'number' && !Number.isNaN(rs)
}

async function runOne(numero: string, force: boolean) {
  const processo = (await getProcesso(numero)) as Record<string, unknown>
  const id = processo.id != null ? String(processo.id) : ''
  if (!id) {
    console.error(`[batch-scores] Processo sem id: ${numero}`)
    process.exitCode = 1
    return
  }

  const existing = (await getScores(id)) as Record<string, unknown> | null
  if (!force && hasManualRiskScore(existing)) {
    console.log(
      `[batch-scores] Pulado (scores já existem; use --force): ${numero}`,
    )
    return
  }

  const municipioIbge = String(processo.municipio_ibge ?? '')
  const substanciaAnm = String(processo.substancia ?? '')

  const [capag, mercado, analise, fiscalMun] = await Promise.all([
    getCapag(municipioIbge),
    getSubstancia(substanciaAnm),
    getTerritoralAnalysis(numero),
    getFiscal(municipioIbge),
  ])

  const input = await buildScoreInput(
    processo,
    analise,
    mercado as Record<string, unknown> | null,
    capag as Record<string, unknown> | null,
    fiscalMun,
  )

  const result = computeAllScores(input)
  const { dimensoes_risco, dimensoes_oportunidade } = buildDimensoes(input, result)

  const row: Record<string, unknown> = {
    processo_id: id,
    risk_score: result.risk_score,
    risk_label: result.risk_label,
    risk_cor: result.risk_cor,
    os_conservador: result.os_conservador,
    os_moderado: result.os_moderado,
    os_arrojado: result.os_arrojado,
    os_label: result.os_label_conservador,
    os_classificacao: result.os_label_conservador,
    dimensoes_risco,
    dimensoes_oportunidade,
    scores_fonte: 'batch_fase1',
  }

  const { error } = await supabase.from('scores').upsert(row, {
    onConflict: 'processo_id',
  })

  if (error) {
    console.error(`[batch-scores] Supabase erro (${numero}):`, error.message)
    process.exitCode = 1
    return
  }

  const geoSubs = dimensoes_risco.geologico.subfatores.length
  const ambSubs = dimensoes_risco.ambiental.subfatores.length
  const socSubs = dimensoes_risco.social.subfatores.length
  const regSubs = dimensoes_risco.regulatorio.subfatores.length
  const atrSubs = dimensoes_oportunidade.atratividade.subfatores.length
  const viaSubs = dimensoes_oportunidade.viabilidade.subfatores.length
  const segSubs = dimensoes_oportunidade.seguranca.subfatores.length

  console.log(
    `[batch-scores] OK ${numero} RS=${result.risk_score} OS cons/mod/arr=${result.os_conservador}/${result.os_moderado}/${result.os_arrojado}`,
  )
  console.log(
    `  dimensoes_risco: geologico(${geoSubs}), ambiental(${ambSubs}), social(${socSubs}), regulatorio(${regSubs})`,
  )
  console.log(
    `  dimensoes_oportunidade: atratividade(${atrSubs}), viabilidade(${viaSubs}), seguranca(${segSubs})`,
  )
}

async function main() {
  const { flags } = parseCliArgs(process.argv.slice(2))
  const raw = flags.numero
  const numero =
    typeof raw === 'string' ? decodeURIComponent(raw.trim()) : ''
  if (!numero) {
    console.error(
      'Uso: npx tsx server/scripts/batch-scores.ts --numero "864.016/2026" [--force]',
    )
    process.exit(1)
  }

  const force = flags.force === true
  await runOne(numero, force)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
