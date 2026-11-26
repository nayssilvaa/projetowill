import type { RowDataPacket } from 'mysql2/promise'
import { Database } from '../database/Database.js'
import type { CotacaoDolar } from '../../shared/tipos.js'

/**
 * Data no horario local (AAAA-MM-DDTHH:MM:SS), como os demais repositorios.
 * Antes usava toISOString(), que converte para UTC e fazia a tela mostrar o
 * horario da consulta 3 horas adiantado.
 */
function dataHoraLocal(valor: unknown): string {
  if (!(valor instanceof Date)) return String(valor ?? '')
  const pad = (n: number): string => String(n).padStart(2, '0')
  return (
    `${valor.getFullYear()}-${pad(valor.getMonth() + 1)}-${pad(valor.getDate())}` +
    `T${pad(valor.getHours())}:${pad(valor.getMinutes())}:${pad(valor.getSeconds())}`
  )
}

export class CotacaoRepository {
  private readonly db = Database.getInstance()

  private mapear(linha: RowDataPacket): CotacaoDolar {
    return {
      id: linha.id,
      valorBrl: Number(linha.valor_brl),
      variacaoPct: linha.variacao_pct === null ? null : Number(linha.variacao_pct),
      fonte: linha.fonte,
      consultadaEm: dataHoraLocal(linha.consultada_em)
    }
  }

  async registrar(dados: {
    valorBrl: number
    variacaoPct: number | null
    fonte: string
  }): Promise<CotacaoDolar> {
    const resultado = await this.db.execute(
      'INSERT INTO cotacao_dolar (valor_brl, variacao_pct, fonte) VALUES (?, ?, ?)',
      [dados.valorBrl, dados.variacaoPct, dados.fonte]
    )
    const linha = await this.db.queryOne<RowDataPacket>(
      'SELECT * FROM cotacao_dolar WHERE id = ?',
      [resultado.insertId]
    )
    return this.mapear(linha!)
  }

  async buscarPorId(id: number): Promise<CotacaoDolar | null> {
    const linha = await this.db.queryOne<RowDataPacket>(
      'SELECT * FROM cotacao_dolar WHERE id = ?',
      [id]
    )
    return linha ? this.mapear(linha) : null
  }

  async maisRecente(): Promise<CotacaoDolar | null> {
    const linha = await this.db.queryOne<RowDataPacket>(
      'SELECT * FROM cotacao_dolar ORDER BY consultada_em DESC, id DESC LIMIT 1'
    )
    return linha ? this.mapear(linha) : null
  }

  async historico(limite = 30): Promise<CotacaoDolar[]> {
    const linhas = await this.db.query<RowDataPacket>(
      'SELECT * FROM cotacao_dolar ORDER BY consultada_em DESC, id DESC LIMIT ?',
      [limite]
    )
    return linhas.map((l) => this.mapear(l))
  }
}
