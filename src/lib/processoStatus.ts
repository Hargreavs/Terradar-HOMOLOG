import type { AnaliseAreaProtegida } from './processoApi'
import type { Processo } from '../types'

export type BloqueadorConstitucional =
  | { tipo: 'TI_REGULARIZADA'; nome: string }
  | { tipo: 'UC_PROTECAO_INTEGRAL'; nome: string }

export function detectarBloqueadorConstitucional(
  areasProtegidas: AnaliseAreaProtegida[] | null | undefined,
): BloqueadorConstitucional | null {
  if (!areasProtegidas?.length) return null

  const tiBloqueadora = areasProtegidas.find((a) => {
    const dk = Number(a.distancia_km)
    const sobre =
      Number.isFinite(dk) && (dk === 0 || Math.abs(dk) < 1e-6)
    return (
      a.tipo === 'TI' &&
      (a.categoria ?? '').trim() === 'Regularizada' &&
      sobre
    )
  })
  if (tiBloqueadora) {
    return { tipo: 'TI_REGULARIZADA', nome: tiBloqueadora.nome.trim() }
  }

  const ucBloqueadora = areasProtegidas.find((a) => {
    const dk = Number(a.distancia_km)
    const sobre =
      Number.isFinite(dk) && (dk === 0 || Math.abs(dk) < 1e-6)
    return (
      a.tipo === 'UC' &&
      sobre &&
      /\b(ESEC|REBIO|PARNA|MONA|REVIS|PROTE[cç][AÃ]O\s+INTEGRAL)\b/i.test(
        a.categoria ?? '',
      )
    )
  })
  if (ucBloqueadora) {
    return { tipo: 'UC_PROTECAO_INTEGRAL', nome: ucBloqueadora.nome.trim() }
  }

  return null
}

/**
 * Normaliza `ativo_derivado` vindo do PostGIS/GeoJSON (boolean, string, 0/1).
 * `null` = desconhecido no cadastro (não forçar ativo/inativo só por isso).
 */
export function parseAtivoDerivado(raw: unknown): boolean | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'number') {
    if (raw === 1) return true
    if (raw === 0) return false
    return null
  }
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase()
    if (s === 'true' || s === 't' || s === '1' || s === 'yes') return true
    if (s === 'false' || s === 'f' || s === '0' || s === 'no') return false
  }
  return null
}

/** Alinha a rótulos do scoreEngine (ex.: "Processo extinto", "N/A · Processo extinto"). */
export function textoIndicaProcessoExtinto(texto: string | null | undefined): boolean {
  const s = (texto ?? '').trim()
  return s !== '' && /processo\s+extinto/i.test(s)
}

/** Fase / situação textual ANM que indica término (cadastro cru no viewport). */
export function faseAnmTextoIndicaTerminal(faseRaw: string | null | undefined): boolean {
  const s = (faseRaw ?? '').trim().toLowerCase()
  if (!s) return false
  if (s.includes('encerr')) return true
  return /\b(arquivad|cassad|caducid|cancelad|extint|revogad|anulad|baixad|nulidad)\b/.test(
    s,
  )
}

/**
 * Propriedades planas do GeoJSON da viewport (antes de `mapDbRowToMapProcesso`).
 * Usado no filtro do endpoint e alinhado a `isProcessoTerminal` no cliente.
 */
export function rawViewportPropsIndicamTerminal(
  props: Record<string, unknown>,
): boolean {
  const ad = parseAtivoDerivado(props.ativo_derivado)
  if (ad === false) return true
  if (ad === true) return false
  if (textoIndicaProcessoExtinto(typeof props.risk_label === 'string' ? props.risk_label : '')) {
    return true
  }
  if (
    textoIndicaProcessoExtinto(
      typeof props.os_label === 'string' ? props.os_label : '',
    )
  ) {
    return true
  }
  return faseAnmTextoIndicaTerminal(String(props.fase ?? ''))
}

/**
 * Processo sem efeitos regulatórios ativos (extinto / encerrado).
 * Respeita `ativo_derivado === true` explícito; caso contrário usa rótulo de
 * risco persistido e fase coerente com o mapa.
 */
export function isProcessoTerminal(processo: {
  ativo_derivado?: boolean | null
  fase?: string
  situacao?: string
  risk_label_persistido?: string | null
  os_label_persistido?: string | null
}): boolean {
  const ad = processo?.ativo_derivado
  if (ad === false) return true
  if (ad === true) return false
  if (textoIndicaProcessoExtinto(processo?.risk_label_persistido)) return true
  if (textoIndicaProcessoExtinto(processo?.os_label_persistido)) return true
  if (processo?.situacao === 'inativo') return true
  if (processo?.fase === 'encerrado') return true
  return false
}

/**
 * Inativo/extinto na **camada de polígonos** (filtros ativos/inativos da sidebar).
 * Respeita `ativo_derivado` explícito; `bloqueado` (ex.: sem score) não conta
 * como inativo regulatório.
 */
export function processoEhInativoParaCamadaMapa(p: Processo): boolean {
  if (p.ativo_derivado === false) return true
  if (p.ativo_derivado === true) return false
  if (p.situacao === 'bloqueado') return false
  if (p.situacao === 'inativo') return true
  return isProcessoTerminal({
    ativo_derivado: null,
    fase: p.fase,
    situacao: p.situacao,
    risk_label_persistido: p.risk_label_persistido,
    os_label_persistido: p.os_label_persistido,
  })
}

/** Infraestrutura considerada para proximidade logística operacional (exclui projetos só em estudo). */
export function infraestruturaComOperacaoDeclarada<
  T extends { detalhes?: string },
>(infra: T[]): T[] {
  return infra.filter((i) => (i.detalhes ?? '').trim() !== 'Estudo')
}
