import type { RowDataPacket } from 'mysql2/promise'
import { BaseRepository } from './BaseRepository.js'
import type { Procedimento } from '../../shared/tipos.js'
import type { ProcedimentoInput } from '../../shared/validacao.js'

export interface MaterialDoProcedimento {
  materialId: number
  materialNome: string
  unidade: string
  quantidadePadrao: number
  estoqueAtual: number
}

export class ProcedimentoRepository extends BaseRepository<Procedimento> {
  protected readonly tabela = 'procedimento'
  protected readonly rotulo = 'Procedimento'

  protected mapear(linha: RowDataPacket): Procedimento {
    return {
      id: linha.id,
      nome: linha.nome,
      categoria: linha.categoria,
      descricao: linha.descricao,
      duracaoMinutos: linha.duracao_minutos,
      precoBase: Number(linha.preco_base),
      diasRetornoSugerido: linha.dias_retorno_sugerido,
      ativo: Boolean(linha.ativo)
    }
  }

  async criar(dados: ProcedimentoInput): Promise<Procedimento> {
    const resultado = await this.db.execute(
      `INSERT INTO procedimento (nome, categoria, descricao, duracao_minutos, preco_base, dias_retorno_sugerido, ativo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        dados.nome,
        dados.categoria,
        dados.descricao ?? null,
        dados.duracaoMinutos,
        dados.precoBase,
        dados.diasRetornoSugerido ?? null,
        dados.ativo
      ]
    )
    return this.obrigatorio(resultado.insertId)
  }

  async atualizar(id: number, dados: Partial<ProcedimentoInput>): Promise<Procedimento> {
    const { sql, valores } = this.montarUpdate({
      nome: dados.nome,
      categoria: dados.categoria,
      descricao: dados.descricao,
      duracao_minutos: dados.duracaoMinutos,
      preco_base: dados.precoBase,
      dias_retorno_sugerido: dados.diasRetornoSugerido,
      ativo: dados.ativo
    })
    if (sql) await this.db.execute(`UPDATE procedimento SET ${sql} WHERE id = ?`, [...valores, id])
    return this.obrigatorio(id)
  }

  async listarMateriais(procedimentoId: number): Promise<MaterialDoProcedimento[]> {
    const linhas = await this.db.query<RowDataPacket>(
      `SELECT pm.material_id, pm.quantidade_padrao, m.nome, m.unidade, m.estoque_atual
       FROM procedimento_material pm
       JOIN material m ON m.id = pm.material_id
       WHERE pm.procedimento_id = ?
       ORDER BY m.nome`,
      [procedimentoId]
    )
    return linhas.map((l) => ({
      materialId: l.material_id,
      materialNome: l.nome,
      unidade: l.unidade,
      quantidadePadrao: Number(l.quantidade_padrao),
      estoqueAtual: Number(l.estoque_atual)
    }))
  }

  async vincularMaterial(
    procedimentoId: number,
    materialId: number,
    quantidadePadrao: number
  ): Promise<void> {
    await this.db.execute(
      `INSERT INTO procedimento_material (procedimento_id, material_id, quantidade_padrao)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantidade_padrao = VALUES(quantidade_padrao)`,
      [procedimentoId, materialId, quantidadePadrao]
    )
  }

  async desvincularMaterial(procedimentoId: number, materialId: number): Promise<void> {
    await this.db.execute(
      'DELETE FROM procedimento_material WHERE procedimento_id = ? AND material_id = ?',
      [procedimentoId, materialId]
    )
  }

  async temAgendamentos(id: number): Promise<boolean> {
    const linha = await this.db.queryOne<RowDataPacket>(
      'SELECT 1 AS existe FROM agendamento WHERE procedimento_id = ? LIMIT 1',
      [id]
    )
    return linha !== null
  }
}
