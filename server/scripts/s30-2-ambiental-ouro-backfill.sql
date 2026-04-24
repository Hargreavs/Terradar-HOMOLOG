-- S30-2 backfill Ambiental OURO + scores. Run in Supabase on TRD-HOMOLOG. Order: Task1 wait SP -> 2 bioma -> 3 timestamp -> 4 this proc -> 5 validate.
-- See handoff in chat: factors LEAST(100,sum), risk weights 0.25/0.30/0.25/0.20.
-- Un-comment sections when executing. Tech debt: S30-001..005 (handoff).

-- Task 1: poll until sp_bulk aquifero pid finishes (manual).

-- Task 2:
-- UPDATE processos p SET amb_bioma_principal = b.nome FROM geo_biomas b
-- WHERE p.substancia ILIKE '%OURO%' AND p.ativo_derivado AND p.geom IS NOT NULL AND p.amb_fatores_calculado_em IS NULL
-- AND ST_Contains(b.geom, ST_Centroid(ST_Transform(p.geom, 4674)));

-- Task 3:
-- UPDATE processos SET amb_fatores_calculado_em = now()
-- WHERE substancia ILIKE '%OURO%' AND ativo_derivado AND geom IS NOT NULL AND amb_fatores_calculado_em IS NULL;

CREATE OR REPLACE PROCEDURE sp_update_scores_ambiental_ouro_por_uf()
LANGUAGE plpgsql AS $$
DECLARE r record; v_afetados int; BEGIN
  FOR r IN
    SELECT DISTINCT p.uf AS uf FROM processos p
    WHERE p.substancia ILIKE '%OURO%' AND p.ativo_derivado = true AND p.geom IS NOT NULL
      AND p.amb_fatores_calculado_em IS NOT NULL AND p.uf IS NOT NULL
    ORDER BY 1
  LOOP
    UPDATE scores s SET
      dimensoes_risco = jsonb_set(COALESCE(s.dimensoes_risco,'{}'::jsonb), '{ambiental}',
        jsonb_build_object('valor',c.v_amb,'valor_bruto',c.v_amb,
          'label',CASE WHEN c.v_amb>=70 THEN 'Risco alto' WHEN c.v_amb>=30 THEN 'Risco medio' ELSE 'Risco baixo' END,
          'subfatores','[]'::jsonb)),
      risk_score = c.risk_round,
      risk_label = c.risk_lbl,
      calculated_at = now()
    FROM (
      SELECT p.id, v.v_amb,
        (ROUND(
          COALESCE((s0.dimensoes_risco->'geologico'->>'valor')::numeric,0)*0.25
          + v.v_amb::numeric*0.30
          + COALESCE((s0.dimensoes_risco->'social'->>'valor')::numeric,0)*0.25
          + COALESCE((s0.dimensoes_risco->'regulatorio'->>'valor')::numeric,0)*0.20
        ))::int AS risk_round,
        CASE WHEN (ROUND(
          COALESCE((s0.dimensoes_risco->'geologico'->>'valor')::numeric,0)*0.25
          + v.v_amb::numeric*0.30
          + COALESCE((s0.dimensoes_risco->'social'->>'valor')::numeric,0)*0.25
          + COALESCE((s0.dimensoes_risco->'regulatorio'->>'valor')::numeric,0)*0.20
        ))::int >= 70 THEN 'Risco alto'
        WHEN (ROUND(
          COALESCE((s0.dimensoes_risco->'geologico'->>'valor')::numeric,0)*0.25
          + v.v_amb::numeric*0.30
          + COALESCE((s0.dimensoes_risco->'social'->>'valor')::numeric,0)*0.25
          + COALESCE((s0.dimensoes_risco->'regulatorio'->>'valor')::numeric,0)*0.20
        ))::int >= 40 THEN 'Risco medio'
        ELSE 'Risco baixo' END AS risk_lbl
      FROM processos p
      INNER JOIN scores s0 ON s0.processo_id = p.id
      INNER JOIN LATERAL ( SELECT LEAST(100,
          (p.amb_ti_sobrepoe::int*40)+(p.amb_uc_pi_sobrepoe::int*35)+(p.amb_app_sobrepoe::int*25)
          +(p.amb_quilombola_sobrepoe::int*20)+(p.amb_uc_us_5km::int*15)+(p.amb_aquifero_5km::int*10)
          +(CASE p.amb_bioma_principal WHEN 'Amazônia' THEN 10 WHEN 'Mata Atlântica' THEN 8 WHEN 'Pantanal' THEN 8 ELSE 0 END)
        )::int AS v_amb ) v ON true
      WHERE p.uf = r.uf AND p.substancia ILIKE '%OURO%' AND p.ativo_derivado = true
        AND p.amb_fatores_calculado_em IS NOT NULL
    ) c
    WHERE s.processo_id = c.id;
    GET DIAGNOSTICS v_afetados = row_count; COMMIT;
    RAISE NOTICE 'UF %: % scores', r.uf, v_afetados;
  END LOOP;
END; $$;

-- CALL sp_update_scores_ambiental_ouro_por_uf();
