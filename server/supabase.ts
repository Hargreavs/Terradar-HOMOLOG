import './env'
import { createClient } from '@supabase/supabase-js'

/** Compat: `SUPABASE_URL` ou o mesmo host em `VITE_SUPABASE_URL` (um único .env). */
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Defina SUPABASE_URL (ou VITE_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY no .env (servidor).',
  )
}

const FETCH_TIMEOUT_MS = Number(
  process.env.SUPABASE_FETCH_TIMEOUT_MS ?? '30000',
)

/**
 * Fetch com timeout via AbortController próprio.
 *
 * IMPORTANTE: NÃO usar AbortSignal.any com init.signal.
 * Versão anterior fez isso e causou hangs piores — supabase-js
 * já passa signal em algumas chamadas internas e a composição
 * gerou cadeia de listeners não liberada.
 *
 * Aqui apenas IGNORAMOS init.signal se vier (raro nos caminhos do batch)
 * e sobrescrevemos com nosso AbortController. Se isso quebrar algum caso
 * de cancelamento legítimo (ex: usuário cancelando query no UI), tratar
 * em camada superior.
 */
const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  return fetch(input, { ...init, signal: controller.signal })
    .finally(() => clearTimeout(timeoutId))
}

/** Cliente com service role — usar só no servidor (Express/scripts), nunca no browser. */
export const supabase = createClient(supabaseUrl, serviceRoleKey, {
  global: { fetch: fetchWithTimeout },
})
