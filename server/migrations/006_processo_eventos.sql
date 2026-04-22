-- TERRADAR: eventos regulatórios (Microdados SCM ANM) + resumo no cadastro

CREATE TABLE IF NOT EXISTS processo_eventos (
  id SERIAL PRIMARY KEY,
  processo_numero TEXT NOT NULL,
  evento_codigo INTEGER NOT NULL,
  evento_descricao TEXT,
  evento_categoria TEXT,
  data_evento DATE NOT NULL,
  observacao TEXT,
  publicacao_dou TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proc_eventos_numero ON processo_eventos(processo_numero);
CREATE INDEX IF NOT EXISTS idx_proc_eventos_data ON processo_eventos(processo_numero, data_evento DESC);

ALTER TABLE processos ADD COLUMN IF NOT EXISTS ultimo_evento_data DATE;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS ultimo_evento_descricao TEXT;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS ultimo_evento_codigo INTEGER;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS portaria_lavra_data DATE;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS portaria_lavra_dou TEXT;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS licenca_ambiental_data DATE;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS inicio_lavra_data DATE;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS plano_fechamento_data DATE;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS tah_ultimo_pagamento DATE;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS ral_ultimo_data DATE;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS exigencia_pendente BOOLEAN DEFAULT false;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS total_eventos INTEGER DEFAULT 0;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS ano_protocolo INTEGER;

COMMENT ON TABLE processo_eventos IS 'Histórico de eventos regulatórios. Fonte: Microdados SCM ANM (ProcessoEvento.txt)';
