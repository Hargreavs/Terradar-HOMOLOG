/**
 * Mini smoke: conexao + contagens + SPs. Remover apos backfill.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import postgres from 'postgres'

const _dir = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(_dir, '../..')
dotenv.config({ path: path.join(ROOT, '.env.local') })
dotenv.config({ path: path.join(ROOT, '.env') })

const connectionUrl = process.env.DATABASE_URL_POOLER || process.env.DATABASE_URL
if (!connectionUrl) {
  console.error('Defina DATABASE_URL ou DATABASE_URL_POOLER em .env.local')
  process.exit(1)
}

const hostPort = connectionUrl.match(/@([^/]+)/)?.[1] || 'desconhecido'
console.log(`Conectando em: ${hostPort}`)

const sql = postgres(connectionUrl, {
  max: 1,
  idle_timeout: 0,
  connect_timeout: 30,
  ssl:
    connectionUrl.includes('supabase') || connectionUrl.includes('amazonaws')
      ? 'require'
      : false,
  prepare: false,
})

async function main() {
  const t0 = Date.now()

  const [{ total }] = await sql<[{ total: number }]>`
    SELECT COUNT(*)::int AS total FROM processos WHERE geom IS NOT NULL
  `
  console.log(`Query 1 OK — processos com geom: ${total}`)

  const [{ com_geog, sem_geog }] = await sql<
    [{ com_geog: number; sem_geog: number }]
  >`
    SELECT 
      COUNT(*) FILTER (WHERE geog IS NOT NULL)::int AS com_geog,
      COUNT(*) FILTER (WHERE geom IS NOT NULL AND geog IS NULL)::int AS sem_geog
    FROM processos
  `
  console.log(
    `Query 2 OK — geog populada: ${com_geog}, pendente: ${sem_geog}`,
  )

  const procs = await sql`
    SELECT proname FROM pg_proc 
    WHERE proname IN ('sp_bulk_amb_flags_por_uf', 'sp_update_scores_ambiental_por_uf',
                      'sp_s30_rollback_ambiental_bulk')
    ORDER BY proname
  `
  console.log(
    `Query 3 OK — SPs existentes:`,
    procs.map((p) => p.proname),
  )

  console.log(
    `\nSmoke test OK em ${Date.now() - t0}ms. Pronto pra backfill.`,
  )
  await sql.end()
}

main().catch((e) => {
  console.error('FALHOU:', e.message)
  process.exit(1)
})
