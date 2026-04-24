// Mapa: SQL explícito (F6a). Notas em Docs/tech-debt-F6a-fn-map-layer.md
import type { Pool } from 'pg'

type MapLayerJsonRow = { geojson: unknown }

function rowGeojson(
  r: { rows: MapLayerJsonRow[] },
): Record<string, unknown> {
  const raw = r.rows[0]?.geojson
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  return {
    type: 'FeatureCollection',
    features: [],
    count: 0,
    truncated: false,
  }
}

export async function fetchMapLayerPorto(
  pool: Pool,
  minx: number,
  miny: number,
  maxx: number,
  maxy: number,
  limit: number,
): Promise<Record<string, unknown>> {
  const sql = `
    WITH fil AS (
      SELECT
        gp.id,
        gp.nome,
        COALESCE(gp.uf, '') AS uf,
        COALESCE(gp.categoria, '') AS categoria,
        gp.geom
      FROM geo_pontos_interesse gp
      WHERE UPPER(TRIM(gp.tipo::text)) = 'PORTO'
        AND gp.geom IS NOT NULL
        AND ST_Intersects(
          ST_Transform(gp.geom, 4326),
          ST_MakeEnvelope($1::float8, $2::float8, $3::float8, $4::float8, 4326)
        )
      LIMIT $5
    )
    SELECT jsonb_build_object(
      'type', 'FeatureCollection',
      'count', (SELECT count(*)::int FROM fil),
      'truncated', (SELECT (SELECT count(*)::int FROM fil) >= $5),
      'features', COALESCE(
        (SELECT jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'id', f.id,
            'properties', jsonb_build_object(
              'id', f.id::text,
              'feature_id', f.id,
              'nome', f.nome,
              'uf', f.uf,
              'categoria', f.categoria,
              'orgao', 'ANTAQ'
            ),
            'geometry', ST_AsGeoJSON(ST_Transform(f.geom, 4326))::jsonb
          )
        )
        FROM fil f),
        '[]'::jsonb
      )
    ) AS geojson
  `

  const out = await pool.query<MapLayerJsonRow>(sql, [
    minx,
    miny,
    maxx,
    maxy,
    limit,
  ])
  return rowGeojson(out)
}

export async function fetchMapLayerRodovia(
  pool: Pool,
  minx: number,
  miny: number,
  maxx: number,
  maxy: number,
  limit: number,
): Promise<Record<string, unknown>> {
  const sql = `
    WITH fil AS (
      SELECT
        gi.id,
        gi.nome,
        COALESCE(gi.categoria, '') AS categoria,
        'DNIT' AS orgao,
        gi.geom
      FROM geo_infraestrutura gi
      WHERE UPPER(TRIM(gi.tipo::text)) = 'RODOVIA'
        AND gi.geom IS NOT NULL
        AND ST_Intersects(
          ST_Transform(gi.geom, 4326),
          ST_MakeEnvelope($1::float8, $2::float8, $3::float8, $4::float8, 4326)
        )
      LIMIT $5
    )
    SELECT jsonb_build_object(
      'type', 'FeatureCollection',
      'count', (SELECT count(*)::int FROM fil),
      'truncated', (SELECT (SELECT count(*)::int FROM fil) >= $5),
      'features', COALESCE(
        (SELECT jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'id', f.id,
            'properties', jsonb_build_object(
              'id', f.id::text,
              'feature_id', f.id,
              'nome', f.nome,
              'uf', '',
              'categoria', f.categoria,
              'orgao', f.orgao
            ),
            'geometry', ST_AsGeoJSON(ST_Transform(f.geom, 4326))::jsonb
          )
        )
        FROM fil f),
        '[]'::jsonb
      )
    ) AS geojson
  `

  const out = await pool.query<MapLayerJsonRow>(sql, [
    minx,
    miny,
    maxx,
    maxy,
    limit,
  ])
  return rowGeojson(out)
}

// NOTE: tabelas geo_* em 4674; viewport bbox em 4326 — ST_Transform para intersecção e saída GeoJSON.
// Tech debt SESSION18-014: processos.geom 4326 vs camadas 4674.
const SIMPLIFY_DEG = 0.0005

export async function fetchMapLayerSitio(
  pool: Pool,
  minx: number,
  miny: number,
  maxx: number,
  maxy: number,
  limit: number,
): Promise<Record<string, unknown>> {
  const sql = `
    WITH fil AS (
      SELECT
        s.id,
        s.identifica,
        s.ds_naturez,
        s.ds_classif,
        s.ds_tipo_be,
        s.geom
      FROM geo_sitios_arqueologicos s
      WHERE s.geom IS NOT NULL
        AND s.geom && ST_Transform(
          ST_MakeEnvelope($1::float8, $2::float8, $3::float8, $4::float8, 4326),
          4674
        )
      ORDER BY s.id
      LIMIT $5
    )
    SELECT jsonb_build_object(
      'type', 'FeatureCollection',
      'count', (SELECT count(*)::int FROM fil),
      'truncated', (SELECT (SELECT count(*)::int FROM fil) >= $5),
      'features', COALESCE(
        (SELECT jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'id', f.id::text,
            'properties', jsonb_build_object(
              'id', f.id::text,
              'feature_id', f.id,
              'identifica', f.identifica,
              'ds_naturez', f.ds_naturez,
              'ds_classif', f.ds_classif,
              'ds_tipo_be', f.ds_tipo_be
            ),
            'geometry', ST_AsGeoJSON(ST_Transform(f.geom, 4326))::jsonb
          )
          ORDER BY f.id
        )
        FROM fil f),
        '[]'::jsonb
      )
    ) AS geojson
  `
  return rowGeojson(await pool.query(sql, [minx, miny, maxx, maxy, limit]))
}

export async function fetchMapLayerHidroMassa(
  pool: Pool,
  minx: number,
  miny: number,
  maxx: number,
  maxy: number,
  minAreaHa: number = 0,
  limit: number = 5000,
): Promise<Record<string, unknown>> {
  const sql = `
    WITH fil AS (
      SELECT
        m.id,
        m.nmoriginal,
        m.nuareaha,
        m.geom,
        m.geom_simplified_4326
      FROM geo_hidrografia_massas m
      WHERE m.geom IS NOT NULL
        AND COALESCE(m.nuareaha, 0) >= $5
        AND m.geom && ST_Transform(
          ST_MakeEnvelope($1::float8, $2::float8, $3::float8, $4::float8, 4326),
          4674
        )
      LIMIT $6
    )
    SELECT jsonb_build_object(
      'type', 'FeatureCollection',
      'count', (SELECT count(*)::int FROM fil),
      'truncated', (SELECT (SELECT count(*)::int FROM fil) >= $6),
      'features', COALESCE(
        (SELECT jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'id', f.id::text,
            'properties', jsonb_build_object(
              'id', f.id::text,
              'feature_id', f.id,
              'nome', COALESCE(f.nmoriginal, ''),
              'nuareaha', f.nuareaha
            ),
            'geometry', ST_AsGeoJSON(f.geom_simplified_4326)::jsonb
          )
        )
        FROM fil f),
        '[]'::jsonb
      )
    ) AS geojson
  `
  return rowGeojson(
    await pool.query(sql, [minx, miny, maxx, maxy, minAreaHa, limit]),
  )
}

export async function fetchMapLayerHidroTrecho(
  pool: Pool,
  minx: number,
  miny: number,
  maxx: number,
  maxy: number,
  minStrahler: number,
  limit: number,
): Promise<Record<string, unknown>> {
  const sql = `
    WITH fil AS (
      SELECT
        t.id,
        t.cotrecho,
        t.nustrahler,
        t.nooriginal,
        t.geom,
        t.geom_simplified_4326
      FROM geo_hidrografia_trechos t
      WHERE t.geom IS NOT NULL
        AND t.nustrahler >= $6
        AND t.geom && ST_Transform(
          ST_MakeEnvelope($1::float8, $2::float8, $3::float8, $4::float8, 4326),
          4674
        )
      LIMIT $5
    )
    SELECT jsonb_build_object(
      'type', 'FeatureCollection',
      'count', (SELECT count(*)::int FROM fil),
      'truncated', (SELECT (SELECT count(*)::int FROM fil) >= $5),
      'features', COALESCE(
        (SELECT jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'id', f.id::text,
            'properties', jsonb_build_object(
              'id', f.id::text,
              'feature_id', f.id,
              'nome', COALESCE(f.nooriginal, f.cotrecho::text, ''),
              'cotrecho', f.cotrecho,
              'nooriginal', f.nooriginal,
              'nustrahler', f.nustrahler
            ),
            'geometry', ST_AsGeoJSON(f.geom_simplified_4326)::jsonb
          )
        )
        FROM fil f),
        '[]'::jsonb
      )
    ) AS geojson
  `
  return rowGeojson(
    await pool.query(sql, [minx, miny, maxx, maxy, limit, minStrahler]),
  )
}

export async function fetchMapLayerAppHidrica(
  pool: Pool,
  minx: number,
  miny: number,
  maxx: number,
  maxy: number,
  minFaixa: number,
  limit: number,
): Promise<Record<string, unknown>> {
  const sql = `
    WITH fil AS (
      SELECT
        a.id,
        a.fonte,
        a.fonte_id,
        a.faixa_m,
        a.nustrahler,
        a.area_ha_origem,
        a.geom,
        a.geom_simplified_4326
      FROM geo_app_hidrica a
      WHERE a.geom IS NOT NULL
        AND a.faixa_m >= $6
        AND a.geom && ST_Transform(
          ST_MakeEnvelope($1::float8, $2::float8, $3::float8, $4::float8, 4326),
          4674
        )
      LIMIT $5
    )
    SELECT jsonb_build_object(
      'type', 'FeatureCollection',
      'count', (SELECT count(*)::int FROM fil),
      'truncated', (SELECT (SELECT count(*)::int FROM fil) >= $5),
      'features', COALESCE(
        (SELECT jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'id', f.id::text,
            'properties', jsonb_build_object(
              'id', f.id::text,
              'feature_id', f.id,
              'nome', 'APP hídrica',
              'fonte', f.fonte,
              'faixa_m', f.faixa_m,
              'nustrahler', f.nustrahler,
              'area_ha_origem', f.area_ha_origem
            ),
            'geometry', ST_AsGeoJSON(f.geom_simplified_4326)::jsonb
          )
        )
        FROM fil f),
        '[]'::jsonb
      )
    ) AS geojson
  `
  return rowGeojson(
    await pool.query(sql, [minx, miny, maxx, maxy, limit, minFaixa]),
  )
}
function ucGrupoExpr(apAlias: string): string {
  return `CASE
          WHEN ${apAlias}.categoria LIKE 'PI %' THEN 'PI'
          WHEN ${apAlias}.categoria LIKE 'US %' THEN 'US'
          ELSE NULL
        END`
}

export async function fetchMapLayerTi(
  pool: Pool,
  minx: number,
  miny: number,
  maxx: number,
  maxy: number,
  limit: number,
): Promise<Record<string, unknown>> {
  const sql = `
    WITH fil AS (
      SELECT
        ap.id,
        ap.nome,
        ap.categoria,
        ap.orgao,
        ap.uf,
        ap.geom
      FROM geo_areas_protegidas ap
      WHERE ap.tipo = 'TI'
        AND ap.geom IS NOT NULL
        AND ap.geom && ST_Transform(
          ST_MakeEnvelope($1::float8, $2::float8, $3::float8, $4::float8, 4326),
          4674
        )
      ORDER BY ap.id
      LIMIT $5
    )
    SELECT jsonb_build_object(
      'type', 'FeatureCollection',
      'count', (SELECT count(*)::int FROM fil),
      'truncated', (SELECT (SELECT count(*)::int FROM fil) >= $5),
      'features', COALESCE(
        (SELECT jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'id', f.id::text,
            'properties', jsonb_build_object(
              'id', f.id::text,
              'feature_id', f.id,
              'nome', f.nome,
              'categoria', f.categoria,
              'orgao', f.orgao,
              'uf', f.uf
            ),
            'geometry', ST_AsGeoJSON(
              ST_SimplifyPreserveTopology(ST_Transform(f.geom, 4326), ${SIMPLIFY_DEG})
            )::jsonb
          )
          ORDER BY f.id
        )
        FROM fil f),
        '[]'::jsonb
      )
    ) AS geojson
  `
  return rowGeojson(await pool.query(sql, [minx, miny, maxx, maxy, limit]))
}

export async function fetchMapLayerUc(
  pool: Pool,
  minx: number,
  miny: number,
  maxx: number,
  maxy: number,
  limit: number,
): Promise<Record<string, unknown>> {
  const sql = `
    WITH fil AS (
      SELECT
        ap.id,
        ap.nome,
        ap.categoria,
        ap.orgao,
        ap.uf,
        ap.geom,
        ${ucGrupoExpr('ap')} AS grupo
      FROM geo_areas_protegidas ap
      WHERE ap.tipo = 'UC'
        AND ap.geom IS NOT NULL
        AND ap.geom && ST_Transform(
          ST_MakeEnvelope($1::float8, $2::float8, $3::float8, $4::float8, 4326),
          4674
        )
      ORDER BY ap.id
      LIMIT $5
    )
    SELECT jsonb_build_object(
      'type', 'FeatureCollection',
      'count', (SELECT count(*)::int FROM fil),
      'truncated', (SELECT (SELECT count(*)::int FROM fil) >= $5),
      'features', COALESCE(
        (SELECT jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'id', f.id::text,
            'properties', jsonb_build_object(
              'id', f.id::text,
              'feature_id', f.id,
              'nome', f.nome,
              'categoria', f.categoria,
              'grupo', f.grupo,
              'orgao', f.orgao,
              'uf', f.uf
            ),
            'geometry', ST_AsGeoJSON(
              ST_SimplifyPreserveTopology(ST_Transform(f.geom, 4326), ${SIMPLIFY_DEG})
            )::jsonb
          )
          ORDER BY f.id
        )
        FROM fil f),
        '[]'::jsonb
      )
    ) AS geojson
  `
  return rowGeojson(await pool.query(sql, [minx, miny, maxx, maxy, limit]))
}

export async function fetchMapLayerUcPi(
  pool: Pool,
  minx: number,
  miny: number,
  maxx: number,
  maxy: number,
  limit: number,
): Promise<Record<string, unknown>> {
  const sql = `
    WITH fil AS (
      SELECT
        ap.id,
        ap.nome,
        ap.categoria,
        ap.orgao,
        ap.uf,
        ap.geom
      FROM geo_areas_protegidas ap
      WHERE ap.tipo = 'UC'
        AND ap.categoria LIKE 'PI %'
        AND ap.geom IS NOT NULL
        AND ap.geom && ST_Transform(
          ST_MakeEnvelope($1::float8, $2::float8, $3::float8, $4::float8, 4326),
          4674
        )
      ORDER BY ap.id
      LIMIT $5
    )
    SELECT jsonb_build_object(
      'type', 'FeatureCollection',
      'count', (SELECT count(*)::int FROM fil),
      'truncated', (SELECT (SELECT count(*)::int FROM fil) >= $5),
      'features', COALESCE(
        (SELECT jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'id', f.id::text,
            'properties', jsonb_build_object(
              'id', f.id::text,
              'feature_id', f.id,
              'nome', f.nome,
              'categoria', f.categoria,
              'grupo', 'PI',
              'orgao', f.orgao,
              'uf', f.uf
            ),
            'geometry', ST_AsGeoJSON(
              ST_SimplifyPreserveTopology(ST_Transform(f.geom, 4326), ${SIMPLIFY_DEG})
            )::jsonb
          )
          ORDER BY f.id
        )
        FROM fil f),
        '[]'::jsonb
      )
    ) AS geojson
  `
  return rowGeojson(await pool.query(sql, [minx, miny, maxx, maxy, limit]))
}

export async function fetchMapLayerUcUs(
  pool: Pool,
  minx: number,
  miny: number,
  maxx: number,
  maxy: number,
  limit: number,
): Promise<Record<string, unknown>> {
  const sql = `
    WITH fil AS (
      SELECT
        ap.id,
        ap.nome,
        ap.categoria,
        ap.orgao,
        ap.uf,
        ap.geom
      FROM geo_areas_protegidas ap
      WHERE ap.tipo = 'UC'
        AND ap.categoria LIKE 'US %'
        AND ap.geom IS NOT NULL
        AND ap.geom && ST_Transform(
          ST_MakeEnvelope($1::float8, $2::float8, $3::float8, $4::float8, 4326),
          4674
        )
      ORDER BY ap.id
      LIMIT $5
    )
    SELECT jsonb_build_object(
      'type', 'FeatureCollection',
      'count', (SELECT count(*)::int FROM fil),
      'truncated', (SELECT (SELECT count(*)::int FROM fil) >= $5),
      'features', COALESCE(
        (SELECT jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'id', f.id::text,
            'properties', jsonb_build_object(
              'id', f.id::text,
              'feature_id', f.id,
              'nome', f.nome,
              'categoria', f.categoria,
              'grupo', 'US',
              'orgao', f.orgao,
              'uf', f.uf
            ),
            'geometry', ST_AsGeoJSON(
              ST_SimplifyPreserveTopology(ST_Transform(f.geom, 4326), ${SIMPLIFY_DEG})
            )::jsonb
          )
          ORDER BY f.id
        )
        FROM fil f),
        '[]'::jsonb
      )
    ) AS geojson
  `
  return rowGeojson(await pool.query(sql, [minx, miny, maxx, maxy, limit]))
}

export async function fetchMapLayerQuilombola(
  pool: Pool,
  minx: number,
  miny: number,
  maxx: number,
  maxy: number,
  limit: number,
): Promise<Record<string, unknown>> {
  const sql = `
    WITH fil AS (
      SELECT
        ap.id,
        ap.nome,
        ap.categoria,
        ap.orgao,
        ap.uf,
        ap.geom
      FROM geo_areas_protegidas ap
      WHERE ap.tipo = 'QUILOMBOLA'
        AND ap.geom IS NOT NULL
        AND ap.geom && ST_Transform(
          ST_MakeEnvelope($1::float8, $2::float8, $3::float8, $4::float8, 4326),
          4674
        )
      ORDER BY ap.id
      LIMIT $5
    )
    SELECT jsonb_build_object(
      'type', 'FeatureCollection',
      'count', (SELECT count(*)::int FROM fil),
      'truncated', (SELECT (SELECT count(*)::int FROM fil) >= $5),
      'features', COALESCE(
        (SELECT jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'id', f.id::text,
            'properties', jsonb_build_object(
              'id', f.id::text,
              'feature_id', f.id,
              'nome', f.nome,
              'categoria', f.categoria,
              'orgao', f.orgao,
              'uf', f.uf
            ),
            'geometry', ST_AsGeoJSON(
              ST_SimplifyPreserveTopology(ST_Transform(f.geom, 4326), ${SIMPLIFY_DEG})
            )::jsonb
          )
          ORDER BY f.id
        )
        FROM fil f),
        '[]'::jsonb
      )
    ) AS geojson
  `
  return rowGeojson(await pool.query(sql, [minx, miny, maxx, maxy, limit]))
}

export async function fetchMapLayerAquifero(
  pool: Pool,
  minx: number,
  miny: number,
  maxx: number,
  maxy: number,
  limit: number,
): Promise<Record<string, unknown>> {
  const sql = `
    WITH fil AS (
      SELECT
        aq.id,
        aq.nome,
        aq.tipo,
        aq.geom
      FROM geo_aquiferos aq
      WHERE aq.geom IS NOT NULL
        AND aq.geom && ST_Transform(
          ST_MakeEnvelope($1::float8, $2::float8, $3::float8, $4::float8, 4326),
          4674
        )
      ORDER BY aq.id
      LIMIT $5
    )
    SELECT jsonb_build_object(
      'type', 'FeatureCollection',
      'count', (SELECT count(*)::int FROM fil),
      'truncated', (SELECT (SELECT count(*)::int FROM fil) >= $5),
      'features', COALESCE(
        (SELECT jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'id', f.id::text,
            'properties', jsonb_build_object(
              'id', f.id::text,
              'feature_id', f.id,
              'nome', f.nome,
              'tipo', f.tipo
            ),
            'geometry', ST_AsGeoJSON(
              ST_SimplifyPreserveTopology(ST_Transform(f.geom, 4326), ${SIMPLIFY_DEG})
            )::jsonb
          )
          ORDER BY f.id
        )
        FROM fil f),
        '[]'::jsonb
      )
    ) AS geojson
  `
  return rowGeojson(await pool.query(sql, [minx, miny, maxx, maxy, limit]))
}

export async function fetchMapLayerBioma(
  pool: Pool,
  minx: number,
  miny: number,
  maxx: number,
  maxy: number,
  limit: number,
): Promise<Record<string, unknown>> {
  const sql = `
    WITH fil AS (
      SELECT
        b.id,
        b.nome,
        b.geom
      FROM geo_biomas b
      WHERE b.geom IS NOT NULL
        AND b.geom && ST_Transform(
          ST_MakeEnvelope($1::float8, $2::float8, $3::float8, $4::float8, 4326),
          4674
        )
      ORDER BY b.nome
      LIMIT $5
    )
    SELECT jsonb_build_object(
      'type', 'FeatureCollection',
      'count', (SELECT count(*)::int FROM fil),
      'truncated', (SELECT (SELECT count(*)::int FROM fil) >= $5),
      'features', COALESCE(
        (SELECT jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'id', f.id::text,
            'properties', jsonb_build_object(
              'id', f.id::text,
              'feature_id', f.id,
              'nome', f.nome
            ),
            'geometry', ST_AsGeoJSON(
              ST_SimplifyPreserveTopology(ST_Transform(f.geom, 4326), ${SIMPLIFY_DEG})
            )::jsonb
          )
          ORDER BY f.nome
        )
        FROM fil f),
        '[]'::jsonb
      )
    ) AS geojson
  `
  return rowGeojson(await pool.query(sql, [minx, miny, maxx, maxy, limit]))
}

export async function fetchMapLayerHidrovia(
  pool: Pool,
  minx: number,
  miny: number,
  maxx: number,
  maxy: number,
  limit: number,
): Promise<Record<string, unknown>> {
  const sql = `
    WITH fil AS (
      SELECT
        gi.id,
        gi.nome,
        COALESCE(gi.categoria, '') AS categoria,
        gi.geom
      FROM geo_infraestrutura gi
      WHERE gi.tipo = 'HIDROVIA'
        AND gi.geom IS NOT NULL
        AND gi.geom && ST_Transform(
          ST_MakeEnvelope($1::float8, $2::float8, $3::float8, $4::float8, 4326),
          4674
        )
      ORDER BY gi.id
      LIMIT $5
    )
    SELECT jsonb_build_object(
      'type', 'FeatureCollection',
      'count', (SELECT count(*)::int FROM fil),
      'truncated', (SELECT (SELECT count(*)::int FROM fil) >= $5),
      'features', COALESCE(
        (SELECT jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'id', f.id::text,
            'properties', jsonb_build_object(
              'id', f.id::text,
              'feature_id', f.id,
              'nome', f.nome,
              'categoria', f.categoria
            ),
            'geometry', ST_AsGeoJSON(
              ST_SimplifyPreserveTopology(ST_Transform(f.geom, 4326), ${SIMPLIFY_DEG})
            )::jsonb
          )
          ORDER BY f.id
        )
        FROM fil f),
        '[]'::jsonb
      )
    ) AS geojson
  `
  return rowGeojson(await pool.query(sql, [minx, miny, maxx, maxy, limit]))
}
