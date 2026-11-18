import type { RowDataPacket } from 'mysql2/promise'
import { BaseRepository } from './BaseRepository.js'
import type { Agendamento, AgendamentoDetalhado, StatusAgendamento } from '../../shared/tipos.js'

function dataHora(valor: unknown): string {
  if (valor instanceof Date) {
    const pad = (n: number): string => String(n).padStart(2, '0')
    return `${valor.getFullYear()}-${pad(valor.getMonth() + 1)}-${pad(valor.getDate())}T${pad(valor.getHours())}:${pad(valor.getMinutes())}`
  }
  return String(valor ?? '')
}

export class AgendamentoRepository extends BaseRepository<Agendamento> {
  protected readonly tabela = 'agendamento'
  protected readonly rotulo = 'Agendamento'

  protected mapear(linha: RowDataPacket): Agendamento {
    return {
      id: linha.id,
      clienteId: linha.cliente_id,
      profissionalId: linha.profissional_id,
      procedimentoId: linha.procedimento_id,
      inicio: dataHora(linha.inicio),
      fim: dataHora(linha.fim),
      status: linha.status,
      observacoes: linha.observacoes,
      lembreteEnviadoEm: linha.lembrete_enviado_em ? dataHora(linha.lembrete_enviado_em) : null
    }
  }

  private mapearDetalhado(linha: RowDataPacket): AgendamentoDetalhado {
    return {
      ...this.mapear(linha),
      clienteNome: linha.cliente_nome,
      clienteEmail: linha.cliente_email,
      profissionalNome: linha.profissional_nome,
      procedimentoNome: linha.procedimento_nome
    }
  }

  private readonly selectDetalhado = `
    SELECT a.*,
           c.nome  AS cliente_nome,
           c.email AS cliente_email,
           u.nome  AS profissional_nome,
           pr.nome AS procedimento_nome
    FROM agendamento a
    JOIN cliente c       ON c.id = a.cliente_id
    JOIN profissional p  ON p.id = a.profissional_id
    JOIN usuario u       ON u.id = p.usuario_id
    JOIN procedimento pr ON pr.id = a.procedimento_id`

  override async buscarPorId(id: number): Promise<Agendamento | null> {
    const linha = await this.db.queryOne<RowDataPacket>(
      'SELECT * FROM agendamento WHERE id = ?',
      [id]
    )
    return linha ? this.mapear(linha) : null
  }

  async detalhar(id: number): Promise<AgendamentoDetalhado | null> {
    const linha = await this.db.queryOne<RowDataPacket>(`${this.selectDetalhado} WHERE a.id = ?`, [
      id
    ])
    return linha ? this.mapearDetalhado(linha) : null
  }

  async criar(dados: {
    clienteId: number
    profissionalId: number
    procedimentoId: number
    inicio: string
    fim: string
    observacoes?: string | null
  }): Promise<Agendamento> {
    const resultado = await this.db.execute(
      `INSERT INTO agendamento (cliente_id, profissional_id, procedimento_id, inicio, fim, observacoes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        dados.clienteId,
        dados.profissionalId,
        dados.procedimentoId,
        dados.inicio,
        dados.fim,
        dados.observacoes ?? null
      ]
    )
    return this.obrigatorio(resultado.insertId)
  }

  async atualizar(
    id: number,
    dados: Partial<{
      profissional_id: number
      procedimento_id: number
      inicio: string
      fim: string
      status: StatusAgendamento
      observacoes: string | null
    }>
  ): Promise<Agendamento> {
    const { sql, valores } = this.montarUpdate(dados)
    if (sql) await this.db.execute(`UPDATE agendamento SET ${sql} WHERE id = ?`, [...valores, id])
    return this.obrigatorio(id)
  }

  /**
   * Procura um agendamento do mesmo profissional cujo intervalo invada o periodo informado.
   * Cancelados e faltas nao bloqueiam o horario.
   */
  async conflito(
    profissionalId: number,
    inicio: string,
    fim: string,
    ignorarId?: number
  ): Promise<Agendamento | null> {
    const linha = await this.db.queryOne<RowDataPacket>(
      `SELECT * FROM agendamento
       WHERE profissional_id = ?
         AND status NOT IN ('CANCELADO', 'FALTOU')
         AND id <> ?
         AND inicio < ?
         AND fim > ?
       LIMIT 1`,
      [profissionalId, ignorarId ?? 0, fim, inicio]
    )
    return linha ? this.mapear(linha) : null
  }

  async listarPorPeriodo(
    inicio: string,
    fim: string,
    profissionalId?: number
  ): Promise<AgendamentoDetalhado[]> {
    const filtroProfissional = profissionalId ? ' AND a.profissional_id = ?' : ''
    const params: unknown[] = [inicio, fim]
    if (profissionalId) params.push(profissionalId)

    const linhas = await this.db.query<RowDataPacket>(
      `${this.selectDetalhado} WHERE a.inicio >= ? AND a.inicio < ?${filtroProfissional} ORDER BY a.inicio`,
      params
    )
    return linhas.map((l) => this.mapearDetalhado(l))
  }

  async listarPorCliente(clienteId: number): Promise<AgendamentoDetalhado[]> {
    const linhas = await this.db.query<RowDataPacket>(
      `${this.selectDetalhado} WHERE a.cliente_id = ? ORDER BY a.inicio DESC`,
      [clienteId]
    )
    return linhas.map((l) => this.mapearDetalhado(l))
  }

  /** Agendamentos que acontecem na janela informada e ainda nao receberam o lembrete. */
  async pendentesDeLembrete(de: string, ate: string): Promise<AgendamentoDetalhado[]> {
    const linhas = await this.db.query<RowDataPacket>(
      `${this.selectDetalhado}
       WHERE a.status IN ('AGENDADO', 'CONFIRMADO')
         AND a.lembrete_enviado_em IS NULL
         AND a.inicio >= ? AND a.inicio < ?
         AND c.email IS NOT NULL AND c.email <> ''
       ORDER BY a.inicio`,
      [de, ate]
    )
    return linhas.map((l) => this.mapearDetalhado(l))
  }

  async marcarLembreteEnviado(id: number): Promise<void> {
    await this.db.execute('UPDATE agendamento SET lembrete_enviado_em = NOW() WHERE id = ?', [id])
  }

  async temAtendimento(id: number): Promise<boolean> {
    const linha = await this.db.queryOne<RowDataPacket>(
      'SELECT 1 AS existe FROM atendimento WHERE agendamento_id = ? LIMIT 1',
      [id]
    )
    return linha !== null
  }
}
