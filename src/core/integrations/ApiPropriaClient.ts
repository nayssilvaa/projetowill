import { HttpClient } from './HttpClient.js'
import { IntegracaoError } from '../errors.js'
import { env } from '../config/env.js'
import type { AgendamentoDetalhado, ResultadoAvisos } from '../../shared/tipos.js'
import type { ResultadoLembretes } from '../services/NotificacaoService.js'

interface RespostaSaude {
  status: string
  banco: boolean
  agendadorAtivo: boolean
  emailConfigurado: boolean
  horario: string
}

export interface StatusServicoLembretes {
  online: boolean
  agendadorAtivo: boolean
  emailConfigurado: boolean
  bancoOk: boolean
  pendentes: number
  verificadoEm: string
  erro?: string
}

/**
 * Cliente da API propria (api/ApiServer.ts), consumida pelo processo principal do Electron.
 *
 * O desktop nao dispara lembretes por conta propria: quem envia e o servico da API,
 * que tambem roda o agendador das 09:00. Centralizar o envio ali evita que o app e o
 * agendador mandem o mesmo lembrete duas vezes, e permite ao painel mostrar se o
 * envio automatico esta realmente funcionando.
 */
export class ApiPropriaClient extends HttpClient {
  protected readonly servico = 'servico de lembretes (API propria)'
  protected override readonly timeoutMs = 4000

  constructor(
    private readonly baseUrl = env.api.baseUrl,
    private readonly chave = env.appSecret
  ) {
    super()
  }

  protected override mensagemParaStatus(status: number): string {
    if (status === 401) return 'chave de API recusada (confira APP_SECRET no .env do app e da API)'
    if (status >= 500) return `erro interno na API (HTTP ${status})`
    return `HTTP ${status}`
  }

  private get autenticacao(): Record<string, string> {
    return { 'x-api-key': this.chave }
  }

  saude(): Promise<RespostaSaude> {
    return this.getJson<RespostaSaude>(`${this.baseUrl}/saude`)
  }

  lembretesPendentes(): Promise<AgendamentoDetalhado[]> {
    return this.getJson<AgendamentoDetalhado[]>(
      `${this.baseUrl}/lembretes/pendentes`,
      this.autenticacao
    )
  }

  /**
   * Envia de fato os e-mails: cada um leva alguns segundos no SMTP, entao esta chamada
   * tem um limite bem maior que as consultas de status (que precisam ser rapidas).
   */
  executarLembretes(): Promise<ResultadoLembretes> {
    return this.postJson<ResultadoLembretes>(
      `${this.baseUrl}/lembretes/executar`,
      undefined,
      this.autenticacao,
      ApiPropriaClient.TIMEOUT_ENVIO_MS
    )
  }

  private static readonly TIMEOUT_ENVIO_MS = 120_000

  /** Dispara os avisos de amanha aos profissionais, registrando quem pediu o envio. */
  executarAvisos(remetenteId: number): Promise<ResultadoAvisos> {
    return this.postJson<ResultadoAvisos>(
      `${this.baseUrl}/avisos/executar`,
      { remetenteId },
      this.autenticacao,
      30_000
    )
  }

  /** Nunca lanca: o painel precisa exibir o status mesmo com a API fora do ar. */
  async status(): Promise<StatusServicoLembretes> {
    const verificadoEm = new Date().toISOString()
    try {
      const [saude, pendentes] = await Promise.all([this.saude(), this.lembretesPendentes()])
      return {
        online: saude.status === 'ok',
        agendadorAtivo: saude.agendadorAtivo,
        emailConfigurado: Boolean(saude.emailConfigurado),
        bancoOk: saude.banco,
        pendentes: pendentes.length,
        verificadoEm
      }
    } catch (erro) {
      return {
        online: false,
        agendadorAtivo: false,
        emailConfigurado: false,
        bancoOk: false,
        pendentes: 0,
        verificadoEm,
        erro: erro instanceof IntegracaoError ? erro.message : 'API propria inacessivel.'
      }
    }
  }
}
