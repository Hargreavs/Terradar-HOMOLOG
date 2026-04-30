/** Sprint 1: BRASIL.zip SIGMINE. npx tsx server/scripts/download-sigmine-brasil.ts [--force] [--data-dir=PATH] */
import { createWriteStream } from 'node:fs'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { finished, pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { once } from 'node:events'
import { createRequire } from 'node:module'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'
import * as yauzl from 'yauzl'

const rq = createRequire(import.meta.url)
type ShapeSrc = {
  read(): Promise<
    | { done: true; value?: undefined }
    | { done: false; value: { type: string; geometry: unknown; properties?: unknown } }
  >
}
const { open: openShape } = rq('shapefile') as { open: (path: string) => Promise<ShapeSrc> }

const URL_PRIM =
  'https://dadosabertos.anm.gov.br/SIGMINE/PROCESSOS_MINERARIOS/BRASIL.zip'
/** Espelho: tentativa final se o primário só falhar com 5xx (URL antiga costuma 404; mantida por se a ANM reativar). */
const URL_ESP =
  'https://app.anm.gov.br/dadosabertos/SIGMINE/PROCESSOS_MINERARIOS/BRASIL.zip'
const FONTE_CODIGO = 'anm_sigmine_brasil'
const SHP_REQ = ['BRASIL.shp', 'BRASIL.shx', 'BRASIL.dbf', 'BRASIL.prj'] as const
const MIN_SHP_BYTES = 100 * 1024 * 1024
const BACKOFF_MS = [0, 1_000, 4_000, 16_000] as const
const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; TerradarBot/1.0; +https://share.tec.br)',
  Accept: 'application/zip,application/octet-stream,*/*',
} as const
const META_NAME = '.last-download.json'
const TMP_ZIP = '.tmp.zip'

type LastMeta = {
  fonte_codigo: string
  fonte_url: string
  downloaded_at: string
  etag: string | null
  last_modified_header: string | null
  tamanho_bytes: number
  hash_sha256: string
  duracao_segundos: number
  arquivos_descompactados: string[]
}

const logEvt = (o: Record<string, unknown>) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), ...o }) + '\n')

function normEtag(h: string | null): string | null {
  if (!h?.trim()) return null
  let t = h.trim()
  if (t.startsWith('W/')) t = t.slice(2).trim()
  if (t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1)
  return t.trim() || null
}
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function fetchBackoff(fn: () => Promise<Response>, label: string): Promise<Response> {
  let last: unknown
  for (let i = 0; i < BACKOFF_MS.length; i++) {
    if (BACKOFF_MS[i]! > 0) await sleep(BACKOFF_MS[i]!)
    try {
      return await fn()
    } catch (e) {
      last = e
    }
  }
  throw new Error(`backoff (${label}): ${String(last)}`)
}

/** GET zip: primario com 4 tentativas; se todas falharem com HTTP 5xx, tenta espelho. */
async function fetchZipResponse(): Promise<{ res: Response; urlUsed: string }> {
  let lastSt = 0
  let lastNetworkErr: string | null = null
  let only5xx = true
  for (let i = 0; i < BACKOFF_MS.length; i++) {
    if (BACKOFF_MS[i]! > 0) await sleep(BACKOFF_MS[i]!)
    try {
      const res = await fetch(URL_PRIM, { headers: HTTP_HEADERS, signal: AbortSignal.timeout(7200_000) })
      if (res.ok && res.body) return { res, urlUsed: URL_PRIM }
      lastSt = res.status
      lastNetworkErr = null
      if (!(res.status >= 500 && res.status <= 599)) only5xx = false
    } catch (e) {
      only5xx = false
      lastNetworkErr = String((e as Error)?.message ?? e)
      lastSt = 0
    }
  }
  if (only5xx && lastSt >= 500) {
    logEvt({ event: 'download_fallback_mirror', fonte: FONTE_CODIGO, motivo: '5xx_primario', url_espelho: URL_ESP })
    for (let i = 0; i < BACKOFF_MS.length; i++) {
      if (BACKOFF_MS[i]! > 0) await sleep(BACKOFF_MS[i]!)
      try {
        const res = await fetch(URL_ESP, { headers: HTTP_HEADERS, signal: AbortSignal.timeout(7200_000) })
        if (res.ok && res.body) return { res, urlUsed: URL_ESP }
        lastSt = res.status
        lastNetworkErr = null
      } catch (e) {
        lastNetworkErr = String((e as Error)?.message ?? e)
        lastSt = 0
      }
    }
  }
  if (lastSt > 0) throw new Error(`download SIGMINE falhou (HTTP ${lastSt})`)
  throw new Error(`download SIGMINE falhou (erro de rede: ${lastNetworkErr ?? 'desconhecido'})`)
}

async function headSig(u: string): Promise<{ et: string | null; lm: string | null }> {
  try {
    const r = await fetchBackoff(
      () => fetch(u, { method: 'HEAD', headers: HTTP_HEADERS, signal: AbortSignal.timeout(60_000) }),
      'HEAD',
    )
    if (!r.ok) return { et: null, lm: null }
    return { et: normEtag(r.headers.get('etag')), lm: r.headers.get('last-modified') }
  } catch {
    return { et: null, lm: null }
  }
}

async function downloadTmp(
  tmpPath: string,
  hint: number | null,
): Promise<{ h: string; b: number; et: string | null; lm: string | null; urlUsed: string }> {
  const { res, urlUsed } = await fetchZipResponse()
  logEvt({ event: 'download_start', fonte: FONTE_CODIGO, url: urlUsed })
  const ch = parseInt(res.headers.get('content-length') ?? '', 10)
  const total = Number.isFinite(ch) && ch > 0 ? ch : hint
  const et = normEtag(res.headers.get('etag'))
  const lm = res.headers.get('last-modified')
  const hash = createHash('sha256')
  const ws = createWriteStream(tmpPath)
  const readable = Readable.fromWeb(res.body as WebReadableStream)
  let bytes = 0
  let lastB = -1
  for await (const chunk of readable) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    hash.update(buf)
    if (!ws.write(buf)) await once(ws, 'drain')
    bytes += buf.length
    if (total && total > 0) {
      const pct = (bytes / total) * 100
      const b = Math.floor(pct / 5)
      if (b > lastB) {
        lastB = b
        logEvt({ event: 'download_progress', fonte: FONTE_CODIGO, bytes, total, percent: Math.round(pct * 10) / 10 })
      }
    }
  }
  ws.end()
  await finished(ws)
  return { h: hash.digest('hex'), b: bytes, et, lm, urlUsed }
}

const openZip = (p: string) =>
  new Promise<yauzl.ZipFile>((resolve, reject) => {
    yauzl.open(p, { lazyEntries: true, validateEntrySizes: true }, (err, zf) =>
      err || !zf ? reject(err ?? new Error('zip')) : resolve(zf),
    )
  })
const openRS = (zf: yauzl.ZipFile, en: yauzl.Entry) =>
  new Promise<NodeJS.ReadableStream>((resolve, reject) => {
    zf.openReadStream(en, (e, rs) => (e || !rs ? reject(e ?? new Error('rs')) : resolve(rs)))
  })

async function unzipAll(zipPath: string, targetDir: string): Promise<string[]> {
  const zf = await openZip(zipPath)
  const out: string[] = []
  const base = path.resolve(targetDir)
  await new Promise<void>((resolve, reject) => {
    zf.once('error', reject)
    zf.on('end', () => resolve())
    zf.on('entry', (en: yauzl.Entry) => {
      void (async () => {
        try {
          if (en.fileName.includes('..') || en.fileName.includes('\\')) throw new Error(`zip: ${en.fileName}`)
          if (/\/$/u.test(en.fileName)) {
            zf.readEntry()
            return
          }
          const resolved = path.resolve(base, en.fileName)
          const bn = base.endsWith(path.sep) ? base : base + path.sep
          if (!(resolved === base || resolved.startsWith(bn))) throw new Error(`zip slip: ${en.fileName}`)
          await fs.mkdir(path.dirname(resolved), { recursive: true })
          await pipeline(await openRS(zf, en), createWriteStream(resolved))
          out.push(path.relative(base, resolved).replace(/\\/g, '/'))
          zf.readEntry()
        } catch (e) {
          reject(e)
        }
      })().catch(reject)
    })
    zf.readEntry()
  })
  zf.close()
  return out.sort((a, b) => (a > b ? 1 : -1))
}

async function findShp(dir: string, bn: string): Promise<string | null> {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue
    const fp = path.join(dir, e.name)
    if (e.isDirectory()) {
      const s = await findShp(fp, bn)
      if (s) return s
    } else if (e.name === bn) return fp
  }
  return null
}

async function validarShape(dataDir: string): Promise<void> {
  for (const f of SHP_REQ) {
    const p = await findShp(dataDir, f)
    if (!p) {
      logEvt({ event: 'validation_error', fonte: FONTE_CODIGO, motivo: 'ausente', arquivo: f })
      throw new Error(`Validacao SIGMINE: faltam ficheiros obrigatorios (${f})`)
    }
  }
  const shpPath = (await findShp(dataDir, 'BRASIL.shp'))!
  const st = await fs.stat(shpPath)
  if (st.size <= MIN_SHP_BYTES) {
    logEvt({ event: 'validation_error', fonte: FONTE_CODIGO, motivo: 'shp_pequeno_demais', bytes: st.size })
    throw new Error(`Validacao SIGMINE: BRASIL.shp muito pequeno (${st.size} bytes)`)
  }
  const src = await openShape(shpPath)
  const r = await src.read()
  if (r.done) throw new Error('Validacao SIGMINE: shapefile ilegivel')
  const v = r.value
  if (v.type !== 'Feature' || v.geometry == null) throw new Error('Validacao SIGMINE: shapefile ilegivel')
}

function parseArgs(a: string[]): { force: boolean; dataDir: string } {
  let force = false
  let dataDir = ''
  const root = path.resolve(import.meta.dirname, '..', '..')
  for (const x of a) {
    if (x === '--force') force = true
    else if (x.startsWith('--data-dir=')) dataDir = path.resolve(x.slice(11))
  }
  if (!dataDir) dataDir = path.join(root, 'data', 'sigmine')
  return { force, dataDir }
}

async function loadMeta(p: string): Promise<LastMeta | null> {
  try {
    const j = JSON.parse(await fs.readFile(p, 'utf8')) as LastMeta
    return j.fonte_codigo === FONTE_CODIGO ? j : null
  } catch {
    return null
  }
}

const shouldSkip = (m: LastMeta | null, et: string | null, lm: string | null) => {
  if (!m) return false
  const re = normEtag(et)
  const le = normEtag(m.etag)
  if (re && le && re === le) return true
  const rl = lm?.trim() || null
  const ll = m.last_modified_header?.trim() || null
  return Boolean(rl && ll && rl === ll)
}

async function main(): Promise<number> {
  const { force, dataDir } = parseArgs(process.argv.slice(2))
  const metaPath = path.join(dataDir, META_NAME)
  const tmpPath = path.join(dataDir, TMP_ZIP)
  await fs.mkdir(dataDir, { recursive: true })
  const h0 = await headSig(URL_PRIM)
  const local = await loadMeta(metaPath)
  logEvt({ event: 'download_check', fonte: FONTE_CODIGO, etag_remoto: h0.et, etag_local: local?.etag != null ? normEtag(local.etag) : null })
  if (!force && shouldSkip(local, h0.et, h0.lm)) {
    logEvt({ event: 'download_skip', fonte: FONTE_CODIGO, motivo: 'etag_match' })
    logEvt({ event: 'done', fonte: FONTE_CODIGO, exit_code: 1 })
    return 1
  }
  const t0 = Date.now()
  try {
    try {
      await fs.unlink(tmpPath)
    } catch {
      /* ok */
    }
    const dl = await downloadTmp(tmpPath, local?.tamanho_bytes ?? null)
    logEvt({
      event: 'download_complete',
      fonte: FONTE_CODIGO,
      duration_ms: Date.now() - t0,
      bytes: dl.b,
      hash: `sha256:${dl.h}`,
      url_usada: dl.urlUsed,
    })
    logEvt({ event: 'unzip_start', fonte: FONTE_CODIGO })
    const tu = Date.now()
    const arqs = await unzipAll(tmpPath, dataDir)
    logEvt({ event: 'unzip_complete', fonte: FONTE_CODIGO, arquivos: arqs.length, duration_ms: Date.now() - tu })
    await validarShape(dataDir)
    logEvt({ event: 'validation_ok', fonte: FONTE_CODIGO, shapefile_ok: true, componentes_obrigatorios: SHP_REQ.length })
    const h1 = await headSig(URL_PRIM)
    const meta: LastMeta = {
      fonte_codigo: FONTE_CODIGO,
      fonte_url: URL_PRIM,
      downloaded_at: new Date().toISOString(),
      etag: dl.et ?? h1.et ?? h0.et ?? local?.etag ?? null,
      last_modified_header: dl.lm ?? h1.lm ?? h0.lm ?? local?.last_modified_header ?? null,
      tamanho_bytes: dl.b,
      hash_sha256: dl.h,
      duracao_segundos: Math.round(((Date.now() - t0) / 1000) * 100) / 100,
      arquivos_descompactados: arqs,
    }
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8')
    await fs.unlink(tmpPath)
    logEvt({ event: 'done', fonte: FONTE_CODIGO, exit_code: 0 })
    return 0
  } catch (e) {
    const msg = String((e as Error)?.message ?? e ?? '')
    if (msg.startsWith('Validacao SIGMINE')) {
      console.error(msg)
      logEvt({ event: 'done', fonte: FONTE_CODIGO, exit_code: 2 })
      return 2
    }
    console.error(msg)
    logEvt({ event: 'download_error', fonte: FONTE_CODIGO, erro: msg })
    logEvt({ event: 'done', fonte: FONTE_CODIGO, exit_code: 3 })
    return 3
  }
}

await main().then((c) => process.exit(c))
