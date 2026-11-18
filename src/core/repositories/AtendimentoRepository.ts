import type { PoolConnection, RowDataPacket } from 'mysql2/promise'
import { BaseRepository } from './BaseRepository.js'
import type { Atendimento, FormaPagamento } from '../../shared/tipos.js'

function dataIso(valor: unknown): string | null {
  if (!valor) return null
  return valor instanceof Date ? valor.toISOString().slice(0, 10) : String(valor).slice(0, 10)
}

export interface ItemHistoricoCliente {
  atendimentoId: number
  agendamentoId: number
  procedimentoNome: string
  profissionalNome: string
  realizadoEm: string
  valorCobrado: number
  anotacoesTecnicas: string | null
  dataRetornoSugerida: string | null
  retornoVencido: boolean
}

export class AtendimentoRepository extends BaseRepository<Atendimento> {
  protected readonly tabela = 'atendimento'
  protected readonly rotulo = 'Atendimento'

  protected mapear(linha: RowDataPacket): Atendimento {
    return {
      id: linha.id,
      agendamentoId: linha.agendamento_id,
      realizadoEm:
        linha.realizado_em instanceof Date
          ? linha.realizado_em.toISOString()
          : String(linha.realizado_em),
      valorCobrado: Number(linha.valor_cobrado),
      formaPagamento: linha.forma_pagamento,
      anotacoesTecnicas: linha.anotacoes_tecnicas,
      dataRetornoSugerida: dataIso(linha.data_retorno_sugerida)
    }
  }

  async criarNaTransacao(
    conn: PoolConnection,
    dados: {
      agendamentoId: number
      valorCobrado: number
      formaPagamento: FormaPagamento
      anotacoesTecnicas: string | null
      dataRetornoSugerida: string | null
    }
  ): Promise<number> {
    const [resultado] = await conn.execute(
      `INSERT INTO atendimento
         (agendamento_id, realizado_em, valor_cobrado, forma_pagamento, anotacoes_tecnicas, data_retorno_sugerida)
       VALUES (?, NOW(), ?, ?, ?, ?)`,
      [
        dados.agendamentoId,
        dados.valorCobrado,
        dados.formaPagamento,
        dados.anotacoesTecnicas,
        dados.dataRetornoSugerida
      ]
    )
    return (resultado as { insertId: number }).insertId
  }

  async atualizar(
    id: number,
    dados: Partial<{
      valor_cobrado: number
      forma_pagamento: FormaPagamento
      anotacoes_tecnicas: string | null
      data_retorno_sugerida: string | null
    }>
  ): Promise<Atendimento> {
    const { sql, valores } = this.montarUpdate(dados)
    if (sql) await this.db.execute(`UPDATE atendimento SET ${sql} WHERE id = ?`, [...valores, id])
    return this.obrigatorio(id)
  }

  async buscarPorAgendamento(agendamentoId: number): Promise<Atendimento | null> {
    const linha = await this.db.queryOne<RowDataPacket>(
      'SELECT * FROM atendimento WHERE agendamento_id = ?',
      [agendamentoId]
    )
    return linha ? this.mapear(linha) : null
  }

  /** Linha do tempo do cliente: o que fez, com quem, quando e se o retorno ja venceu. */
  async historicoDoCliente(clienteId: number): Promise<ItemHistoricoCliente[]> {
    const linhas = await this.db.query<RowDataPacket>(
      `SELECT at.id, at.agendamento_id, at.realizado_em, at.valor_cobrado,
              at.anotacoes_tecnicas, at.data_retorno_sugerida,
              pr.nome AS procedimento_nome,
              u.nome  AS profissional_nome
       FROM atendimento at
       JOIN agendamento a   ON a.id = at.agendamento_id
       JOIN procedimento pr ON pr.id = a.procedimento_id
       JOIN profissional p  ON p.id = a.profissional_id
       JOIN usuario u       ON u.id = p.usuario_id
       WHERE a.cliente_id = ?
       ORDER BY at.realizado_em DESC`,
      [clienteId]
    )

    const hoje = new Date().toISOString().slice(0, 10)
    return linhas.map((l) => {
      const retorno = dataIso(l.data_retorno_sugerida)
      return {
        atendimentoId: l.id,
        agendamentoId: l.agendamento_id,
        procedimentoNome: l.procedimento_nome,
        profissionalNome: l.profissional_nome,
        realizadoEm:
          l.realizado_em instanceof Date ? l.realizado_em.toISOString() : String(l.realizado_em),
        valorCobrado: Number(l.valor_cobrado),
        anotacoesTecnicas: l.anotacoes_tecnicas,
        dataRetornoSugerida: retorno,
        retornoVencido: retorno !== null && retorno <= hoje
      }
    })
  }

  /** Clientes cujo retorno sugerido ja passou e que nao tem novo agendamento futuro. */
  async retornosPendentes(): Promise<
    Array<{
      clienteId: number
      clienteNome: string
      clienteEmail: string | null
      procedimentoNome: string
      dataRetornoSugerida: string
      diasAtraso: number
    }>
  > {
    const linhas = await this.db.query<RowDataPacket>(
      `SELECT c.id AS cliente_id, c.nome AS cliente_nome, c.email AS cliente_email,
              pr.nome AS procedimento_nome, at.data_retorno_sugerida,
              DATEDIFF(CURDATE(), at.data_retorno_sugerida) AS dias_atraso
       FROM atendimento at
       JOIN agendamento a   ON a.id = at.agendamento_id
       JOIN cliente c       ON c.id = a.cliente_id
       JOIN procedimento pr ON pr.id = a.procedimento_id
       WHERE at.data_retorno_sugerida IS NOT NULL
         AND at.data_retorno_sugerida <= CURDATE()
         AND c.ativo = TRUE
         AND NOT EXISTS (
           SELECT 1 FROM agendamento fut
           WHERE fut.cliente_id = c.id
             AND fut.inicio > NOW()
             AND fut.status IN ('AGENDADO', 'CONFIRMADO')
         )
       ORDER BY dias_atraso DESC`
    )
    return linhas.map((l) => ({
      clienteId: l.cliente_id,
      clienteNome: l.cliente_nome,
      clienteEmail: l.cliente_email,
      procedimentoNome: l.procedimento_nome,
      dataRetornoSugerida: dataIso(l.data_retorno_sugerida)!,
      diasAtraso: Number(l.dias_atraso)
    }))
  }

  async faturamentoPorPeriodo(
    inicio: string,
    fim: string
  ): Promise<Array<{ profissionalNome: string; totalAtendimentos: number; totalFaturado: number }>> {
    const linhas = await this.db.query<RowDataPacket>(
      `SELECT u.nome AS profissional_nome,
              COUNT(*) AS total_atendimentos,
              SUM(at.valor_cobrado) AS total_faturado
       FROM atendimento at
       JOIN agendamento a  ON a.id = at.agendamento_id
       JOIN profissional p ON p.id = a.profissional_id
       JOIN usuario u      ON u.id = p.usuario_id
       WHERE at.realizado_em >= ? AND at.realizado_em < ?
       GROUP BY u.id, u.nome
       ORDER BY total_faturado DESC`,
      [inicio, fim]
    )
    return linhas.map((l) => ({
      profissionalNome: l.profissional_nome,
      totalAtendimentos: Number(l.total_atendimentos),
      totalFaturado: Number(l.total_faturado)
    }))
  }
}
