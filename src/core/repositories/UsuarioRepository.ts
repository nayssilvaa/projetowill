import type { RowDataPacket } from 'mysql2/promise'
import { BaseRepository } from './BaseRepository.js'
import type { Usuario } from '../../shared/tipos.js'

export interface UsuarioComSenha extends Usuario {
  senhaHash: string
}

export class UsuarioRepository extends BaseRepository<Usuario> {
  protected readonly tabela = 'usuario'
  protected readonly rotulo = 'Usuario'

  /** A coluna senha_hash fica fora das leituras normais para nao vazar pela ponte IPC. */
  protected override get colunas(): string {
    return 'id, nome, email, perfil, ativo'
  }

  protected mapear(linha: RowDataPacket): Usuario {
    return {
      id: linha.id,
      nome: linha.nome,
      email: linha.email,
      perfil: linha.perfil,
      ativo: Boolean(linha.ativo)
    }
  }

  async criar(dados: {
    nome: string
    email: string
    senhaHash: string
    perfil: Usuario['perfil']
    ativo: boolean
  }): Promise<Usuario> {
    const resultado = await this.db.execute(
      'INSERT INTO usuario (nome, email, senha_hash, perfil, ativo) VALUES (?, ?, ?, ?, ?)',
      [dados.nome, dados.email, dados.senhaHash, dados.perfil, dados.ativo]
    )
    return this.obrigatorio(resultado.insertId)
  }

  async atualizar(
    id: number,
    dados: Partial<{ nome: string; email: string; perfil: Usuario['perfil']; ativo: boolean }>
  ): Promise<Usuario> {
    const { sql, valores } = this.montarUpdate(dados)
    if (sql) await this.db.execute(`UPDATE usuario SET ${sql} WHERE id = ?`, [...valores, id])
    return this.obrigatorio(id)
  }

  async atualizarSenha(id: number, senhaHash: string): Promise<void> {
    await this.db.execute('UPDATE usuario SET senha_hash = ? WHERE id = ?', [senhaHash, id])
  }

  async buscarPorEmailComSenha(email: string): Promise<UsuarioComSenha | null> {
    const linha = await this.db.queryOne<RowDataPacket>(
      'SELECT id, nome, email, perfil, ativo, senha_hash FROM usuario WHERE email = ?',
      [email]
    )
    if (!linha) return null
    return { ...this.mapear(linha), senhaHash: linha.senha_hash }
  }

  async emailEmUso(email: string, ignorarId?: number): Promise<boolean> {
    const linha = await this.db.queryOne<RowDataPacket>(
      'SELECT 1 AS existe FROM usuario WHERE email = ? AND id <> ?',
      [email, ignorarId ?? 0]
    )
    return linha !== null
  }

  async contarDonosAtivos(): Promise<number> {
    const linha = await this.db.queryOne<RowDataPacket>(
      "SELECT COUNT(*) AS total FROM usuario WHERE perfil = 'DONO' AND ativo = TRUE"
    )
    return Number(linha?.total ?? 0)
  }
}
