-- ============================================================
-- CHAPADA DA NATIVIDADE (IBGE 1705102) — dados auditados 12.05
-- Executar no Supabase APÓS: 003_fiscal_divida_consolidada.sql e 004_capag_indicadores_normatizados.sql
-- Schema real: `municipio_ibge` (text), sem cod_ibge / codigo_municipio_completo neste projeto.
-- ============================================================

-- 2a. CAPAG (STN XLSX posição 2025; indicadores ano-base 2023 como ratio)
UPDATE capag_municipios
SET
  nota = 'n.d.',
  indicador_1 = 0.1613498280993015,
  nota_1 = 'A',
  indicador_2 = 0.9992433059204746,
  nota_2 = 'C',
  indicador_3 = NULL,
  nota_3 = 'n.d.',
  endividamento = '0.1613498280993015',
  poupanca = '0.9992433059204746',
  liquidez = 'n.d.',
  updated_at = now()
WHERE municipio_ibge = '1705102';

-- 2b. Fiscal (SICONFI DCA 2023 + SIDRA + PNUD + população)
UPDATE fiscal_municipios
SET
  receita_tributaria = 1816277.40,
  dep_transferencias_pct = 93.4,
  divida_consolidada = 3942246.49,
  idh = 0.620,
  populacao = 3117,
  exercicio = 2023,
  updated_at = now()
WHERE municipio_ibge = '1705102';

-- Verificação CAPAG
SELECT municipio_ibge, nota, indicador_1, nota_1, indicador_2, nota_2, indicador_3, nota_3
FROM capag_municipios
WHERE municipio_ibge = '1705102';

-- Verificação fiscal (string_agg)
SELECT string_agg(campo || ': ' || valor, chr(10) ORDER BY campo)
FROM (
  SELECT 'receita_tributaria' AS campo, receita_tributaria::text AS valor
  FROM fiscal_municipios WHERE municipio_ibge = '1705102'
  UNION ALL SELECT 'dep_transferencias_pct', dep_transferencias_pct::text
  FROM fiscal_municipios WHERE municipio_ibge = '1705102'
  UNION ALL SELECT 'divida_consolidada', divida_consolidada::text
  FROM fiscal_municipios WHERE municipio_ibge = '1705102'
  UNION ALL SELECT 'pib_municipal_mi', pib_municipal_mi::text
  FROM fiscal_municipios WHERE municipio_ibge = '1705102'
  UNION ALL SELECT 'idh', idh::text
  FROM fiscal_municipios WHERE municipio_ibge = '1705102'
  UNION ALL SELECT 'populacao', populacao::text
  FROM fiscal_municipios WHERE municipio_ibge = '1705102'
  UNION ALL SELECT 'exercicio', exercicio::text
  FROM fiscal_municipios WHERE municipio_ibge = '1705102'
  UNION ALL SELECT 'passivo_nao_circulante', coalesce(passivo_nao_circulante::text, 'null')
  FROM fiscal_municipios WHERE municipio_ibge = '1705102'
) sub;
