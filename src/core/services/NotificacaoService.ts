import { AgendamentoRepository } from '../repositories/AgendamentoRepository.js'
import { EmailClient } from '../integrations/EmailClient.js'
import type { AgendamentoDetalhado } from '../../shared/tipos.js'

export interface ResultadoLembretes {
  analisados: number
  enviados: number
  simulados: number
  falhas: Array<{ agendamentoId: number; motivo: string }>
}

function formatarDataHora(iso: string): string {
  const [data, hora] = iso.split('T')
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano} as ${hora.slice(0, 5)}`
}

/**
 * Lembretes automaticos pedidos pelo dono: hoje ele avisa cada cliente no WhatsApp na mao.
 * O servico varre os agendamentos da janela de 24h a 48h a frente e envia um e-mail
 * uma unica vez por agendamento (controlado pela coluna lembrete_enviado_em).
 */
export class NotificacaoService {
  constructor(
    private readonly agendamentos = new AgendamentoRepository(),
    private readonly email = new EmailClient()
  ) {}

  private corpoLembrete(agendamento: AgendamentoDetalhado): { texto: string; html: string } {
    const quando = formatarDataHora(agendamento.inicio)
    const texto = [
      `Ola, ${agendamento.clienteNome}!`,
      '',
      `Passando para lembrar do seu procedimento no estudio:`,
      `  Procedimento: ${agendamento.procedimentoNome}`,
      `  Profissional: ${agendamento.profissionalNome}`,
      `  Data e hora:  ${quando}`,
      '',
      'Se precisar remarcar, e so responder esta mensagem.',
      'Ate breve!'
    ].join('\n')

    const html = `
      <div style="font-family: Arial, sans-serif; font-size: 15px; color: #1f2430;">
        <p>Ola, <strong>${agendamento.clienteNome}</strong>!</p>
        <p>Passando para lembrar do seu procedimento no estudio:</p>
        <table cellpadding="6" style="border-collapse: collapse;">
          <tr><td><strong>Procedimento</strong></td><td>${agendamento.procedimentoNome}</td></tr>
          <tr><td><strong>Profissional</strong></td><td>${agendamento.profissionalNome}</td></tr>
          <tr><td><strong>Data e hora</strong></td><td>${quando}</td></tr>
        </table>
        <p>Se precisar remarcar, e so responder esta mensagem.</p>
        <p>Ate breve!</p>
      </div>`

    return { texto, html }
  }

  /** Agendamentos que acontecem daqui a 24h-48h e ainda nao foram lembrados. */
  async pendentes(): Promise<AgendamentoDetalhado[]> {
    const agora = Date.now()
    const paraMysql = (ms: number): string =>
      new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
    return this.agendamentos.pendentesDeLembrete(
      paraMysql(agora + 24 * 3_600_000),
      paraMysql(agora + 48 * 3_600_000)
    )
  }

  async enviarLembretesPendentes(): Promise<ResultadoLembretes> {
    const pendentes = await this.pendentes()
    const resultado: ResultadoLembretes = {
      analisados: pendentes.length,
      enviados: 0,
      simulados: 0,
      falhas: []
    }

    for (const agendamento of pendentes) {
      if (!agendamento.clienteEmail) continue
      try {
        const corpo = this.corpoLembrete(agendamento)
        const envio = await this.email.enviar({
          para: agendamento.clienteEmail,
          assunto: `Lembrete: ${agendamento.procedimentoNome} amanha`,
          textoSimples: corpo.texto,
          html: corpo.html
        })
        await this.agendamentos.marcarLembreteEnviado(agendamento.id)
        resultado.enviados++
        if (envio.simulado) resultado.simulados++
      } catch (erro) {
        resultado.falhas.push({
          agendamentoId: agendamento.id,
          motivo: erro instanceof Error ? erro.message : 'erro desconhecido'
        })
      }
    }

    return resultado
  }
}
