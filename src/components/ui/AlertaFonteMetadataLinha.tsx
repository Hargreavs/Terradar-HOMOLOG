import type { CSSProperties } from 'react'

const META_TXT: CSSProperties = {
  fontSize: 13,
  color: '#5F5E5A',
}

function dataDdMmYyyy(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

/** Linha via {fonte_diario} · DD/MM/AAAA (estilo discreto). */
export function AlertaFonteMetadataLinha({
  fonteDiario,
  dataIso,
  style,
}: {
  fonteDiario: string
  dataIso: string
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        ...style,
      }}
    >
      <span style={META_TXT}>via {fonteDiario}</span>
      <span style={META_TXT}>·</span>
      <span style={META_TXT}>{dataDdMmYyyy(dataIso)}</span>
    </div>
  )
}
