-- Dívida consolidada (RGF/STN), preferida em relação ao passivo DCA quando preenchida.
ALTER TABLE fiscal_municipios
  ADD COLUMN IF NOT EXISTS divida_consolidada numeric;

COMMENT ON COLUMN fiscal_municipios.divida_consolidada IS
  'Dívida consolidada (R$), p. ex. RGF conta DC; se nulo, UI pode usar passivo_nao_circulante legado.';
