export function formatCNPJ(cnpj: string | null | undefined): string {
  const n = (cnpj ?? '').replace(/\D/g, '')
  if (n.length !== 14) return String(cnpj ?? '').trim()
  return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12)}`
}