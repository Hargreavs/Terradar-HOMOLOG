-- TERRADAR: CNPJ / NUP a partir dos Microdados SCM (ANM)

ALTER TABLE processos ADD COLUMN IF NOT EXISTS cnpj_titular TEXT;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS cnpj_filial TEXT;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS nup_sei TEXT;

COMMENT ON COLUMN processos.cnpj_titular IS 'CNPJ da matriz do titular. Fonte: Microdados SCM ANM (dados abertos)';
COMMENT ON COLUMN processos.cnpj_filial IS 'CNPJ da filial operacional (CNAE mineração + município). Fonte: BrasilAPI';
COMMENT ON COLUMN processos.nup_sei IS 'NUP SEI do processo. Fonte: Microdados SCM ANM';
