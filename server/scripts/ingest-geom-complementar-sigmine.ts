// Fase B.1: preenche processos.geom a partir do SIGMINE (BRASIL.shp) para linhas com geom IS NULL.
// Nao altera regime. Default: --dry-run (ROLLBACK). Use --apply para persistir.
// Uso: npm run ingest:geom-complementar -- [--dry-run] | --apply [--limit N]
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import dotenv from 'dotenv'
import { Pool, type PoolClient } from 'pg'
import { open } from 'shapefile'

import { formatNumeroAnm } from './utils/format-numero-anm'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
dotenv.config({ path: path.join(ROOT, '.env.local') })
dotenv.config({ path: path.join(ROOT, '.env') })

const DATABASE_URL = process.env.DATABASE_URL

function parseArgs(): { apply: boolean; limit: number | null } {
  let apply = false
  let limit: number | null = null
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i]
    if (a === '--apply') apply = true
    else if (a === '--dry-run') apply = false
    else if (a === '--limit' && process.argv[i + 1])
      limit = Math.max(0, parseInt(process.argv[++i], 10) || 0)
    else if (a.startsWith('--limit='))
      limit = Math.max(0, parseInt(a.slice('--limit='.length), 10) || 0)
  }
  return { apply, limit }
}

function rawProcesso(props: Record<string, unknown>): string | null {
  if (props.PROCESSO != null && String(props.PROCESSO).trim() !== '')
    return String(props.PROCESSO)
  if (props.DSProcesso != null && String(props.DSProcesso).trim() !== '')
    return String(props.DSProcesso)
  return null
}

type GeoJsonGeom = {
  type: string
  coordinates: unknown
}

async function countShapefileCategories(
  client: PoolClient,
  numerosUnicos: string[],
): Promise<{ orphans: number; skippedGeom: number; alvoNull: number }> {
  let orphans = 0
  let skippedGeom = 0
  let alvoNull = 0
  const CHUNK = 8000
  for (let i = 0; i < numerosUnicos.length; i += CHUNK) {
    const slice = numerosUnicos.slice(i, i + CHUNK)
    const { rows } = await client.query<{
      orphans: string
      skipped: string
      alvo: string
    }>(
      `
      SELECT
        COUNT(*) FILTER (WHERE p.numero IS NULL)::text AS orphans,
        COUNT(*) FILTER (WHERE p.geom IS NOT NULL)::text AS skipped,
        COUNT(*) FILTER (WHERE p.numero IS NOT NULL AND p.geom IS NULL)::text AS alvo
      FROM unnest($1::text[]) AS u(numero)
      LEFT JOIN processos p ON p.numero = u.numero
      `,
      [slice],
    )
    const r = rows[0]
    orphans += parseInt(r?.orphans ?? '0', 10)
    skippedGeom += parseInt(r?.skipped ?? '0', 10)
    alvoNull += parseInt(r?.alvo ?? '0', 10)
  }
  return { orphans, skippedGeom, alvoNull }
}

async function regimeDistribuicaoAlvo(
  client: PoolClient,
  numeros: string[],
): Promise<Map<string, number>> {
  const m = new Map<string, number>()
  const CHUNK = 8000
  for (let i = 0; i < numeros.length; i += CHUNK) {
    const slice = numeros.slice(i, i + CHUNK)
    const { rows } = await client.query<{ regime: string; c: string }>(
      `
      SELECT p.regime, COUNT(*)::text AS c
      FROM unnest($1::text[]) AS u(numero)
      INNER JOIN processos p ON p.numero = u.numero
      WHERE p.geom IS NULL
      GROUP BY p.regime
      `,
      [slice],
    )
    for (const r of rows) {
      const k = r.regime ?? '(null)'
      m.set(k, (m.get(k) ?? 0) + parseInt(r.c, 10))
    }
  }
  return m
}

const BATCH_NUMEROS = 500

async function flushBatch(
  client: PoolClient,
  flatNum: string[],
  flatGj: string[],
  logStream: fs.WriteStream,
): Promise<{ updated: number; geomErr: number }> {
  if (flatNum.length === 0) return { updated: 0, geomErr: 0 }
  try {
    const res = await client.query<{ numero: string }>(
      `
      WITH input AS (
        SELECT *
        FROM unnest($1::text[], $2::text[]) AS t(numero, geom_json)
      ),
      parsed AS (
        SELECT
          numero,
          ST_Transform(
            ST_MakeValid(
              ST_SetSRID(ST_GeomFromGeoJSON(geom_json::json), 4674)
            ),
            4326
          ) AS g
        FROM input
        WHERE geom_json IS NOT NULL AND geom_json <> ''
      ),
      unioned AS (
        SELECT numero, ST_Union(g) AS g_merged
        FROM parsed
        GROUP BY numero
      ),
      final_geom AS (
        SELECT
          numero,
          CASE
            WHEN g_merged IS NULL THEN NULL
            WHEN ST_GeometryType(g_merged) = 'ST_MultiPolygon' THEN (
              SELECT d.geom
              FROM ST_Dump(g_merged) AS d
              ORDER BY ST_Area(d.geom::geography) DESC
              LIMIT 1
            )
            WHEN ST_GeometryType(g_merged) = 'ST_Polygon' THEN g_merged
            ELSE (
              SELECT d.geom
              FROM ST_Dump(ST_MakeValid(g_merged)) AS d
              ORDER BY ST_Area(d.geom::geography) DESC
              LIMIT 1
            )
          END AS g_final
        FROM unioned
      )
      UPDATE processos p
      SET geom = fg.g_final,
          updated_at = now()
      FROM final_geom fg
      WHERE p.numero = fg.numero
        AND p.geom IS NULL
        AND fg.g_final IS NOT NULL
      RETURNING p.numero
      `,
      [flatNum, flatGj],
    )
    const n = res.rowCount ?? 0
    for (const row of res.rows) {
      logStream.write(`${row.numero}\n`)
    }
    return { updated: n, geomErr: 0 }
  } catch (e) {
    console.error('[geom-sigmine] batch error:', (e as Error).message)
    return { updated: 0, geomErr: 1 }
  }
}

async function main() {
  const t0 = Date.now()
  const { apply, limit } = parseArgs()
  const dryRun = !apply

  const shp = path.join(ROOT, 'data', 'sigmine', 'BRASIL.shp')
  if (!fs.existsSync(shp)) {
    console.error(`Shapefile nao encontrado: ${shp}`)
    process.exit(1)
  }

  if (!DATABASE_URL) {
    console.error('DATABASE_URL ausente')
    process.exit(1)
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 2,
    ssl: DATABASE_URL.includes('supabase.co')
      ? { rejectUnauthorized: false }
      : undefined,
  })

  let featuresLidas = 0
  let featuresSemProcessoValido = 0
  const porNumero = new Map<string, GeoJsonGeom[]>()

  const source = await open(shp, undefined, { encoding: 'utf-8' })
  for (;;) {
    const r = await source.read()
    if (r.done) break
    featuresLidas++
    if (limit != null && featuresLidas > limit) break

    const f = r.value
    if (f.type !== 'Feature' || !f.properties || !f.geometry) continue
    const props = f.properties as Record<string, unknown>
    const raw = rawProcesso(props)
    if (!raw) {
      featuresSemProcessoValido++
      continue
    }
    const numero = formatNumeroAnm(raw)
    if (!numero) {
      featuresSemProcessoValido++
      continue
    }
    const g = f.geometry as GeoJsonGeom
    const arr = porNumero.get(numero) ?? []
    arr.push(g)
    porNumero.set(numero, arr)
  }

  const numerosUnicos = porNumero.size
  let numerosComDup = 0
  for (const [, gs] of porNumero) {
    if (gs.length > 1) numerosComDup++
  }

  const chaves = [...porNumero.keys()]
  const updatesTentados = chaves.length

  const tmpDir = path.join(ROOT, 'tmp')
  fs.mkdirSync(tmpDir, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const logNumerosPath = path.join(
    tmpDir,
    dryRun
      ? `ingest-geom-complementar-${ts}-numeros-dry-run.txt`
      : `ingest-geom-complementar-${ts}-numeros.txt`,
  )
  const logStream = fs.createWriteStream(logNumerosPath, { flags: 'a' })

  const client = await pool.connect()

  let updatesEfetivos = 0
  let errosGeomInvalida = 0
  let cat = { orphans: 0, skippedGeom: 0, alvoNull: 0 }

  try {
    await client.query(`SET statement_timeout = '5min'`)

    cat = await countShapefileCategories(client, chaves)
    const regimeMap = await regimeDistribuicaoAlvo(client, chaves)

    console.log('')
    console.log('--- Distribuicao por regime (processos com geom IS NULL, numero no shapefile) ---')
    const regimeOrd = [...regimeMap.entries()].sort((a, b) => b[1] - a[1])
    for (const [reg, c] of regimeOrd) console.log(`  ${reg}: ${c}`)
    console.log('')

    if (dryRun) await client.query(`BEGIN`)

    for (let i = 0; i < chaves.length; i += BATCH_NUMEROS) {
      const slice = chaves.slice(i, i + BATCH_NUMEROS)
      const flatNum: string[] = []
      const flatGj: string[] = []
      for (const num of slice) {
        const geoms = porNumero.get(num)!
        for (const g of geoms) {
          flatNum.push(num)
          flatGj.push(JSON.stringify(g))
        }
      }
      const { updated, geomErr } = await flushBatch(client, flatNum, flatGj, logStream)
      updatesEfetivos += updated
      errosGeomInvalida += geomErr
      if ((i / BATCH_NUMEROS + 1) % 20 === 0) {
        console.error(
          `[geom-sigmine] batches ~${i + slice.length}/${chaves.length} numeros unicos…`,
        )
      }
    }

    if (dryRun) await client.query(`ROLLBACK`)
  } finally {
    logStream.end()
    client.release()
    await pool.end()
  }

  const tempoTotalS = ((Date.now() - t0) / 1000).toFixed(1)

  console.log('')
  console.log('=== ingest-geom-complementar-sigmine (resumo) ===')
  console.log(`modo: ${dryRun ? 'DRY-RUN (ROLLBACK)' : 'APPLY'}`)
  console.log(`log numeros: ${logNumerosPath}`)
  console.log(`tempo_total_s: ${tempoTotalS}`)
  console.log(`features_lidas: ${featuresLidas}`)
  console.log(`features_sem_processo_valido: ${featuresSemProcessoValido}`)
  console.log(`numeros_unicos_no_shapefile: ${numerosUnicos}`)
  console.log(`numeros_com_duplicatas_intra_shapefile: ${numerosComDup}`)
  console.log(`updates_tentados (unicos processados): ${updatesTentados}`)
  console.log(`updates_efetivos (RETURNING): ${updatesEfetivos}`)
  console.log(`skipped_ja_tem_geom (no BD, ja tinham poligono): ${cat.skippedGeom}`)
  console.log(`orphans (numero no shapefile sem linha em processos): ${cat.orphans}`)
  console.log(
    `alvo_null_geom (pre-batch, referencia investigacao): ${cat.alvoNull}`,
  )
  console.log(`erros_geom_invalida (batch falhou): ${errosGeomInvalida}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
