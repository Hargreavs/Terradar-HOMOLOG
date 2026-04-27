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

/** Cliente com service role — usar só no servidor (Express/scripts), nunca no browser. */
export const supabase = createClient(supabaseUrl, serviceRoleKey)
