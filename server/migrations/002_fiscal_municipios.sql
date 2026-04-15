-- fiscal_municipios — SICONFI + IBGE (rodar no Supabase SQL Editor)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fiscal_municipios (
  id serial PRIMARY KEY,
  municipio_ibge text NOT NULL,
  municipio_nome text,
  uf text,
  exercicio integer NOT NULL,
  populacao integer,
  receita_corrente numeric,
  receita_tributaria numeric,
  transferencias_correntes numeric,
  passivo_nao_circulante numeric,
  dep_transferencias_pct numeric,
  autonomia_ratio numeric,
  pib_municipal_mi numeric,
  area_km2 numeric,
  densidade numeric,
  idh numeric,
  fonte text DEFAULT 'SICONFI/IBGE',
  updated_at timestamptz DEFAULT now(),
  UNIQUE (municipio_ibge, exercicio)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_municipios_ibge
  ON fiscal_municipios (municipio_ibge);
