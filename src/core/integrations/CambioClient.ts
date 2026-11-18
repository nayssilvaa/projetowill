import { HttpClient } from './HttpClient.js'
import { env } from '../config/env.js'
import { IntegracaoError } from '../errors.js'

interface AwesomeApiResposta {
  USDBRL?: {
    bid?: string
    pctChange?: string
    create_date?: string
  }
}

export interface CotacaoAtual {
  valorBrl: number
  variacaoPct: number | null
  fonte: string
}

/**
 * API externa 2/4 — AwesomeAPI (USD-BRL).
 * O estudio compra material importado; a cotacao do dia e gravada junto da compra
 * e serve de alerta quando o dolar sobe acima do limite configurado.
 */
export class CambioClient extends HttpClient {
  protected readonly servico = 'API de cambio'

  async cotacaoDolar(): Promise<CotacaoAtual> {
    const dados = await this.getJson<AwesomeApiResposta>(`${env.cambioBaseUrl}/USD-BRL`)
    const bid = Number(dados.USDBRL?.bid)
    if (!Number.isFinite(bid) || bid <= 0) {
      throw new IntegracaoError(this.servico, 'resposta sem cotacao valida.')
    }
    const pct = Number(dados.USDBRL?.pctChange)
    return {
      valorBrl: bid,
      variacaoPct: Number.isFinite(pct) ? pct : null,
      fonte: 'awesomeapi'
    }
  }
}
