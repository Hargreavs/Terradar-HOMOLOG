-- Corrige acentuação na fonte (master_substancias), alinhado ao texto PNM ouro.
-- Executar no Supabase após revisão.

UPDATE master_substancias
SET estrategia_nacional =
  replace(
    replace(
      replace(coalesce(estrategia_nacional, ''),
        'Certificacao',
        'Certificação'),
      'exportacao',
      'exportação'),
    'Formalizacao',
    'Formalização'
)
WHERE estrategia_nacional IS NOT NULL
  AND (
    estrategia_nacional ILIKE '%Certificacao%'
    OR estrategia_nacional ILIKE '%exportacao%'
    OR estrategia_nacional ILIKE '%Formalizacao%'
  );

-- Verificação (coluna de substância no projeto: substancia_anm)
-- SELECT substancia_anm, left(estrategia_nacional, 120) FROM master_substancias
-- WHERE estrategia_nacional ILIKE '%Certificação%' LIMIT 3;
