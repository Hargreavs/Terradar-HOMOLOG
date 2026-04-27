import rawAquiferos from './aquiferos.geojson?raw'
import rawFerrovias from './ferrovias.geojson?raw'
import rawPortos from './portos.geojson?raw'
import rawQuilombolas from './quilombolas.geojson?raw'
import rawTerrasIndigenas from './terras-indigenas.geojson?raw'
import rawUc from './unidades-conservacao.geojson?raw'

export type FeatureCollectionJson = {
  type: 'FeatureCollection'
  features: unknown[]
}

export type CamadasGeoJSONData = {
  aquiferos: FeatureCollectionJson
  terras_indigenas: FeatureCollectionJson
  unidades_conservacao: FeatureCollectionJson
  quilombolas: FeatureCollectionJson
  ferrovias: FeatureCollectionJson
  portos: FeatureCollectionJson
  biomas: FeatureCollectionJson
  rodovias: FeatureCollectionJson
  hidrovias: FeatureCollectionJson
}

const EMPTY_FC: FeatureCollectionJson = { type: 'FeatureCollection', features: [] }

function parse(raw: string): FeatureCollectionJson {
  const cleaned = raw.replace(/^\uFEFF/, '').replace(/\0/g, '')
  return JSON.parse(cleaned) as FeatureCollectionJson
}

export const CAMADAS_GEO_JSON: CamadasGeoJSONData = {
  aquiferos: parse(rawAquiferos),
  terras_indigenas: parse(rawTerrasIndigenas),
  unidades_conservacao: parse(rawUc),
  quilombolas: parse(rawQuilombolas),
  ferrovias: parse(rawFerrovias),
  portos: parse(rawPortos),
  biomas: EMPTY_FC,
  rodovias: EMPTY_FC,
  hidrovias: EMPTY_FC,
}
