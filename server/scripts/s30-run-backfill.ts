/**
 * S30-3 orquestracao: sp_bulk_amb_flags_por_uf + sp_update_scores_ambiental_por_uf
 * Requer: migrations aplicadas, processos.geog preenchido, backups S31 ainda nao removidos.
 *
 *   npx tsx server/scripts/s30-run-backfill.ts
 *   PowerShell: npx tsx server/scripts/s30-run-backfill.ts 2>&1 | Tee-Object -FilePath logs/s30-run.log
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
  connect_timeout: 120,
  ssl:
    DATABASE_URL.includes('supabase') || DATABASE_URL.includes('amazonaws')
      ? 'require'
      : false,
  prepare: false,
  onnotice: (n) => console.log('[psql notice]', n.message),
})

async function phase(label: string, fn: () => Promise<void>) {
  const t0 = Date.now()
  console.log(`\n>> ${label}...`)
  await fn()
  console.log(`ok ${label} em ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}

async function main() {
  await phase('Flags por UF (ouro ativo)', async () => {
    await sql`call sp_bulk_amb_flags_por_uf(${'OURO'}::text, ${true}::boolean)`
  })

  await phase('Scores por UF (ouro ativo)', async () => {
    await sql`call sp_update_scores_ambiental_por_uf(${'OURO'}::text, ${true}::boolean)`
  })

  const top = await sql<
    {
      numero: string
      uf: string | null
      regime: string | null
      amb: number
      risk_score: number
      risk_label: string | null
    }[]
  >`
    SELECT
      p.numero,
      p.uf,
      p.regime,
      (s.dimensoes_risco->'ambiental'->>'valor')::int AS amb,
      s.risk_score,
      s.risk_label
    FROM processos p
    INNER JOIN scores s ON s.processo_id = p.id
    WHERE p.substancia ILIKE '%OURO%'
      AND p.ativo_derivado = true
      AND p.amb_fatores_calculado_em IS NOT NULL
    ORDER BY amb DESC
    LIMIT 10
  `
  console.log('Top 10 piores Ambientais (ouro ativo):')
  console.table(top)

  console.log(
    '\nPausa 10s antes de extender. Ctrl+C para parar. Continuando...',
  )
  await new Promise((r) => setTimeout(r, 10_000))

  await phase('Flags por UF (outras substancias ativas)', async () => {
    await sql`call sp_bulk_amb_flags_por_uf(${null}::text, ${true}::boolean)`
  })

  await phase('Scores por UF (outras substancias ativas)', async () => {
    await sql`call sp_update_scores_ambiental_por_uf(${null}::text, ${true}::boolean)`
  })

  await phase('Flags por UF (inativos, toda base)', async () => {
    await sql`call sp_bulk_amb_flags_por_uf(${null}::text, ${false}::boolean)`
  })

  await phase('Scores por UF (inativos, toda base)', async () => {
    await sql`call sp_update_scores_ambiental_por_uf(${null}::text, ${false}::boolean)`
  })

  console.log('\nBackfill fases do script: completo. Validar com SQLs do handoff (Tarefa D).')
  await sql.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
