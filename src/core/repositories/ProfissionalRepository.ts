import type { RowDataPacket } from 'mysql2/promise'
import { BaseRepository } from './BaseRepository.js'
import type { Procedimento, Profissional } from '../../shared/tipos.js'
import type { ProfissionalInput } from '../../shared/validacao.js'

export interface ProcedimentoHabilitado extends Procedimento {
  precoPraticado: number | null
}

export class ProfissionalRepository extends BaseRepository<Profissional> {
  protected readonly tabela = 'profissional'
  protected readonly rotulo = 'Profissional'

  protected mapear(linha: RowDataPacket): Profissional {
    return {
      id: linha.id,
      usuarioId: linha.usuario_id,
      nome: linha.nome ?? '',
      email: linha.email ?? '',
      registroConselho: linha.registro_conselho,
      comissaoPercentual: Number(linha.comissao_percentual),
      bio: linha.bio,
      ativo: Boolean(linha.ativo)
    }
  }

  private readonly selectComUsuario = `
    SELECT p.*, u.nome, u.email
    FROM profissional p
    JOIN usuario u ON u.id = p.usuario_id`

  override async listar(apenasAtivos = false): Promise<Profissional[]> {
    const filtro = apenasAtivos ? ' WHERE p.ativo = TRUE AND u.ativo = TRUE' : ''
    const linhas = await this.db.query<RowDataPacket>(
      `${this.selectComUsuario}${filtro} ORDER BY u.nome`
    )
    return linhas.map((l) => this.mapear(l))
  }

  override async buscarPorId(id: number): Promise<Profissional | null> {
    const linha = await this.db.queryOne<RowDataPacket>(`${this.selectComUsuario} WHERE p.id = ?`, [
      id
    ])
    return linha ? this.mapear(linha) : null
  }

  async buscarPorUsuarioId(usuarioId: number): Promise<Profissional | null> {
    const linha = await this.db.queryOne<RowDataPacket>(
      `${this.selectComUsuario} WHERE p.usuario_id = ?`,
      [usuarioId]
    )
    return linha ? this.mapear(linha) : null
  }

  async criar(dados: ProfissionalInput): Promise<Profissional> {
    const resultado = await this.db.execute(
      `INSERT INTO profissional (usuario_id, registro_conselho, comissao_percentual, bio, ativo)
       VALUES (?, ?, ?, ?, ?)`,
      [
        dados.usuarioId,
        dados.registroConselho ?? null,
        dados.comissaoPercentual,
        dados.bio ?? null,
        dados.ativo
      ]
    )
    return this.obrigatorio(resultado.insertId)
  }

  async atualizar(id: number, dados: Partial<ProfissionalInput>): Promise<Profissional> {
    const { sql, valores } = this.montarUpdate({
      registro_conselho: dados.registroConselho,
      comissao_percentual: dados.comissaoPercentual,
      bio: dados.bio,
      ativo: dados.ativo
    })
    if (sql) await this.db.execute(`UPDATE profissional SET ${sql} WHERE id = ?`, [...valores, id])
    return this.obrigatorio(id)
  }

  async listarProcedimentos(profissionalId: number): Promise<ProcedimentoHabilitado[]> {
    const linhas = await this.db.query<RowDataPacket>(
      `SELECT pr.*, pp.preco_praticado
       FROM profissional_procedimento pp
       JOIN procedimento pr ON pr.id = pp.procedimento_id
       WHERE pp.profissional_id = ?
       ORDER BY pr.nome`,
      [profissionalId]
    )
    return linhas.map((l) => ({
      id: l.id,
      nome: l.nome,
      categoria: l.categoria,
      descricao: l.descricao,
      duracaoMinutos: l.duracao_minutos,
      precoBase: Number(l.preco_base),
      diasRetornoSugerido: l.dias_retorno_sugerido,
      ativo: Boolean(l.ativo),
      precoPraticado: l.preco_praticado === null ? null : Number(l.preco_praticado)
    }))
  }

  async vincularProcedimento(
    profissionalId: number,
    procedimentoId: number,
    precoPraticado: number | null
  ): Promise<void> {
    await this.db.execute(
      `INSERT INTO profissional_procedimento (profissional_id, procedimento_id, preco_praticado)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE preco_praticado = VALUES(preco_praticado)`,
      [profissionalId, procedimentoId, precoPraticado]
    )
  }

  async desvincularProcedimento(profissionalId: number, procedimentoId: number): Promise<void> {
    await this.db.execute(
      'DELETE FROM profissional_procedimento WHERE profissional_id = ? AND procedimento_id = ?',
      [profissionalId, procedimentoId]
    )
  }

  async habilitadoPara(profissionalId: number, procedimentoId: number): Promise<boolean> {
    const linha = await this.db.queryOne<RowDataPacket>(
      'SELECT 1 AS existe FROM profissional_procedimento WHERE profissional_id = ? AND procedimento_id = ?',
      [profissionalId, procedimentoId]
    )
    return linha !== null
  }

  async temAgendamentos(id: number): Promise<boolean> {
    const linha = await this.db.queryOne<RowDataPacket>(
      'SELECT 1 AS existe FROM agendamento WHERE profissional_id = ? LIMIT 1',
      [id]
    )
    return linha !== null
  }
}
