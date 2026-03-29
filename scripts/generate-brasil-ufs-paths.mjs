/**
 * Gera `src/data/brasil-ufs-paths.ts` a partir do GeoJSON das UFs (malha IBGE, ex.: fititnt/gis-dataset-brasil).
 *
 * 1) Descarregar uf/geojson/uf.json para a raiz como `_tmp_uf.json`.
 * 2) Simplificar com TopoJSON (evita artefactos ao usar só mapshaper -simplify):
 *    npx mapshaper _tmp_uf.json -o format=topojson _uf.topo.json
 *    npx mapshaper _uf.topo.json -simplify 4% -o format=geojson _uf_topo_simp.json
 * 3) node scripts/generate-brasil-ufs-paths.mjs _uf_topo_simp.json
 *
 * Ou: node scripts/generate-brasil-ufs-paths.mjs [caminho.geojson]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { geoMercator, geoPath } from 'd3-geo'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const inputPath = process.argv[2] ?? path.join(root, '_tmp_uf.json')
const outPath = path.join(root, 'src', 'data', 'brasil-ufs-paths.ts')

const geojson = JSON.parse(fs.readFileSync(inputPath, 'utf8'))

const W = 600
const H = 560
const projection = geoMercator()
  .center([-54, -14])
  .fitExtent(
    [
      [2, 2],
      [W - 2, H - 2],
    ],
    geojson,
  )

const pathGen = geoPath(projection)

/** d3-geo pode anexar o retângulo de clip ao path; remove o segundo subpath (ZM…). */
function pathSemArtefactoClip(d) {
  if (!d) return d
  const i = d.search(/ZM[0-9.]+,[0-9.]+L/)
  if (i === -1) return d
  return d.slice(0, i + 1)
}

const order = [
  'AM',
  'PA',
  'MT',
  'MG',
  'BA',
  'GO',
  'MS',
  'MA',
  'TO',
  'RO',
  'PI',
  'CE',
  'PE',
  'RN',
  'PB',
  'AL',
  'SE',
  'ES',
  'SP',
  'PR',
  'SC',
  'RS',
  'RJ',
  'DF',
  'AC',
  'AP',
  'RR',
]

/** @type {Record<string, string>} */
const byUf = {}
for (const f of geojson.features) {
  const sigla = f.properties?.UF_05
  if (!sigla || typeof sigla !== 'string') continue
  const d = pathSemArtefactoClip(pathGen(f))
  if (d) byUf[sigla] = d
}

const lines = [
  '/**',
  ' * Paths SVG das 27 UFs, projetados a partir do GeoJSON IBGE (malhas estaduais).',
  ` * viewBox 0 0 ${W} ${H}. Gerado por scripts/generate-brasil-ufs-paths.mjs`,
  ' */',
  `export const BRASIL_MINI_VIEWBOX = '0 0 ${W} ${H}'`,
  '',
  '/** Ordem de desenho: fundo primeiro, detalhes por cima. */',
  'export const BRASIL_UFS_PAINT_ORDER: readonly string[] = [',
  ...order.map((u) => `  '${u}',`),
  ']',
  '',
  'export const BRASIL_UF_PATH_D: Record<string, string> = {',
]

for (const u of order) {
  const d = byUf[u]
  if (!d) throw new Error(`Missing path for ${u}`)
  lines.push(`  ${u}: ${JSON.stringify(d)},`)
}
lines.push('}', '')

fs.writeFileSync(outPath, lines.join('\n'), 'utf8')
console.log('Wrote', outPath, Object.keys(byUf).length, 'states')
