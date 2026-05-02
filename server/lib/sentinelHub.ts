/**
 * Sentinel Hub (Copernicus Data Space) - OAuth, Catalog STAC, Process API, Storage.
 * Never log access_token or client_secret.
 */

import { supabase } from '../supabase'

const TOKEN_URL =
  'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token'
const CATALOG_URL = 'https://sh.dataspace.copernicus.eu/catalog/v1/search'
const PROCESS_URL = 'https://sh.dataspace.copernicus.eu/api/v1/process'

const BUCKET = 'satellite-cache'
const BBOX_PAD = 0.175
const DIM_MIN = 256
const DIM_MAX = 1280
const AR_CAP = 3

const EVALSCRIPT_TRUE_COLOR = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B02", "B03", "B04", "dataMask"] }],
    output: { bands: 3, sampleType: "AUTO" },
    mosaicking: "ORBIT"
  };
}

function evaluatePixel(samples) {
  const factor = 2.5;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (s.dataMask === 1) {
      return [
        Math.min(1, s.B04 * factor),
        Math.min(1, s.B03 * factor),
        Math.min(1, s.B02 * factor)
      ];
    }
  }
  return [0, 0, 0];
}`

export class SentinelHubError extends Error {
  readonly code: 'sem_imagem_disponivel' | 'rate_limit' | 'interno'

  constructor(
    code: 'sem_imagem_disponivel' | 'rate_limit' | 'interno',
    message: string,
  ) {
    super(message)
    this.code = code
    this.name = 'SentinelHubError'
  }
}

type S2Geometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] }

type LonLat = [number, number]

let tokenCache: { token: string; expiresAtMs: number } | null = null

function sleep(ms: number): Promise<void> {
  const delay = Math.max(0, ms)
  return new Promise((r) => setTimeout(r, delay))
}

async function postOAuthToken(): Promise<{ access_token: string; expires_in: number }> {
  const clientId = process.env.SENTINEL_HUB_CLIENT_ID?.trim()
  const clientSecret = process.env.SENTINEL_HUB_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    throw new SentinelHubError(
      'interno',
      'Credenciais Sentinel Hub nao configuradas no servidor',
    )
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })

  let delayMs = 1000
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (res.status === 429) {
      if (attempt === 2) {
        throw new SentinelHubError(
          'rate_limit',
          'Quota Sentinel Hub atingida — tente em alguns minutos',
        )
      }
      await sleep(delayMs)
      delayMs *= 4
      continue
    }
    if (!res.ok) {
      throw new SentinelHubError('interno', 'Falha temporária — tente de novo')
    }
    const json = (await res.json()) as {
      access_token?: string
      expires_in?: number
    }
    if (!json.access_token || typeof json.expires_in !== 'number') {
      throw new SentinelHubError('interno', 'Falha temporária — tente de novo')
    }
    return { access_token: json.access_token, expires_in: json.expires_in }
  }
  throw new SentinelHubError(
    'rate_limit',
    'Quota Sentinel Hub atingida — tente em alguns minutos',
  )
}

async function getValidToken(): Promise<string> {
  const now = Date.now()
  if (tokenCache && tokenCache.expiresAtMs > now + 60_000) {
    return tokenCache.token
  }
  const t = await postOAuthToken()
  tokenCache = {
    token: t.access_token,
    expiresAtMs: now + Math.max(60, t.expires_in - 120) * 1000,
  }
  return tokenCache.token
}

function flattenCoords(geometry: S2Geometry): LonLat[] {
  if (geometry.type === 'Polygon') {
    const ring = geometry.coordinates[0]
    if (!ring?.length) return []
    return ring.map((c) => [c[0]!, c[1]!] as LonLat)
  }
  const out: LonLat[] = []
  for (const polygon of geometry.coordinates) {
    const exterior = polygon[0]
    if (!exterior?.length) continue
    for (const c of exterior) {
      out.push([c[0]!, c[1]!] as LonLat)
    }
  }
  return out
}

function bboxFromCoords(coords: LonLat[]): [number, number, number, number] | null {
  if (!coords.length) return null
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  for (const [lon, lat] of coords) {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue
    minLon = Math.min(minLon, lon)
    minLat = Math.min(minLat, lat)
    maxLon = Math.max(maxLon, lon)
    maxLat = Math.max(maxLat, lat)
  }
  if (
    !Number.isFinite(minLon) ||
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLon) ||
    !Number.isFinite(maxLat)
  ) {
    return null
  }
  return [minLon, minLat, maxLon, maxLat]
}

function expandBbox(
  box: [number, number, number, number],
  pad: number,
): [number, number, number, number] {
  const [minLon, minLat, maxLon, maxLat] = box
  let w = maxLon - minLon
  let h = maxLat - minLat
  if (w <= 0) w = 1e-6
  if (h <= 0) h = 1e-6
  const px = w * pad
  const py = h * pad
  return [minLon - px, minLat - py, maxLon + px, maxLat + py]
}

/** west, south, east, north */
export type BBoxLonLat = [number, number, number, number]

export function bboxUsadoEPixels(geometry: S2Geometry): {
  bbox_usado: BBoxLonLat
  imagem_largura: number
  imagem_altura: number
} {
  const coords = flattenCoords(geometry)
  const rawBox = bboxFromCoords(coords)
  if (!rawBox) {
    throw new SentinelHubError('interno', 'Geometria invalida')
  }
  let [minLon, minLat, maxLon, maxLat] = expandBbox(rawBox, BBOX_PAD)
  let bw = Math.max(maxLon - minLon, 1e-8)
  let bh = Math.max(maxLat - minLat, 1e-8)
  let ar = bw / bh
  if (ar > AR_CAP) {
    const newBh = bw / AR_CAP
    const d = (newBh - bh) / 2
    minLat -= d
    maxLat += d
    bh = newBh
  } else if (ar < 1 / AR_CAP) {
    const newBw = bh / AR_CAP
    const d = (newBw - bw) / 2
    minLon -= d
    maxLon += d
    bw = newBw
  }
  const bbox_usado: BBoxLonLat = [minLon, minLat, maxLon, maxLat]

  bw = bbox_usado[2] - bbox_usado[0]
  bh = bbox_usado[3] - bbox_usado[1]
  ar = bw / bh

  const huge = bw > 2 || bh > 2 || bw * bh > 0.5
  const maxSide = huge ? 512 : DIM_MAX
  const minSide = DIM_MIN

  let imagem_largura: number
  let imagem_altura: number
  if (ar >= 1024 / 768) {
    imagem_largura = Math.min(1024, maxSide)
    imagem_altura = Math.max(minSide, Math.round(imagem_largura / ar))
  } else {
    imagem_altura = Math.min(768, maxSide)
    imagem_largura = Math.max(minSide, Math.round(imagem_altura * ar))
  }

  imagem_largura = Math.min(Math.max(imagem_largura, minSide), maxSide)
  imagem_altura = Math.min(Math.max(imagem_altura, minSide), maxSide)

  return { bbox_usado, imagem_largura, imagem_altura }
}

type StacFeature = {
  properties?: Record<string, unknown>
}

function parseSceneInstant(iso: string | undefined): Date | null {
  if (!iso || typeof iso !== 'string') return null
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : new Date(t)
}

function sceneInstantFromFeature(f: StacFeature): Date | null {
  const p = f.properties ?? {}
  const dt = p['datetime']
  if (typeof dt === 'string') {
    const d = parseSceneInstant(dt)
    if (d) return d
  }
  const start = p['start_datetime']
  if (typeof start === 'string') {
    return parseSceneInstant(start)
  }
  return null
}

function cloudFromFeature(f: StacFeature): number {
  const p = f.properties ?? {}
  const c = p['eo:cloud_cover']
  return typeof c === 'number' && Number.isFinite(c) ? c : 999
}

type JanelaCatalog = {
  from: string
  to: string
  diasJanela: 30 | 90
}

async function catalogSearch(
  token: string,
  args: {
    geometry: S2Geometry
    days: 30 | 90
    cloudLt: number
  },
): Promise<{ features: StacFeature[]; janelaUsada: JanelaCatalog }> {
  const toDate = new Date()
  const fromDate = new Date(toDate.getTime() - args.days * 86_400_000)
  const datetime = `${fromDate.toISOString().slice(0, 19)}Z/${toDate.toISOString().slice(0, 19)}Z`
  const janelaUsada: JanelaCatalog = {
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    diasJanela: args.days,
  }

  const body = {
    collections: ['sentinel-2-l2a'],
    datetime,
    intersects: args.geometry,
    limit: 50,
    filter: `eo:cloud_cover < ${args.cloudLt}`,
  }

  const res = await fetch(CATALOG_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/geo+json',
    },
    body: JSON.stringify(body),
  })

  if (res.status === 429) {
    throw new SentinelHubError(
      'rate_limit',
      'Quota Sentinel Hub atingida — tente em alguns minutos',
    )
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    console.warn('[sentinelHub] catalog HTTP', res.status, txt.slice(0, 200))
    throw new SentinelHubError('interno', 'Falha temporária — tente de novo')
  }

  const json = (await res.json()) as { features?: StacFeature[] }
  const features = Array.isArray(json.features) ? json.features : []
  return { features, janelaUsada }
}

async function buscarMelhorTile(
  token: string,
  geometry: S2Geometry,
): Promise<{
  capturedAt: Date
  cloud: number
  janelaUsada: JanelaCatalog
}> {
  let { features, janelaUsada } = await catalogSearch(token, {
    geometry,
    days: 30,
    cloudLt: 30,
  })
  if (features.length === 0) {
    const segundo = await catalogSearch(token, {
      geometry,
      days: 90,
      cloudLt: 60,
    })
    features = segundo.features
    janelaUsada = segundo.janelaUsada
  }
  if (features.length === 0) {
    throw new SentinelHubError(
      'sem_imagem_disponivel',
      'Sem imagem com cobertura de nuvem aceitavel nos ultimos 90 dias',
    )
  }

  features = [...features].sort((a, b) => cloudFromFeature(a) - cloudFromFeature(b))
  const best = features[0]!
  const capturedAt = sceneInstantFromFeature(best)
  if (!capturedAt) {
    throw new SentinelHubError('interno', 'Falha temporária — tente de novo')
  }
  return { capturedAt, cloud: cloudFromFeature(best), janelaUsada }
}

async function processRenderJpeg(args: {
  token: string
  bbox: BBoxLonLat
  imagem_largura: number
  imagem_altura: number
  janelaUsada: JanelaCatalog
  maxCloudCoverage: number
}): Promise<ArrayBuffer> {
  const payload = {
    input: {
      bounds: {
        bbox: args.bbox,
        properties: {
          crs: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84',
        },
      },
      data: [
        {
          type: 'sentinel-2-l2a',
          dataFilter: {
            timeRange: {
              from: args.janelaUsada.from,
              to: args.janelaUsada.to,
            },
            maxCloudCoverage: args.maxCloudCoverage,
            mosaickingOrder: 'leastCC',
          },
          processing: {
            harmonizeValues: true,
          },
        },
      ],
    },
    output: {
      width: args.imagem_largura,
      height: args.imagem_altura,
      responses: [
        {
          identifier: 'default',
          format: { type: 'image/jpeg', quality: 85 },
        },
      ],
    },
    evalscript: EVALSCRIPT_TRUE_COLOR,
  }

  const res = await fetch(PROCESS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.token}`,
      'Content-Type': 'application/json',
      Accept: 'image/jpeg',
    },
    body: JSON.stringify(payload),
  })

  if (res.status === 429) {
    throw new SentinelHubError(
      'rate_limit',
      'Quota Sentinel Hub atingida — tente em alguns minutos',
    )
  }
  if (res.status >= 400 && res.status < 500) {
    console.warn('[sentinelHub] process client error', res.status)
    throw new SentinelHubError('interno', 'Falha temporária — tente de novo')
  }
  if (!res.ok) {
    console.warn('[sentinelHub] process HTTP', res.status)
    throw new SentinelHubError('interno', 'Falha temporária — tente de novo')
  }

  return res.arrayBuffer()
}

export type GeradoSentinel = {
  url: string
  captured_at: string
  cloud_coverage: number
  bbox_usado: BBoxLonLat
  imagem_largura: number
  imagem_altura: number
}

export async function gerarImagemSentinel2(
  processoId: string,
  geometry: S2Geometry,
): Promise<GeradoSentinel> {
  const token = await getValidToken()
  const { capturedAt, cloud, janelaUsada } = await buscarMelhorTile(token, geometry)
  const { bbox_usado, imagem_largura, imagem_altura } =
    bboxUsadoEPixels(geometry)

  let buf = await processRenderJpeg({
    token,
    bbox: bbox_usado,
    imagem_largura,
    imagem_altura,
    janelaUsada,
    maxCloudCoverage: Math.min(100, Math.max(30, cloud + 10)),
  })

  if (buf.byteLength < 1000) {
    const smallerW = Math.min(imagem_largura, 512)
    const smallerH = Math.min(imagem_altura, 512)
    buf = await processRenderJpeg({
      token,
      bbox: bbox_usado,
      imagem_largura: smallerW,
      imagem_altura: smallerH,
      janelaUsada,
      maxCloudCoverage: Math.min(100, Math.max(30, cloud + 10)),
    })
  }

  const path = `${processoId}-sentinel2.jpg`
  const jpegBuffer = Buffer.from(buf)

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, jpegBuffer, {
      upsert: true,
      contentType: 'image/jpeg',
    })

  if (upErr) {
    console.warn('[sentinelHub] storage upload:', upErr.message)
    throw new SentinelHubError('interno', 'Falha temporária — tente de novo')
  }

  const capturedIso = capturedAt.toISOString()
  const bboxJson: [number, number, number, number] = [...bbox_usado]

  const { error: dbErr } = await supabase.from('satellite_image_cache').upsert(
    {
      processo_id: processoId,
      storage_path: path,
      captured_at: capturedIso,
      cloud_coverage: cloud,
      bbox_usado: bboxJson,
      imagem_largura,
      imagem_altura,
      generated_at: new Date().toISOString(),
    },
    { onConflict: 'processo_id' },
  )

  if (dbErr) {
    console.warn('[sentinelHub] cache upsert:', dbErr.message)
  }

  const signed = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600)

  if (signed.error || !signed.data?.signedUrl) {
    throw new SentinelHubError('interno', 'Falha temporária — tente de novo')
  }

  return {
    url: signed.data.signedUrl,
    captured_at: capturedIso,
    cloud_coverage: cloud,
    bbox_usado,
    imagem_largura,
    imagem_altura,
  }
}

export async function signedUrlFromCachePath(path: string): Promise<string> {
  const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (signed.error || !signed.data?.signedUrl) {
    throw new SentinelHubError('interno', 'Falha temporária — tente de novo')
  }
  return signed.data.signedUrl
}

function isS2Geometry(v: unknown): v is S2Geometry {
  if (!v || typeof v !== 'object') return false
  const o = v as { type?: string }
  return o.type === 'Polygon' || o.type === 'MultiPolygon'
}

export function parseGeometryJsonb(g: unknown): S2Geometry | null {
  if (!isS2Geometry(g)) return null
  return g
}
