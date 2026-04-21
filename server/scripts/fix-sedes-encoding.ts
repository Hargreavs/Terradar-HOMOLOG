// fix-sedes-encoding.ts - Corrige nomes mojibake em geo_sedes_municipais a partir do DBF UTF-8.
// O ingest antigo usava windows-1252 no pacote shapefile; reimporta NM_MUN com UTF-8.
// Uso: npx tsx server/scripts/fix-sedes-encoding.ts --shp data/ibge/BR_Municipios_2025
//      npx tsx server/scripts/fix-sedes-encoding.ts --shp data/ibge/BR_Municipios_2025 --dry-run

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import dotenv from 'dotenv'
import { Pool } from 'pg'
import { open } from 'shapefile'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
dotenv.config({ path: path.join(ROOT, '.env.local') })
dotenv.config({ path: path.join(ROOT, '.env') })

const DATABASE_URL = process.env.DATABASE_URL

/** Caractere U+00C3 (Ã) tipico em "SÃ£o Paulo" quando UTF-8 foi lido como cp1252/latin1 */
const MOJIBAKE_MARK = '\u00c3'

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
  for (const k of ['CD_MUN', 'CD_MUNICIPIO', 'GEOCODIGO', 'COD_MUN']) {
    const v = props[k] ?? props[k.toLowerCase()]
    const p = padIbge7(v)
    if (p) return p
  }
  return null
}

function extractNome(props: Record<string, unknown>): string {
  for (const k of ['NM_MUN', 'NM_MUNICIPIO', 'NOME']) {
    const v = props[k] ?? props[k.toLowerCase()]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

async function loadNomePorIbge(shpBase: string): Promise<Map<string, string>> {
  const shpPath = `${shpBase}.shp`
  if (!fs.existsSync(shpPath)) {
    console.error(`File not found: ${shpPath}`)
    process.exit(1)
  }

  const source = await open(shpPath, undefined, { encoding: 'utf-8' })
  const map = new Map<string, string>()

  for (;;) {
    const result = await source.read()
    if (result.done) break
    const feat = result.value
    if (feat.type !== 'Feature' || !feat.properties) continue
    const props = feat.properties as Record<string, unknown>
    const cod = extractCodIbge(props)
    if (!cod) continue
    const nome = extractNome(props)
    if (!nome) continue
    if (!map.has(cod)) map.set(cod, nome)
  }

  return map
}

async function main(): Promise<void> {
  const shpArg = getArg('--shp') ?? 'data/ibge/BR_Municipios_2025'
  const dryRun = process.argv.includes('--dry-run')

  const resolved = path.isAbsolute(shpArg) ? shpArg : path.join(ROOT, shpArg)
  console.log('Shapefile base:', resolved)
  console.log('encoding: utf-8 (TextDecoder)')
  console.log('dry-run:', dryRun)

  const nomePorIbge = await loadNomePorIbge(resolved)
  console.log(`Municipalities in shapefile: ${nomePorIbge.size}`)

  if (!DATABASE_URL) {
    console.error('DATABASE_URL must be set in .env.local')
    process.exit(1)
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  const client = await pool.connect()

  try {
    const pattern = `%${MOJIBAKE_MARK}%`
    const before = await client.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM geo_sedes_municipais WHERE nome LIKE $1`,
      [pattern],
    )
    const beforeN = Number(before.rows[0]?.c ?? 0)
    console.log(`\nDB rows with mojibake mark (nome LIKE ${JSON.stringify(pattern)}): ${beforeN}`)

    const candidatos = await client.query<{ municipio_ibge: string; nome: string }>(
      `SELECT municipio_ibge, nome FROM geo_sedes_municipais WHERE nome LIKE $1 ORDER BY municipio_ibge`,
      [pattern],
    )

    const preview: Array<{
      municipio_ibge: string
      nome_atual: string
      nome_correto: string
    }> = []
    let missingInShp = 0
    for (const row of candidatos.rows) {
      const fixed = nomePorIbge.get(row.municipio_ibge)
      if (fixed == null) {
        missingInShp++
        continue
      }
      preview.push({
        municipio_ibge: row.municipio_ibge,
        nome_atual: row.nome,
        nome_correto: fixed,
      })
    }

    console.log('\n--- First 20 planned updates ---\n')
    for (const p of preview.slice(0, 20)) {
      console.log(
        `${p.municipio_ibge} | ${JSON.stringify(p.nome_atual)} -> ${JSON.stringify(p.nome_correto)}`,
      )
    }
    if (preview.length > 20) console.log(`... and ${preview.length - 20} more`)

    if (missingInShp > 0) {
      console.log(`\nWarning: ${missingInShp} corrupted rows have no IBGE match in shapefile map`)
    }

    if (dryRun) {
      console.log('\n[dry-run] No UPDATE executed.')
      console.log(`Would update up to ${preview.length} rows (where shapefile has nome).`)
      return
    }

    let updated = 0
    for (const p of preview) {
      const res = await client.query(
        `UPDATE geo_sedes_municipais
         SET nome = $1,
             fonte = COALESCE(fonte, '') || '_fix_encoding'
         WHERE municipio_ibge = $2
           AND nome LIKE $3`,
        [p.nome_correto, p.municipio_ibge, pattern],
      )
      updated += res.rowCount ?? 0
    }

    const after = await client.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM geo_sedes_municipais WHERE nome LIKE $1`,
      [pattern],
    )
    const afterN = Number(after.rows[0]?.c ?? 0)

    const stillMojibake = await client.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM geo_sedes_municipais
       WHERE nome LIKE $1 OR nome LIKE $2 OR nome LIKE $3`,
      ['%\u00c2%', '%\u00a3%', '%\u00a7%'],
    )

    const totalRes = await client.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM geo_sedes_municipais`,
    )
    const totalSedes = Number(totalRes.rows[0]?.c ?? 0)
    const neverCorrupted = totalSedes - beforeN

    console.log('\n--- Result ---\n')
    console.log(`UPDATE rows affected: ${updated}`)
    console.log(
      `Preserved (never had mojibake mark, nome left unchanged): ${neverCorrupted}`,
    )
    console.log(`DB rows with mojibake mark (${JSON.stringify(MOJIBAKE_MARK)}) before: ${beforeN}`)
    console.log(`DB rows with mojibake mark after:  ${afterN}`)
    console.log(
      `Rows matching extra patterns (Â / £ / §): ${stillMojibake.rows[0]?.c ?? '?'}`,
    )
    if (missingInShp > 0) {
      console.log(
        `Corrupted rows with no shapefile match (not updated): ${missingInShp}`,
      )
    }
    console.log('\nValidation samples (run in SQL client):')
    console.log(
      "  SELECT nome FROM geo_sedes_municipais WHERE municipio_ibge='3550308';  -- Sao Paulo",
    )
    console.log(
      "  SELECT nome FROM geo_sedes_municipais WHERE municipio_ibge='2704302';  -- Maceio",
    )
    console.log(
      "  SELECT nome FROM geo_sedes_municipais WHERE municipio_ibge='2932002';  -- Uaua",
    )
    console.log(
      "  SELECT nome FROM geo_sedes_municipais WHERE municipio_ibge='1711506';  -- Jau do Tocantins",
    )
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
