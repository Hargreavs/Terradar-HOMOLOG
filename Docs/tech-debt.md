# Tech debt (TERRADAR)

## S30 — Ambiental / backfill

- **S30-001 RESOLVIDO:** `processos.geog` persistida + indice GIST (`s30-backfill-processos-geog.ts` + migration `20260424120000_s30_processos_add_geog.sql`).
- **S30-002 RESOLVIDO (DB):** `geo_aquiferos.geog` + indice (TRD-HOMOLOG; DWithin usa geog x geog).
- **S30-003 PENDENTE:** pg_cron job backfill-ambiental-ouro-lavra (jobid=2) desativado. Localizar migration e remover ou reescrever para sp_bulk_amb_flags_por_uf / sp_update_scores_ambiental_por_uf.
- **S30-004:** convenção — updates massivos: stored procedures com COMMIT por UF.
- **S30-005 PENDENTE:** drawer pode chamar fn_calc_score_ambiental(numero) em runtime; backfill deixa subfatores vazio no JSONB persistido.
- **S30-ROLLBACK:** manter processos_backup_s30_pre_bulk e scores_backup_s30_pre_bulk até validacao S31. CALL sp_s30_rollback_ambiental_bulk(); — nao dropar backups sem confirmacao.