-- ============================================================
-- fn_territorial_analysis(p_numero text)
-- Retorna análise territorial completa de um processo minerário
-- ============================================================
-- Executar no Supabase: Dashboard → SQL Editor → New Query → Run
-- ============================================================

CREATE OR REPLACE FUNCTION fn_territorial_analysis(p_numero text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_geom_4674 geometry;
  v_result jsonb;
  v_areas jsonb;
  v_infra jsonb;
  v_portos jsonb;
  v_bioma jsonb;
  v_aquiferos jsonb;
BEGIN
  -- 1. Buscar geometria do processo e converter para SRID 4674
  SELECT ST_Transform(geom, 4674)
  INTO v_geom_4674
  FROM processos
  WHERE numero = p_numero;

  IF v_geom_4674 IS NULL THEN
    RAISE EXCEPTION 'Processo % não encontrado ou sem geometria', p_numero;
  END IF;

  -- 2. Áreas protegidas mais próximas (top 3 por tipo)
  SELECT jsonb_agg(to_jsonb(sub.*))
  INTO v_areas
  FROM (
    (
      SELECT ap.tipo, ap.nome, ap.categoria, ap.orgao,
             ROUND((ST_Distance(ap.geom::geography, v_geom_4674::geography) / 1000)::numeric, 1) AS distancia_km
      FROM geo_areas_protegidas ap
      WHERE ap.tipo = 'TI'
      ORDER BY ap.geom <-> v_geom_4674
      LIMIT 3
    )
    UNION ALL
    (
      SELECT ap.tipo, ap.nome, ap.categoria, ap.orgao,
             ROUND((ST_Distance(ap.geom::geography, v_geom_4674::geography) / 1000)::numeric, 1) AS distancia_km
      FROM geo_areas_protegidas ap
      WHERE ap.tipo = 'UC'
      ORDER BY ap.geom <-> v_geom_4674
      LIMIT 3
    )
    UNION ALL
    (
      SELECT ap.tipo, ap.nome, ap.categoria, ap.orgao,
             ROUND((ST_Distance(ap.geom::geography, v_geom_4674::geography) / 1000)::numeric, 1) AS distancia_km
      FROM geo_areas_protegidas ap
      WHERE ap.tipo = 'QUILOMBOLA'
      ORDER BY ap.geom <-> v_geom_4674
      LIMIT 3
    )
  ) sub;

  -- 3. Infraestrutura mais próxima (top 3 por tipo)
  SELECT jsonb_agg(to_jsonb(sub.*))
  INTO v_infra
  FROM (
    (
      SELECT gi.tipo, gi.nome, gi.categoria,
             ROUND((ST_Distance(gi.geom::geography, v_geom_4674::geography) / 1000)::numeric, 1) AS distancia_km
      FROM geo_infraestrutura gi
      WHERE gi.tipo = 'FERROVIA'
      ORDER BY gi.geom <-> v_geom_4674
      LIMIT 3
    )
    UNION ALL
    (
      SELECT gi.tipo, gi.nome, gi.categoria,
             ROUND((ST_Distance(gi.geom::geography, v_geom_4674::geography) / 1000)::numeric, 1) AS distancia_km
      FROM geo_infraestrutura gi
      WHERE gi.tipo = 'RODOVIA'
      ORDER BY gi.geom <-> v_geom_4674
      LIMIT 3
    )
    UNION ALL
    (
      SELECT gi.tipo, gi.nome, gi.categoria,
             ROUND((ST_Distance(gi.geom::geography, v_geom_4674::geography) / 1000)::numeric, 1) AS distancia_km
      FROM geo_infraestrutura gi
      WHERE gi.tipo = 'HIDROVIA'
      ORDER BY gi.geom <-> v_geom_4674
      LIMIT 3
    )
  ) sub;

  -- 4. Portos mais próximos (top 3)
  SELECT jsonb_agg(to_jsonb(sub.*))
  INTO v_portos
  FROM (
    SELECT gp.nome, gp.uf,
           ROUND((ST_Distance(gp.geom::geography, v_geom_4674::geography) / 1000)::numeric, 1) AS distancia_km
    FROM geo_pontos_interesse gp
    WHERE gp.tipo = 'PORTO'
    ORDER BY gp.geom <-> v_geom_4674
    LIMIT 3
  ) sub;

  -- 5. Bioma (interseção direta)
  SELECT jsonb_agg(jsonb_build_object('nome', b.nome))
  INTO v_bioma
  FROM geo_biomas b
  WHERE ST_Intersects(b.geom, v_geom_4674);

  -- 6. Aquíferos (interseção direta)
  SELECT jsonb_agg(jsonb_build_object('nome', a.nome, 'tipo', a.tipo))
  INTO v_aquiferos
  FROM geo_aquiferos a
  WHERE ST_Intersects(a.geom, v_geom_4674);

  -- 7. Montar resultado final
  v_result := jsonb_build_object(
    'processo', p_numero,
    'areas_protegidas', COALESCE(v_areas, '[]'::jsonb),
    'infraestrutura', COALESCE(v_infra, '[]'::jsonb),
    'portos', COALESCE(v_portos, '[]'::jsonb),
    'bioma', COALESCE(v_bioma, '[]'::jsonb),
    'aquiferos', COALESCE(v_aquiferos, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_territorial_analysis(text) TO service_role;
