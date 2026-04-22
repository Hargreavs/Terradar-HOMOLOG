/**
 * Fase B.1 - Investigacao pre-ingest SIGMINE (geom complementar).
 * Uso: npx tsx scripts/one-off/investigar-sigmine-geom.ts
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import dotenv from 'dotenv'
import { Pool } from 'pg'
import { open } from 'shapefile'

import { formatNumeroAnm } from '../../server/scripts/utils/format-numero-anm'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
dotenv.config({ path: path.join(ROOT, '.env.local') })
dotenv.config({ path: path.join(ROOT, '.env') })

const SHP = path.join(ROOT, 'data', 'sigmine', 'BRASIL.shp')

function rawProcesso(props: Record<string, unknown>): string | null {
  if (props.PROCESSO != null && String(props.PROCESSO).trim() !== '')
    return String(props.PROCESSO)
  if (props.DSProcesso != null && String(props.DSProcesso).trim() !== '')
    return String(props.DSProcesso)
  return null
}

async function main() {
  const t0 = Date.now()

  console.log('=== Investigacao SIGMINE geom (pre B.1) ===\n')

  if (!fs.existsSync(SHP)) {
    console.error(`ERRO: shapefile nao encontrado em ${SHP}`)
    process.exit(1)
  }
  console.log(`1) Shapefile: OK — ${SHP}\n`)

  const source = await open(SHP, undefined, { encoding: 'utf-8' })

  let featuresLidas = 0
  let comProcessoValido = 0
  const faseCount = new Map<string, number>()
  const geomTypeCount = { Polygon: 0, MultiPolygon: 0, other: 0 }
  const amostras: { raw: string; norm: string }[] = []
  const numeroParaCount = new Map<string, number>()
  const todosNorm = new Set<string>()

  for (;;) {
    const r = await source.read()
    if (r.done) break
    featuresLidas++
    const f = r.value
    if (f.type !== 'Feature' || !f.properties) continue
    const props = f.properties as Record<string, unknown>
    const raw = rawProcesso(props)
    const fase = String(props.FASE ?? props.fase ?? '').trim() || '(vazio)'
    faseCount.set(fase, (faseCount.get(fase) ?? 0) + 1)

    const gt = f.geometry?.type ?? ''
    if (gt === 'Polygon') geomTypeCount.Polygon++
    else if (gt === 'MultiPolygon') geomTypeCount.MultiPolygon++
    else geomTypeCount.other++

    if (!raw) continue
    const norm = formatNumeroAnm(raw)
    if (norm == null) continue
    comProcessoValido++
    todosNorm.add(norm)
    numeroParaCount.set(norm, (numeroParaCount.get(norm) ?? 0) + 1)
    if (amostras.length < 20) amostras.push({ raw: raw.trim(), norm })
  }

  console.log(`2) Total de features (feicoes lidas): ${featuresLidas}`)
  console.log(
    `3) Features com PROCESSO normalizados (formatNumeroAnm != null): ${comProcessoValido}`,
  )
  console.log('')

  console.log('4) Distribuicao FASE (top 30 por count desc):')
  const fasesOrd = [...faseCount.entries()].sort((a, b) => b[1] - a[1])
  for (const [k, v] of fasesOrd.slice(0, 30)) {
    console.log(`   ${v}\t${k}`)
  }
  if (fasesOrd.length > 30)
    console.log(`   ... (+${fasesOrd.length - 30} valores distintos)`)
  console.log('')

  console.log('5) Geometry type (GeoJSON):')
  console.log(`   Polygon: ${geomTypeCount.Polygon}`)
  console.log(`   MultiPolygon: ${geomTypeCount.MultiPolygon}`)
  console.log(`   outro: ${geomTypeCount.other}`)
  console.log('')

  console.log('6) Amostra 20 (PROCESSO cru -> formatNumeroAnm):')
  for (const a of amostras) console.log(`   "${a.raw}" -> "${a.norm}"`)
  console.log('')

  const numerosUnicos = todosNorm.size
  let comDup = 0
  for (const [, c] of numeroParaCount) {
    if (c > 1) comDup++
  }
  console.log(`7) PROCESSO unicos (apos normalizacao): ${numerosUnicos}`)
  console.log(
    `   Numeros com >1 feature (duplicatas intra-shapefile): ${comDup}`,
  )
  const topDup = [...numeroParaCount.entries()]
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
  console.log('8) Top 10 PROCESSO mais duplicados:')
  for (const [num, c] of topDup) console.log(`   ${c}\t${num}`)
  if (topDup.length === 0) console.log('   (nenhuma duplicata)')
  console.log('')

  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) {
    console.log('9) Dry-run DB: DATABASE_URL ausente.\n')
  } else {
    const pool = new Pool({
      connectionString: DATABASE_URL,
      max: 2,
      ssl: DATABASE_URL.includes('supabase.co')
        ? { rejectUnauthorized: false }
        : undefined,
    })
    const client = await pool.connect()
    try {
      await client.query(`SET statement_timeout = '2min'`)
      const arr = [...todosNorm]
      let matchSemGeom = 0
      let matchComGeom = 0
      let orphan = 0

      const CHUNK = 5000
      for (let i = 0; i < arr.length; i += CHUNK) {
        const slice = arr.slice(i, i + CHUNK)
        const { rows } = await client.query(
          `
          SELECT p.numero AS p_num,
                 (p.geom IS NOT NULL) AS tem_geom
          FROM unnest($1::text[]) AS u(numero)
          LEFT JOIN processos p ON p.numero = u.numero
          `,
          [slice],
        )
        for (const row of rows) {
          if (row.p_num == null) {
            orphan++
            continue
          }
          if (row.tem_geom === true) matchComGeom++
          else matchSemGeom++
        }
      }

      console.log('9) Match contra banco:')
      console.log(`   SEM geom (alvo UPDATE): ${matchSemGeom}`)
      console.log(`   JA com geom (skip): ${matchComGeom}`)
      console.log(`   Orfaos: ${orphan}`)
    } finally {
      client.release()
      await pool.end()
    }
  }

  const sec = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`\nTempo investigacao: ${sec}s`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
