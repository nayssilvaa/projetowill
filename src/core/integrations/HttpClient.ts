import { IntegracaoError } from '../errors.js'

interface OpcoesRequisicao {
  metodo?: 'GET' | 'POST'
  cabecalhos?: Record<string, string>
  corpo?: unknown
  /** Sobrescreve o timeout padrao do cliente para uma chamada especifica. */
  timeoutMs?: number
}

/** Base dos clientes HTTP: timeout, tratamento de erro e parsing em um lugar so. */
export abstract class HttpClient {
  protected abstract readonly servico: string
  protected readonly timeoutMs: number = 8000

  protected getJson<T>(url: string, cabecalhos?: Record<string, string>): Promise<T> {
    return this.requisitar<T>(url, { metodo: 'GET', cabecalhos })
  }

  protected postJson<T>(
    url: string,
    corpo?: unknown,
    cabecalhos?: Record<string, string>,
    timeoutMs?: number
  ): Promise<T> {
    return this.requisitar<T>(url, { metodo: 'POST', corpo, cabecalhos, timeoutMs })
  }

  /** Permite que cada cliente traduza um status HTTP em uma mensagem do dominio. */
  protected mensagemParaStatus(status: number): string {
    return `HTTP ${status}`
  }

  private async requisitar<T>(url: string, opcoes: OpcoesRequisicao): Promise<T> {
    const limite = opcoes.timeoutMs ?? this.timeoutMs
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), limite)
    try {
      const resposta = await fetch(url, {
        method: opcoes.metodo ?? 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(opcoes.corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...opcoes.cabecalhos
        },
        body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined
      })
      if (!resposta.ok) {
        throw new IntegracaoError(this.servico, this.mensagemParaStatus(resposta.status))
      }
      return (await resposta.json()) as T
    } catch (erro) {
      if (erro instanceof IntegracaoError) throw erro
      if (erro instanceof Error && erro.name === 'AbortError') {
        throw new IntegracaoError(this.servico, `tempo limite de ${limite}ms excedido`)
      }
      if (erro instanceof TypeError && erro.message === 'fetch failed') {
        throw new IntegracaoError(this.servico, 'servico inacessivel (sem conexao ou fora do ar)')
      }
      throw new IntegracaoError(this.servico, erro instanceof Error ? erro.message : 'erro desconhecido')
    } finally {
      clearTimeout(timer)
    }
  }
}
