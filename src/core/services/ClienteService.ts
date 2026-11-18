import { ClienteRepository } from '../repositories/ClienteRepository.js'
import { EnderecoRepository } from '../repositories/EnderecoRepository.js'
import { AtendimentoRepository, type ItemHistoricoCliente } from '../repositories/AtendimentoRepository.js'
import { AgendamentoRepository } from '../repositories/AgendamentoRepository.js'
import { ViaCepClient, type EnderecoViaCep } from '../integrations/ViaCepClient.js'
import { clienteSchema, clienteUpdateSchema } from '../../shared/validacao.js'
import { validar } from '../validacaoUtil.js'
import { ConflictError } from '../errors.js'
import type { AgendamentoDetalhado, Cliente, Endereco } from '../../shared/tipos.js'

export interface ClienteComEndereco extends Cliente {
  endereco: Endereco | null
}

export interface FichaCliente {
  cliente: ClienteComEndereco
  historico: ItemHistoricoCliente[]
  proximosAgendamentos: AgendamentoDetalhado[]
  totalGasto: number
  ultimoAtendimentoEm: string | null
}

export class ClienteService {
  constructor(
    private readonly clientes = new ClienteRepository(),
    private readonly enderecos = new EnderecoRepository(),
    private readonly atendimentos = new AtendimentoRepository(),
    private readonly agendamentos = new AgendamentoRepository(),
    private readonly viaCep = new ViaCepClient()
  ) {}

  /** Autopreenchimento pedido pelo cliente: digita o CEP, o resto vem da ViaCEP. */
  async consultarCep(cep: string): Promise<EnderecoViaCep> {
    return this.viaCep.buscar(cep)
  }

  async listar(apenasAtivos = true): Promise<Cliente[]> {
    return this.clientes.listar(apenasAtivos)
  }

  async buscar(termo: string): Promise<Cliente[]> {
    const limpo = termo.trim()
    if (limpo.length < 2) return []
    return this.clientes.buscar(limpo)
  }

  async obter(id: number): Promise<ClienteComEndereco> {
    const cliente = await this.clientes.obrigatorio(id)
    const endereco = cliente.enderecoId ? await this.enderecos.buscarPorId(cliente.enderecoId) : null
    return { ...cliente, endereco }
  }

  async criar(entrada: unknown): Promise<ClienteComEndereco> {
    const dados = validar(clienteSchema, entrada, 'Cliente')

    if (dados.cpf && (await this.clientes.cpfEmUso(dados.cpf))) {
      throw new ConflictError('Ja existe um cliente cadastrado com esse CPF.')
    }

    const endereco = dados.endereco ? await this.enderecos.criar(dados.endereco) : null
    const cliente = await this.clientes.criar({
      nome: dados.nome,
      cpf: dados.cpf,
      email: dados.email,
      telefone: dados.telefone,
      dataNascimento: dados.dataNascimento,
      enderecoId: endereco?.id ?? null,
      alergias: dados.alergias,
      observacoesSaude: dados.observacoesSaude,
      ativo: dados.ativo
    })
    return { ...cliente, endereco }
  }

  async atualizar(id: number, entrada: unknown): Promise<ClienteComEndereco> {
    const dados = validar(clienteUpdateSchema, entrada, 'Cliente')
    const atual = await this.clientes.obrigatorio(id)

    if (dados.cpf && (await this.clientes.cpfEmUso(dados.cpf, id))) {
      throw new ConflictError('Ja existe um cliente cadastrado com esse CPF.')
    }

    let enderecoId = atual.enderecoId
    if (dados.endereco) {
      const endereco = enderecoId
        ? await this.enderecos.atualizar(enderecoId, dados.endereco)
        : await this.enderecos.criar(dados.endereco)
      enderecoId = endereco.id
    }

    await this.clientes.atualizar(id, {
      nome: dados.nome,
      cpf: dados.cpf,
      email: dados.email,
      telefone: dados.telefone,
      data_nascimento: dados.dataNascimento,
      endereco_id: enderecoId,
      alergias: dados.alergias,
      observacoes_saude: dados.observacoesSaude,
      ativo: dados.ativo
    })
    return this.obter(id)
  }

  /**
   * Cliente com historico nao e apagado de verdade: a exclusao vira desativacao,
   * senao o estudio perderia o registro de procedimentos ja realizados.
   */
  async remover(id: number): Promise<{ removido: boolean; desativado: boolean }> {
    if (await this.clientes.temAgendamentos(id)) {
      await this.clientes.desativar(id)
      return { removido: false, desativado: true }
    }
    const cliente = await this.clientes.obrigatorio(id)
    await this.clientes.remover(id)
    if (cliente.enderecoId) await this.enderecos.remover(cliente.enderecoId).catch(() => undefined)
    return { removido: true, desativado: false }
  }

  /** Ficha completa: o "historico do cliente" que o dono disse que mais faz falta hoje. */
  async ficha(id: number): Promise<FichaCliente> {
    const cliente = await this.obter(id)
    const historico = await this.atendimentos.historicoDoCliente(id)
    const agenda = await this.agendamentos.listarPorCliente(id)
    const agora = new Date().toISOString().slice(0, 16)

    return {
      cliente,
      historico,
      proximosAgendamentos: agenda.filter(
        (a) => a.inicio >= agora && (a.status === 'AGENDADO' || a.status === 'CONFIRMADO')
      ),
      totalGasto: historico.reduce((soma, item) => soma + item.valorCobrado, 0),
      ultimoAtendimentoEm: historico[0]?.realizadoEm ?? null
    }
  }
}
