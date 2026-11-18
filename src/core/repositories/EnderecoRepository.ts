import type { RowDataPacket } from 'mysql2/promise'
import { BaseRepository } from './BaseRepository.js'
import type { Endereco } from '../../shared/tipos.js'
import type { EnderecoInput } from '../../shared/validacao.js'

export class EnderecoRepository extends BaseRepository<Endereco> {
  protected readonly tabela = 'endereco'
  protected readonly rotulo = 'Endereco'

  protected mapear(linha: RowDataPacket): Endereco {
    return {
      id: linha.id,
      cep: linha.cep,
      logradouro: linha.logradouro,
      numero: linha.numero,
      complemento: linha.complemento,
      bairro: linha.bairro,
      cidade: linha.cidade,
      uf: linha.uf
    }
  }

  async criar(dados: EnderecoInput): Promise<Endereco> {
    const resultado = await this.db.execute(
      `INSERT INTO endereco (cep, logradouro, numero, complemento, bairro, cidade, uf)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        dados.cep,
        dados.logradouro,
        dados.numero ?? null,
        dados.complemento ?? null,
        dados.bairro ?? null,
        dados.cidade,
        dados.uf
      ]
    )
    return this.obrigatorio(resultado.insertId)
  }

  async atualizar(id: number, dados: Partial<EnderecoInput>): Promise<Endereco> {
    const { sql, valores } = this.montarUpdate({
      cep: dados.cep,
      logradouro: dados.logradouro,
      numero: dados.numero,
      complemento: dados.complemento,
      bairro: dados.bairro,
      cidade: dados.cidade,
      uf: dados.uf
    })
    if (sql) await this.db.execute(`UPDATE endereco SET ${sql} WHERE id = ?`, [...valores, id])
    return this.obrigatorio(id)
  }
}
