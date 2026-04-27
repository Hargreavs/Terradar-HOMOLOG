/**
 * Sobreposicao APP: 0% cinza; qualquer >0 laranja-alerta (alinhado a SOBREPOSTO do Aquifero #EF9F27).
 */
export function appOverlapTextColor(pct: number): string {
  if (pct === 0) return '#9ca3af'
  return '#EF9F27'
}

/**
 * Distancia em metros: abaixo de 1000 m em "X m", senao "X,XX km".
 */
export function formatDistM(m: number | null | undefined): string {
  if (m == null || Number.isNaN(m)) return 'N/D'
  if (m < 1000) return `${Math.round(m)} m`
  const km = m / 1000
  return `${km.toFixed(2).replace('.', ',')} km`
}

/**
 * Proximidade a sitio/massa (km): quanto mais perto, maior o risco (vermelho).
 * >=30 esmeralda; [10,30) verde; [3,10) amarelo; [0.5,3) laranja; <0.5 vermelho.
 */
export function distanciaTextColor(km: number): string {
  if (km >= 30) return '#34d399'
  if (km >= 10) return '#4ade80'
  if (km >= 3) return '#facc15'
  if (km >= 0.5) return '#fb923c'
  return '#f87171'
}

/**
 * Data ISO (com ou sem hora) -> dd/mm/aaaa em pt-BR.
 */
export function formatDateBR(iso: string | null | undefined): string {
  if (iso == null || iso === '') return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR')
}