import { AgendamentoRepository } from '../repositories/AgendamentoRepository.js'
import { ProcedimentoRepository } from '../repositories/ProcedimentoRepository.js'
import { ProfissionalRepository } from '../repositories/ProfissionalRepository.js'
import { ClienteRepository } from '../repositories/ClienteRepository.js'
import { agendamentoSchema, agendamentoUpdateSchema } from '../../shared/validacao.js'
import { validar } from '../validacaoUtil.js'
import { ConflictError, NotFoundError, ValidationError } from '../errors.js'
import type { Agendamento, AgendamentoDetalhado } from '../../shared/tipos.js'

function somarMinutos(inicioLocal: string, minutos: number): string {
  const data = new Date(inicioLocal)
  data.setMinutes(data.getMinutes() + minutos)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}`
}

function paraMysql(dataLocal: string): string {
  return dataLocal.replace('T', ' ').slice(0, 19).padEnd(19, ':00').slice(0, 19)
}

export class AgendaService {
  constructor(
    private readonly agendamentos = new AgendamentoRepository(),
    private readonly procedimentos = new ProcedimentoRepository(),
    private readonly profissionais = new ProfissionalRepository(),
    private readonly clientes = new ClienteRepository()
  ) {}

  async listarPeriodo(
    inicio: string,
    fim: string,
    profissionalId?: number
  ): Promise<AgendamentoDetalhado[]> {
    return this.agendamentos.listarPorPeriodo(paraMysql(inicio), paraMysql(fim), profissionalId)
  }

  async obter(id: number): Promise<AgendamentoDetalhado> {
    const agendamento = await this.agendamentos.detalhar(id)
    if (!agendamento) throw new NotFoundError('Agendamento', id)
    return agendamento
  }

  /**
   * Regras de negocio do agendamento:
   * 1. o profissional precisa estar habilitado para o procedimento;
   * 2. o fim e calculado pela duracao do procedimento, nao digitado;
   * 3. o horario nao pode se sobrepor a outro agendamento ativo do mesmo profissional.
   */
  async agendar(entrada: unknown): Promise<Agendamento> {
    const dados = validar(agendamentoSchema, entrada, 'Agendamento')

    const procedimento = await this.procedimentos.obrigatorio(dados.procedimentoId)
    if (!procedimento.ativo) throw new ValidationError('Procedimento inativo.')

    const profissional = await this.profissionais.obrigatorio(dados.profissionalId)
    if (!profissional.ativo) throw new ValidationError('Profissional inativo.')

    const cliente = await this.clientes.obrigatorio(dados.clienteId)
    if (!cliente.ativo) throw new ValidationError('Cliente inativo.')

    if (!(await this.profissionais.habilitadoPara(dados.profissionalId, dados.procedimentoId))) {
      throw new ValidationError(
        `${profissional.nome} nao esta habilitado(a) para "${procedimento.nome}".`
      )
    }

    const fim = somarMinutos(dados.inicio, procedimento.duracaoMinutos)
    await this.garantirHorarioLivre(dados.profissionalId, dados.inicio, fim)

    return this.agendamentos.criar({
      clienteId: dados.clienteId,
      profissionalId: dados.profissionalId,
      procedimentoId: dados.procedimentoId,
      inicio: paraMysql(dados.inicio),
      fim: paraMysql(fim),
      observacoes: dados.observacoes
    })
  }

  async atualizar(id: number, entrada: unknown): Promise<Agendamento> {
    const dados = validar(agendamentoUpdateSchema, entrada, 'Agendamento')
    const atual = await this.agendamentos.obrigatorio(id)

    if (atual.status === 'REALIZADO' && dados.status !== 'REALIZADO') {
      throw new ConflictError('Agendamento ja realizado nao pode ser reaberto.')
    }

    const profissionalId = dados.profissionalId ?? atual.profissionalId
    const procedimentoId = dados.procedimentoId ?? atual.procedimentoId
    const inicio = dados.inicio ?? atual.inicio

    const mudouHorario =
      dados.inicio !== undefined ||
      dados.profissionalId !== undefined ||
      dados.procedimentoId !== undefined

    let fim = atual.fim
    if (mudouHorario) {
      const procedimento = await this.procedimentos.obrigatorio(procedimentoId)
      if (!(await this.profissionais.habilitadoPara(profissionalId, procedimentoId))) {
        throw new ValidationError('Profissional nao habilitado para esse procedimento.')
      }
      fim = somarMinutos(inicio, procedimento.duracaoMinutos)
      await this.garantirHorarioLivre(profissionalId, inicio, fim, id)
    }

    return this.agendamentos.atualizar(id, {
      profissional_id: dados.profissionalId,
      procedimento_id: dados.procedimentoId,
      inicio: mudouHorario ? paraMysql(inicio) : undefined,
      fim: mudouHorario ? paraMysql(fim) : undefined,
      status: dados.status,
      observacoes: dados.observacoes
    })
  }

  async cancelar(id: number, motivo?: string): Promise<Agendamento> {
    const atual = await this.agendamentos.obrigatorio(id)
    if (atual.status === 'REALIZADO') {
      throw new ConflictError('Agendamento ja realizado nao pode ser cancelado.')
    }
    return this.agendamentos.atualizar(id, {
      status: 'CANCELADO',
      observacoes: motivo ? `${atual.observacoes ?? ''}\n[cancelado] ${motivo}`.trim() : undefined
    })
  }

  /** Exclusao real so para agendamento sem atendimento registrado; o resto vira cancelamento. */
  async remover(id: number): Promise<{ removido: boolean }> {
    if (await this.agendamentos.temAtendimento(id)) {
      throw new ConflictError(
        'Esse agendamento ja tem atendimento registrado e faz parte do historico do cliente. Cancele em vez de excluir.'
      )
    }
    await this.agendamentos.remover(id)
    return { removido: true }
  }

  /** Horarios livres de um profissional em um dia, respeitando a duracao do procedimento. */
  async horariosLivres(
    profissionalId: number,
    dia: string,
    procedimentoId: number,
    expediente = { inicio: 9, fim: 19 },
    passoMinutos = 30
  ): Promise<string[]> {
    const procedimento = await this.procedimentos.obrigatorio(procedimentoId)
    const ocupados = await this.agendamentos.listarPorPeriodo(
      `${dia} 00:00:00`,
      `${dia} 23:59:59`,
      profissionalId
    )
    const ativos = ocupados.filter((a) => a.status !== 'CANCELADO' && a.status !== 'FALTOU')

    const livres: string[] = []
    const agora = new Date()
    for (let minuto = expediente.inicio * 60; minuto < expediente.fim * 60; minuto += passoMinutos) {
      const hora = String(Math.floor(minuto / 60)).padStart(2, '0')
      const min = String(minuto % 60).padStart(2, '0')
      const inicio = `${dia}T${hora}:${min}`
      const fim = somarMinutos(inicio, procedimento.duracaoMinutos)

      if (fim.slice(11) > `${String(expediente.fim).padStart(2, '0')}:00`) continue
      if (new Date(inicio) < agora) continue
      if (ativos.some((a) => a.inicio < fim && a.fim > inicio)) continue

      livres.push(inicio)
    }
    return livres
  }

  private async garantirHorarioLivre(
    profissionalId: number,
    inicio: string,
    fim: string,
    ignorarId?: number
  ): Promise<void> {
    const conflito = await this.agendamentos.conflito(
      profissionalId,
      paraMysql(inicio),
      paraMysql(fim),
      ignorarId
    )
    if (conflito) {
      throw new ConflictError(
        `Esse profissional ja tem um atendimento das ${conflito.inicio.slice(11)} as ${conflito.fim.slice(11)}.`
      )
    }
  }
}
