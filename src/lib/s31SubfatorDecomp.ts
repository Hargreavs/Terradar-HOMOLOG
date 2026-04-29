import type { MasterSubstancia } from './reportTypes'
import type { Processo } from '../types'

export type S31SubfatorItem = {
  nome: string
  valor: number
  peso: number
  fonte?: string
  desativado?: boolean
}

export function scoreSubstanciaFromANM(sub: string | null | undefined): number {
  if (!sub) return 50
  const u = sub.toUpperCase()
  const map: Record<string, number> = {
    OURO: 95,
    'TERRAS RARAS': 95,
    COBRE: 90,
    NIOBIO: 95,
    NIQUEL: 90,
    FERRO: 80,
    BAUXITA: 75,
    CAULIM: 60,
    CALCARIO: 50,
    AREIA: 30,
    ARGILA: 30,
    BRITA: 30,
    CASCALHO: 25,
  }
  return map[u] ?? 50
}

function scoreA2Gap(gap: number | null | undefined): number {
  if (gap == null || !Number.isFinite(gap)) return 50
  if (gap >= 50) return 95
  if (gap >= 20) return 80
  if (gap >= 0) return 60
  return 40
}

function scoreA3Preco(precoBrl: number | null | undefined): number {
  if (precoBrl == null || !Number.isFinite(precoBrl) || precoBrl <= 0) return 50
  if (precoBrl >= 20000) return 90
  if (precoBrl >= 5000) return 75
  if (precoBrl >= 1000) return 60
  return 45
}

function scoreA4Tendencia(tend: string | null | undefined): number {
  if (!tend) return 50
  const t = tend.toLowerCase()
  if (t.includes('alta')) return 85
  if (t.includes('média') || t.includes('media')) return 60
  if (t.includes('baixa')) return 40
  return 55
}

function scoreA5ValorReserva(
  valReservaHa: number | null | undefined,
  areaHa: number | null | undefined,
): number {
  if (valReservaHa == null || !Number.isFinite(valReservaHa)) return 50
  const a = areaHa != null && Number.isFinite(areaHa) ? areaHa : 0
  if (a <= 0) return Math.min(100, Math.max(0, valReservaHa / 1e4))
  const tot = (valReservaHa * a) / 1e6
  if (tot >= 10) return 95
  if (tot >= 1) return 80
  if (tot >= 0.1) return 65
  return 50
}

export function buildAtratividadeItemsS31(
  processo: Processo,
  mercado: MasterSubstancia | null,
): S31SubfatorItem[] {
  const a1 = scoreSubstanciaFromANM(processo.substancia)
  const a2 = scoreA2Gap(mercado?.gap_pp ?? null)
  const a3 = scoreA3Preco(mercado?.preco_brl ?? null)
  const a4 = scoreA4Tendencia(mercado?.tendencia ?? null)
  const a5 = scoreA5ValorReserva(mercado?.val_reserva_brl_ha ?? null, processo.area_ha)
  const areaFmt =
    processo.area_ha != null && Number.isFinite(processo.area_ha)
      ? `${processo.area_ha.toLocaleString('pt-BR', {
          maximumFractionDigits: 0,
        })} ha`
      : null
  return [
    {
      nome: 'Relevância da substância',
      valor: a1,
      peso: 0.25,
      fonte: processo.substancia
        ? `${processo.substancia} · base TERRADAR`
        : 'Substância não declarada',
    },
    {
      nome: 'Espaço de mercado',
      valor: a2,
      peso: 0.25,
      fonte:
        mercado?.gap_pp != null
          ? `Diferença reservas vs produção: ${mercado.gap_pp.toLocaleString(
              'pt-BR',
              { maximumFractionDigits: 1 },
            )} p.p.`
          : 'Sem dado de gap publicado',
    },
    {
      nome: 'Preço de mercado',
      valor: a3,
      peso: 0.2,
      fonte:
        mercado?.preco_brl != null
          ? `R$ ${mercado.preco_brl.toLocaleString('pt-BR', {
              maximumFractionDigits: 0,
            })}/t`
          : '—',
    },
    {
      nome: 'Tendência de preço',
      valor: a4,
      peso: 0.15,
      fonte: mercado?.tendencia ?? '—',
    },
    {
      nome: 'Valor da reserva por hectare',
      valor: a5,
      peso: 0.15,
      fonte:
        areaFmt !== null
          ? `R$ por hectare × ${areaFmt} (área do processo)`
          : 'Área não informada',
    },
  ]
}

export function buildGeologicoItemsS31(processo: Processo): S31SubfatorItem[] {
  const sSub = scoreSubstanciaFromANM(processo.substancia)
  let sQual = 20
  if (processo.inicio_lavra_data) sQual = 80
  else if (processo.portaria_lavra_data) sQual = 70
  else if (processo.ral_ultimo_data) {
    const ms = Date.now() - new Date(processo.ral_ultimo_data).getTime()
    const meses = Math.round(ms / (30 * 24 * 3600 * 1000))
    if (meses < 24) sQual = 60
    else if (meses < 60) sQual = 40
    else sQual = 20
  }
  return [
    {
      nome: 'Relevância da substância',
      valor: sSub,
      peso: 0.5,
      fonte: processo.substancia
        ? `${processo.substancia} · base TERRADAR de 47 minerais`
        : 'Substância não declarada',
    },
    {
      nome: 'Maturidade dos dados de pesquisa',
      valor: sQual,
      peso: 0.5,
      fonte: 'Histórico de cadastro ANM (RAL, portarias, eventos)',
    },
  ]
}
