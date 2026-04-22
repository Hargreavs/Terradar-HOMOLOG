// Backfill regulatory fields on processos via fn_derivar_campos_regulatorios (bulk UPDATE per chunk).
//
// Default: all processos with total_eventos > 0 (full backfill of derived columns).
// --only-null: opt-in partial rerun (rows with any of several derived fields still NULL).
// --dry-run --numero "N": print JSON for one process (no UPDATE).
//
// Usage:
//   npx tsx server/scripts/derivar-campos-regulatorios.ts --dry-run --numero "870.180/2023"
//   npx tsx server/scripts/derivar-campos-regulatorios.ts --limit 500
//   npx tsx server/scripts/derivar-campos-regulatorios.ts --all
import * as dotenv from 'dotenv'
import path from 'path'
import { Pool, type PoolClient } from 'pg'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL ausente em .env.local')
  process.exit(1)
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 4,
  ssl: DATABASE_URL.includes('supabase.co')
    ? { rejectUnauthorized: false }
    : undefined,
})

const CHUNK_SIZE = 500

type Args = {
  dryRun: boolean
  limit: number | null
  numero: string | null
  onlyNull: boolean
  all: boolean
}

function parseArgs(argv: string[]): Args {
  let dryRun = false
  let limit: number | null = null
  let numero: string | null = null
  let onlyNull = false
  let all = false

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') dryRun = true
    else if (a === '--all') {
      all = true
      onlyNull = false
    } else if (a === '--only-null') onlyNull = true
    else if (a.startsWith('--limit='))
      limit = Math.max(0, parseInt(a.slice('--limit='.length), 10) || 0)
    else if (a === '--limit' && argv[i + 1]) {
      limit = Math.max(0, parseInt(argv[++i], 10) || 0)
    } else if (a.startsWith('--numero='))
      numero = a.slice('--numero='.length).trim() || null
    else if (a === '--numero' && argv[i + 1]) numero = argv[++i].trim() || null
  }

  if (all) onlyNull = false

  return { dryRun, limit, numero, onlyNull, all }
}

type Derived = {
  alvara_validade: string | null
  gu_status: string
  gu_validade: string | null
  tah_ultimo_pagamento: string | null
  licenca_ambiental_data: string | null
  portaria_lavra_data: string | null
  inicio_lavra_data: string | null
  plano_fechamento_data: string | null
  ral_ultimo_data: string | null
  exigencia_pendente: boolean
  ultimo_evento_data: string | null
  ultimo_evento_codigo: number | null
  ultimo_evento_descricao: string | null
  total_eventos: number
  ativo_derivado: boolean
}

async function deriveOne(numero: string): Promise<Derived> {
  const { rows } = await pool.query(
    `SELECT fn_derivar_campos_regulatorios($1) AS j`,
    [numero],
  )
  const j = rows[0]?.j as Record<string, unknown> | undefined
  if (!j) {
    throw new Error(`fn_derivar_campos_regulatorios sem resultado para ${numero}`)
  }
  return {
    alvara_validade: (j.alvara_validade as string | null) ?? null,
    gu_status: String(j.gu_status ?? 'NUNCA_REQUERIDA'),
    gu_validade: (j.gu_validade as string | null) ?? null,
    tah_ultimo_pagamento: (j.tah_ultimo_pagamento as string | null) ?? null,
    licenca_ambiental_data: (j.licenca_ambiental_data as string | null) ?? null,
    portaria_lavra_data: (j.portaria_lavra_data as string | null) ?? null,
    inicio_lavra_data: (j.inicio_lavra_data as string | null) ?? null,
    plano_fechamento_data: (j.plano_fechamento_data as string | null) ?? null,
    ral_ultimo_data: (j.ral_ultimo_data as string | null) ?? null,
    exigencia_pendente: Boolean(j.exigencia_pendente),
    ultimo_evento_data: (j.ultimo_evento_data as string | null) ?? null,
    ultimo_evento_codigo:
      j.ultimo_evento_codigo != null ? Number(j.ultimo_evento_codigo) : null,
    ultimo_evento_descricao: (j.ultimo_evento_descricao as string | null) ?? null,
    total_eventos: Number(j.total_eventos ?? 0),
    ativo_derivado: j.ativo_derivado !== false,
  }
}

async function processChunk(
  client: PoolClient,
  numeros: string[],
): Promise<number> {
  if (numeros.length === 0) return 0

  const sql = `
    WITH amostra AS (
      SELECT unnest($1::text[]) AS numero
    ),
    derivados AS (
      SELECT a.numero, fn_derivar_campos_regulatorios(a.numero) AS j
      FROM amostra a
    )
    UPDATE processos p SET
      alvara_validade = (NULLIF(d.j->>'alvara_validade', ''))::date,
      gu_status = COALESCE(d.j->>'gu_status', 'NUNCA_REQUERIDA'),
      gu_validade = (NULLIF(d.j->>'gu_validade', ''))::date,
      tah_ultimo_pagamento = (NULLIF(d.j->>'tah_ultimo_pagamento', ''))::date,
      licenca_ambiental_data = (NULLIF(d.j->>'licenca_ambiental_data', ''))::date,
      portaria_lavra_data = (NULLIF(d.j->>'portaria_lavra_data', ''))::date,
      inicio_lavra_data = (NULLIF(d.j->>'inicio_lavra_data', ''))::date,
      plano_fechamento_data = (NULLIF(d.j->>'plano_fechamento_data', ''))::date,
      ral_ultimo_data = (NULLIF(d.j->>'ral_ultimo_data', ''))::date,
      exigencia_pendente = COALESCE((NULLIF(d.j->>'exigencia_pendente', ''))::boolean, false),
      ultimo_evento_data = (NULLIF(d.j->>'ultimo_evento_data', ''))::date,
      ultimo_evento_codigo = (NULLIF(d.j->>'ultimo_evento_codigo', ''))::integer,
      ultimo_evento_descricao = d.j->>'ultimo_evento_descricao',
      total_eventos = COALESCE((NULLIF(d.j->>'total_eventos', ''))::integer, 0),
      ativo_derivado = COALESCE((NULLIF(d.j->>'ativo_derivado', ''))::boolean, true),
      updated_at = now()
    FROM derivados d
    WHERE p.numero = d.numero
  `

  const result = await client.query(sql, [numeros])
  return result.rowCount ?? 0
}

async function countAlvaraPopulated(): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM processos WHERE alvara_validade IS NOT NULL`,
  )
  return rows[0]?.c ?? 0
}

async function listNumeros(args: Args): Promise<string[]> {
  if (args.numero) return [args.numero]

  // Fase 0.7 (20.04.2026): muda fonte de "SELECT numero FROM processos WHERE total_eventos > 0"
  // para "DISTINCT processo_numero em processo_eventos" com EXISTS em processos.
  // Motivo: captura os ~78k processos da Fase B que tem eventos ingeridos mas nunca
  // foram derivados (total_eventos ainda eh NULL/0 em processos).
  let sql: string
  if (args.onlyNull) {
    // --only-null mantem semantica original: retoma processos que JA foram derivados uma vez
    // mas ainda tem campos derivados vazios (util pra retry de batches incompletos).
    sql = `
      SELECT p.numero
      FROM processos p
      WHERE p.total_eventos > 0
        AND (
          p.alvara_validade IS NULL
          OR p.tah_ultimo_pagamento IS NULL
          OR p.licenca_ambiental_data IS NULL
          OR p.portaria_lavra_data IS NULL
          OR p.inicio_lavra_data IS NULL
          OR p.plano_fechamento_data IS NULL
          OR p.ral_ultimo_data IS NULL
          OR p.ultimo_evento_data IS NULL
          OR p.ultimo_evento_codigo IS NULL
        )
      ORDER BY p.numero
    `
  } else {
    // Default (--all ou sem flags): todo processo que tem rows em processo_eventos,
    // independente de ja ter sido derivado ou nao.
    sql = `
      SELECT DISTINCT pe.processo_numero AS numero
      FROM processo_eventos pe
      WHERE EXISTS (SELECT 1 FROM processos p WHERE p.numero = pe.processo_numero)
      ORDER BY numero
    `
  }
  if (args.limit != null && args.limit > 0) {
    sql += ` LIMIT ${args.limit}`
  }

  const { rows } = await pool.query(sql)
  return rows.map((r) => String(r.numero))
}

async function main() {
  const args = parseArgs(process.argv)

  const before = await countAlvaraPopulated()
  console.log(
    `[derivar] processos com alvara_validade preenchida (antes): ${before}`,
  )

  const numeros = await listNumeros(args)
  console.log(`[derivar] fila: ${numeros.length} processo(s)${args.dryRun ? ' (dry-run)' : ''}`)

  if (args.dryRun && args.numero) {
    const d = await deriveOne(args.numero)
    console.log(JSON.stringify({ numero: args.numero, ...d }, null, 2))
    await pool.end()
    return
  }

  if (args.dryRun) {
    console.log(
      '[derivar] dry-run em lote: nenhum UPDATE executado (use --numero para inspecionar um JSON)',
    )
    await pool.end()
    return
  }

  const client = await pool.connect()
  const inicio = Date.now()
  let err = 0
  let totalUpdated = 0

  try {
    await client.query(`SET statement_timeout = '5min'`)

    for (let i = 0; i < numeros.length; i += CHUNK_SIZE) {
      const chunk = numeros.slice(i, i + CHUNK_SIZE)
      try {
        const updated = await processChunk(client, chunk)
        totalUpdated += updated
        const elapsed = (Date.now() - inicio) / 1000
        const done = Math.min(i + chunk.length, numeros.length)
        const rate = elapsed > 0 ? done / elapsed : 0
        const remaining =
          rate > 0 ? (numeros.length - done) / rate : Number.POSITIVE_INFINITY
        console.log(
          `[${done}/${numeros.length}] ${updated} atualizados. ` +
            `${rate.toFixed(1)} processos/s. ETA: ${
              Number.isFinite(remaining) ? `${Math.round(remaining / 60)} min` : '—'
            }`,
        )
      } catch (e) {
        err++
        console.error(
          `[derivar] ERRO no chunk [${i}..${i + chunk.length}]:`,
          (e as Error).message,
        )
      }
    }
  } finally {
    client.release()
  }

  const after = await countAlvaraPopulated()
  console.log(
    `[derivar] processos com alvara_validade preenchida (depois): ${after} (+${after - before})`,
  )
  console.log(
    `[derivar] concluído: linhas atualizadas (soma rowCount)=${totalUpdated} chunks com erro=${err}`,
  )
  await pool.end()
  process.exit(err > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
