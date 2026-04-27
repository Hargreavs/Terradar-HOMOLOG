import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (typeof import.meta.env.DEV !== 'undefined' && import.meta.env.DEV) {
  if (!url || !anonKey) {
    console.warn(
      '[TERRADAR] Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para o Radar consumir RPCs no browser.',
    )
  }
}

export const supabase = createClient(url ?? '', anonKey ?? '')
