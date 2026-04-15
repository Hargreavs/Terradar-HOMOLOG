/**
 * CLI: npx tsx server/scripts/ingest-capag.ts [--uf TO] [--url <xlsx>]
 *
 * Fonte padrão: XLSX STN «CAPAG municípios» (Tesouro Transparente / CKAN).
 * Pode apontar para outro snapshot com `--url` (ex.: capag-municipios-posicao-2025-fev-19.xlsx).
 * Cabeçalho real é detetado automaticamente; preservar texto completo das notas (n.d., n.e., A–D).
 * Ano gravado em `capag_municipios.ano`: ANO_REF (ajustar ao trocar arquivo).
 */
import * as XLSX from 'xlsx'

import { supabase } from '../supabase'
import { parseCliArgs } from './utils/cli-args'
import { fetchWithRetry } from './utils/http'

const CAPAG_XLSX_URL =
  'https://www.tesourotransparente.gov.br/ckan/dataset/9ff93162-409e-48b5-91d9-cf645a47fdfc/resource/30c5fc20-634d-4558-9d45-01645b501deb/download/20241015capag-municipios.xlsx'

/** Ano gravado em capag_municipios.ano para este arquivo (fixo). */
const ANO_REF = 2024

const MAX_XLSX_BYTES = 150 * 1024 * 1024

function normKey(s: string): string {
  return String(s)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

function cellText(cell: XLSX.CellObject | undefined): string {
  if (!cell) return ''
  if (cell.w != null) return String(cell.w).trim()
  if (cell.v != null) return String(cell.v).trim()
  return ''
}

/** Primeiras `n` linhas da folha (valores em texto), para debug. */
function logFirstSheetRows(
  sheet: XLSX.WorkSheet,
  n: number,
): void {
  const ref = sheet['!ref']
  if (!ref) {
    console.log('[ingest-capag] (debug) Sheet sem !ref')
    return
  }
  const d = XLSX.utils.decode_range(ref)
  const lastRow = Math.min(n - 1, d.e.r)
  for (let r = d.s.r; r <= lastRow; r++) {
    const cells: string[] = []
    for (let c = d.s.c; c <= d.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      cells.push(cellText(sheet[addr]))
    }
    console.log(`[ingest-capag] Linha sheet ${r + 1}:`, cells.join(' | '))
  }
}

/**
 * Converte folha em matriz 2D (todas as linhas com dados).
 */
function sheetToMatrix(sheet: XLSX.WorkSheet): string[][] {
  const ref = sheet['!ref']
  if (!ref) return []
  const d = XLSX.utils.decode_range(ref)
  const rows: string[][] = []
  for (let r = d.s.r; r <= d.e.r; r++) {
    const row: string[] = []
    for (let c = d.s.c; c <= d.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      row.push(cellText(sheet[addr]))
    }
    rows.push(row)
  }
  return rows
}

/**
 * Índice da linha de cabeçalho: colunas tipo CodigoMunicipio / Município / CAPAG.
 * Ignora linhas de título (ex.: "CAPAG Ano Base 2023").
 */
function findHeaderRowIndex(matrix: string[][]): number {
  for (let i = 0; i < Math.min(matrix.length, 30); i++) {
    const row = matrix[i]
    const cells = row.map(normKey)
    const joined = cells.join('|')
    if (joined.includes('ano base') && !cells.some((c) => c === 'municipio'))
      continue
    const hasCod =
      joined.includes('codigomunicipio') ||
      joined.includes('codigo ibge') ||
      cells.some((c) => /codigomunicipio|cod.*ibge|ibge.*cod/.test(c))
    const hasMun = cells.some(
      (c) => c === 'municipio' || c.includes('municipio'),
    )
    const hasCapCol = cells.some(
      (c) =>
        c === 'capag' ||
        (c.startsWith('capag') && !c.includes('ano base')),
    )
    if (hasCod && hasMun) return i
    if (hasMun && hasCapCol && row.filter((x) => x.trim()).length >= 5) return i
  }
  for (const idx of [3, 4, 2, 1, 0]) {
    if (idx < matrix.length) return idx
  }
  return 0
}

function matrixToObjects(
  matrix: string[][],
  headerRowIdx: number,
): Record<string, unknown>[] {
  const header = matrix[headerRowIdx].map((h, colIdx) => {
    const t = h.trim()
    return t === '' || /^__empty/i.test(t) ? `__EMPTY_${colIdx}` : t
  })
  const out: Record<string, unknown>[] = []
  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const row = matrix[r]
    if (!row.some((c) => c.trim())) continue
    const o: Record<string, unknown> = {}
    for (let c = 0; c < header.length; c++) {
      const key = header[c]
      if (key.startsWith('__EMPTY')) continue
      o[key] = row[c] ?? ''
    }
    out.push(o)
  }
  return out
}

function cellByPatterns(
  row: Record<string, unknown>,
  patterns: string[],
): string {
  const keys = Object.keys(row)
  for (const pat of patterns) {
    const pn = normKey(pat)
    for (const k of keys) {
      const kn = normKey(k)
      if (kn === pn || kn.includes(pn) || pn.includes(kn)) {
        const v = row[k]
        if (v != null && v !== '') return String(v).trim()
      }
    }
  }
  return ''
}

async function downloadXlsx(url: string): Promise<Buffer> {
  console.log('[ingest-capag] Baixando XLSX…', url)
  const res = await fetchWithRetry(url)
  const len = res.headers.get('content-length')
  if (len && Number(len) > MAX_XLSX_BYTES) {
    throw new Error(`Arquivo > 150MB (${len} bytes). Abortando.`)
  }
  return Buffer.from(await res.arrayBuffer())
}

async function main() {
  const { flags } = parseCliArgs(process.argv.slice(2))
  const ufFilter =
    typeof flags.uf === 'string' ? flags.uf.trim().toUpperCase() : null
  const url =
    typeof flags.url === 'string' && flags.url.trim()
      ? flags.url.trim()
      : CAPAG_XLSX_URL

  console.log(
    '[ingest-capag] Ano referência (banco):',
    ANO_REF,
    ufFilter ? `| UF ${ufFilter}` : '| todas UFs',
  )

  const buf = await downloadXlsx(url)
  console.log('[ingest-capag] Bytes recebidos:', buf.length)

  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
  const name = wb.SheetNames[0]
  if (!name) {
    console.error('[ingest-capag] Workbook sem folhas.')
    process.exit(1)
  }
  const sheet = wb.Sheets[name]
  console.log('[ingest-capag] Folha:', name)

  logFirstSheetRows(sheet, 3)

  const matrix = sheetToMatrix(sheet)
  console.log('[ingest-capag] Linhas na matriz:', matrix.length)

  const headerIdx = findHeaderRowIndex(matrix)
  console.log('[ingest-capag] Linha de cabeçalho detetada (1-based):', headerIdx + 1)
  console.log(
    '[ingest-capag] Cabeçalho:',
    matrix[headerIdx]?.map((x) => x.trim()).filter(Boolean).join(' | '),
  )

  const rowsRaw = matrixToObjects(matrix, headerIdx)
  console.log('[ingest-capag] Linhas de dados:', rowsRaw.length)
  if (rowsRaw.length > 0) {
    console.log('[ingest-capag] Chaves (1º registro):', Object.keys(rowsRaw[0]).join(' | '))
  }

  const mapped = rowsRaw
    .map((row) => {
      const ibge = cellByPatterns(row, [
        'CodigoMunicipio',
        'Código Município',
        'cod ibge',
        'codigo ibge',
        'ibge',
      ]).replace(/\D/g, '')
      if (!ibge) return null

      const uf = cellByPatterns(row, ['UF', 'uf']).toUpperCase()
      if (ufFilter && uf !== ufFilter) return null

      /** Não usar só "Município": no XLSX isso casa com "Código Município Completo" (valor numérico). */
      const municipio = cellByPatterns(row, [
        'Nome_Município',
        'Nome_Municipio',
        'Município',
        'Municipio',
        'nome',
      ])
      const nota = cellByPatterns(row, [
        'CAPAG',
        'Nota CAPAG',
        'nota capag',
        'classificacao',
      ])
      const endiv = cellByPatterns(row, ['Endividamento', 'endividamento'])
      const poup = cellByPatterns(row, [
        'Poupança Corrente',
        'Poupanca Corrente',
        'poupanca corrente',
        'poupanca',
      ])
      const liq = cellByPatterns(row, ['Liquidez', 'liquidez'])

      return {
        municipio_ibge: ibge,
        municipio: municipio || 'Não disponível',
        uf: uf || 'Não disponível',
        ano: ANO_REF,
        nota: nota || 'Não disponível',
        endividamento: endiv || null,
        poupanca: poup || null,
        liquidez: liq || null,
        pib_municipal: null,
        fonte: 'Tesouro Transparente / XLSX CAPAG municípios',
        updated_at: new Date().toISOString(),
      }
    })
    .filter((x): x is NonNullable<typeof x> => x != null)

  console.log('[ingest-capag] Registros após mapeamento/filtro:', mapped.length)

  let upserted = 0
  const chunk = 300
  for (let i = 0; i < mapped.length; i += chunk) {
    const slice = mapped.slice(i, i + chunk)
    const { error } = await supabase
      .from('capag_municipios')
      .upsert(slice, { onConflict: 'municipio_ibge,ano' })
    if (error) {
      console.error('[ingest-capag] Supabase:', error.message)
      process.exit(1)
    }
    upserted += slice.length
    console.log('[ingest-capag] Upsert lote', upserted, '/', mapped.length)
  }

  console.log('[ingest-capag] Concluído. Total upsert:', upserted)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
