export interface ResultadoBuscaItem {
  id: string
  numero: string
  titular: string | null
  cnpj_titular: string | null
  uf: string | null
  municipio: string | null
  substancia: string | null
  regime: string | null
  fase: string | null
  area_ha: number | null
  ativo_derivado: boolean | null
  tem_geom: boolean
}

export type TipoBusca = 'numero' | 'cnpj' | 'titular' | 'vazio'

export interface RespostaBusca {
  ok: boolean
  tipo: TipoBusca
  total: number
  data: ResultadoBuscaItem[]
  error?: string
}
