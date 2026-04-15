import './env'

import { createClient } from '@supabase/supabase-js'

/** Cliente com service role — usar só no servidor (Express/scripts), nunca no browser. */
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)
