import './env'
import { Pool } from 'pg'

/** Compat: `.env` antigo com `DATABASE_URL` ou novo com `VITE_DATABASE_URL` (Vite lê o mesmo ficheiro; no Node tudo fica em `process.env`). */
const url = process.env.DATABASE_URL ?? process.env.VITE_DATABASE_URL

/** Pool direto ao Postgres (RPC PostGIS, queries pesadas). Requer `DATABASE_URL` ou `VITE_DATABASE_URL` no ambiente. */
export const pool: Pool | null = url
  ? new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
    })
  : null
