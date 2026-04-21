/**
 * Ingest de divida_consolidada a partir do dataset CKAN CAPAG Municípios
 * do Tesouro Transparente.
 *
 * Fonte: https://www.tesourotransparente.gov.br/ckan/dataset/capag-municipios
 * Arquivo usado: capag-municipios-2025.xlsx (posição fev/2025, ano base 2024)
 *
 * Substitui o ingest via API SICONFI que ficou dormant devido a indisponibilidade
 * do endpoint /tt/rgf do Data Lake (count:0 pra qualquer parâmetro — investigado em 19/04/2026).
 *
 * Lê a aba "CAPAG Ano Base 2024", coluna D (DÍVIDA CONSOLIDADA - DC (I)).
 * Popula fiscal_municipios.divida_consolidada onde exercicio = 2024.
 * NÃO toca em passivo_nao_circulante nem em outras colunas.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import xlsxPkg from 'xlsx'

const readXlsxFile = xlsxPkg.readFile.bind(xlsxPkg)
const xlsxUtils = xlsxPkg.utils

import '../env'
import { supabase } from '../supabase'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')

interface Args {
  xlsx: string
  aba: string
  exercicio: number
  dryRun: boolean
  limit: number | null
  ibge: string | null
  onlyNull: boolean
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag)
  return idx !== -1 && idx + 1 < process.argv.length
    ? process.argv[idx + 1]
    : undefined
}

function parseArgs(): Args {
  const xlsxRel =
    getArg('--xlsx') ?? 'data/capag/capag-municipios-2025.xlsx'
  const xlsx = path.isAbsolute(xlsxRel)
    ? xlsxRel
    : path.join(ROOT, xlsxRel)
  const aba = getArg('--aba') ?? 'CAPAG Ano Base 2024'
  const ex = Number(getArg('--exercicio') ?? '2024')
  const dryRun = process.argv.includes('--dry-run')
  const limitRaw = getArg('--limit')
  const limit =
    limitRaw != null && limitRaw !== ''
      ? Number(limitRaw)
      : null
  const ibge = getArg('--ibge')?.replace(/\D/g, '').padStart(7, '0') ?? null
  const onlyNull = process.argv.includes('--all')
    ? false
    : true

  return {
    xlsx,
    aba,
    exercicio: Number.isFinite(ex) ? ex : 2024,
    dryRun,
    limit: limit != null && Number.isFinite(limit) && limit > 0 ? limit : null,
    ibge,
    onlyNull,
  }
}

function parseDc(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  const s = String(raw).trim().toLowerCase()
  if (s === '' || s === 'n.d.' || s === 'n.d' || s === '-') return null
  const n = Number(String(raw).replace(/\s/g, '').replace(',', '.'))
  if (!Number.isFinite(n)) return null
  return n
}

async function main(): Promise<void> {
  const args = parseArgs()

  if (!fs.existsSync(args.xlsx)) {
    console.error(`Arquivo nao encontrado: ${args.xlsx}`)
    process.exit(1)
  }

  const wb = readXlsxFile(args.xlsx, { cellDates: false })
  const ws = wb.Sheets[args.aba]
  if (!ws) {
    console.error(
      `Aba "${args.aba}" nao encontrada. Abas: ${wb.SheetNames.join(', ')}`,
    )
    process.exit(1)
  }

  const rows = xlsxUtils.sheet_to_json(ws, {
    header: 1,
    blankrows: false,
    defval: null,
  }) as unknown[][]

  const dataRows = rows.slice(3)

  const stats = {
    total: 0,
    comValor: 0,
    semValor: 0,
    updated: 0,
    skippedNoRow: 0,
    notFoundOrNoop: 0,
  }

  const preview: Array<{
    ibge: string
    nome: unknown
    uf: unknown
    dc: number
  }> = []

  for (const r of dataRows) {
    const ibgeRaw = r[0]
    const nome = r[1]
    const uf = r[2]
    const dcRaw = r[3]

    if (ibgeRaw === null || ibgeRaw === undefined || ibgeRaw === '') continue

    stats.total++

    const ibgeStr = String(ibgeRaw).replace(/\D/g, '').padStart(7, '0')

    if (args.ibge && ibgeStr !== args.ibge) continue

    if (!args.ibge && args.limit != null && stats.total > args.limit) break

    const dc = parseDc(dcRaw)
    if (dc === null) {
      stats.semValor++
      continue
    }
    stats.comValor++

    if (preview.length < 20) {
      preview.push({ ibge: ibgeStr, nome, uf, dc })
    }

    if (args.dryRun) {
      if (args.ibge) break
      continue
    }

    let q = supabase
      .from('fiscal_municipios')
      .update({ divida_consolidada: dc })
      .eq('municipio_ibge', ibgeStr)
      .eq('exercicio', args.exercicio)

    if (args.onlyNull) {
      q = q.is('divida_consolidada', null)
    }

    const { data, error } = await q.select('municipio_ibge')

    if (error) {
      console.error(`Erro ${ibgeStr}:`, error.message)
      stats.skippedNoRow++
      continue
    }

    const n = Array.isArray(data) ? data.length : 0
    if (n === 0) {
      stats.notFoundOrNoop++
    } else {
      stats.updated += n
    }

    if (args.ibge) break
  }

  console.log('=== PREVIEW (primeiras 20 com valor numerico) ===')
  for (const p of preview) {
    console.log(
      `  ${p.ibge} ${p.nome}/${p.uf}: R$ ${p.dc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    )
  }
  console.log()
  console.log('=== STATS ===')
  console.log(JSON.stringify(stats, null, 2))
  console.log(
    `dryRun=${args.dryRun} onlyNull=${args.onlyNull} exercicio=${args.exercicio} aba=${JSON.stringify(args.aba)}`,
  )

  if (args.dryRun) {
    console.log('\n[dry-run] Nenhum UPDATE no banco.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
