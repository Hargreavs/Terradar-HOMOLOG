// ingest-sedes-ibge.ts - IBGE municipal mesh centroids into geo_sedes_municipais (SRID 4674).
// Needs DATABASE_URL in .env.local. Download BR_Municipios_* shapefile from IBGE malhas.
// DBF is UTF-8 (pacote shapefile default e windows-1252; passamos encoding utf-8).
// Run: npx tsx server/scripts/ingest-sedes-ibge.ts --shp data/ibge/BR_Municipios_2025

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { geoCentroid } from 'd3-geo'
import dotenv from 'dotenv'
import { Pool, type PoolClient } from 'pg'
import { open } from 'shapefile'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
dotenv.config({ path: path.join(ROOT, '.env.local') })
dotenv.config({ path: path.join(ROOT, '.env') })

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL must be set in .env.local')
  process.exit(1)
}

const FONTE_LOTE = 'IBGE_centroide_malha_municipal_2024'

const COD_CAPITAL_UF = new Set<string>([
  '1100205',
  '1200401',
  '1302603',
  '1400100',
  '1501402',
  '1600303',
  '1721000',
  '2111300',
  '2211001',
  '2304400',
  '2408102',
  '2507507',
  '2611606',
  '2704302',
  '2800308',
  '2927408',
  '3106200',
  '3205309',
  '3304557',
  '3550308',
  '4106902',
  '4205407',
  '4314902',
  '5002704',
  '5103403',
  '5208707',
  '5300108',
])

interface SedeRow {
  municipio_ibge: string
  nome: string
  uf: string
  capital: boolean
  lon: number
  lat: number
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag)
  return idx !== -1 && idx + 1 < process.argv.length
    ? process.argv[idx + 1]
    : undefined
}

function padIbge7(raw: unknown): string | null {
  if (raw == null) return null
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length < 6) return null
  return digits.padStart(7, '0').slice(-7)
}

function extractCodIbge(props: Record<string, unknown>): string | null {
  const keys = [
    'CD_MUN',
    'CD_MUNICIPIO',
    'GEOCODIGO',
    'COD_MUN',
    'codigo_ibge',
  ]
  for (const k of keys) {
    const v = props[k] ?? props[k.toLowerCase()]
    const p = padIbge7(v)
    if (p) return p
  }
  return null
}

function extractNome(props: Record<string, unknown>): string {
  const keys = ['NM_MUN', 'NM_MUNICIPIO', 'NOME', 'nome']
  for (const k of keys) {
    const v = props[k] ?? props[k.toLowerCase()]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

function extractUf(props: Record<string, unknown>): string {
  const keys = ['SIGLA_UF', 'UF', 'SG_UF']
  for (const k of keys) {
    const v = props[k] ?? props[k.toLowerCase()]
    if (v != null && String(v).trim() !== '') {
      return String(v).trim().toUpperCase().slice(0, 2)
    }
  }
  return ''
}

function centroidLonLat(geometry: {
  type: string
  coordinates: unknown
}): [number, number] | null {
  const f = {
    type: 'Feature' as const,
    properties: {},
    geometry,
  }
  const c = geoCentroid(f as never)
  const lon = c[0]
  const lat = c[1]
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
  return [lon, lat]
}

async function loadSedesFromShapefile(shpBase: string): Promise<{
  rows: SedeRow[]
  divergentes: string[]
}> {
  const shpPath = `${shpBase}.shp`
  if (!fs.existsSync(shpPath)) {
    console.error(`File not found: ${shpPath}`)
    process.exit(1)
  }

  const source = await open(shpPath, undefined, { encoding: 'utf-8' })
  const byCode = new Map<string, SedeRow>()
  const divergentes: string[] = []
  let first = true

  for (;;) {
    const result = await source.read()
    if (result.done) break
    const feat = result.value
    if (feat.type !== 'Feature' || !feat.properties || !feat.geometry) continue

    if (first) {
      console.log('First feature properties:', JSON.stringify(feat.properties, null, 2))
      first = false
    }

    const props = feat.properties as Record<string, unknown>
    const cod = extractCodIbge(props)
    if (!cod) {
      divergentes.push('missing IBGE code')
      continue
    }

    const nome = extractNome(props)
    const uf = extractUf(props)
    if (uf.length !== 2) divergentes.push(`bad UF for ${cod}`)

    const ll = centroidLonLat(
      feat.geometry as { type: string; coordinates: unknown },
    )
    if (!ll) {
      divergentes.push(`no centroid ${cod}`)
      continue
    }
    const [lon, lat] = ll

    if (byCode.has(cod)) {
      divergentes.push(`duplicate SHP ${cod}`)
      continue
    }

    byCode.set(cod, {
      municipio_ibge: cod,
      nome,
      uf,
      capital: COD_CAPITAL_UF.has(cod),
      lon,
      lat,
    })
  }

  return { rows: [...byCode.values()], divergentes }
}

async function fetchExistingCodes(client: PoolClient): Promise<Set<string>> {
  const r = await client.query<{ municipio_ibge: string }>(
    'SELECT municipio_ibge FROM geo_sedes_municipais',
  )
  return new Set(r.rows.map((x) => x.municipio_ibge))
}

async function insertBatch(
  client: PoolClient,
  batch: SedeRow[],
): Promise<{ inserted: number; conflicts: number }> {
  let inserted = 0
  let conflicts = 0
  for (const s of batch) {
    const res = await client.query(
      `INSERT INTO geo_sedes_municipais (municipio_ibge, nome, uf, capital, geom, fonte)
       VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5::float8, $6::float8), 4674), $7)
       ON CONFLICT (municipio_ibge) DO NOTHING`,
      [
        s.municipio_ibge,
        s.nome,
        s.uf,
        s.capital,
        s.lon,
        s.lat,
        FONTE_LOTE,
      ],
    )
    if (res.rowCount === 1) inserted++
    else conflicts++
  }
  return { inserted, conflicts }
}

async function runValidation(client: PoolClient): Promise<void> {
  console.log('\n--- Validation ---\n')
  const c = await client.query(`SELECT COUNT(*)::text AS c FROM geo_sedes_municipais`)
  console.log('COUNT(*):', c.rows[0]?.c)
  const uaua = await client.query(
    `SELECT municipio_ibge, nome, uf, fonte FROM geo_sedes_municipais WHERE municipio_ibge = '2932002'`,
  )
  console.log('Uaua 2932002:', uaua.rows)
  const sp = await client.query(
    `SELECT municipio_ibge, nome, uf, capital FROM geo_sedes_municipais WHERE municipio_ibge = '3550308'`,
  )
  console.log('SP 3550308:', sp.rows)
  const porUf = await client.query<{ uf: string; n: string }>(
    `SELECT uf, COUNT(*)::text AS n FROM geo_sedes_municipais GROUP BY uf ORDER BY uf`,
  )
  for (const r of porUf.rows) console.log(`  ${r.uf}: ${r.n}`)
}

async function main(): Promise<void> {
  const shpBase = getArg('--shp')
  const dryRun = process.argv.includes('--dry-run')
  const limitRaw = getArg('--limit')
  const limit = limitRaw ? Number(limitRaw) : undefined

  if (!shpBase) {
    console.error('Usage: --shp PATH_WITHOUT_SHP_EXTENSION')
    process.exit(1)
  }

  const resolved = path.isAbsolute(shpBase) ? shpBase : path.join(ROOT, shpBase)
  console.log('Shapefile:', resolved)

  const { rows: allRows, divergentes } = await loadSedesFromShapefile(resolved)
  let rows = allRows
  if (limit != null && Number.isFinite(limit) && limit > 0) {
    rows = rows.slice(0, limit)
    console.log(`limit ${limit} -> ${rows.length} rows`)
  }

  console.log(`Unique municipalities: ${allRows.length}`)
  if (divergentes.length) {
    console.log(`Warnings (max 20), total ${divergentes.length}:`)
    console.log(divergentes.slice(0, 20).join('\n'))
  }

  if (dryRun) {
    console.log('dry-run: no INSERT')
    process.exit(0)
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  const client = await pool.connect()
  try {
    const existentes = await fetchExistingCodes(client)
    console.log(`Already in DB: ${existentes.size}`)
    const novas = rows.filter((r) => !existentes.has(r.municipio_ibge))
    console.log(`New rows to insert: ${novas.length}`)

    const BATCH = 500
    let ins = 0
    for (let i = 0; i < novas.length; i += BATCH) {
      const batch = novas.slice(i, i + BATCH)
      await client.query('BEGIN')
      try {
        const { inserted } = await insertBatch(client, batch)
        ins += inserted
        await client.query('COMMIT')
      } catch (e) {
        await client.query('ROLLBACK')
        console.error('Batch error; rollback.', e)
        throw e
      }
      console.log(
        `  progress ${Math.min(i + batch.length, novas.length)}/${novas.length} (inserted total ${ins})`,
      )
    }

    console.log(`Total new inserts: ${ins}`)
    await runValidation(client)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
