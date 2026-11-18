import mysql from 'mysql2/promise'
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import { env } from '../config/env.js'

/**
 * Ponto unico de acesso ao MySQL. Toda query do sistema passa por aqui,
 * sempre com placeholders `?` — nunca concatenando valores na string SQL.
 */
export class Database {
  private static instance: Database | null = null
  private readonly pool: Pool

  private constructor() {
    this.pool = mysql.createPool({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: false,
      dateStrings: false,
      timezone: 'local'
    })
  }

  static getInstance(): Database {
    if (!Database.instance) Database.instance = new Database()
    return Database.instance
  }

  async query<T extends RowDataPacket>(sql: string, params: unknown[] = []): Promise<T[]> {
    const [rows] = await this.pool.query<T[]>(sql, params)
    return rows
  }

  async queryOne<T extends RowDataPacket>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params)
    return rows[0] ?? null
  }

  async execute(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
    const [result] = await this.pool.execute<ResultSetHeader>(sql, params)
    return result
  }

  /** Executa um bloco dentro de uma transacao, com rollback automatico em caso de erro. */
  async transaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      const resultado = await fn(conn)
      await conn.commit()
      return resultado
    } catch (erro) {
      await conn.rollback()
      throw erro
    } finally {
      conn.release()
    }
  }

  async ping(): Promise<boolean> {
    const conn = await this.pool.getConnection()
    try {
      await conn.ping()
      return true
    } finally {
      conn.release()
    }
  }

  async close(): Promise<void> {
    await this.pool.end()
    Database.instance = null
  }
}
