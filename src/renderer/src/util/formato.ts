const moedaBrl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function moeda(valor: number | null | undefined): string {
  return moedaBrl.format(valor ?? 0)
}

export function dataCurta(iso: string | null | undefined): string {
  if (!iso) return '-'
  const [ano, mes, dia] = iso.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}

export function dataHora(iso: string | null | undefined): string {
  if (!iso) return '-'
  return `${dataCurta(iso)} ${iso.slice(11, 16)}`
}

export function hora(iso: string | null | undefined): string {
  return iso ? iso.slice(11, 16) : '-'
}

export function hoje(): string {
  const d = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function somarDias(dia: string, dias: number): string {
  const d = new Date(`${dia}T12:00:00`)
  d.setDate(d.getDate() + dias)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function telefone(valor: string | null | undefined): string {
  if (!valor) return '-'
  const n = valor.replace(/\D/g, '')
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`
  return valor
}

export function cpf(valor: string | null | undefined): string {
  if (!valor) return '-'
  const n = valor.replace(/\D/g, '')
  if (n.length !== 11) return valor
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`
}

export function cep(valor: string | null | undefined): string {
  if (!valor) return '-'
  const n = valor.replace(/\D/g, '')
  return n.length === 8 ? `${n.slice(0, 5)}-${n.slice(5)}` : valor
}
