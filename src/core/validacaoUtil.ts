import type { ZodType } from 'zod'
import { ValidationError } from './errors.js'

/** Converte os issues do Zod em um mapa campo -> mensagens, para exibir no formulario. */
export function camposDeErro(erro: {
  issues: Array<{ path: PropertyKey[]; message: string }>
}): Record<string, string[]> {
  const mapa: Record<string, string[]> = {}
  for (const issue of erro.issues) {
    const chave = issue.path.map(String).join('.') || '_'
    ;(mapa[chave] ??= []).push(issue.message)
  }
  return mapa
}

/** Valida a entrada vinda da interface ou da API e ja lanca ValidationError formatado. */
export function validar<T>(schema: ZodType<T>, entrada: unknown, contexto: string): T {
  const analise = schema.safeParse(entrada)
  if (!analise.success) {
    throw new ValidationError(`${contexto}: dados invalidos.`, camposDeErro(analise.error))
  }
  return analise.data
}
