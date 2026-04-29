import { supabase } from '@/lib/supabaseClient'

export interface CPTIncidente {
  tipo_categoria: 'assassinato' | 'violencia_posse' | 'conflito_trabalhista'
  data_evento: string | null
  ano: number
  nome_conflito: string | null
  vitima_nome: string | null
  vitima_idade: number | null
  vitima_genero: string | null
  categoria_vitima: string | null
  categoria_causou: string | null
  categoria_sofreu: string | null
  tipo_violencia: string | null
  forma_conflito: string | null
  trabalhadores_resgatados: number | null
  numero_pessoas: number | null
}

export interface CPTMunicipio {
  municipio_nome: string
  uf: string
  qtd_total: number
  qtd_5anos: number
  qtd_assassinatos: number
  qtd_violencia_posse: number
  qtd_trabalhistas: number
  qtd_trabalho_escravo: number
  trabalhadores_resgatados_total: number
  ano_primeiro_evento: number | null
  ano_ultimo_evento: number | null
  data_ultimo_evento: string | null
  categorias_vitima: string[] | null
  categorias_causou: string[] | null
  indice_cpt_nivel: 'severo' | 'alto' | 'moderado' | 'baixo'
  multiplicador_hipotetico: number
  descricao_nivel: string
  data_ultimo_evento_legivel: string | null
}

export interface CPTEstado {
  uf: string
  qtd_total: number
  qtd_5anos: number
  qtd_assassinatos_5anos: number
  qtd_municipios_afetados: number
}

export interface CPTDrawerData {
  municipio: CPTMunicipio
  estado: CPTEstado
  incidentes: CPTIncidente[]
  fonte_label: string
  fonte_descricao: string
}

type RpcRowLegacy = CPTDrawerData & {
  fonte?: string
}

function unwrapRpcJsonb(data: unknown): unknown {
  if (data == null) return null
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as unknown
    } catch {
      return null
    }
  }
  return data
}

function normalizeDrawerRow(row: RpcRowLegacy): CPTDrawerData {
  const m = row.municipio
  return {
    municipio: {
      ...m,
      descricao_nivel:
        typeof m.descricao_nivel === 'string' ? m.descricao_nivel : '',
      data_ultimo_evento_legivel:
        m.data_ultimo_evento_legivel ?? null,
    },
    estado: row.estado,
    incidentes: Array.isArray(row.incidentes) ? row.incidentes : [],
    fonte_label:
      row.fonte_label ?? row.fonte ?? 'Comissão Pastoral da Terra (CPT)',
    fonte_descricao:
      typeof row.fonte_descricao === 'string' ? row.fonte_descricao : '',
  }
}

export async function fetchCPTByMunicipio(params: {
  municipio_ibge?: string | null
  municipio_nome?: string | null
  uf?: string | null
}): Promise<CPTDrawerData | null> {
  const ibge = params.municipio_ibge?.trim() || null
  const nome = params.municipio_nome?.trim() || null
  if (!ibge && !nome) {
    return null
  }

  const { data: raw, error } = await supabase.rpc('fn_cpt_drawer_processo', {
    p_municipio_ibge: ibge,
    p_municipio_nome: nome,
    p_uf: params.uf?.trim() ?? null,
  })

  if (error) {
    console.error('[CPT] erro fetch:', error)
    return null
  }

  const dataRaw = unwrapRpcJsonb(raw)
  const normalized = Array.isArray(dataRaw)
    ? dataRaw.length > 0
      ? dataRaw[0]
      : null
    : dataRaw

  if (!normalized || typeof normalized !== 'object') {
    return null
  }

  return normalizeDrawerRow(normalized as RpcRowLegacy)
}
