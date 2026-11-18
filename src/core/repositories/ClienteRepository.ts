import type { RowDataPacket } from 'mysql2/promise'
import { BaseRepository } from './BaseRepository.js'
import type { Cliente } from '../../shared/tipos.js'

function dataIso(valor: unknown): string | null {
  if (!valor) return null
  return valor instanceof Date ? valor.toISOString().slice(0, 10) : String(valor).slice(0, 10)
}

export class ClienteRepository extends BaseRepository<Cliente> {
  protected readonly tabela = 'cliente'
  protected readonly rotulo = 'Cliente'

  protected mapear(linha: RowDataPacket): Cliente {
    return {
      id: linha.id,
      nome: linha.nome,
      cpf: linha.cpf,
      email: linha.email,
      telefone: linha.telefone,
      dataNascimento: dataIso(linha.data_nascimento),
      enderecoId: linha.endereco_id,
      alergias: linha.alergias,
      observacoesSaude: linha.observacoes_saude,
      ativo: Boolean(linha.ativo)
    }
  }

  async criar(dados: {
    nome: string
    cpf?: string | null
    email?: string | null
    telefone?: string | null
    dataNascimento?: string | null
    enderecoId?: number | null
    alergias?: string | null
    observacoesSaude?: string | null
    ativo?: boolean
  }): Promise<Cliente> {
    const resultado = await this.db.execute(
      `INSERT INTO cliente (nome, cpf, email, telefone, data_nascimento, endereco_id, alergias, observacoes_saude, ativo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dados.nome,
        dados.cpf ?? null,
        dados.email ?? null,
        dados.telefone || null,
        dados.dataNascimento ?? null,
        dados.enderecoId ?? null,
        dados.alergias ?? null,
        dados.observacoesSaude ?? null,
        dados.ativo ?? true
      ]
    )
    return this.obrigatorio(resultado.insertId)
  }

  async atualizar(
    id: number,
    dados: Partial<{
      nome: string
      cpf: string | null
      email: string | null
      telefone: string | null
      data_nascimento: string | null
      endereco_id: number | null
      alergias: string | null
      observacoes_saude: string | null
      ativo: boolean
    }>
  ): Promise<Cliente> {
    const { sql, valores } = this.montarUpdate(dados)
    if (sql) await this.db.execute(`UPDATE cliente SET ${sql} WHERE id = ?`, [...valores, id])
    return this.obrigatorio(id)
  }

  async buscar(termo: string): Promise<Cliente[]> {
    const curinga = `%${termo}%`
    const linhas = await this.db.query<RowDataPacket>(
      `SELECT * FROM cliente
       WHERE nome LIKE ? OR cpf LIKE ? OR email LIKE ? OR telefone LIKE ?
       ORDER BY nome LIMIT 100`,
      [curinga, curinga, curinga, curinga]
    )
    return linhas.map((l) => this.mapear(l))
  }

  async cpfEmUso(cpf: string, ignorarId?: number): Promise<boolean> {
    const linha = await this.db.queryOne<RowDataPacket>(
      'SELECT 1 AS existe FROM cliente WHERE cpf = ? AND id <> ?',
      [cpf, ignorarId ?? 0]
    )
    return linha !== null
  }

  async temAgendamentos(id: number): Promise<boolean> {
    const linha = await this.db.queryOne<RowDataPacket>(
      'SELECT 1 AS existe FROM agendamento WHERE cliente_id = ? LIMIT 1',
      [id]
    )
    return linha !== null
  }
}
