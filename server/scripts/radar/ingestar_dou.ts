import * as crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { JSDOM } from 'jsdom'
import postgres from 'postgres'
import '../../env'

const dbUrl = process.env.DATABASE_URL ?? process.env.VITE_DATABASE_URL
if (!dbUrl) {
  console.error('DATABASE_URL ou VITE_DATABASE_URL e obrigatorio')
  process.exit(1)
}

const sql = postgres(dbUrl, {
  ssl: { rejectUnauthorized: false },
  max: 2,
  idle_timeout: 0,
  prepare: false,
})

const HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
}

const ORGAOS_FILTRO = [
  'Agência Nacional de Mineração',
  // Proximos orgaos a habilitar (v1.1):
  // 'Fundação Nacional dos Povos Indígenas',
  // 'Instituto Brasileiro do Meio Ambiente',
  // 'Instituto Chico Mendes de Conservação',
  // 'Ministério do Meio Ambiente',
]

type JsonItem = {
  urlTitle?: string
  title?: string
  titulo?: string
  hierarchyStr?: string
  pubDate?: string
  artType?: string
  content?: string
  editionNumber?: string
  numberPage?: string
}

export interface AtoDOU {
  urlTitle: string
  titulo: string
  hierarquia: string
  pubDate: string
  artType: string
  contentPreview: string
  editionNumber: string
  numberPage: string
}

function normalizarJsonArray(json: Record<string, unknown>, data: string): JsonItem[] {
  let raw: unknown = json.jsonArray
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      console.warn(`[${data}] jsonArray string aninhada invalida`)
      return []
    }
  }
  if (Array.isArray(raw)) {
    return raw as JsonItem[]
  }
  if (raw && typeof raw === 'object' && Array.isArray((raw as { items?: JsonItem[] }).items)) {
    return (raw as { items: JsonItem[] }).items
  }
  console.warn(`[${data}] formato jsonArray inesperado`)
  return []
}

async function espera(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
}

function extrairListaDoHtml(
  html: string,
  data: string,
): { arr: JsonItem[]; temParams: boolean; parseErro?: string } {
  const dom = new JSDOM(html)
  const script = dom.window.document.querySelector('script#params')
  if (!script?.textContent) {
    return { arr: [], temParams: false }
  }

  try {
    const json = JSON.parse(script.textContent) as Record<string, unknown>
    return { arr: normalizarJsonArray(json, data), temParams: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { arr: [], temParams: true, parseErro: msg }
  }
}

function montarUrlsLeiturajornal(data: string): URL[] {
  const minimal = new URL('https://www.in.gov.br/leiturajornal')
  minimal.searchParams.set('data', data)
  minimal.searchParams.set('secao', 'do1')

  const cueSsr = new URL(minimal.href)
  cueSsr.searchParams.set('org_sub', ORGAOS_FILTRO[0])

  return [minimal, cueSsr]
}

async function baixarJsonArray(
  data: string,
  urlLabel: string,
  urlObj: URL,
  fetchRetries: number,
): Promise<JsonItem[] | null> {
  for (let t = 1; t <= fetchRetries; t++) {
    const resp = await fetch(urlObj.toString(), { headers: HEADERS })
    if (!resp.ok) {
      throw new Error(`leiturajornal status ${resp.status}`)
    }
    const html = await resp.text()
    const { arr, temParams, parseErro } = extrairListaDoHtml(html, data)
    if (parseErro) {
      console.warn(`[${data}] (${urlLabel}) parse falhou: ${parseErro}`)
      return []
    }
    if (!temParams) {
      console.warn(`[${data}] (${urlLabel}) sem #params — layout mudou?`)
      return []
    }
    if (arr.length === 0) {
      console.warn(
        `[${data}] (${urlLabel}) lista vazia (${t}/${fetchRetries}, html ${html.length} bytes)`,
      )
      await espera(700 * t)
      continue
    }
    console.log(`[${data}] (${urlLabel}) html=${html.length} bytes, jsonArray=${arr.length}`)
    return arr
  }
  return null
}

export async function listarAtosDoDia(data: string): Promise<AtoDOU[]> {
  const FETCH_RETRIES = 3
  const [urlMinimal, urlCueSsr] = montarUrlsLeiturajornal(data)

  let arr: JsonItem[] | null =
    (await baixarJsonArray(data, 'URL minima', urlMinimal, FETCH_RETRIES)) ?? []

  if (arr.length === 0 && urlCueSsr) {
    console.warn(
      `[${data}] Fallback: org_sub como cue SSR (${ORGAOS_FILTRO[0]}). ` +
        'Filtro por orgãos continua local (ORGAOS_FILTRO).',
    )
    arr = (await baixarJsonArray(data, 'cue SSR org_sub', urlCueSsr, FETCH_RETRIES)) ?? []
  }

  if (!arr.length) {
    console.warn(`[${data}] jsonArray vazio após URLs/caches testados`)
    return []
  }

  console.log(`[${data}] ${arr.length} atos no DOU/Seção 1 inteiro`)

  const filtrados = arr.filter((it) => {
    const h = String(it.hierarchyStr ?? '')
    return ORGAOS_FILTRO.some((o) => h.includes(o))
  })

  console.log(`[${data}] ${filtrados.length} atos relevantes (filtro: ${ORGAOS_FILTRO.join(', ')})`)

  return filtrados.map((it) => ({
    urlTitle: String(it.urlTitle ?? ''),
    titulo: String(it.title ?? it.titulo ?? ''),
    hierarquia: String(it.hierarchyStr ?? ''),
    pubDate: String(it.pubDate ?? ''),
    artType: String(it.artType ?? ''),
    contentPreview: String(it.content ?? ''),
    editionNumber: String(it.editionNumber ?? ''),
    numberPage: String(it.numberPage ?? ''),
  }))
}

export async function fetchAto(urlTitle: string): Promise<{ html: string; texto: string }> {
  const url = `https://www.in.gov.br/web/dou/-/${urlTitle}`
  const resp = await fetch(url, { headers: HEADERS })
  if (!resp.ok) throw new Error(`ato ${urlTitle} status ${resp.status}`)
  const html = await resp.text()
  const dom = new JSDOM(html)
  const materia = dom.window.document.querySelector(
    '#materia, .texto-dou, article, .assina',
  )
  const texto = (materia?.textContent || dom.window.document.body.textContent || '').trim()
  return { html, texto }
}

function hashConteudo(texto: string): string {
  const normalizado = texto.replace(/\s+/g, ' ').trim().toLowerCase()
  return crypto.createHash('md5').update(normalizado, 'utf8').digest('hex')
}

const DELAY_MS = 1500
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function ingerirData(
  data: string,
): Promise<{ ingeridos: number; pulados: number; erros: number }> {
  let ingeridos = 0
  let pulados = 0
  let erros = 0
  const [dd, mm, yyyy] = data.split('-')
  const dataIso = `${yyyy}-${mm}-${dd}`

  const atos = await listarAtosDoDia(data)

  for (const ato of atos) {
    if (!ato.urlTitle.trim()) continue
    try {
      const exists = await sql`
        SELECT id FROM radar_publicacoes_brutas WHERE url_title = ${ato.urlTitle} LIMIT 1
      `
      if (exists.length > 0) {
        pulados++
        continue
      }

      const urlCompleta = `https://www.in.gov.br/web/dou/-/${ato.urlTitle}`

      let texto = ''
      try {
        const r = await fetchAto(ato.urlTitle)
        texto = r.texto
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        console.warn(
          `[${data}] fetch individual falhou pra ${ato.urlTitle}, usando contentPreview: ${msg}`,
        )
        texto = ato.contentPreview
      }

      if (!texto || texto.length < 100) {
        console.warn(
          `[${data}] ⚠️ ${ato.urlTitle} sem conteúdo suficiente (${texto.length} chars)`,
        )
      }

      await delay(DELAY_MS)

      const partesH = ato.hierarquia.split('/')
      const orgPrincipal = partesH[0] || ''
      const orgSecundario = partesH.slice(1).join('/') || partesH[0] || ''

      await sql`
        INSERT INTO radar_publicacoes_brutas (
          url_title, url_completa, fonte, secao,
          orgao_principal, orgao_secundario,
          data_publicacao, titulo_bruto,
          conteudo_html, conteudo_chars, hash_conteudo, status
        ) VALUES (
          ${ato.urlTitle}, ${urlCompleta}, 'DOU', 'do1',
          ${orgPrincipal}, ${orgSecundario},
          ${dataIso}::date, ${ato.titulo},
          ${texto}, ${texto.length}, ${hashConteudo(texto)}, 'PENDENTE'
        )
      `
      ingeridos++
      const short =
        ato.urlTitle.length > 70 ? ato.urlTitle.slice(0, 70) + '...' : ato.urlTitle
      console.log(`[${data}] ✅ ${short} (${texto.length} chars)`)
    } catch (e: unknown) {
      erros++
      const msg = e instanceof Error ? e.message : String(e)
      const short =
        ato.urlTitle.length > 70 ? ato.urlTitle.slice(0, 70) : ato.urlTitle
      console.error(`[${data}] ❌ ${short}: ${msg}`)
    }
  }

  return { ingeridos, pulados, erros }
}

/** Fecha pool postgres do script — usar após ingest em lote (ingestar_range). */
export async function closeIngestDouSql(): Promise<void> {
  await sql.end({ timeout: 15 })
}

function isEntrypoint(): boolean {
  const a = fileURLToPath(import.meta.url)
  const b = process.argv[1] ? path.resolve(process.argv[1]) : ''
  if (!b) return false
  return a.replace(/\//g, path.sep) === b.replace(/\//g, path.sep)
}

if (isEntrypoint()) {
  const data = process.argv[2] || '27-04-2026'
  ingerirData(data)
    .then((r) => {
      console.log(`\n[RESULTADO ${data}]`, r)
      return sql.end({ timeout: 5 })
    })
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
