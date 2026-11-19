import { ApiServer } from './ApiServer.js'
import { Database } from '../src/core/database/Database.js'

const servidor = new ApiServer()

async function encerrar(): Promise<void> {
  servidor.parar()
  await Database.getInstance().close().catch(() => undefined)
  process.exit(0)
}

process.on('SIGINT', encerrar)
process.on('SIGTERM', encerrar)

servidor.iniciar().catch((erro) => {
  console.error('Falha ao iniciar a API:', erro instanceof Error ? erro.message : erro)
  process.exit(1)
})
