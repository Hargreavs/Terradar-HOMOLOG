/**
 * Extrai polígonos SIGMINE (BRASIL.shp) para os NUPs alvo.
 * Uso (raiz): npx tsx server/scripts/extract-12-poligonos.ts
 */
import fs from 'fs'
import path from 'path'
import { open } from 'shapefile'

import { NUMEROS_LISTA } from './extract-12-processos-numeros'

const ROOT = process.cwd()
const SHP_BASE = path.join(ROOT, 'data/sigmine/BRASIL')
const OUT_DIR = path.join(ROOT, 'tmp')
const OUT_JSON = path.join(OUT_DIR, 'poligonos-extraidos.json')

function normalizeNupKey(s: string): string {
  return String(s ?? '')
    .trim()
    .replace(/[.\s]/g, '')
    .replace(/\//g, '')
}

const ALVO_KEYS = new Set(NUMEROS_LISTA.map((n) => normalizeNupKey(n)))

function extractProcessoFromProps(
  props: Record<string, unknown>,
): string | null {
  const candidates = [
    'PROCESSO',
    'NRPROCESSO',
    'NUMERO',
    'DSProcesso',
    'DS_PROCESSO',
    'PROCESSO_DS',
  ]
  for (const k of candidates) {
    const v = props[k]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  for (const [k, v] of Object.entries(props)) {
    if (/processo/i.test(k) && v != null && String(v).trim() !== '') {
      return String(v).trim()
    }
  }
  return null
}

/** Alinha ao formato ANM `864.016/2026` (ingest-processo / SIGMINE). */
function formatNumeroAnm(sigmineProcesso: string): string {
  const s = sigmineProcesso.replace(/\./g, '').trim()
  const parts = s.split('/')
  if (parts.length === 2) {
    const num = parts[0]!
    const year = parts[1]!
    if (num.length <= 3) return sigmineProcesso
    const rest = num.slice(0, -3)
    const last3 = num.slice(-3)
    return `${rest}.${last3}/${year}`
  }
  if (/^\d{10,}$/.test(s)) {
    const year = s.slice(-4)
    const num = s.slice(0, -4)
    if (num.length >= 3) {
      const rest = num.slice(0, -3)
      const last3 = num.slice(-3)
      return `${rest}.${last3}/${year}`
    }
  }
  return sigmineProcesso
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const source = await open(`${SHP_BASE}.shp`)
  let first = true
  const out: Record<string, GeoJSON.Geometry> = {}
  const matchedKeys = new Set<string>()
  let featuresRead = 0

  for (;;) {
    const result = await source.read()
    if (result.done) break
    featuresRead++
    const f = result.value
    if (f.type !== 'Feature' || !f.properties || !f.geometry) continue

    if (first) {
      console.log('=== Primeira feature: properties ===')
      console.log(JSON.stringify(f.properties, null, 2))
      first = false
    }

    const raw = extractProcessoFromProps(
      f.properties as Record<string, unknown>,
    )
    if (!raw) continue

    const canon = formatNumeroAnm(raw)
    const keyNorm = normalizeNupKey(canon)
    const keyNormRaw = normalizeNupKey(raw)

    let numeroMatch: string | null = null
    if (ALVO_KEYS.has(keyNorm)) numeroMatch = canon
    else if (ALVO_KEYS.has(keyNormRaw)) numeroMatch = formatNumeroAnm(raw)
    else {
      for (const alvo of NUMEROS_LISTA) {
        if (normalizeNupKey(alvo) === keyNorm || normalizeNupKey(alvo) === keyNormRaw) {
          numeroMatch = alvo
          break
        }
      }
    }

    if (!numeroMatch) continue
    if (out[numeroMatch]) continue

    out[numeroMatch] = f.geometry as GeoJSON.Geometry
    matchedKeys.add(numeroMatch)
    console.log(`Match shapefile: ${numeroMatch} (${f.geometry.type})`)
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2), 'utf8')

  console.log('\n=== Resumo polígonos ===')
  console.log(`Features lidas (total arquivo): ${featuresRead}`)
  console.log(`NUPs com geometria: ${matchedKeys.size} / ${NUMEROS_LISTA.length}`)
  const faltando = NUMEROS_LISTA.filter((n) => !matchedKeys.has(n))
  if (faltando.length) {
    console.log('Sem polígono no shapefile (normal p/ processos novos):')
    console.log(faltando.join(', '))
  }
  console.log(`JSON: ${OUT_JSON}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
