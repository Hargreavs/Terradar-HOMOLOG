/**
 * CLI: npx tsx server/scripts/ingest-processo.ts "864.231/2017" --municipio "Jaú do Tocantins" --ibge 1711506
 * (IBGE 1711506 = Jaú do Tocantins; não confundir com 1711803 = Juarina/TO.)
 */
import { supabase } from '../supabase'
import { parseCliArgs } from './utils/cli-args'
import { arcgisRingsToGeoJsonPolygon } from './utils/geometry'
import { fetchWithRetry } from './utils/http'
import { familiaFromSubstancia } from './utils/substancia-map'

const SIGMINE_QUERY =
  'https://geo.anm.gov.br/arcgis/rest/services/SIGMINE/dados_anm/MapServer/0/query'

/** Chave para WHERE: 864.231/2017 → 864231/2017 */
function normalizeSigmineProcessKey(input: string): string {
  return input.trim().replace(/\./g, '')
}

/** Exibição ANM: 864231/2017 → 864.231/2017 */
function formatNumeroAnm(sigmineProcesso: string): string {
  const parts = sigmineProcesso.split('/')
  if (parts.length !== 2) return sigmineProcesso
  const [num, year] = parts
  if (!year || num.length <= 3) return sigmineProcesso
  const rest = num.slice(0, -3)
  const last3 = num.slice(-3)
  return `${rest}.${last3}/${year}`
}

interface SigmineFeature {
  attributes?: Record<string, unknown>
  geometry?: { rings?: number[][][] }
}

async function main() {
  const { positional, flags } = parseCliArgs(process.argv.slice(2))
  const rawNumero = positional[0]
  if (!rawNumero) {
    console.error(
      'Uso: npx tsx server/scripts/ingest-processo.ts "<NUMERO>" [--municipio "Nome"] [--ibge 1234567]',
    )
    process.exit(1)
  }

  const municipioOpt =
    typeof flags.municipio === 'string' ? flags.municipio.trim() : null
  const ibgeOpt =
    typeof flags.ibge === 'string' ? flags.ibge.trim() : null

  const sigmineKey = normalizeSigmineProcessKey(rawNumero)
  const safeWhere = sigmineKey.replace(/'/g, "''")

  const params = new URLSearchParams({
    where: `PROCESSO='${safeWhere}'`,
    outFields:
      'PROCESSO,NUMERO,ANO,FASE,NOME,SUBS,USO,AREA_HA,UF,ULT_EVENTO,ID',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'json',
  })

  const url = `${SIGMINE_QUERY}?${params.toString()}`
  console.log('[ingest-processo] Consultando SIGMINE…', sigmineKey)

  const res = await fetchWithRetry(url)
  const json = (await res.json()) as {
    features?: SigmineFeature[]
    error?: { message?: string }
  }

  if (json.error?.message) {
    console.error('[ingest-processo] SIGMINE erro:', json.error.message)
    process.exit(1)
  }

  const features = json.features ?? []
  if (features.length === 0) {
    console.error('[ingest-processo] Processo não encontrado no SIGMINE:', rawNumero)
    process.exit(1)
  }

  const f = features[0]
  const attr = f.attributes ?? {}
  const processoRaw = String(attr.PROCESSO ?? sigmineKey)
  const numero = formatNumeroAnm(processoRaw)
  const titular = String(attr.NOME ?? '').trim()
  const substancia = String(attr.SUBS ?? '').trim()
  const areaFromSig = Number(attr.AREA_HA)
  const uf = String(attr.UF ?? '').trim()
  const fase = String(attr.FASE ?? '').trim()
  const uso = String(attr.USO ?? '').trim()
  const regime = fase || uso || 'Não disponível'
  const familia = familiaFromSubstancia(substancia)

  const geo = arcgisRingsToGeoJsonPolygon(f.geometry?.rings)

  const { data: existing } = await supabase
    .from('processos')
    .select('*')
    .eq('numero', numero)
    .maybeSingle()

  const prev = (existing ?? {}) as Record<string, unknown>
  const row: Record<string, unknown> = {
    ...prev,
    numero,
    titular: titular || prev.titular,
    substancia: substancia || prev.substancia,
    substancia_familia: familia ?? prev.substancia_familia,
    area_ha: Number.isFinite(areaFromSig) ? areaFromSig : (prev.area_ha ?? 0),
    uf: uf || prev.uf,
    fase: fase || prev.fase,
    regime: regime || prev.regime,
    municipio: municipioOpt ?? prev.municipio,
    municipio_ibge: ibgeOpt ?? prev.municipio_ibge,
    geom: geo ?? prev.geom,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('processos')
    .upsert(row, { onConflict: 'numero' })

  if (error) {
    console.error('[ingest-processo] Supabase:', error.message)
    process.exit(1)
  }

  console.log('[ingest-processo] Upsert OK:', numero, '| features:', features.length)
  console.log(
    '[ingest-processo] titular:',
    titular,
    '| substância:',
    substancia,
    '| geom:',
    geo ? 'sim' : 'não',
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
