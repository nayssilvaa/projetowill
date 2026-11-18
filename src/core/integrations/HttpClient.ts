import { IntegracaoError } from '../errors.js'

/** Base dos clientes HTTP: timeout, tratamento de erro e parsing em um lugar so. */
export abstract class HttpClient {
  protected abstract readonly servico: string
  protected readonly timeoutMs: number = 8000

  protected async getJson<T>(url: string): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const resposta = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      })
      if (!resposta.ok) {
        throw new IntegracaoError(this.servico, `HTTP ${resposta.status}`)
      }
      return (await resposta.json()) as T
    } catch (erro) {
      if (erro instanceof IntegracaoError) throw erro
      if (erro instanceof Error && erro.name === 'AbortError') {
        throw new IntegracaoError(this.servico, `tempo limite de ${this.timeoutMs}ms excedido`)
      }
      throw new IntegracaoError(this.servico, erro instanceof Error ? erro.message : 'erro desconhecido')
    } finally {
      clearTimeout(timer)
    }
  }
}
