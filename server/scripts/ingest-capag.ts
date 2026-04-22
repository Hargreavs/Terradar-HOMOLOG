/**
 * CLI: npx tsx server/scripts/ingest-capag.ts [--uf TO] [--url <xlsx>] [--diagnose]
 * (TERRADAR) - merge: nunca sobrescrever valor existente com NULL no upsert.
 *
 * Fonte padrão: XLSX STN «CAPAG municípios» (Tesouro Transparente / CKAN).
 * Pode apontar para outro snapshot com `--url` (ex.: capag-municipios-posicao-2025-fev-19.xlsx).
 * Cabeçalho real é detetado automaticamente; preservar texto completo das notas (n.d., n.e., A–D).
 * Ano gravado em `capag_municipios.ano`: ANO_REF (ajustar ao trocar arquivo).
 *
 * `--diagnose`: baixa o XLSX, imprime todos os cabeçalhos e uma linha de exemplo (UF filtrada se --uf), sai sem gravar no Supabase.
 * `--verbose`: em ingestão normal, também lista todas as colunas e JSON de exemplo (como --diagnose, mas grava no banco).
 */
import * as XLSX from 'xlsx'

import { supabase } from '../supabase'
import { parseCliArgs } from './utils/cli-args'
import { fetchWithRetry } from './utils/http'

/** Não sobrescrever colunas com NULL/undefined (nem string vazia). */
function mergePreserveNonNull<T extends Record<string, unknown>>(
  existing: T | null,
  incoming: T,
): T {
  if (!existing) return incoming
  const out = { ...existing } as Record<string, unknown>
  for (const [k, v] of Object.entries(incoming)) {
    if (v === null || v === undefined) continue
    if (typeof v === 'string' && v.trim() === '') continue
    out[k] = v
  }
  return out as T
}

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
function logFirstSheetRows(sheet: XLSX.WorkSheet, n: number): void {
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

/** Match exato (normalizado), evitando colunas tipo "Indicador 3 Antigo". */
function findKeyExact(
  row: Record<string, unknown>,
  wanted: string[],
  excludeSubstrings: string[] = ['antigo', 'deducao', 'dcb'],
): string | null {
  const keys = Object.keys(row)
  for (const w of wanted) {
    const wn = normKey(w)
    for (const k of keys) {
      const kn = normKey(k)
      if (excludeSubstrings.some((ex) => kn.includes(normKey(ex)))) continue
      if (kn === wn) return k
    }
  }
  return null
}

/**
 * Fallback: primeira coluna cujo nome normalizado contém `includes` mas não `exclude`.
 */
function findKeyContains(
  row: Record<string, unknown>,
  includes: string,
  excludeSubstrings: string[],
): string | null {
  const inc = normKey(includes)
  const keys = Object.keys(row)
  for (const k of keys) {
    const kn = normKey(k)
    if (!kn.includes(inc)) continue
    if (excludeSubstrings.some((ex) => kn.includes(normKey(ex)))) continue
    return k
  }
  return null
}

function resolveColumnKeyOnce(
  row: Record<string, unknown>,
  exactCandidates: string[],
  containsFallback: { includes: string; exclude: string[] } | null,
  label: string,
  missing: string[],
): string | null {
  const ex = ['antigo', 'deducao', 'dcb zerada', 'of negativa']
  let k = findKeyExact(row, exactCandidates, ex)
  if (!k && containsFallback) {
    k = findKeyContains(row, containsFallback.includes, [
      ...ex,
      ...containsFallback.exclude,
    ])
  }
  if (!k) missing.push(label)
  return k
}

interface CapagColumnKeys {
  kInd1: string | null
  kNota1: string | null
  kInd2: string | null
  kNota2: string | null
  kInd3: string | null
  kNota3: string | null
}

function buildCapagColumnKeys(
  sampleRow: Record<string, unknown>,
): { keys: CapagColumnKeys; warnings: string[] } {
  const missing: string[] = []
  const keys: CapagColumnKeys = {
    kInd1: resolveColumnKeyOnce(
      sampleRow,
      ['Indicador 1', 'Indicador1'],
      { includes: 'endividamento', exclude: ['nota'] },
      'indicador_1',
      missing,
    ),
    kNota1: resolveColumnKeyOnce(
      sampleRow,
      ['Nota 1', 'Nota1'],
      null,
      'nota_1',
      missing,
    ),
    kInd2: resolveColumnKeyOnce(
      sampleRow,
      ['Indicador 2', 'Indicador2'],
      { includes: 'poupanca', exclude: [] },
      'indicador_2',
      missing,
    ),
    kNota2: resolveColumnKeyOnce(
      sampleRow,
      ['Nota 2', 'Nota2'],
      null,
      'nota_2',
      missing,
    ),
    kInd3: resolveColumnKeyOnce(
      sampleRow,
      ['Indicador 3', 'Indicador3'],
      { includes: 'liquidez', exclude: [] },
      'indicador_3',
      missing,
    ),
    kNota3: resolveColumnKeyOnce(
      sampleRow,
      ['Nota 3', 'Nota3'],
      null,
      'nota_3',
      missing,
    ),
  }
  return { keys, warnings: [...new Set(missing)] }
}

/** Parse ratio STN: 0,1613 / 0.1613 / 11,27% / 11.27% / -1,92%; n.d./n.e. → null. */
function parseIndicadorRatio(raw: string): number | null {
  let t = raw.trim()
  if (!t) return null
  const low = t.toLowerCase()
  if (
    low === 'n.d.' ||
    low === 'n.d' ||
    low === 'n.e.' ||
    low === 'n.e' ||
    low === '—' ||
    low === '-'
  )
    return null
  const isPct = /%$/.test(t)
  if (isPct) t = t.replace(/%$/, '').trim()
  let s = t.replace(/\s/g, '')
  if (/^-?\d{1,3}(\.\d{3})*,\d+$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (s.includes(',') && s.lastIndexOf(',') > s.indexOf('.')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    s = s.replace(',', '.')
  }
  let n = parseFloat(s)
  if (!Number.isFinite(n)) return null
  if (isPct) n /= 100
  return n
}

function cleanNotaText(raw: string): string | null {
  const t = raw.trim()
  return t ? t : null
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

function logAllHeaders(headers: string[]): void {
  console.log('[ingest-capag] --- Todas as colunas (headers) ---')
  headers.forEach((h, i) => {
    if (h.trim()) console.log(`  [${i}] ${h}`)
  })
  console.log('[ingest-capag] Total de colunas com nome:', headers.filter((h) => h.trim()).length)
}

function rowToPlain(row: Record<string, unknown>): Record<string, string> {
  const o: Record<string, string> = {}
  for (const [k, v] of Object.entries(row)) {
    if (k.startsWith('__EMPTY')) continue
    o[k] = v != null ? String(v) : ''
  }
  return o
}

async function main() {
  const { flags } = parseCliArgs(process.argv.slice(2))
  const ufFilter =
    typeof flags.uf === 'string' ? flags.uf.trim().toUpperCase() : null
  const diagnose = flags.diagnose === true
  const verbose = flags.verbose === true
  const url =
    typeof flags.url === 'string' && flags.url.trim()
      ? flags.url.trim()
      : CAPAG_XLSX_URL

  console.log(
    '[ingest-capag] Ano referência (banco):',
    ANO_REF,
    ufFilter ? `| UF ${ufFilter}` : '| todas UFs',
    diagnose ? '| MODO DIAGNOSE (sem gravar)' : '',
    verbose && !diagnose ? '| verbose' : '',
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

  const headerRow = matrix[headerIdx] ?? []
  if (verbose || diagnose) {
    logAllHeaders(headerRow)
  } else {
    console.log(
      '[ingest-capag] Cabeçalho (resumo):',
      headerRow.filter((h) => h.trim()).length,
      'colunas | linha',
      headerIdx + 1,
    )
  }

  const rowsRaw = matrixToObjects(matrix, headerIdx)
  console.log('[ingest-capag] Linhas de dados:', rowsRaw.length)
  if (rowsRaw.length > 0) {
    console.log('[ingest-capag] Chaves (1º registro):', Object.keys(rowsRaw[0]).join(' | '))
  }

  // Linha de exemplo: primeiro município da UF solicitada (ou primeiro do arquivo)
  let sampleRow: Record<string, unknown> | null = null
  for (const row of rowsRaw) {
    const uf = cellByPatterns(row, ['UF', 'uf']).toUpperCase()
    if (ufFilter) {
      if (uf === ufFilter) {
        sampleRow = row
        break
      }
    } else {
      sampleRow = row
      break
    }
  }
  if (verbose || diagnose) {
    if (sampleRow) {
      console.log(
        '[ingest-capag] --- Exemplo de linha' +
          (ufFilter ? ` (primeiro município UF ${ufFilter})` : '') +
          ' ---',
      )
      console.log(JSON.stringify(rowToPlain(sampleRow), null, 2))
    } else {
      console.log('[ingest-capag] WARN: nenhuma linha de exemplo (filtro UF sem match?)')
    }
  }

  if (diagnose) {
    console.log('[ingest-capag] Diagnose concluída (--diagnose: sem upsert).')
    return
  }

  if (rowsRaw.length === 0) {
    console.error('[ingest-capag] Nenhuma linha de dados; abortando.')
    process.exit(1)
  }

  const { keys: capKeys, warnings: headerWarnings } = buildCapagColumnKeys(
    rowsRaw[0],
  )
  console.log('[ingest-capag] Colunas resolvidas (1ª linha):', {
    indicador_1: capKeys.kInd1,
    nota_1: capKeys.kNota1,
    indicador_2: capKeys.kInd2,
    nota_2: capKeys.kNota2,
    indicador_3: capKeys.kInd3,
    nota_3: capKeys.kNota3,
  })
  if (headerWarnings.length > 0) {
    console.warn(
      '[ingest-capag] WARN: não foi possível resolver coluna no cabeçalho para:',
      headerWarnings.join(', '),
    )
  }

  const mapped = rowsRaw
    .map((row) => {
      const ibge = cellByPatterns(row, [
        'CodigoMunicipio',
        'Código Município',
        'cod ibge',
        'codigo ibge',
        'Código Município Completo',
      ]).replace(/\D/g, '')
      if (!ibge) return null

      const uf = cellByPatterns(row, ['UF', 'uf']).toUpperCase()
      if (ufFilter && uf !== ufFilter) return null

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

      const vInd1 =
        capKeys.kInd1 && row[capKeys.kInd1] != null
          ? String(row[capKeys.kInd1]).trim()
          : ''
      const vNota1 =
        capKeys.kNota1 && row[capKeys.kNota1] != null
          ? String(row[capKeys.kNota1]).trim()
          : ''
      const vInd2 =
        capKeys.kInd2 && row[capKeys.kInd2] != null
          ? String(row[capKeys.kInd2]).trim()
          : ''
      const vNota2 =
        capKeys.kNota2 && row[capKeys.kNota2] != null
          ? String(row[capKeys.kNota2]).trim()
          : ''
      const vInd3 =
        capKeys.kInd3 && row[capKeys.kInd3] != null
          ? String(row[capKeys.kInd3]).trim()
          : ''
      const vNota3 =
        capKeys.kNota3 && row[capKeys.kNota3] != null
          ? String(row[capKeys.kNota3]).trim()
          : ''

      const indicador_1 = parseIndicadorRatio(vInd1)
      const indicador_2 = parseIndicadorRatio(vInd2)
      const indicador_3 = parseIndicadorRatio(vInd3)
      const nota_1 = cleanNotaText(vNota1)
      const nota_2 = cleanNotaText(vNota2)
      const nota_3 = cleanNotaText(vNota3)

      /** Legado: sempre espelhar os indicadores oficiais (STN). */
      const endividamento: number | null = indicador_1
      const poupanca: number | null = indicador_2
      const liquidez: number | null = indicador_3

      return {
        municipio_ibge: ibge,
        municipio: municipio || 'Não disponível',
        uf: uf || 'Não disponível',
        ano: ANO_REF,
        nota: nota || 'Não disponível',
        endividamento,
        poupanca,
        liquidez,
        indicador_1,
        indicador_2,
        indicador_3,
        nota_1,
        nota_2,
        nota_3,
        pib_municipal: null,
        fonte: 'Tesouro Transparente / XLSX CAPAG municípios',
        updated_at: new Date().toISOString(),
      }
    })
    .filter((x): x is NonNullable<typeof x> => x != null)

  console.log('[ingest-capag] Registros após mapeamento/filtro:', mapped.length)

  const ibgesProcessados = [...new Set(mapped.map((m) => m.municipio_ibge))]

  let upserted = 0
  const chunk = 300
  for (let i = 0; i < mapped.length; i += chunk) {
    const slice = mapped.slice(i, i + chunk)
    const ibgesChunk = slice.map((r) => r.municipio_ibge)
    const { data: existentes } = await supabase
      .from('capag_municipios')
      .select('*')
      .eq('ano', ANO_REF)
      .in('municipio_ibge', ibgesChunk)

    const porIbge = new Map(
      (existentes ?? []).map((r) => [String(r.municipio_ibge), r]),
    )

    const mergedSlice = slice.map((row) => {
      const ex = porIbge.get(row.municipio_ibge) as
        | Record<string, unknown>
        | undefined
      const merged = mergePreserveNonNull(ex ?? null, {
        ...row,
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>)
      const i1 = merged.indicador_1
      const i2 = merged.indicador_2
      const i3 = merged.indicador_3
      return {
        ...merged,
        /** Legado espelha sempre os indicadores efetivos (merge pode preservar i* do banco). */
        endividamento: i1 != null ? Number(i1) : null,
        poupanca: i2 != null ? Number(i2) : null,
        liquidez: i3 != null ? Number(i3) : null,
      }
    })

    const { error } = await supabase
      .from('capag_municipios')
      .upsert(mergedSlice, { onConflict: 'municipio_ibge,ano' })
    if (error) {
      console.error('[ingest-capag] Supabase:', error.message)
      process.exit(1)
    }
    upserted += slice.length
    console.log('[ingest-capag] Upsert lote', upserted, '/', mapped.length)
  }

  console.log('[ingest-capag] Sincronizando pib_municipal a partir de fiscal_municipios…')
  const { data: fiscais } = await supabase
    .from('fiscal_municipios')
    .select('municipio_ibge,pib_municipal_mi')
    .in('municipio_ibge', ibgesProcessados)

  const { data: capPibs } = await supabase
    .from('capag_municipios')
    .select('municipio_ibge,pib_municipal')
    .eq('ano', ANO_REF)
    .in('municipio_ibge', ibgesProcessados)

  const pibCap = new Map(
    (capPibs ?? []).map((r) => [String(r.municipio_ibge), r.pib_municipal]),
  )

  let pibAtualizados = 0
  for (const f of fiscais ?? []) {
    const pib = f.pib_municipal_mi
    if (pib == null || !Number.isFinite(Number(pib))) continue
    const ib = String(f.municipio_ibge)
    if (pibCap.get(ib) != null) continue
    const { error: upErr } = await supabase
      .from('capag_municipios')
      .update({
        pib_municipal: Number(pib),
        updated_at: new Date().toISOString(),
      })
      .eq('municipio_ibge', ib)
      .eq('ano', ANO_REF)
      .is('pib_municipal', null)
    if (!upErr) pibAtualizados++
  }
  console.log(`[ingest-capag] pib_municipal preenchido em ${pibAtualizados} linha(s) (estava NULL).`)

  const auditIbges = new Set<string>(['1705102', '1711506'])
  if (mapped.length <= 40) {
    ibgesProcessados.forEach((x) => auditIbges.add(x))
  }
  for (const ibge of auditIbges) {
    if (!ibgesProcessados.includes(ibge)) continue
    const { data: row } = await supabase
      .from('capag_municipios')
      .select(
        'municipio_ibge,endividamento,poupanca,liquidez,pib_municipal,indicador_1,indicador_2,indicador_3',
      )
      .eq('municipio_ibge', ibge)
      .eq('ano', ANO_REF)
      .maybeSingle()
    if (!row) continue
    console.log(`\n[AUDIT] capag_municipios ${ibge}:`)
    const fields: Array<{ k: keyof typeof row; label: string }> = [
      { k: 'endividamento', label: 'endividamento' },
      { k: 'poupanca', label: 'poupanca' },
      { k: 'liquidez', label: 'liquidez' },
      { k: 'pib_municipal', label: 'pib_municipal' },
    ]
    for (const { k, label } of fields) {
      const v = row[k]
      if (v != null && v !== '') {
        console.log(`  ✅ ${label} = ${v}`)
      } else {
        const tag =
          label === 'pib_municipal'
            ? '(sem pib_municipal_mi em fiscal_municipios para este IBGE)'
            : '(n.d. na fonte CAPAG ou indicador nulo)'
        console.log(`  ⚠️ ${label} = NULL ${tag}`)
      }
    }
  }

  console.log('\n[ingest-capag] Concluído. Total upsert:', upserted)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
