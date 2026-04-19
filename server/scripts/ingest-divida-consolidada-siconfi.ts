/**
 * NOTA (19/04/2026): endpoint SICONFI RGF Data Lake retorna count:0 pra todos
 * os entes/períodos testados. Investigação registrada em tmp/debug-rgf-sp.log.
 * DCA consultado anteriormente não expõe Dívida Consolidada LRF (só Dívida Ativa,
 * Amortização, Encargos). Script mantido dormant até reabilitação da carga RGF
 * ou definição de fonte alternativa (CKAN Tesouro Transparente, scraping manual,
 * upload CSV).
 *
 * Backfill apenas de fiscal_municipios.divida_consolidada via SICONFI DCA
 * (mesma lógica que ingest-fiscal / utils/siconfi-dca-divida).
 * Não altera passivo_nao_circulante nem outras colunas.
 *
 * Uso (quando reativar):
 *   npx tsx server/scripts/ingest-divida-consolidada-siconfi.ts --exercicio 2024
 *   npx tsx server/scripts/ingest-divida-consolidada-siconfi.ts --exercicio 2024 --only-null
 *   npx tsx server/scripts/ingest-divida-consolidada-siconfi.ts --ibge 2932002 --exercicio 2024
 *   npx tsx server/scripts/ingest-divida-consolidada-siconfi.ts --dry-run --limit 5
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import '../env'
import { supabase } from '../supabase'
import { fetchDividaConsolidadaForMunicipio } from './utils/siconfi-dca-divida'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag)
  return idx !== -1 && idx + 1 < process.argv.length
    ? process.argv[idx + 1]
    : undefined
}

function logLine(path: string, line: string): void {
  fs.appendFileSync(path, `${new Date().toISOString()} ${line}\n`, 'utf8')
}

async function main(): Promise<void> {
  const exercicio = Number(getArg('--exercicio') ?? '2024')
  const onlyNull = process.argv.includes('--only-null')
  const dryRun = process.argv.includes('--dry-run')
  const limitRaw = getArg('--limit')
  const limit =
    limitRaw != null && limitRaw !== '' ? Number(limitRaw) : undefined
  const ibgeFilter = getArg('--ibge')

  if (!Number.isFinite(exercicio) || exercicio < 2000) {
    console.error('Use --exercicio YYYY (default 2024)')
    process.exit(1)
  }

  const pageSize = 1000
  const rows: Array<{
    municipio_ibge: string
    exercicio: number
    divida_consolidada: unknown
    passivo_nao_circulante: unknown
  }> = []

  if (ibgeFilter) {
    let q = supabase
      .from('fiscal_municipios')
      .select(
        'municipio_ibge, exercicio, divida_consolidada, passivo_nao_circulante',
      )
      .eq('exercicio', exercicio)
      .eq('municipio_ibge', ibgeFilter)
    if (onlyNull) q = q.is('divida_consolidada', null)
    const { data, error } = await q.maybeSingle()
    if (error) {
      console.error(error.message)
      process.exit(1)
    }
    if (data) rows.push(data as (typeof rows)[0])
  } else {
    for (let offset = 0; ; offset += pageSize) {
      let q = supabase
        .from('fiscal_municipios')
        .select(
          'municipio_ibge, exercicio, divida_consolidada, passivo_nao_circulante',
        )
        .eq('exercicio', exercicio)
        .order('municipio_ibge')
        .range(offset, offset + pageSize - 1)
      if (onlyNull) q = q.is('divida_consolidada', null)
      const { data, error } = await q
      if (error) {
        console.error(error.message)
        process.exit(1)
      }
      const chunk = data ?? []
      rows.push(...(chunk as typeof rows))
      if (chunk.length < pageSize) break
    }
  }

  let list = rows
  if (limit === 0) {
    list = []
  } else if (limit != null && Number.isFinite(limit) && limit > 0) {
    list = list.slice(0, limit)
  }

  const logPath = path.join(ROOT, 'tmp', 'ingest-divida-consolidada-siconfi.log')
  fs.mkdirSync(path.dirname(logPath), { recursive: true })

  console.log(
    `Registros a processar: ${list.length} (exercicio=${exercicio}, onlyNull=${onlyNull}, dryRun=${dryRun})`,
  )
  logLine(logPath, `START count=${list.length} exercicio=${exercicio}`)

  let sucesso = 0
  let semDeclaracao = 0
  let erros = 0

  for (let i = 0; i < list.length; i++) {
    const row = list[i]!
    const ibge = String(row.municipio_ibge)
    const ex = Number(row.exercicio)

    try {
      const dc = await fetchDividaConsolidadaForMunicipio(ibge, ex)

      if (dc === null) {
        semDeclaracao++
        logLine(logPath, `SEM_DC ibge=${ibge} ex=${ex}`)
        if ((i + 1) % 100 === 0) {
          console.log(
            `  ... ${i + 1}/${list.length} (ok=${sucesso}, semDC=${semDeclaracao}, err=${erros})`,
          )
        }
        await sleep(250)
        continue
      }

      if (dryRun) {
        console.log(`[dry-run] ${ibge} divida_consolidada=${dc}`)
        sucesso++
        await sleep(250)
        continue
      }

      const { error: upErr } = await supabase
        .from('fiscal_municipios')
        .update({ divida_consolidada: dc })
        .eq('municipio_ibge', ibge)
        .eq('exercicio', ex)

      if (upErr) {
        erros++
        console.warn(`Erro update ${ibge}:`, upErr.message)
        logLine(logPath, `ERRO_UPDATE ibge=${ibge} ${upErr.message}`)
        await sleep(2000)
      } else {
        sucesso++
        logLine(logPath, `OK ibge=${ibge} dc=${dc}`)
        if (sucesso % 100 === 0) {
          console.log(`Progresso: ${sucesso} ok / ${i + 1} processados`)
        }
      }
    } catch (e) {
      erros++
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`Erro ${ibge}:`, msg)
      logLine(logPath, `ERRO ibge=${ibge} ${msg}`)
      await sleep(2000)
    }

    await sleep(250)
  }

  console.log('\nResumo:', { sucesso, semDeclaracao, erros })
  logLine(
    logPath,
    `END sucesso=${sucesso} semDeclaracao=${semDeclaracao} erros=${erros}`,
  )

  if (dryRun) {
    console.log('dry-run: nenhum UPDATE no banco.')
    return
  }

  const anomAll: Array<{
    municipio_ibge: string
    exercicio: number
    divida_consolidada: unknown
    passivo_nao_circulante: unknown
  }> = []
  for (let off = 0; ; off += pageSize) {
    const { data: chunk, error: anomErr } = await supabase
      .from('fiscal_municipios')
      .select(
        'municipio_ibge, exercicio, divida_consolidada, passivo_nao_circulante',
      )
      .eq('exercicio', exercicio)
      .not('divida_consolidada', 'is', null)
      .not('passivo_nao_circulante', 'is', null)
      .order('municipio_ibge')
      .range(off, off + pageSize - 1)
    if (anomErr) {
      console.warn('Aviso: nao foi possivel listar anomalias:', anomErr.message)
      break
    }
    const c = chunk ?? []
    anomAll.push(...(c as typeof anomAll))
    if (c.length < pageSize) break
  }

  const bad = anomAll.filter((r) => {
    const d = Number(r.divida_consolidada)
    const p = Number(r.passivo_nao_circulante)
    return Number.isFinite(d) && Number.isFinite(p) && d > p
  })

  if (bad.length > 0) {
    console.warn(
      `\n[ANOMALIA] divida_consolidada > passivo_nao_circulante (${bad.length} linhas, amostra 20):`,
    )
    console.warn(bad.slice(0, 20))
    logLine(logPath, `ANOMALIAS count=${bad.length} sample=${JSON.stringify(bad.slice(0, 10))}`)
  } else {
    console.log('\nNenhuma anomalia DC > PNC neste exercicio.')
  }
}

const isCli =
  typeof process.argv[1] === 'string' &&
  process.argv[1].includes('ingest-divida-consolidada-siconfi')
if (isCli) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
