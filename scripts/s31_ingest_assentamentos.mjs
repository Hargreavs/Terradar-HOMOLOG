/**
 * TERRADAR S31: ingestao sequencial de batches SQL (assentamentos INCRA)
 * em geo_areas_protegidas. Nao paralelizar.
 */
import { config as loadEnv } from 'dotenv'
import { Client } from 'pg'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
loadEnv({ path: path.join(REPO_ROOT, '.env') })
loadEnv({ path: path.join(REPO_ROOT, '.env.local'), override: true })

const DEFAULT_BATCHES_DIR = path.join(
  'C:',
  'Users',
  'alex-',
  'Terrae',
  'tmp',
  's31_assentamentos',
)

const BATCHES_DIR = process.env.S31_ASSENTAMENTOS_DIR || DEFAULT_BATCHES_DIR

const dbUrl =
  process.env.DATABASE_URL ||
  process.env.VITE_DATABASE_URL ||
  process.env.DATABASE_URL_POOLER

if (!dbUrl) {
  console.error(
    'ERRO: nenhuma connection string Postgres no .env. Defina uma de: DATABASE_URL, VITE_DATABASE_URL, DATABASE_URL_POOLER',
  )
  process.exit(1)
}

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
})

console.log('Conectando ao Supabase...')
await client.connect()

const before = await client.query(
  "SELECT COUNT(*)::int AS n FROM geo_areas_protegidas WHERE tipo = 'ASSENTAMENTO_INCRA'",
)
console.log(`Estado inicial: ${before.rows[0].n} assentamentos no banco`)

if (before.rows[0].n > 0) {
  console.error('ERRO: Ja existem assentamentos no banco. Abortar para evitar duplicacao.')
  console.error('   Se quiser limpar e reingerir, rodar antes:')
  console.error(
    "   DELETE FROM geo_areas_protegidas WHERE tipo = 'ASSENTAMENTO_INCRA';",
  )
  await client.end()
  process.exit(1)
}

async function findBatchesDir() {
  const direct = path.resolve(BATCHES_DIR)
  try {
    const files = await fs.readdir(direct)
    const n = files.filter((f) => /^b\d{3}\.sql$/.test(f)).length
    if (n >= 1) return direct
  } catch {
    // segue
  }
  const base = direct
  let entries
  try {
    entries = await fs.readdir(base, { withFileTypes: true })
  } catch (e) {
    console.error(`ERRO: Nao foi possivel ler ${base}:`, e.message)
    process.exit(1)
  }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue
    const sub = path.join(base, ent.name)
    const subFiles = await fs.readdir(sub)
    const n = subFiles.filter((f) => /^b\d{3}\.sql$/.test(f)).length
    if (n >= 1) {
      console.log(
        `Usando subpasta com batches: ${path.relative(REPO_ROOT, sub) || sub}`,
      )
      return sub
    }
  }
  return direct
}

const resolvedDir = await findBatchesDir()
const allFiles = (await fs.readdir(resolvedDir)).filter((f) =>
  /^b\d{3}\.sql$/.test(f),
)
const files = allFiles.sort()

console.log('')
console.log(`Encontrados ${files.length} batches em ${resolvedDir}`)
if (files.length !== 66) {
  console.error(`ERRO: Esperado 66 batches, encontrado ${files.length}. Abortar.`)
  await client.end()
  process.exit(1)
}

const t0 = Date.now()

for (let i = 0; i < files.length; i++) {
  const fname = files[i]
  const sqlPath = path.join(resolvedDir, fname)
  const sql = await fs.readFile(sqlPath, 'utf8')
  try {
    await client.query(sql)
    process.stdout.write(
      `[${String(i + 1).padStart(2, '0')}/66] ${fname} OK\n`,
    )
  } catch (err) {
    console.error(`\nERRO no batch ${fname}:`)
    console.error(err.message)
    console.error(err)
    console.error('\nParando execucao. Nao tentar pular.')
    await client.end()
    process.exit(1)
  }
}

const after = await client.query(`
  SELECT
    COUNT(*)::int AS total,
    COUNT(DISTINCT uf)::int AS ufs_distintas
  FROM geo_areas_protegidas
  WHERE tipo = 'ASSENTAMENTO_INCRA'
`)

const porUF = await client.query(`
  SELECT uf, COUNT(*)::int AS n
  FROM geo_areas_protegidas
  WHERE tipo = 'ASSENTAMENTO_INCRA'
  GROUP BY uf
  ORDER BY n DESC
  LIMIT 10
`)

const tempo = ((Date.now() - t0) / 1000).toFixed(1)

console.log('\n=== Ingestão concluída ===')
console.log(`Total inserido: ${after.rows[0].total} (esperado: 8213)`)
console.log(`UFs distintas: ${after.rows[0].ufs_distintas}`)
console.log(`Tempo: ${tempo}s`)
console.log('\nTop 10 UFs:')
porUF.rows.forEach((r) => console.log(`  ${r.uf}: ${r.n}`))

if (after.rows[0].total !== 8213) {
  console.error(
    `\nAVISO: Total ${after.rows[0].total} difere do esperado 8213.`,
  )
}

await client.end()
