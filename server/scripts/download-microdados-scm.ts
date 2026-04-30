/** Sprint 1: ZIP microdados SCM (ANM). npx tsx server/scripts/download-microdados-scm.ts [--force] [--data-dir=PATH] */
/** TXTs criticos: uniao ingest-requerimentos-microdados + ingest-processo-eventos + ingest-eventos-microdados + extract-13-scm-data + ingest-cnpj-microdados */
import { createWriteStream } from 'node:fs'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { finished, pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { once } from 'node:events'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'
import * as yauzl from 'yauzl'

const URL_FONTE =
  'https://dadosabertos.anm.gov.br/SCM/microdados/microdados-scm.zip'
const FONTE_CODIGO = 'anm_scm_microdados'
const SCM_TXTS_CRITICOS = [
  'Evento.txt','FaseProcesso.txt','Municipio.txt','Pessoa.txt','Processo.txt',
  'ProcessoEvento.txt','ProcessoMunicipio.txt','ProcessoPessoa.txt','ProcessoSubstancia.txt','Substancia.txt',
].sort((a, b) => a.localeCompare(b, 'pt')) as readonly string[]
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

/** Retorna Response; falha de rede relanca. Para GET/HEAD depois verificar .ok. */
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
  throw new Error(`backoff esgotado (${label}): ${String(last)}`)
}

/** GET com retry ate resposta ok. */
async function fetchGetOk(url: string): Promise<Response> {
  let lastStatus = 0
  let lastNetworkErr: string | null = null
  for (let i = 0; i < BACKOFF_MS.length; i++) {
    if (BACKOFF_MS[i]! > 0) await sleep(BACKOFF_MS[i]!)
    try {
      const res = await fetch(url, { headers: HTTP_HEADERS, signal: AbortSignal.timeout(7200_000) })
      if (res.ok && res.body) return res
      lastStatus = res.status
      lastNetworkErr = null
    } catch (e) {
      lastNetworkErr = String((e as Error)?.message ?? e)
      lastStatus = 0
    }
  }
  if (lastStatus > 0) throw new Error(`GET falhou apos retries (HTTP ${lastStatus})`)
  throw new Error(`GET falhou apos retries (erro de rede: ${lastNetworkErr ?? 'desconhecido'})`)
}

async function downloadGetTmp(
  url: string,
  tmpPath: string,
  totalHint: number | null,
): Promise<{ hashHex: string; bytes: number; etag: string | null; lm: string | null }> {
  const res = await fetchGetOk(url)
  const totalHdr = parseInt(res.headers.get('content-length') ?? '', 10)
  const total = Number.isFinite(totalHdr) && totalHdr > 0 ? totalHdr : totalHint
  logEvt({ event: 'download_start', fonte: FONTE_CODIGO, url })
  const etag = normEtag(res.headers.get('etag'))
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
  return { hashHex: hash.digest('hex'), bytes, etag, lm }
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

async function findBN(dir: string, bn: string): Promise<boolean> {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue
    const fp = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (await findBN(fp, bn)) return true
    } else if (e.name === bn) return true
  }
  return false
}

async function assertTxts(dir: string): Promise<void> {
  const falta: string[] = []
  for (const f of SCM_TXTS_CRITICOS) {
    if (!(await findBN(dir, f))) falta.push(f)
  }
  if (falta.length) {
    logEvt({ event: 'validation_error', fonte: FONTE_CODIGO, motivo: 'arquivos_criticos_ausentes', faltantes: falta })
    throw new Error(`Validacao SCM: faltam: ${falta.join(', ')}`)
  }
}

function parseArgs(a: string[]): { force: boolean; dataDir: string } {
  let force = false
  let dataDir = ''
  const root = path.resolve(import.meta.dirname, '..', '..')
  for (const x of a) {
    if (x === '--force') force = true
    else if (x.startsWith('--data-dir=')) dataDir = path.resolve(x.slice(11))
  }
  if (!dataDir) dataDir = path.join(root, 'data', 'microdados-scm')
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

async function main(): Promise<number> {
  const { force, dataDir } = parseArgs(process.argv.slice(2))
  const metaPath = path.join(dataDir, META_NAME)
  const tmpPath = path.join(dataDir, TMP_ZIP)
  await fs.mkdir(dataDir, { recursive: true })
  const h0 = await headSig(URL_FONTE)
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
    const dl = await downloadGetTmp(URL_FONTE, tmpPath, local?.tamanho_bytes ?? null)
    logEvt({ event: 'download_complete', fonte: FONTE_CODIGO, duration_ms: Date.now() - t0, bytes: dl.bytes, hash: `sha256:${dl.hashHex}` })
    logEvt({ event: 'unzip_start', fonte: FONTE_CODIGO })
    const tu = Date.now()
    const arqs = await unzipAll(tmpPath, dataDir)
    logEvt({ event: 'unzip_complete', fonte: FONTE_CODIGO, arquivos: arqs.length, duration_ms: Date.now() - tu })
    await assertTxts(dataDir)
    logEvt({ event: 'validation_ok', fonte: FONTE_CODIGO, arquivos_esperados: SCM_TXTS_CRITICOS.length, arquivos_encontrados: SCM_TXTS_CRITICOS.length })
    const h1 = await headSig(URL_FONTE)
    const meta: LastMeta = {
      fonte_codigo: FONTE_CODIGO,
      fonte_url: URL_FONTE,
      downloaded_at: new Date().toISOString(),
      etag: dl.etag ?? h1.et ?? h0.et ?? local?.etag ?? null,
      last_modified_header: dl.lm ?? h1.lm ?? h0.lm ?? local?.last_modified_header ?? null,
      tamanho_bytes: dl.bytes,
      hash_sha256: dl.hashHex,
      duracao_segundos: Math.round(((Date.now() - t0) / 1000) * 100) / 100,
      arquivos_descompactados: arqs,
    }
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8')
    await fs.unlink(tmpPath)
    logEvt({ event: 'done', fonte: FONTE_CODIGO, exit_code: 0 })
    return 0
  } catch (e) {
    const msg = String((e as Error)?.message ?? e ?? '')
    if (msg.includes('Validacao SCM')) {
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
