# Resultados de comandos (PowerShell)

Exportado automaticamente a partir da sessão no repositório **Terrae** (`C:\Users\alex-\Terrae`).

---

## Resumo

| Comando | Resultado |
|--------|-----------|
| `ingest-processo.ts` (864.231/2017 + município/IBGE) | **OK** — upsert SIGMINE, geometria presente |
| `ingest-cfem.ts --uf TO` | **Erro** — CSV 2017–2021 ~84 MB, limite 50 MB do script |
| `ingest-capag.ts --uf TO` | **Erro** — API SICONFI retornou **HTTP 404** na URL usada |

---

## Saída completa (copiada do terminal)

```
PS C:\Users\alex-\Terrae> npx tsx server/scripts/ingest-processo.ts "864.231/2017" --municipio "Jaú do Tocantins" --ibge 1711803
>> 
◇ injected env (4) from .env.local // tip: ⌘ multiple files { path: ['.env.local', '.env'] }
◇ injected env (0) from .env // tip: ◈ encrypted .env [www.dotenvx.com]
[ingest-processo] Consultando SIGMINE… 864231/2017
[ingest-processo] Upsert OK: 864.231/2017 | features: 1
[ingest-processo] titular: M P LANCA MINERADORA | substância: MINÉRIO DE OURO | geom: sim
PS C:\Users\alex-\Terrae> ^C
PS C:\Users\alex-\Terrae> ^C
PS C:\Users\alex-\Terrae> npx tsx server/scripts/ingest-cfem.ts --uf TO
>> 
◇ injected env (4) from .env.local // tip: ◈ secrets for agents [www.dotenvx.com]
◇ injected env (0) from .env // tip: ◈ secrets for agents [www.dotenvx.com]
[ingest-cfem] Baixando https://app.anm.gov.br/DadosAbertos/ARRECADACAO/CFEM_Arrecadacao_2017_2021.csv
Error: Arquivo > 50MB (84062855 bytes). Abortando. Use filtros mais específicos.
    at downloadCsv (C:\Users\alex-\Terrae\server\scripts\ingest-cfem.ts:71:11)
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async main (C:\Users\alex-\Terrae\server\scripts\ingest-cfem.ts:96:18)
PS C:\Users\alex-\Terrae> ^C
PS C:\Users\alex-\Terrae> ^C
PS C:\Users\alex-\Terrae> npx tsx server/scripts/ingest-capag.ts --uf TO
>> 
◇ injected env (4) from .env.local // tip: ⌘ override existing { override: true }
◇ injected env (0) from .env // tip: ◈ encrypted .env [www.dotenvx.com]
[ingest-capag] Ano referência: 2024 | UF TO
[ingest-capag] GET https://apidatalake.tesouro.gov.br/arest/siconfi/v1/capag?an_referencia=2024&id_esfera=M&limit=5000&offset=0
Error: CAPAG HTTP 404: 
    at fetchAllCapag (C:\Users\alex-\Terrae\server\scripts\ingest-capag.ts:58:13)
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async main (C:\Users\alex-\Terrae\server\scripts\ingest-capag.ts:87:19)
PS C:\Users\alex-\Terrae> ^C
PS C:\Users\alex-\Terrae> ^C
PS C:\Users\alex-\Terrae> ^C
PS C:\Users\alex-\Terrae> ^C
PS C:\Users\alex-\Terrae> npx tsx server/scripts/ingest-cfem.ts --uf TO
>> 
◇ injected env (4) from .env.local // tip: ⌘ custom filepath { path: '/custom/path/.env' }
◇ injected env (0) from .env // tip: ◈ encrypted .env [www.dotenvx.com]
[ingest-cfem] Baixando https://app.anm.gov.br/DadosAbertos/ARRECADACAO/CFEM_Arrecadacao_2017_2021.csv
Error: Arquivo > 50MB (84062855 bytes). Abortando. Use filtros mais específicos.
    at downloadCsv (C:\Users\alex-\Terrae\server\scripts\ingest-cfem.ts:71:11)
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async main (C:\Users\alex-\Terrae\server\scripts\ingest-cfem.ts:96:18)
PS C:\Users\alex-\Terrae> ^C
PS C:\Users\alex-\Terrae> ^C
PS C:\Users\alex-\Terrae>
```

---

## Copiar saída no PowerShell / Cursor (dica rápida)

- **Ctrl+Shift+C** (como no VS Code) ou **clique direito → Copy** no terminal integrado, selecionando o texto antes.
- Ou **selecionar com o rato** e **Enter** (em alguns terminais Windows copia ao Enter).
- Para `curl` estilo bash no PowerShell, use **`curl.exe`** ou **`Invoke-RestMethod`**, porque `curl` é alias de `Invoke-WebRequest` e não aceita `-X`, `-H`, `-d` como no Linux.

---

*Ficheiro gerado para arquivo; não substitui logs oficiais de CI.*
