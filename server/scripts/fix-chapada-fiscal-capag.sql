-- Chapada da Natividade (IBGE 1705102) — correções pontuais de dados legados.
-- Executar no Supabase SQL Editor após revisão.

-- 1) Fiscal: passivo não circulante veio NULL quando o valor SICONFI é zero
UPDATE fiscal_municipios
SET passivo_nao_circulante = 0
WHERE municipio_ibge = '1705102'
  AND passivo_nao_circulante IS NULL;

-- 2) CAPAG: registo pode existir só no IBGE antigo (1705557)
-- Verificar antes:
-- SELECT * FROM capag_municipios WHERE municipio_ibge IN ('1705102', '1705557');

UPDATE capag_municipios
SET municipio_ibge = '1705102'
WHERE municipio_ibge = '1705557';

-- 3) Após migration 003 (coluna divida_consolidada): Chapada, posição STN 2023 / RGF referência
-- Dívida R$ 3.942.246,49; IDHM 2010 = 0,620 (PNUD/IBGE via SIDRA quando aplicável)
UPDATE fiscal_municipios
SET
  divida_consolidada = 3942246.49,
  idh = 0.620
WHERE municipio_ibge = '1705102';

-- 4) CAPAG município: nota global n.d.; indicadores como ratios (exibição ×100 no app)
UPDATE capag_municipios
SET
  nota = 'n.d.',
  endividamento = '0,1613',
  poupanca = '0,9992',
  liquidez = 'n.d.'
WHERE municipio_ibge = '1705102';
