/**
 * CLI: npx tsx server/scripts/ingest-cfem.ts --uf TO
 *       npx tsx server/scripts/ingest-cfem.ts --ibge 1711506
 */
import iconv from 'iconv-lite'

import { supabase } from '../supabase'
import { parseCliArgs } from './utils/cli-args'
import { fetchWithRetry } from './utils/http'

const CFEM_URLS = [
  'https://app.anm.gov.br/DadosAbertos/ARRECADACAO/CFEM_Arrecadacao_2017_2021.csv',
  'https://app.anm.gov.br/DadosAbertos/ARRECADACAO/CFEM_Arrecadacao_2022_2026.csv',
] as const

/** CSV ANM pode passar de 80MB; filtro por UF só após o parse. */
const MAX_BYTES = 150 * 1024 * 1024

/** Cabeçalhos oficiais ANM. O ficheiro pode vir com `;` ou `,`. */
const COL = {
  ano: ['Ano'],
  uf: ['UF'],
  codigoMunicipio: ['CodigoMunicipio'],
  municipio: ['Município', 'Municipio'],
  substancia: ['Substância', 'Substancia'],
  valorRecolhido: ['ValorRecolhido'],
} as const

function parseDelimitedLine(line: string, delim: ';' | ','): string[] {
  const out: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuote = !inQuote
    } else if (c === delim && !inQuote) {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur.trim())
  return out
}

/** ANM: ficheiros antigos `;`, atuais frequentemente `,`. */
function detectDelimiter(firstLine: string): ';' | ',' {
  const semi = parseDelimitedLine(firstLine, ';')
  if (semi.length > 1) return ';'
  const comma = parseDelimitedLine(firstLine, ',')
  if (comma.length > 1) return ','
  return ';'
}

function trimHeaderCell(h: string): string {
  return h.replace(/^\uFEFF/, '').trim()
}

function findColIndex(headers: string[], candidates: readonly string[]): number {
  const normalized = headers.map(trimHeaderCell)
  for (const name of candidates) {
    const i = normalized.findIndex((h) => h === name)
    if (i >= 0) return i
  }
  return -1
}

/** ValorRecolhido: vírgula decimal, ponto milhar. */
function parseValorRecolhido(s: string): number {
  const t = s.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const v = parseFloat(t)
  return Number.isFinite(v) ? v : 0
}

async function downloadCsv(url: string): Promise<string> {
  console.log('[ingest-cfem] Baixando', url)
  const res = await fetchWithRetry(url)
  const len = res.headers.get('content-length')
  if (len && Number(len) > MAX_BYTES) {
    throw new Error(`Arquivo > 150MB (${len} bytes). Abortando.`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  return iconv.decode(buf, 'win1252')
}

type Agg = { valor: number; subs: Set<string>; municipio: string; uf: string }

async function main() {
  const { flags } = parseCliArgs(process.argv.slice(2))
  const ufFilter =
    typeof flags.uf === 'string' ? flags.uf.trim().toUpperCase() : null
  const ibgeFilter =
    typeof flags.ibge === 'string' ? flags.ibge.trim() : null

  if (!ufFilter && !ibgeFilter) {
    console.error('Uso: --uf TO | --ibge 1711506')
    process.exit(1)
  }

  const aggregates = new Map<string, Agg>()
  /** Linhas CSV que passam filtros, contadas por UF. */
  const linhasPorUf = new Map<string, number>()

  for (const url of CFEM_URLS) {
    const text = await downloadCsv(url)
    const lines = text.split(/\r?\n/).filter((l) => l.length > 0)
    if (lines.length < 2) {
      console.warn('[ingest-cfem] Sem linhas em', url)
      continue
    }

    const delim = detectDelimiter(lines[0])
    console.log('[ingest-cfem] Delimitador CSV:', JSON.stringify(delim))
    const header = parseDelimitedLine(lines[0], delim).map(trimHeaderCell)
    const iAno = findColIndex(header, COL.ano)
    const iUf = findColIndex(header, COL.uf)
    const iIbge = findColIndex(header, COL.codigoMunicipio)
    const iMun = findColIndex(header, COL.municipio)
    const iSub = findColIndex(header, COL.substancia)
    const iValor = findColIndex(header, COL.valorRecolhido)

    if (
      iAno < 0 ||
      iUf < 0 ||
      iIbge < 0 ||
      iMun < 0 ||
      iSub < 0 ||
      iValor < 0
    ) {
      console.error(
        '[ingest-cfem] Cabeçalho incompleto. Esperado: Ano, UF, CodigoMunicipio, Município, Substância, ValorRecolhido',
      )
      console.error('[ingest-cfem] Colunas lidas:', header.join(' | '))
      process.exit(1)
    }

    let processed = 0
    for (let li = 1; li < lines.length; li++) {
      const cells = parseDelimitedLine(lines[li], delim)
      if (cells.length < Math.min(header.length, 6)) continue

      const uf = (cells[iUf] ?? '').trim().toUpperCase()
      const ibgeRaw = cells[iIbge] ?? ''
      const ibge = String(ibgeRaw).replace(/\D/g, '')
      if (ibgeFilter && ibge !== ibgeFilter) continue
      if (ufFilter && uf !== ufFilter) continue

      linhasPorUf.set(uf, (linhasPorUf.get(uf) ?? 0) + 1)

      const ano = parseInt(cells[iAno] ?? '', 10)
      if (!Number.isFinite(ano)) continue

      const valor = parseValorRecolhido(cells[iValor] ?? '0')
      const sub = iSub >= 0 ? (cells[iSub] ?? '').trim() : ''
      const municipio =
        iMun >= 0 ? (cells[iMun] ?? '').trim() : ''

      const key = `${ibge}|${ano}`
      let agg = aggregates.get(key)
      if (!agg) {
        agg = {
          valor: 0,
          subs: new Set<string>(),
          municipio,
          uf,
        }
        aggregates.set(key, agg)
      }
      agg.valor += valor
      if (sub) agg.subs.add(sub)
      processed++
    }
    console.log('[ingest-cfem] Arquivo processado:', url, '| linhas úteis ~', processed)
  }

  console.log(
    '[ingest-cfem] Linhas CSV por UF (após filtros --uf / --ibge):',
    Object.fromEntries([...linhasPorUf.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
  )

  const rows = [...aggregates.entries()].map(([key, agg]) => {
    const [ibge, anoStr] = key.split('|')
    return {
      municipio_ibge: ibge,
      municipio: agg.municipio || 'Não disponível',
      uf: agg.uf,
      ano: parseInt(anoStr, 10),
      valor_brl: Math.round(agg.valor * 100) / 100,
      substancias: [...agg.subs],
      fonte: 'ANM Dados Abertos',
      updated_at: new Date().toISOString(),
    }
  })

  const agregadosPorUf = new Map<string, number>()
  for (const r of rows) {
    agregadosPorUf.set(r.uf, (agregadosPorUf.get(r.uf) ?? 0) + 1)
  }
  console.log(
    '[ingest-cfem] Registros agregados (município+ano) por UF:',
    Object.fromEntries([...agregadosPorUf.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
  )
  console.log('[ingest-cfem] Total agregados (município+ano):', rows.length)

  let upserted = 0
  const chunk = 200
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk)
    const { error } = await supabase
      .from('cfem_historico')
      .upsert(slice, { onConflict: 'municipio_ibge,ano' })
    if (error) {
      console.error('[ingest-cfem] Supabase:', error.message)
      process.exit(1)
    }
    upserted += slice.length
    console.log('[ingest-cfem] Upsert lote', upserted, '/', rows.length)
  }

  console.log('[ingest-cfem] Concluído. Total upsert:', upserted)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
