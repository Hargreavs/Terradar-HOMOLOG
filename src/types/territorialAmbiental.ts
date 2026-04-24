// Resposta de GET /api/processo/:numero/territorial-ambiental
// Espelha o retorno de fn_territorial_analysis_ambiental(numero) do banco.

export interface SitioArqueologicoProximo {
  id: number
  nome: string | null
  classificacao: string | null
  tipo_bem: string | null
  distancia_km: number
}

export interface AppHidricaAnalise {
  distancia_m: number | null
  overlap_m2: number
  overlap_pct: number
  /** 30, 50, 100, 200, 500 ou null */
  faixa_mais_proxima: number | null
  fonte_mais_proxima: 'trecho' | 'massa' | null
}

export interface MassaAguaProxima {
  id: number
  nome: string | null
  area_ha: number
  distancia_km: number
}

export interface TerritorialAmbientalResponse {
  processo_numero: string
  calculado_em: string
  area_processo_m2: number
  sitios_arqueologicos: SitioArqueologicoProximo[]
  app_hidrica: AppHidricaAnalise
  massas_agua: MassaAguaProxima[]
}
