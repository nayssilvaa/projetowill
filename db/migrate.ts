import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { env } from '../src/core/config/env.js'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations')

async function main(): Promise<void> {
  const conn = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true
  })

  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${env.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  )
  await conn.changeUser({ database: env.db.database })

  await conn.query(`CREATE TABLE IF NOT EXISTS _migracao (
    nome VARCHAR(255) PRIMARY KEY,
    aplicada_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`)

  const [aplicadas] = await conn.query<mysql.RowDataPacket[]>('SELECT nome FROM _migracao')
  const jaAplicadas = new Set(aplicadas.map((r) => r.nome as string))

  const arquivos = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort()

  let novas = 0
  for (const arquivo of arquivos) {
    if (jaAplicadas.has(arquivo)) continue
    const sql = await readFile(join(migrationsDir, arquivo), 'utf8')
    console.log(`Aplicando ${arquivo}...`)
    await conn.query(sql)
    await conn.execute('INSERT INTO _migracao (nome) VALUES (?)', [arquivo])
    novas++
  }

  console.log(novas === 0 ? 'Banco ja esta atualizado.' : `${novas} migracao(oes) aplicada(s).`)
  await conn.end()
}

main().catch((erro) => {
  console.error('Falha na migracao:', erro instanceof Error ? erro.message : erro)
  process.exit(1)
})
