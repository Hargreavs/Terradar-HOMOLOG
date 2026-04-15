/** fetch com retry (até 3 tentativas, backoff exponencial). */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  maxAttempts = 3,
): Promise<Response> {
  let lastErr: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, init)
      if (res.status >= 500) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`)
      }
      return res
    } catch (e) {
      lastErr = e
      if (attempt < maxAttempts - 1) {
        const ms = 2 ** attempt * 500
        console.warn(
          `[fetchWithRetry] tentativa ${attempt + 1}/${maxAttempts} falhou, aguardando ${ms}ms…`,
        )
        await new Promise((r) => setTimeout(r, ms))
      }
    }
  }
  throw lastErr
}
