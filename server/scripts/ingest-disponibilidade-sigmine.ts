/**
 * Ingere feicoes SIGMINE com FASE = DISPONIBILIDADE em `processos` (geom SRID 4326; origem assumida 4674).
 *
 * Ordem Fase B: executar ANTES de ingest-requerimentos-microdados.ts
 *
 * Uso: npx tsx server/scripts/ingest-disponibilidade-sigmine.ts [--dry-run] [--limit N] [--shp path]
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import dotenv from 'dotenv'
import { Pool, type PoolClient } from 'pg'
import { open } from 'shapefile'

import { formatNumeroAnm } from './utils/format-numero-anm'
import { familiaFromSubstancia } from './utils/substancia-map'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
dotenv.config({ path: path.join(ROOT, '.env.local') })
dotenv.config({ path: path.join(ROOT, '.env') })

const DATABASE_URL = process.env.DATABASE_URL
const SUBS_FALLBACK = 'SUBSTÂNCIA NÃO ESPECIFICADA'

function parseArgs(): { dryRun: boolean; limit: number | null; shp: string } {
  let dryRun = false
  let limit: number | null = null
  let shp = path.join(ROOT, 'data', 'sigmine', 'BRASIL.shp')
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i]
    if (a === '--dry-run') dryRun = true
    else if (a === '--limit' && process.argv[i + 1])
      limit = Math.max(0, parseInt(process.argv[++i], 10) || 0)
    else if (a.startsWith('--limit='))
      limit = Math.max(0, parseInt(a.slice('--limit='.length), 10) || 0)
    else if (a === '--shp' && process.argv[i + 1]) shp = process.argv[++i]
  }
  return { dryRun, limit, shp }
}

async function loadMasterFamilias(
  client: PoolClient,
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const { rows } = await client.query(
    `SELECT substancia_anm, familia FROM master_substancias WHERE substancia_anm IS NOT NULL`,
  )
  for (const r of rows) {
    const k = String(r.substancia_anm).trim()
    if (k) map.set(k, String(r.familia ?? '').trim())
  }
  return map
}

function propsFase(props: Record<string, unknown>): string {
  const v = props.FASE ?? props.fase
  return String(v ?? '')
    .trim()
    .toUpperCase()
}

async function main() {
  const { dryRun, limit, shp } = parseArgs()
  if (!fs.existsSync(shp)) {
    console.error(`Shapefile nao encontrado: ${shp}`)
    process.exit(1)
  }

  if (!DATABASE_URL && !dryRun) {
    console.error('DATABASE_URL ausente em .env.local')
    process.exit(1)
  }

  const pool = dryRun
    ? null
    : new Pool({
        connectionString: DATABASE_URL!,
        max: 2,
        ssl: DATABASE_URL!.includes('supabase.co')
          ? { rejectUnauthorized: false }
          : undefined,
      })

  const source = await open(shp, undefined, { encoding: 'utf-8' })

  let matched = 0
  let upserts = 0
  let read = 0
  let rowInserts = 0
  let rowUpdates = 0

  const runInsert = async (client: PoolClient, master: Map<string, string>) => {
    for (;;) {
      const result = await source.read()
      if (result.done) break
      read++
      const f = result.value
      if (f.type !== 'Feature' || !f.properties || !f.geometry) continue

      const props = f.properties as Record<string, unknown>
      if (propsFase(props) !== 'DISPONIBILIDADE') continue

      const rawProc =
        props.DSProcesso != null && String(props.DSProcesso).trim() !== ''
          ? String(props.DSProcesso)
          : props.PROCESSO != null
            ? String(props.PROCESSO)
            : null
      if (!rawProc) continue

      const numero = formatNumeroAnm(rawProc)
      if (!numero) continue

      const nome = String(props.NOME ?? '').trim()
      const subsRaw = String(props.SUBS ?? '').trim()
      const substancia = subsRaw || SUBS_FALLBACK
      const uf = String(props.UF ?? '')
        .trim()
        .slice(0, 2)
      const areaHa = Number(props.AREA_HA)
      const area = Number.isFinite(areaHa) ? areaHa : null
      const anoRaw = props.ANO
      const ano =
        anoRaw != null && String(anoRaw).trim() !== ''
          ? parseInt(String(anoRaw).slice(0, 4), 10)
          : null
      const ano_protocolo =
        Number.isFinite(ano) && ano! >= 1900 && ano! <= 2100 ? ano : null
      const ultEv = String(props.ULT_EVENTO ?? '').trim().slice(0, 500)

      let familia =
        master.get(substancia) ?? familiaFromSubstancia(substancia) ?? null
      if (!familia && substancia === SUBS_FALLBACK) familia = null

      const geomJson = JSON.stringify(f.geometry)

      matched++
      if (limit != null && matched > limit) break

      if (dryRun) {
        upserts++
        if (upserts <= 5) {
          console.log(
            `[dry-run] ${numero} | ${substancia.slice(0, 40)} | area=${area} UF=${uf}`,
          )
        }
        continue
      }

      if (!client) throw new Error('client')

      const res = await client.query<{
        was_insert: boolean
      }>(
        `
        INSERT INTO processos (
          numero, regime, fase, substancia, substancia_familia, titular,
          area_ha, uf, municipio, municipio_ibge, geom, ano_protocolo,
          ultimo_evento_descricao, updated_at
        ) VALUES (
          $1, 'disponibilidade', 'Disponibilidade', $2, $3, $4,
          $5, $6, NULL, NULL,
          (
            SELECT ST_MakeValid(
              CASE
                WHEN ST_GeometryType(gg) = 'ST_MultiPolygon' AND ST_NumGeometries(gg) > 0
                  THEN ST_GeometryN(gg, 1)
                ELSE gg
              END
            )
            FROM (
              SELECT ST_Transform(
                ST_SetSRID(ST_GeomFromGeoJSON($7::text), 4674),
                4326
              ) AS gg
            ) _
          ), $8, $9, now()
        )
        ON CONFLICT (numero) DO UPDATE SET
          geom = EXCLUDED.geom,
          regime = 'disponibilidade',
          fase = 'Disponibilidade',
          area_ha = COALESCE(EXCLUDED.area_ha, processos.area_ha),
          titular = COALESCE(NULLIF(EXCLUDED.titular, ''), processos.titular),
          substancia = CASE
            WHEN processos.substancia IS NULL OR processos.substancia = '' OR processos.substancia = $10
            THEN EXCLUDED.substancia
            ELSE processos.substancia
          END,
          substancia_familia = COALESCE(EXCLUDED.substancia_familia, processos.substancia_familia),
          ultimo_evento_descricao = COALESCE(NULLIF(EXCLUDED.ultimo_evento_descricao, ''), processos.ultimo_evento_descricao),
          updated_at = now()
        RETURNING (xmax = 0) AS was_insert
        `,
        [
          numero,
          substancia,
          familia,
          nome || null,
          area,
          uf || null,
          geomJson,
          ano_protocolo,
          ultEv || null,
          SUBS_FALLBACK,
        ],
      )
      const row = res.rows[0]
      if (row?.was_insert) rowInserts++
      else rowUpdates++
      upserts++
      if (upserts % 500 === 0)
        console.error(
          `[sigmine] ${upserts} upserts (novos=${rowInserts}, conflito_update=${rowUpdates})…`,
        )
      if (limit != null && upserts >= limit) break
    }
  }

  if (dryRun) {
    await runInsert(null as unknown as PoolClient, new Map())
    console.log(
      `[sigmine] dry-run: feicoes lidas=${read}, DISPONIBILIDADE (ate limit)=${matched}, amostra mostrada=min(5,${matched})`,
    )
    return
  }

  const client = await pool!.connect()
  try {
    await client.query(`SET statement_timeout = '10min'`)
    const master = await loadMasterFamilias(client)
    console.error(`[sigmine] master_substancias: ${master.size} linhas`)
    await runInsert(client, master)
    console.log(
      `[sigmine] concluido: FASE=DISPONIBILIDADE processadas=${matched}, feicoes_lidas_total=${read}, upserts=${upserts}, INSERT_novos=${rowInserts}, ON_CONFLICT_update=${rowUpdates}`,
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
