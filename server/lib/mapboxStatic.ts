import { supabase } from '../supabase'
import { bboxUsadoEPixels, type BBoxLonLat } from './sentinelHub'

const BUCKET = 'satellite-cache'
const MAPBOX_BASE_URL =
  'https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static'

export class MapboxError extends Error {
  readonly code: 'sem_imagem_disponivel' | 'rate_limit' | 'interno'

  constructor(
    code: 'sem_imagem_disponivel' | 'rate_limit' | 'interno',
    message: string,
  ) {
    super(message)
    this.code = code
    this.name = 'MapboxError'
  }
}

type S2Geometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] }

export type GeradoMapbox = {
  url: string
  fonte: 'mapbox'
  captured_at: null
  cloud_coverage: null
  bbox_usado: BBoxLonLat
  imagem_largura: number
  imagem_altura: number
}

export async function gerarImagemMapbox(
  processoId: string,
  geometry: S2Geometry,
): Promise<GeradoMapbox> {
  const token =
    process.env.MAPBOX_TOKEN_SERVER?.trim() ?? process.env.VITE_MAPBOX_TOKEN?.trim()
  if (!token) {
    throw new MapboxError('interno', 'Token Mapbox nao configurado no servidor')
  }

  const { bbox_usado, imagem_largura, imagem_altura } =
    bboxUsadoEPixels(geometry)
  const bboxStr = bbox_usado.join(',')
  const qs = new URLSearchParams({
    access_token: token,
    attribution: 'false',
    logo: 'false',
  })
  const url = `${MAPBOX_BASE_URL}/[${bboxStr}]/${imagem_largura}x${imagem_altura}@2x?${qs}`

  const res = await fetch(url)
  if (res.status === 429) {
    throw new MapboxError(
      'rate_limit',
      'Quota Mapbox atingida — tente em alguns minutos',
    )
  }
  if (!res.ok) {
    console.warn('[mapboxStatic] HTTP', res.status)
    throw new MapboxError('interno', 'Falha temporária — tente de novo')
  }
  const buf = await res.arrayBuffer()

  const path = `${processoId}-mapbox.png`
  const pngBuffer = Buffer.from(buf)
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, pngBuffer, { upsert: true, contentType: 'image/png' })
  if (upErr) {
    console.warn('[mapboxStatic] storage upload:', upErr.message)
    throw new MapboxError('interno', 'Falha temporária — tente de novo')
  }

  const bboxJson: [number, number, number, number] = [...bbox_usado]
  const { error: dbErr } = await supabase.from('satellite_image_cache').upsert(
    {
      processo_id: processoId,
      storage_path: path,
      captured_at: null,
      cloud_coverage: null,
      bbox_usado: bboxJson,
      imagem_largura,
      imagem_altura,
      generated_at: new Date().toISOString(),
      fonte: 'mapbox',
    },
    { onConflict: 'processo_id' },
  )
  if (dbErr) {
    console.warn('[mapboxStatic] cache upsert:', dbErr.message)
  }

  const signed = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600)
  if (signed.error || !signed.data?.signedUrl) {
    throw new MapboxError('interno', 'Falha temporária — tente de novo')
  }

  return {
    url: signed.data.signedUrl,
    fonte: 'mapbox',
    captured_at: null,
    cloud_coverage: null,
    bbox_usado,
    imagem_largura,
    imagem_altura,
  }
}
