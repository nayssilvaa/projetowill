import type { PoolConnection, RowDataPacket } from 'mysql2/promise'
import { BaseRepository } from './BaseRepository.js'
import type { Material, MovimentacaoEstoque, TipoMovimentacao } from '../../shared/tipos.js'
import type { MaterialInput } from '../../shared/validacao.js'

export class MaterialRepository extends BaseRepository<Material> {
  protected readonly tabela = 'material'
  protected readonly rotulo = 'Material'

  protected mapear(linha: RowDataPacket): Material {
    return {
      id: linha.id,
      nome: linha.nome,
      unidade: linha.unidade,
      importado: Boolean(linha.importado),
      precoUsd: linha.preco_usd === null ? null : Number(linha.preco_usd),
      estoqueAtual: Number(linha.estoque_atual),
      estoqueMinimo: Number(linha.estoque_minimo),
      ativo: Boolean(linha.ativo)
    }
  }

  async criar(dados: MaterialInput): Promise<Material> {
    const resultado = await this.db.execute(
      `INSERT INTO material (nome, unidade, importado, preco_usd, estoque_minimo, ativo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [dados.nome, dados.unidade, dados.importado, dados.precoUsd ?? null, dados.estoqueMinimo, dados.ativo]
    )
    return this.obrigatorio(resultado.insertId)
  }

  async atualizar(id: number, dados: Partial<MaterialInput>): Promise<Material> {
    const { sql, valores } = this.montarUpdate({
      nome: dados.nome,
      unidade: dados.unidade,
      importado: dados.importado,
      preco_usd: dados.precoUsd,
      estoque_minimo: dados.estoqueMinimo,
      ativo: dados.ativo
    })
    if (sql) await this.db.execute(`UPDATE material SET ${sql} WHERE id = ?`, [...valores, id])
    return this.obrigatorio(id)
  }

  async abaixoDoMinimo(): Promise<Material[]> {
    const linhas = await this.db.query<RowDataPacket>(
      `SELECT * FROM material
       WHERE ativo = TRUE AND estoque_minimo > 0 AND estoque_atual <= estoque_minimo
       ORDER BY (estoque_atual / NULLIF(estoque_minimo, 0)) ASC`
    )
    return linhas.map((l) => this.mapear(l))
  }

  async listarImportados(): Promise<Material[]> {
    const linhas = await this.db.query<RowDataPacket>(
      'SELECT * FROM material WHERE importado = TRUE AND ativo = TRUE ORDER BY nome'
    )
    return linhas.map((l) => this.mapear(l))
  }

  /**
   * Aplica a variacao no estoque e grava a movimentacao, dentro da transacao recebida.
   * Entradas somam; saidas e perdas subtraem; ajuste grava o valor absoluto informado.
   */
  async movimentar(
    conn: PoolConnection,
    dados: {
      materialId: number
      tipo: TipoMovimentacao
      quantidade: number
      custoUnitarioBrl?: number | null
      cotacaoDolarId?: number | null
      atendimentoId?: number | null
      usuarioId?: number | null
      observacao?: string | null
    }
  ): Promise<number> {
    const expressao =
      dados.tipo === 'ENTRADA'
        ? 'estoque_atual + ?'
        : dados.tipo === 'AJUSTE'
          ? '?'
          : 'GREATEST(estoque_atual - ?, 0)'

    await conn.execute(`UPDATE material SET estoque_atual = ${expressao} WHERE id = ?`, [
      dados.quantidade,
      dados.materialId
    ])

    const [resultado] = await conn.execute(
      `INSERT INTO movimentacao_estoque
         (material_id, tipo, quantidade, custo_unitario_brl, cotacao_dolar_id, atendimento_id, usuario_id, observacao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dados.materialId,
        dados.tipo,
        dados.quantidade,
        dados.custoUnitarioBrl ?? null,
        dados.cotacaoDolarId ?? null,
        dados.atendimentoId ?? null,
        dados.usuarioId ?? null,
        dados.observacao ?? null
      ]
    )
    return (resultado as { insertId: number }).insertId
  }

  async historico(materialId: number, limite = 50): Promise<MovimentacaoEstoque[]> {
    const linhas = await this.db.query<RowDataPacket>(
      `SELECT * FROM movimentacao_estoque
       WHERE material_id = ?
       ORDER BY criado_em DESC, id DESC
       LIMIT ?`,
      [materialId, limite]
    )
    return linhas.map((l) => ({
      id: l.id,
      materialId: l.material_id,
      tipo: l.tipo,
      quantidade: Number(l.quantidade),
      custoUnitarioBrl: l.custo_unitario_brl === null ? null : Number(l.custo_unitario_brl),
      cotacaoDolarId: l.cotacao_dolar_id,
      atendimentoId: l.atendimento_id,
      usuarioId: l.usuario_id,
      observacao: l.observacao,
      criadoEm: l.criado_em instanceof Date ? l.criado_em.toISOString() : String(l.criado_em)
    }))
  }

  async usadoEmProcedimentos(id: number): Promise<boolean> {
    const linha = await this.db.queryOne<RowDataPacket>(
      'SELECT 1 AS existe FROM procedimento_material WHERE material_id = ? LIMIT 1',
      [id]
    )
    return linha !== null
  }
}
