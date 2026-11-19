import type { Resultado } from '@shared/tipos'

export class ErroIpc extends Error {
  constructor(
    message: string,
    readonly codigo: string
  ) {
    super(message)
    this.name = 'ErroIpc'
  }
}

let tokenAtual: string | null = null

export function definirToken(token: string | null): void {
  tokenAtual = token
}

export function obterToken(): string | null {
  return tokenAtual
}

/** Chama um canal publico (sem sessao). */
export async function invocarPublico<T>(canal: string, ...args: unknown[]): Promise<T> {
  const resultado = (await window.api.invocar(canal, ...args)) as Resultado<T>
  if (!resultado.ok) throw new ErroIpc(resultado.erro, resultado.codigo)
  return resultado.dados
}

/** Chama um canal protegido: o token da sessao vai sempre como primeiro argumento. */
export async function invocar<T>(canal: string, ...args: unknown[]): Promise<T> {
  if (!tokenAtual) throw new ErroIpc('Sessao nao iniciada.', 'UNAUTHORIZED')
  const resultado = (await window.api.invocar(canal, tokenAtual, ...args)) as Resultado<T>
  if (!resultado.ok) throw new ErroIpc(resultado.erro, resultado.codigo)
  return resultado.dados
}
