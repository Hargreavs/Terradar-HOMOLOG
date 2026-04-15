-- Indicadores CAPAG como valores numéricos (ratio STN) e notas por linha.
-- Compatível com scripts auditados 12.05; `endividamento` / `poupanca` / `liquidez` permanecem para legado texto.

ALTER TABLE capag_municipios
  ADD COLUMN IF NOT EXISTS indicador_1 numeric,
  ADD COLUMN IF NOT EXISTS indicador_2 numeric,
  ADD COLUMN IF NOT EXISTS indicador_3 numeric,
  ADD COLUMN IF NOT EXISTS nota_1 text,
  ADD COLUMN IF NOT EXISTS nota_2 text,
  ADD COLUMN IF NOT EXISTS nota_3 text;

COMMENT ON COLUMN capag_municipios.indicador_1 IS 'Ratio STN endividamento (ex. 0,1613 → 16,13% na UI).';
COMMENT ON COLUMN capag_municipios.indicador_2 IS 'Ratio STN poupança corrente.';
COMMENT ON COLUMN capag_municipios.indicador_3 IS 'Ratio STN liquidez ou NULL se n.d.';
