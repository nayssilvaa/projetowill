import type { RowDataPacket } from 'mysql2/promise'
import { Database } from '../database/Database.js'
import { NotFoundError } from '../errors.js'

/**
 * Base dos repositorios: concentra o CRUD generico para que cada repositorio
 * concreto so precise descrever sua tabela e o mapeamento linha -> entidade.
 */
export abstract class BaseRepository<T> {
  protected readonly db = Database.getInstance()

  protected abstract readonly tabela: string
  protected abstract readonly rotulo: string

  /** Converte a linha crua do MySQL (snake_case) para a entidade do dominio (camelCase). */
  protected abstract mapear(linha: RowDataPacket): T

  /** Colunas devolvidas nas leituras. Sobrescreva para esconder colunas sensiveis. */
  protected get colunas(): string {
    return '*'
  }

  async listar(apenasAtivos = false): Promise<T[]> {
    const filtro = apenasAtivos ? ' WHERE ativo = TRUE' : ''
    const linhas = await this.db.query<RowDataPacket>(
      `SELECT ${this.colunas} FROM ${this.tabela}${filtro} ORDER BY id DESC`
    )
    return linhas.map((l) => this.mapear(l))
  }

  async buscarPorId(id: number): Promise<T | null> {
    const linha = await this.db.queryOne<RowDataPacket>(
      `SELECT ${this.colunas} FROM ${this.tabela} WHERE id = ?`,
      [id]
    )
    return linha ? this.mapear(linha) : null
  }

  async obrigatorio(id: number): Promise<T> {
    const registro = await this.buscarPorId(id)
    if (!registro) throw new NotFoundError(this.rotulo, id)
    return registro
  }

  async existe(id: number): Promise<boolean> {
    const linha = await this.db.queryOne<RowDataPacket>(
      `SELECT 1 AS existe FROM ${this.tabela} WHERE id = ?`,
      [id]
    )
    return linha !== null
  }

  async remover(id: number): Promise<void> {
    const resultado = await this.db.execute(`DELETE FROM ${this.tabela} WHERE id = ?`, [id])
    if (resultado.affectedRows === 0) throw new NotFoundError(this.rotulo, id)
  }

  /** Exclusao logica: preserva o historico, usada quando o registro ja tem vinculos. */
  async desativar(id: number): Promise<void> {
    const resultado = await this.db.execute(
      `UPDATE ${this.tabela} SET ativo = FALSE WHERE id = ?`,
      [id]
    )
    if (resultado.affectedRows === 0) throw new NotFoundError(this.rotulo, id)
  }

  /** Monta `SET col = ?, ...` apenas com os campos realmente enviados na edicao. */
  protected montarUpdate(dados: Record<string, unknown>): { sql: string; valores: unknown[] } {
    const campos = Object.entries(dados).filter(([, v]) => v !== undefined)
    return {
      sql: campos.map(([coluna]) => `${coluna} = ?`).join(', '),
      valores: campos.map(([, valor]) => valor)
    }
  }
}
