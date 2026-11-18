import { Database } from '../database/Database.js'
import { AtendimentoRepository } from '../repositories/AtendimentoRepository.js'
import { AgendamentoRepository } from '../repositories/AgendamentoRepository.js'
import { ProcedimentoRepository } from '../repositories/ProcedimentoRepository.js'
import { MaterialRepository } from '../repositories/MaterialRepository.js'
import { atendimentoSchema } from '../../shared/validacao.js'
import { validar } from '../validacaoUtil.js'
import { ConflictError } from '../errors.js'
import type { Atendimento, Material } from '../../shared/tipos.js'

export interface ResultadoAtendimento {
  atendimento: Atendimento
  materiaisBaixados: Array<{ materialId: number; nome: string; quantidade: number }>
  alertasEstoque: Material[]
  dataRetornoSugerida: string | null
}

export class AtendimentoService {
  constructor(
    private readonly db = Database.getInstance(),
    private readonly atendimentos = new AtendimentoRepository(),
    private readonly agendamentos = new AgendamentoRepository(),
    private readonly procedimentos = new ProcedimentoRepository(),
    private readonly materiais = new MaterialRepository()
  ) {}

  /**
   * Fecha o atendimento em uma unica transacao:
   * grava o historico, marca o agendamento como REALIZADO, baixa o estoque dos
   * materiais consumidos e calcula a data de retorno sugerida do procedimento.
   */
  async registrar(entrada: unknown, usuarioId: number): Promise<ResultadoAtendimento> {
    const dados = validar(atendimentoSchema, entrada, 'Atendimento')

    const agendamento = await this.agendamentos.obrigatorio(dados.agendamentoId)
    if (agendamento.status === 'CANCELADO') {
      throw new ConflictError('Nao e possivel registrar atendimento de agendamento cancelado.')
    }
    if (await this.atendimentos.buscarPorAgendamento(dados.agendamentoId)) {
      throw new ConflictError('Esse agendamento ja tem atendimento registrado.')
    }

    const procedimento = await this.procedimentos.obrigatorio(agendamento.procedimentoId)
    const dataRetornoSugerida = procedimento.diasRetornoSugerido
      ? new Date(Date.now() + procedimento.diasRetornoSugerido * 86_400_000)
          .toISOString()
          .slice(0, 10)
      : null

    // Sem lista explicita, consome o que a ficha tecnica do procedimento define.
    const padrao = await this.procedimentos.listarMateriais(procedimento.id)
    const consumo =
      dados.materiaisConsumidos.length > 0
        ? dados.materiaisConsumidos
        : padrao.map((m) => ({ materialId: m.materialId, quantidade: m.quantidadePadrao }))

    const atendimentoId = await this.db.transaction(async (conn) => {
      const novoId = await this.atendimentos.criarNaTransacao(conn, {
        agendamentoId: dados.agendamentoId,
        valorCobrado: dados.valorCobrado,
        formaPagamento: dados.formaPagamento,
        anotacoesTecnicas: dados.anotacoesTecnicas ?? null,
        dataRetornoSugerida
      })

      for (const item of consumo) {
        await this.materiais.movimentar(conn, {
          materialId: item.materialId,
          tipo: 'SAIDA',
          quantidade: item.quantidade,
          atendimentoId: novoId,
          usuarioId,
          observacao: `Consumo automatico: ${procedimento.nome}`
        })
      }

      await conn.execute("UPDATE agendamento SET status = 'REALIZADO' WHERE id = ?", [
        dados.agendamentoId
      ])

      return novoId
    })

    const nomes = new Map(padrao.map((m) => [m.materialId, m.materialNome]))
    const abaixoDoMinimo = await this.materiais.abaixoDoMinimo()
    const idsConsumidos = new Set(consumo.map((c) => c.materialId))

    return {
      atendimento: await this.atendimentos.obrigatorio(atendimentoId),
      materiaisBaixados: consumo.map((c) => ({
        materialId: c.materialId,
        nome: nomes.get(c.materialId) ?? `Material ${c.materialId}`,
        quantidade: c.quantidade
      })),
      alertasEstoque: abaixoDoMinimo.filter((m) => idsConsumidos.has(m.id)),
      dataRetornoSugerida
    }
  }

  async obter(id: number): Promise<Atendimento> {
    return this.atendimentos.obrigatorio(id)
  }

  async listar(): Promise<Atendimento[]> {
    return this.atendimentos.listar()
  }

  async atualizar(
    id: number,
    dados: {
      valorCobrado?: number
      formaPagamento?: Atendimento['formaPagamento']
      anotacoesTecnicas?: string | null
      dataRetornoSugerida?: string | null
    }
  ): Promise<Atendimento> {
    await this.atendimentos.obrigatorio(id)
    return this.atendimentos.atualizar(id, {
      valor_cobrado: dados.valorCobrado,
      forma_pagamento: dados.formaPagamento,
      anotacoes_tecnicas: dados.anotacoesTecnicas,
      data_retorno_sugerida: dados.dataRetornoSugerida
    })
  }

  /**
   * Estornar um atendimento devolve ao estoque o que foi baixado e reabre o agendamento.
   * Sem isso, um erro de digitacao deixaria o estoque permanentemente errado.
   */
  async estornar(id: number, usuarioId: number): Promise<void> {
    const atendimento = await this.atendimentos.obrigatorio(id)
    const movimentacoes = await this.db.query<never>(
      'SELECT material_id, quantidade FROM movimentacao_estoque WHERE atendimento_id = ? AND tipo = ?',
      [id, 'SAIDA']
    )

    await this.db.transaction(async (conn) => {
      for (const mov of movimentacoes as Array<{ material_id: number; quantidade: string }>) {
        await this.materiais.movimentar(conn, {
          materialId: mov.material_id,
          tipo: 'ENTRADA',
          quantidade: Number(mov.quantidade),
          usuarioId,
          observacao: `Estorno do atendimento ${id}`
        })
      }
      await conn.execute('DELETE FROM atendimento WHERE id = ?', [id])
      await conn.execute("UPDATE agendamento SET status = 'AGENDADO' WHERE id = ?", [
        atendimento.agendamentoId
      ])
    })
  }

  async historicoDoCliente(clienteId: number) {
    return this.atendimentos.historicoDoCliente(clienteId)
  }

  async retornosPendentes() {
    return this.atendimentos.retornosPendentes()
  }
}
