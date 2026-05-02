export type ErroSateliteApi =
  | 'sem_geom'
  | 'sem_imagem_disponivel'
  | 'rate_limit'
  | 'interno'

export type SatelliteImageResponse = {
  url: string
  fonte: 'sentinel-2' | 'mapbox'
  captured_at: string | null
  cloud_coverage: number | null
  cached: boolean
  bbox_usado: [number, number, number, number]
  imagem_largura: number
  imagem_altura: number
}

export type RespostaSatelite =
  | ({ ok: true } & SatelliteImageResponse)
  | {
      ok: false
      error: ErroSateliteApi
      message: string
    }

function isoParaDdmYyyy(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = d.getUTCFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function formatarDataPtBr(iso: string | null): string {
  if (!iso) return '–'
  return isoParaDdmYyyy(iso)
}

/** Rodapé conforme fonte (Sentinel-2 compósito · Prompt 11.2 / Mapbox · Prompt 12). */
export function montarFooter(resp: SatelliteImageResponse): string {
  if (resp.fonte === 'mapbox') {
    return 'Imagem por satélite · Fonte: Mapbox / Maxar'
  }
  const dataPt = formatarDataPtBr(resp.captured_at)
  const nuvemPct = (Number(resp.cloud_coverage ?? 0)).toFixed(1).replace('.', ',')
  return `Sentinel-2 · compósito ~${dataPt} · ${nuvemPct}% nuvem · Fonte: Copernicus Programme`
}

/** @deprecated Preferir montarFooter(respostaCompleta). Mantido para chamadas legadas só Sentinel-2. */
export function montarFooterSentinel(opts: {
  captured_at: string
  cloud_coverage: number
}): string {
  return montarFooter({
    url: '',
    fonte: 'sentinel-2',
    captured_at: opts.captured_at,
    cloud_coverage: opts.cloud_coverage,
    cached: false,
    bbox_usado: [0, 0, 0, 0],
    imagem_largura: 0,
    imagem_altura: 0,
  })
}

export async function buscarImagemSateliteProcesso(
  processoId: string,
): Promise<RespostaSatelite> {
  let res: Response
  try {
    res = await fetch(
      `/api/processos/${encodeURIComponent(processoId)}/satellite-image`,
    )
  } catch {
    return {
      ok: false,
      error: 'interno',
      message:
        'Não foi possível carregar a imagem agora. Tente novamente em alguns instantes.',
    }
  }

  let body: unknown
  try {
    body = await res.json()
  } catch {
    return {
      ok: false,
      error: 'interno',
      message:
        'Não foi possível carregar a imagem agora. Tente novamente em alguns instantes.',
    }
  }

  const o = body as Record<string, unknown>

  if (!res.ok) {
    const err = o.error
    const msg =
      typeof o.message === 'string'
        ? o.message
        : 'Não foi possível carregar a imagem agora. Tente novamente em alguns instantes.'
    if (err === 'sem_geom') {
      return { ok: false, error: 'sem_geom', message: msg }
    }
    if (err === 'sem_imagem_disponivel') {
      return { ok: false, error: 'sem_imagem_disponivel', message: msg }
    }
    if (err === 'rate_limit') {
      return { ok: false, error: 'rate_limit', message: msg }
    }
    return { ok: false, error: 'interno', message: msg }
  }

  const url = o.url
  const fonte = o.fonte
  const cached = o.cached
  const bbox_usado = o.bbox_usado
  const imagem_largura = o.imagem_largura
  const imagem_altura = o.imagem_altura
  const captured_at = o.captured_at
  const cloud_coverage = o.cloud_coverage

  if (
    typeof url !== 'string' ||
    (fonte !== 'sentinel-2' && fonte !== 'mapbox') ||
    typeof cached !== 'boolean' ||
    !Array.isArray(bbox_usado) ||
    bbox_usado.length !== 4 ||
    typeof imagem_largura !== 'number' ||
    typeof imagem_altura !== 'number'
  ) {
    return {
      ok: false,
      error: 'interno',
      message:
        'Não foi possível carregar a imagem agora. Tente novamente em alguns instantes.',
    }
  }

  if (fonte === 'sentinel-2') {
    if (typeof captured_at !== 'string' || typeof cloud_coverage !== 'number') {
      return {
        ok: false,
        error: 'interno',
        message:
          'Não foi possível carregar a imagem agora. Tente novamente em alguns instantes.',
      }
    }
  } else {
    if (captured_at != null) {
      return {
        ok: false,
        error: 'interno',
        message:
          'Não foi possível carregar a imagem agora. Tente novamente em alguns instantes.',
      }
    }
    if (cloud_coverage != null) {
      return {
        ok: false,
        error: 'interno',
        message:
          'Não foi possível carregar a imagem agora. Tente novamente em alguns instantes.',
      }
    }
  }

  const bbox: [number, number, number, number] = [
    Number(bbox_usado[0]),
    Number(bbox_usado[1]),
    Number(bbox_usado[2]),
    Number(bbox_usado[3]),
  ]
  if (!bbox.every((n) => Number.isFinite(n))) {
    return {
      ok: false,
      error: 'interno',
      message:
        'Não foi possível carregar a imagem agora. Tente novamente em alguns instantes.',
    }
  }

  const out: SatelliteImageResponse = {
    url,
    fonte,
    cached,
    bbox_usado: bbox,
    imagem_largura,
    imagem_altura,
    captured_at:
      fonte === 'sentinel-2' ? (captured_at as string) : null,
    cloud_coverage:
      fonte === 'sentinel-2' ? (cloud_coverage as number) : null,
  }

  return { ok: true, ...out }
}
