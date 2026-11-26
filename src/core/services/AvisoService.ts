import { AvisoRepository } from '../repositories/AvisoRepository.js'
import { AgendamentoRepository } from '../repositories/AgendamentoRepository.js'
import { ForbiddenError } from '../errors.js'
import type { AgendamentoDetalhado, AvisoProfissional, ResultadoAvisos } from '../../shared/tipos.js'

function diaLocal(deslocamento: number): string {
  const data = new Date()
  data.setDate(data.getDate() + deslocamento)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`
}

function dataBr(dia: string): string {
  const [ano, mes, d] = dia.split('-')
  return `${d}/${mes}/${ano}`
}

/**
 * Avisos internos da recepcao para os profissionais.
 *
 * O dono contou que os profissionais "vao se virando" para saber a agenda. Na vespera,
 * a recepcao dispara um aviso por profissional com os atendimentos do dia seguinte,
 * e cada um ve o seu no proprio painel. O profissional so le os avisos dele.
 */
export class AvisoService {
  constructor(
    private readonly avisos = new AvisoRepository(),
    private readonly agendamentos = new AgendamentoRepository()
  ) {}

  private montarMensagem(dia: string, lista: AgendamentoDetalhado[]): string {
    const linhas = lista.map(
      (a) =>
        `${a.inicio.slice(11, 16)} - ${a.fim.slice(11, 16)} · ${a.clienteNome} · ${a.procedimentoNome}`
    )
    const plural = lista.length === 1 ? 'atendimento' : 'atendimentos'
    return [`Amanha (${dataBr(dia)}) voce tem ${lista.length} ${plural}:`, ...linhas].join('\n')
  }

  /**
   * Gera (ou atualiza) o aviso de amanha para cada profissional com horario marcado.
   * `remetenteId` nulo significa envio automatico do agendador da API ("sistema").
   */
  async avisarSobreAmanha(remetenteId: number | null): Promise<ResultadoAvisos> {
    const amanha = diaLocal(1)
    const depois = diaLocal(2)
    const todos = await this.agendamentos.listarPorPeriodo(
      `${amanha} 00:00:00`,
      `${depois} 00:00:00`
    )
    const ativos = todos.filter((a) => a.status === 'AGENDADO' || a.status === 'CONFIRMADO')

    const porProfissional = new Map<number, AgendamentoDetalhado[]>()
    for (const a of ativos) {
      const lista = porProfissional.get(a.profissionalId) ?? []
      lista.push(a)
      porProfissional.set(a.profissionalId, lista)
    }

    for (const [profissionalId, lista] of porProfissional) {
      await this.avisos.salvarDoDia({
        profissionalId,
        remetenteId,
        diaReferencia: amanha,
        totalAgendamentos: lista.length,
        mensagem: this.montarMensagem(amanha, lista)
      })
    }

    return {
      diaReferencia: amanha,
      profissionaisAvisados: porProfissional.size,
      totalAgendamentos: ativos.length
    }
  }

  /** Avisos de amanha ja enviados, para a recepcao acompanhar quem leu. */
  enviadosParaAmanha(): Promise<AvisoProfissional[]> {
    return this.avisos.listarDoDia(diaLocal(1))
  }

  meus(profissionalId: number): Promise<AvisoProfissional[]> {
    return this.avisos.listarDoProfissional(profissionalId)
  }

  /** So o destinatario pode marcar o proprio aviso como lido. */
  async marcarLido(id: number, profissionalId: number): Promise<AvisoProfissional> {
    const aviso = await this.avisos.obrigatorio(id)
    if (aviso.profissionalId !== profissionalId) throw new ForbiddenError()
    await this.avisos.marcarLido(id)
    return this.avisos.obrigatorio(id)
  }

  remover(id: number): Promise<void> {
    return this.avisos.remover(id)
  }
}
