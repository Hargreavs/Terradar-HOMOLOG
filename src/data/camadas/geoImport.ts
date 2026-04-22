import rawAquiferos from './aquiferos.geojson?raw'
import rawAppCar from './app-car.geojson?raw'
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
  app_car: FeatureCollectionJson
  ferrovias: FeatureCollectionJson
  portos: FeatureCollectionJson
  biomas: FeatureCollectionJson
  rodovias: FeatureCollectionJson
  hidrovias: FeatureCollectionJson
}

const EMPTY_FC: FeatureCollectionJson = { type: 'FeatureCollection', features: [] }

function parse(raw: string): FeatureCollectionJson {
  return JSON.parse(raw) as FeatureCollectionJson
}

export const CAMADAS_GEO_JSON: CamadasGeoJSONData = {
  aquiferos: parse(rawAquiferos),
  terras_indigenas: parse(rawTerrasIndigenas),
  unidades_conservacao: parse(rawUc),
  quilombolas: parse(rawQuilombolas),
  app_car: parse(rawAppCar),
  ferrovias: parse(rawFerrovias),
  portos: parse(rawPortos),
  biomas: EMPTY_FC,
  rodovias: EMPTY_FC,
  hidrovias: EMPTY_FC,
}
