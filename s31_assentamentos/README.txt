TERRADAR · S31 · Batches SQL - Assentamentos INCRA
===================================================

Conteúdo: 66 arquivos b000.sql a b065.sql
Total: 8.213 registros de assentamentos do INCRA
Schema: INSERT INTO geo_areas_protegidas (...)

ATENÇÃO: este NÃO é o shapefile original.
Este é o resultado do processamento do shapefile
em batches SQL prontos para execução no Postgres.

Como executar:
1. Extrair em C:\Users\alex-\Terrae\tmp\s31_assentamentos\
2. Executar: npm run s31:ingest-assentamentos

Esperado após execução:
- COUNT(*) = 8213 em geo_areas_protegidas WHERE tipo='ASSENTAMENTO_INCRA'
- Top UF: PA (~1080)
