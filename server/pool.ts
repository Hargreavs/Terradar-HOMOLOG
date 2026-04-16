import './env'
import { Pool } from 'pg'

const url = process.env.DATABASE_URL

/** Pool direto ao Postgres (RPC PostGIS, queries pesadas). Requer DATABASE_URL no ambiente. */
export const pool: Pool | null = url
  ? new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
    })
  : null
