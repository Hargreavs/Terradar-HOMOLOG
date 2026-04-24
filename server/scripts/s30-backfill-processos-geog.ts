/**
 * Preenche processos.geog a partir de processos.geom (SRID 4326) e cria GIST.
 * S30-3 - rodar apos migracao 20260424120000_s30_processos_add_geog.sql
 *
 *   DATABASE_URL em .env.local   npx tsx server/scripts/s30-backfill-processos-geog.ts
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import postgres from 'postgres'

const _dir = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(_dir, '../..')
dotenv.config({ path: path.join(ROOT, '.env.local') })
dotenv.config({ path: path.join(ROOT, '.env') })

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL ausente (.env.local ou .env)')
  process.exit(1)
}

const sql = postgres(DATABASE_URL, {
  max: 1,
  idle_timeout: 0,
  connect_timeout: 60,
  ssl:
    DATABASE_URL.includes('supabase') || DATABASE_URL.includes('amazonaws')
      ? 'require'
      : false,
  prepare: false,
})

function affectedCount(result: unknown): number {
  if (
    result &&
    typeof result === 'object' &&
    'count' in result &&
    typeof (result as { count: unknown }).count === 'number'
  ) {
    return (result as { count: number }).count
  }
  return 0
}

async function main() {
  const [{ total } = { total: 0 }] = await sql<[{ total: number }]>`
    SELECT COUNT(*)::int AS total
    FROM processos
    WHERE geom IS NOT NULL
      AND geog IS NULL
  `
  console.log(`Pendentes (geog NULL): ${total}`)

  const t0 = Date.now()
  let done = 0
  let iter = 0

  while (true) {
    iter++
    const result = await sql`
      WITH alvos AS (
        SELECT id
        FROM processos
        WHERE geom IS NOT NULL
          AND geog IS NULL
        ORDER BY id
        LIMIT 20000
      )
      UPDATE processos p
      SET geog = ST_Multi(p.geom)::geography
      FROM alvos
      WHERE p.id = alvos.id
    `
    const affected = affectedCount(result)
    done += affected
    const elapsed = ((Date.now() - t0) / 1000).toFixed(0)
    const pct = total > 0 ? ((done / total) * 100).toFixed(1) : '100.0'
    console.log(
      `[iter ${iter}] +${affected} (acum. ${done}/${total || done}, ${pct}%, ${elapsed}s)`,
    )
    if (affected === 0) break
  }

  console.log('Criando indice GIST em geog...')
  await sql`CREATE INDEX IF NOT EXISTS idx_processos_geog ON processos USING gist (geog)`
  await sql`ANALYZE processos`
  console.log('DONE')

  const check = await sql<[{ c: number; f: number }]>`
    SELECT
      COUNT(*) FILTER (WHERE geog IS NOT NULL) AS c,
      COUNT(*) FILTER (WHERE geom IS NOT NULL AND geog IS NULL) AS f
    FROM processos
  `
  console.log('Validacao: com_geog =', check[0].c, 'faltando =', check[0].f)

  await sql.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
