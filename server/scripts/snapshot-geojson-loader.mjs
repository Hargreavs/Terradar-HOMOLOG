/**
 * Loader: redireciona imports *.geojson / *.geojson?raw para snapshot-empty-geojson.mjs
 *
 * Uso:
 *   node --experimental-loader ./server/scripts/snapshot-geojson-loader.mjs --import tsx server/scripts/snapshot-13-processos.ts
 */
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STUB = pathToFileURL(
  path.join(__dirname, 'snapshot-empty-geojson.mjs'),
).href

/** @param {string} specifier */
/** @param {import('node:module').ResolveHookContext} context */
/** @param {import('node:module').ResolveFn} nextResolve */
export async function resolve(specifier, context, nextResolve) {
  const noQuery = specifier.replace(/\?raw$/, '').split('?')[0]
  if (noQuery.includes('.geojson')) {
    return { shortCircuit: true, url: STUB }
  }
  return nextResolve(specifier, context)
}
