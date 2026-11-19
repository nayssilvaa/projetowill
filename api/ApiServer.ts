import { timingSafeEqual } from 'node:crypto'
import express, { type Express, type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import cron, { type ScheduledTask } from 'node-cron'
import { NotificacaoService } from '../src/core/services/NotificacaoService.js'
import { RelatorioService } from '../src/core/services/RelatorioService.js'
import { AtendimentoService } from '../src/core/services/AtendimentoService.js'
import { EstoqueService } from '../src/core/services/EstoqueService.js'
import { Database } from '../src/core/database/Database.js'
import { AppError } from '../src/core/errors.js'
import { env } from '../src/core/config/env.js'

/**
 * API propria do projeto (4a situacao de consumo de API).
 *
 * Existe por um motivo real: o lembrete de 24h precisa disparar mesmo com o
 * aplicativo desktop fechado. O Electron nao serve para isso — ele so roda
 * quando alguem abre. Entao este servico fica de pe, executa o agendador
 * diario e expoe os relatorios consolidados que o desktop consome.
 *
 * Reaproveita exatamente as mesmas classes de dominio do app, sem duplicar regra.
 */
export class ApiServer {
  private readonly app: Express
  private tarefas: ScheduledTask[] = []

  constructor(
    private readonly notificacoes = new NotificacaoService(),
    private readonly relatorios = new RelatorioService(),
    private readonly atendimentos = new AtendimentoService(),
    private readonly estoque = new EstoqueService()
  ) {
    this.app = express()
    this.configurar()
    this.registrarRotas()
    this.tratarErros()
  }

  private configurar(): void {
    // So o proprio desktop (localhost) conversa com esta API.
    this.app.use(cors({ origin: [/^http:\/\/localhost(:\d+)?$/, /^file:\/\//] }))
    this.app.use(express.json({ limit: '100kb' }))
    this.app.disable('x-powered-by')
  }

  /** Autentica a chamada por chave compartilhada, com comparacao em tempo constante. */
  private exigirChave = (req: Request, res: Response, next: NextFunction): void => {
    const recebida = Buffer.from(String(req.header('x-api-key') ?? ''))
    const esperada = Buffer.from(env.appSecret)
    const valida =
      recebida.length === esperada.length && timingSafeEqual(recebida, esperada)

    if (!valida) {
      res.status(401).json({ erro: 'Chave de API invalida.' })
      return
    }
    next()
  }

  /** Encapsula o handler async para que erros caiam no middleware de erro. */
  private rota(acao: (req: Request) => Promise<unknown>) {
    return (req: Request, res: Response, next: NextFunction): void => {
      acao(req)
        .then((dados) => res.json(dados))
        .catch(next)
    }
  }

  private registrarRotas(): void {
    this.app.get(
      '/saude',
      this.rota(async () => ({
        status: 'ok',
        banco: await Database.getInstance().ping(),
        agendadorAtivo: this.tarefas.length > 0,
        horario: new Date().toISOString()
      }))
    )

    const protegidas = express.Router()
    protegidas.use(this.exigirChave)

    protegidas.get(
      '/lembretes/pendentes',
      this.rota(() => this.notificacoes.pendentes())
    )

    protegidas.post(
      '/lembretes/executar',
      this.rota(() => this.notificacoes.enviarLembretesPendentes())
    )

    protegidas.get(
      '/relatorios/painel',
      this.rota(() => this.relatorios.painelInicial())
    )

    protegidas.get(
      '/relatorios/faturamento',
      this.rota((req) => {
        const hoje = new Date().toISOString().slice(0, 10)
        const inicio = String(req.query.inicio ?? `${hoje.slice(0, 8)}01`)
        const fim = String(req.query.fim ?? hoje)
        return this.relatorios.faturamentoPorProfissional(inicio, fim)
      })
    )

    protegidas.get(
      '/relatorios/retornos-pendentes',
      this.rota(() => this.atendimentos.retornosPendentes())
    )

    protegidas.get(
      '/relatorios/estoque-critico',
      this.rota(() => this.estoque.abaixoDoMinimo())
    )

    protegidas.get(
      '/cotacao',
      this.rota(() => this.estoque.consultarCotacao())
    )

    this.app.use(protegidas)
  }

  private tratarErros(): void {
    this.app.use((_req: Request, res: Response) => {
      res.status(404).json({ erro: 'Rota nao encontrada.' })
    })

    this.app.use((erro: Error, _req: Request, res: Response, _next: NextFunction) => {
      if (erro instanceof AppError) {
        res.status(erro.status).json({ erro: erro.message, codigo: erro.code })
        return
      }
      console.error('[api] erro inesperado:', erro)
      res.status(500).json({ erro: 'Erro interno do servidor.' })
    })
  }

  /** Agendador diario: as 9h varre a agenda e envia os lembretes de 24h. */
  private iniciarAgendador(): void {
    const diario = cron.schedule(
      '0 9 * * *',
      async () => {
        try {
          const resultado = await this.notificacoes.enviarLembretesPendentes()
          console.info(
            `[cron] lembretes: ${resultado.enviados}/${resultado.analisados} enviados` +
              (resultado.simulados > 0 ? ` (${resultado.simulados} simulados, SMTP nao configurado)` : '')
          )
        } catch (erro) {
          console.error('[cron] falha ao enviar lembretes:', erro)
        }
      },
      { timezone: 'America/Sao_Paulo' }
    )
    this.tarefas.push(diario)
  }

  async iniciar(): Promise<void> {
    this.iniciarAgendador()
    await new Promise<void>((resolve) => {
      this.app.listen(env.api.port, '127.0.0.1', () => {
        console.info(`[api] ouvindo em http://127.0.0.1:${env.api.port}`)
        console.info('[api] agendador de lembretes ativo (diariamente as 09:00)')
        resolve()
      })
    })
  }

  parar(): void {
    for (const tarefa of this.tarefas) tarefa.stop()
    this.tarefas = []
  }
}
