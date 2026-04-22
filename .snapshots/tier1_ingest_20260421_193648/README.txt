Tier 1 ingest snapshot 20260421_193648

Arquivos adicionados no repo:
- server/scripts/lib/csv-utils.ts
- server/scripts/ingest-cfem-arrecadacao.ts
- server/scripts/ingest-tah.ts
- server/scripts/ingest-cfem-autuacao.ts
- package.json (scripts + csv-parse)

Notas:
- Cliente Supabase: import de ../supabase (carrega server/env.ts), nao de ../db.
- Pastas de dados: process.cwd()/data/anm-arrecadacao
- Encoding dos .ts: UTF-8 (corrigido apos gravacao inicial)
