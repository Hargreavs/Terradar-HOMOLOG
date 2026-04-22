-- TERRADAR 12.14 — Cadastro real Microdados SCM (864.231/2017)
-- IBGE correto: Jaú do Tocantins/TO = 1711506 (não Gurupi 1709500).
-- Executar no SQL Editor do Supabase; depois verificar fiscal em fiscal_municipios / capag_municipios para 1711506.

UPDATE processos SET
  municipio_ibge = '1711506',
  fase = 'AUTORIZAÇÃO DE PESQUISA',
  regime = 'autorizacao_pesquisa',
  substancia = 'MINÉRIO DE OURO',
  area_ha = 1600.00,
  municipio = 'Jaú do Tocantins',
  uf = 'TO',
  titular = 'M P Lanca Mineradora',
  ano_protocolo = 2017,
  data_protocolo = '2017-12-01'
WHERE numero = '864.231/2017';

-- Verificação:
-- SELECT numero, titular, municipio, uf, municipio_ibge, substancia, fase, regime,
--        area_ha, data_protocolo, ano_protocolo, cnpj_titular, nup_sei
-- FROM processos WHERE numero = '864.231/2017';

-- Dados fiscais por município (próxima etapa: ingestão SICONFI para 1711506 se vazio):
-- SELECT * FROM fiscal_municipios WHERE municipio_ibge = '1711506' LIMIT 5;
-- SELECT * FROM capag_municipios WHERE municipio_ibge = '1711506' LIMIT 5;
