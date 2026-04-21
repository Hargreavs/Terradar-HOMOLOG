/**
 * Helpers compartilhados para ingestão de CSVs ANM (Latin-1, decimais BR).
 * TERRADAR
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Normaliza número de processo ANM para formato canônico NNN.NNN/AAAA
 * Ex: ("932710", "2017") => "932.710/2017"
 *     ("826539", "2016") => "826.539/2016"
 *     ("323", "1973")    => "000.323/1973" (padded)
 */
export function normalizarProcesso(
  numero: string | undefined,
  ano: string | number | undefined,
): string | null {
  if (!numero || ano === undefined || ano === null) return null
  const num = String(numero).trim().replace(/\D/g, '')
  if (!num) return null
  const padded = num.padStart(6, '0')
  return `${padded.slice(0, 3)}.${padded.slice(3)}/${String(ano).trim()}`
}

/**
 * Parse decimal brasileiro: "70,28" => 70.28; "1.234,56" => 1234.56
 * Aceita vírgula decimal e ponto separador de milhar.
 */
export function parseDecimalBR(valor: string | undefined | null): number | null {
  if (valor === undefined || valor === null) return null
  const s = String(valor).trim()
  if (s === '' || s === '-' || s === 'N/D' || s.toLowerCase() === 'null')
    return null
  const normalizado = s.replace(/\./g, '').replace(',', '.')
  const n = Number.parseFloat(normalizado)
  return Number.isFinite(n) ? n : null
}

/**
 * Parse data ANM YYYY-MM-DD ou YYYY-MM-DD HH:MM:SS para ISO string ou null.
 */
export function parseDataISO(valor: string | undefined | null): string | null {
  if (!valor) return null
  const s = String(valor).trim()
  if (s === '' || s.startsWith('0000')) return null
  const match = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[\s T](\d{2}):(\d{2}):?(\d{2})?)?/,
  )
  if (!match) return null
  const [, y, mo, d, h, mi, se] = match
  if (h) return `${y}-${mo}-${d}T${h}:${mi}:${se || '00'}`
  return `${y}-${mo}-${d}`
}

/**
 * Batch upsert com ignoreDuplicates (idempotente).
 */
export async function upsertBatch(
  supabase: SupabaseClient,
  tableName: string,
  batch: Record<string, unknown>[],
  onConflict: string,
): Promise<{ inserted: number; errors: number }> {
  if (batch.length === 0) return { inserted: 0, errors: 0 }

  try {
    const { error } = await supabase
      .from(tableName)
      .upsert(batch, { onConflict, ignoreDuplicates: true })

    if (error) {
      console.error(`Erro upsert ${tableName}:`, error.message)
      return { inserted: 0, errors: batch.length }
    }
    return { inserted: batch.length, errors: 0 }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`Exception upsert ${tableName}:`, msg)
    return { inserted: 0, errors: batch.length }
  }
}
