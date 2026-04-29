/**
 * Batch: motor S31 (`runS31MotorAndPersist`) em `scores` com UPSERT único pelo motor —
 * mesmo snapshot que drawer/PDF on-demand (evitar divergência com motor clássico).
 *
 * Helpers do motor clássico (`computeAllScores`, `buildDimensoes`, etc.) mantidos aqui até deprecação futura.
 *
 * Uso:
 *   npx tsx server/scripts/batch-scores.ts --numeros "..." [--force] [--scores-fonte s31_v3_20260428] [--sample-size N]
 *
 * Requer `.env` / `.env.local` com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { supabase } from '../supabase'
import { type ScoreInput, type ScoreResult } from '../scoreEngine'
import { runS31MotorAndPersist } from '../scoringMotorS31'
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
import pLimit from 'p-limit'

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
// PARALELIZAÇÃO
// ══════════════════════════════════════════════════

const CONCURRENCY = 8

// ══════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════

const round1 = (n: number) => Math.round(n * 10) / 10

/** Classificação visual por escala 0-100 do subfator (valor_bruto), não pelo valor ponderado. */
function labelSubfatorBruto(valorBruto: number): string {
  if (valorBruto <= 30) return 'Risco baixo'
  if (valorBruto <= 60) return 'Risco médio'
  return 'Risco alto'
}

/** Oportunidade: alto valor_bruto = melhor (invertido em relação ao eixo risco). */
function labelSubfatorBrutoOportunidade(valorBruto: number): string {
  if (valorBruto <= 30) return 'Oportunidade baixa'
  if (valorBruto <= 60) return 'Oportunidade média'
  return 'Oportunidade alta'
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
    label: labelSubfatorBruto(valor_bruto),
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
    label: labelSubfatorBrutoOportunidade(valor_bruto),
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
      label: labelSubfatorBruto(pontos),
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

function textoCaducidadeRegulatorio(input: ScoreInput): string {
  const diasRaw =
    input.dias_ate_caducidade != null &&
    !Number.isNaN(input.dias_ate_caducidade)
      ? input.dias_ate_caducidade
      : input.alvara_validade
        ? Math.floor(
            (new Date(input.alvara_validade).getTime() - Date.now()) /
              MS_DIA_BATCH,
          )
        : null

  if (diasRaw != null && !Number.isNaN(diasRaw)) {
    if (diasRaw < 0) {
      return `Alvará vencido há ${Math.abs(diasRaw)} dias`
    }
    return `Alvará expira em ${diasRaw} dias`
  }
  const r = (input.regime_anm ?? input.regime ?? '').toLowerCase()
  if (r.includes('disponibilidade') || r.includes('concess')) {
    return 'Regime sem prazo de alvará (caducidade 5)'
  }
  return 'Alvará/validade não disponível (fallback 50)'
}

function buildRegulatorioSubs(
  input: ScoreInput,
  d: ScoreResult['detail'],
): Subfator[] {
  const tempoTxt =
    input.dias_sem_despacho != null && !Number.isNaN(input.dias_sem_despacho)
      ? `${input.dias_sem_despacho} dias desde último despacho`
      : 'Sem data de último despacho registrada'

  const pendTxt =
    input.qtd_pendencias_anm != null &&
    !Number.isNaN(input.qtd_pendencias_anm)
      ? `${input.qtd_pendencias_anm} pendência(s) na ANM`
      : 'Contagem de pendências indisponível'

  const alertasTxt =
    'Integração Adoo pendente - não compõe score atualmente'

  return [
    rsSub(
      'Tempo sem despacho',
      d.scoreRegTempo,
      0.3,
      tempoTxt,
      'ANM/SEI',
    ),
    rsSub(
      'Pendências',
      d.scoreRegPendencias,
      0.25,
      pendTxt,
      'ANM/SEI',
    ),
    rsSub(
      'Alertas restritivos',
      d.scoreRegAlertas,
      0.25,
      alertasTxt,
      'Adoo',
    ),
    rsSub(
      'Proximidade de caducidade',
      d.scoreCaducidade,
      0.2,
      textoCaducidadeRegulatorio(input),
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
  input: ScoreInput,
): Subfator[] {
  const c4Txt =
    input.dias_sem_despacho != null && !Number.isNaN(input.dias_sem_despacho)
      ? `${input.dias_sem_despacho} dias desde último despacho`
      : 'Sem data de último despacho registrada'

  const adooTxt = 'Integração Adoo pendente - não compõe score atualmente'

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
      c4Txt,
      'ANM/SEI',
    ),
    osSub(
      'Ausência de alertas restritivos',
      d.c5,
      0.1,
      adooTxt,
      'Adoo',
    ),
    osSub(
      'Alertas favoráveis',
      d.c6,
      0.05,
      adooTxt,
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
        subfatores: buildSegurancaSubs(result, d, input),
      },
    },
  }
}

// ══════════════════════════════════════════════════
// INPUT BUILDER (replica `computeScoresAuto` de server/db.ts, mas expõe o input)
// ══════════════════════════════════════════════════

const MS_DIA_BATCH = 1000 * 60 * 60 * 24

function diasDesdeUltimoDespacho(ultimo: unknown): number | null {
  if (ultimo == null || ultimo === '') return null
  const d = new Date(String(ultimo))
  if (Number.isNaN(d.getTime())) return null
  const hoje = new Date()
  return Math.floor((hoje.getTime() - d.getTime()) / MS_DIA_BATCH)
}

function diasAteAlvaraValidade(alvara: unknown): number | null {
  if (alvara == null || alvara === '') return null
  const validade = new Date(String(alvara))
  if (Number.isNaN(validade.getTime())) return null
  const hoje = new Date()
  return Math.floor((validade.getTime() - hoje.getTime()) / MS_DIA_BATCH)
}

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

  const numeroProc = String(processo.numero ?? '').trim()
  let qtdPendenciasAnm: number | null = null
  if (numeroProc) {
    const { data, error } = await supabase.rpc('fn_pendencias_processo', {
      p_numero: numeroProc,
    })
    if (!error && Array.isArray(data)) {
      qtdPendenciasAnm = data.length
    }
  }

  const regimeStr =
    processo.regime != null ? String(processo.regime) : null
  const diasSemDespacho = diasDesdeUltimoDespacho(processo.ultimo_evento_data)
  const diasAteCad = diasAteAlvaraValidade(processo.alvara_validade)

  return {
    substancia: String(processo.substancia ?? ''),
    substancia_familia: String(processo.substancia_familia ?? 'outros') || 'outros',
    fase: String(processo.fase ?? ''),
    regime: regimeStr,
    area_ha: Number(processo.area_ha) || 0,
    alvara_validade:
      processo.alvara_validade != null ? String(processo.alvara_validade) : null,
    uf,
    ativo_derivado: processo.ativo_derivado !== false,
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
    dias_sem_despacho: diasSemDespacho,
    qtd_pendencias_anm: qtdPendenciasAnm,
    dias_ate_caducidade: diasAteCad,
    regime_anm: regimeStr,
  }
}

// ══════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════

const errosDetalhados: { numero: string; erro: string; stack?: string }[] = []

/** Inicializado no `main` com stream de arquivo + console; até lá só console. */
let batchLogMsg: (msg: string) => void = (msg) => console.log(msg)

function hasManualRiskScore(
  scores: Record<string, unknown> | null,
): boolean {
  if (scores == null) return false
  const rs = scores.risk_score
  return typeof rs === 'number' && !Number.isNaN(rs)
}

async function runOne(numero: string, force: boolean, scoresFonte: string) {
  const processo = (await getProcesso(numero)) as Record<string, unknown>
  const id = processo.id != null ? String(processo.id) : ''
  if (!id) {
    batchLogMsg(`[batch-scores] ERRO Processo sem id: ${numero}`)
    process.exitCode = 1
    return
  }

  const existing = (await getScores(id)) as Record<string, unknown> | null
  if (!force && hasManualRiskScore(existing)) {
    batchLogMsg(
      `[batch-scores] Pulado (scores já existem; use --force): ${numero}`,
    )
    return
  }

  const result = await runS31MotorAndPersist(id, {
    persist: true,
    scoresFonte,
  })

  const rb = result.risk_breakdown
  const ob = result.os_breakdown

  batchLogMsg(
    `[batch-scores] OK ${numero} RS=${result.risk_score} OS cons/mod/arr=${result.os_conservador}/${result.os_moderado}/${result.os_arrojado}`,
  )
  batchLogMsg(
    `[batch-scores]   risk_breakdown: geologico(${rb.geologico}), ambiental(${rb.ambiental}), social(${rb.social}), regulatorio(${rb.regulatorio})`,
  )
  batchLogMsg(
    `[batch-scores]   os_breakdown: atratividade(${ob.atratividade}), viabilidade(${ob.viabilidade}), seguranca(${ob.seguranca})`,
  )
}

function parseNumerosList(flags: Record<string, string | boolean>): string[] {
  const rawMulti =
    typeof flags.numeros === 'string' ? flags.numeros.trim() : ''
  if (rawMulti) {
    return rawMulti
      .split(',')
      .map((s) => decodeURIComponent(s.trim()))
      .filter(Boolean)
  }
  const rawSingle =
    typeof flags.numero === 'string' ? decodeURIComponent(flags.numero.trim()) : ''
  return rawSingle ? [rawSingle] : []
}

async function main() {
  const { flags } = parseCliArgs(process.argv.slice(2))
  const numerosExplicitosInput = parseNumerosList(flags)

  const sampleRaw = flags['sample-size']
  let sampleSize: number | null = null
  if (typeof sampleRaw === 'string' && sampleRaw.trim()) {
    const n = Number(sampleRaw.trim())
    if (!Number.isNaN(n) && n > 0) sampleSize = Math.floor(n)
  }

  const force = flags.force === true
  const scoresFonteRaw = flags['scores-fonte']
  const scoresFonte =
    typeof scoresFonteRaw === 'string' && scoresFonteRaw.trim()
      ? scoresFonteRaw.trim()
      : 's31_v3_20260428'

  const modoAll = flags.all === true
  const skipExisting = flags['skip-existing'] === true
  const ativosOnly = flags['ativos-only'] === true

  if (numerosExplicitosInput.length === 0 && !modoAll) {
    console.error(
      'Uso: npx tsx server/scripts/batch-scores.ts --numero "864.016/2026" [--force] [--scores-fonte s31_v3_20260428]',
    )
    console.error(
      '   ou: npx tsx server/scripts/batch-scores.ts --numeros "857.854/1996,850.280/1991" --force --scores-fonte s31_v3_20260428 [--sample-size N]',
    )
    console.error(
      '   ou: npx tsx server/scripts/batch-scores.ts --all --force --scores-fonte s31_v3_20260428',
    )
    console.error(
      '   ou: npx tsx server/scripts/batch-scores.ts --all --skip-existing --force --scores-fonte s31_v3_20260428   (retoma)',
    )
    process.exit(1)
  }

  let logStream: fs.WriteStream | undefined

  try {
    const logPath = path.join(os.tmpdir(), `batch-scores-${Date.now()}.log`)
    logStream = fs.createWriteStream(logPath, { flags: 'a' })
    const log = (msg: string) => {
      const ts = new Date().toISOString()
      const line = `[${ts}] ${msg}\n`
      logStream!.write(line)
      console.log(line.trim())
    }
    batchLogMsg = log
    log(
      `[batch-scores] Início arquivo de log=${logPath} SUPABASE configurado.`,
    )

    let numerosExplicitos = [...numerosExplicitosInput]
    if (numerosExplicitos.length > 0 && sampleSize != null && sampleSize > 0) {
      numerosExplicitos = numerosExplicitos.slice(0, sampleSize)
      log(
        `Modo amostra: rodando apenas ${numerosExplicitos.length} processos (--sample-size ${sampleSize}).`,
      )
    }

    // Pre-carregar conjunto "ja processado" se --skip-existing (keyset paginado)
    const jaProcessados = new Set<string>()
    if (skipExisting) {
      log(
        `[batch-scores] --skip-existing: carregando processos ja feitos com fonte="${scoresFonte}"...`,
      )
      let lastNumero = ''
      const PAGE = 1000
      while (true) {
        const { data, error } = await supabase
          .from('scores')
          .select('processos!inner(numero)')
          .eq('scores_fonte', scoresFonte)
          .gt('processos.numero', lastNumero)
          .order('numero', { foreignTable: 'processos', ascending: true })
          .limit(PAGE)

        if (error) {
          log(`[batch-scores] Erro ao carregar skip-list: ${error.message}`)
          break
        }
        if (!data || data.length === 0) break

        for (const row of data) {
          const pRow = (row as { processos?: { numero?: string } }).processos
          if (pRow?.numero) {
            jaProcessados.add(String(pRow.numero))
            lastNumero = String(pRow.numero)
          }
        }

        if (
          jaProcessados.size % 10000 === 0 ||
          data.length < PAGE
        ) {
          log(
            `[batch-scores]   skip-list: ${jaProcessados.size} ja processados carregados`,
          )
        }

        if (data.length < PAGE) break
      }
      log(
        `[batch-scores] --skip-existing: total ${jaProcessados.size} ja processados`,
      )
    }

    const BATCH_SIZE = 1000
    const startTime = Date.now()
    let processados = 0
    let pulados = 0
    let erros = 0

    /** Metas só para texto do heartbeat (% / média). */
    let totalHeartbeat: number | null = null

    async function processarLote(lote: string[]): Promise<void> {
      const limit = pLimit(CONCURRENCY)
      const tarefas = lote.map((numero) =>
        limit(async () => {
          if (jaProcessados.has(numero)) {
            pulados++
            return
          }
          try {
            await runOne(numero, force, scoresFonte)
            processados++

            if (processados % 1000 === 0) {
              const elapsedMs = Date.now() - startTime
              const pctStr =
                totalHeartbeat != null && totalHeartbeat > 0
                  ? ((100 * processados) / totalHeartbeat).toFixed(1)
                  : '?'
              const avgMs =
                processados > 0 ? elapsedMs / processados : 0
              log(
                `Heartbeat: ${processados}/${totalHeartbeat ?? '?'} (${pctStr}%) | erros: ${erros} | pulados: ${pulados} | média por processo: ${avgMs.toFixed(1)} ms | decorrido: ${(elapsedMs / 60000).toFixed(2)} min`,
              )
            }
          } catch (err) {
            erros++
            const errMsg = err instanceof Error ? err.message : String(err)
            const errStack = err instanceof Error ? err.stack : undefined
            errosDetalhados.push({ numero, erro: errMsg, stack: errStack })
            log(`[batch-scores] Erro em ${numero}: ${errMsg}`)
          }
        }),
      )
      await Promise.all(tarefas)
    }

    // Caso 1: numeros explicitos
    if (numerosExplicitos.length > 0) {
      totalHeartbeat = numerosExplicitos.length
      log(
        `[batch-scores] iniciando: ${numerosExplicitos.length} processos explicitos, fonte="${scoresFonte}", force=${force}`,
      )
      await processarLote(numerosExplicitos)
    }
    // Caso 2: --all com keyset pagination streaming
    else if (modoAll) {
      totalHeartbeat =
        sampleSize != null && sampleSize > 0 ? sampleSize : null
      log(
        `[batch-scores] iniciando modo --all (keyset streaming), fonte="${scoresFonte}", force=${force}, skip-existing=${skipExisting}${sampleSize != null ? ` sample-size=${sampleSize}` : ''}`,
      )
      if (ativosOnly) {
        log(
          '[batch-scores] FILTRO --ativos-only ATIVO. Processando apenas processos com ativo_derivado=true.',
        )
      }

      let lastNumero = ''
      let loteIdx = 0
      /** Números ainda aceitos no modo amostra (sem contar já pulados pelo skip-existing). */
      let numerosRestantesAmostra: number | null =
        sampleSize != null && sampleSize > 0 ? sampleSize : null

      while (true) {
        if (numerosRestantesAmostra !== null && numerosRestantesAmostra <= 0)
          break

        const pageLimit =
          numerosRestantesAmostra != null
            ? Math.min(BATCH_SIZE, numerosRestantesAmostra)
            : BATCH_SIZE

        const baseQuery = supabase
          .from('processos')
          .select('numero')
          .not('geom', 'is', null)
          .not('substancia', 'is', null)
          .not('municipio_ibge', 'is', null)
          .gt('numero', lastNumero)
        const { data, error } = await (ativosOnly
          ? baseQuery.eq('ativo_derivado', true)
          : baseQuery
        )
          .order('numero', { ascending: true })
          .limit(pageLimit)

        if (error) {
          log(`[batch-scores] Erro ao carregar lote ${loteIdx + 1}: ${error.message}`)
          break
        }
        if (!data || data.length === 0) break

        const lote = data.map((r) => String(r.numero))

        lastNumero = lote[lote.length - 1]
        loteIdx++

        if (numerosRestantesAmostra != null) {
          numerosRestantesAmostra -= lote.length
        }

        log(
          `[batch-scores] lote ${loteIdx} (${lote.length} processos, ultimo=${lastNumero})`,
        )
        await processarLote(lote)

        if (data.length < pageLimit) break
      }
    }

    const totalSec = (Date.now() - startTime) / 1000
    log(
      `[batch-scores][concluido] processados=${processados} pulados=${pulados} erros=${erros} em ${(totalSec / 60).toFixed(2)} min`,
    )

    if (errosDetalhados.length > 0) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const dumpPath = path.join('tmp', `erros_fase010_${timestamp}.json`)
      try {
        if (!fs.existsSync('tmp')) fs.mkdirSync('tmp', { recursive: true })
        fs.writeFileSync(dumpPath, JSON.stringify(errosDetalhados, null, 2))
        log(
          `[batch-scores] Lista de ${errosDetalhados.length} erros salva em: ${dumpPath}`,
        )
      } catch (e) {
        log(
          `[batch-scores] Falha ao salvar dump de erros: ${e instanceof Error ? e.message : e}`,
        )
      }
    }

    if (erros > 0) process.exitCode = 1
  } catch (fatal) {
    const msg =
      fatal instanceof Error ? fatal.message + '\n' + fatal.stack : String(fatal)
    console.error(`[batch-scores] Erro fatal: ${msg}`)
    process.exitCode = 1
  } finally {
    logStream?.end(() => {})
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
