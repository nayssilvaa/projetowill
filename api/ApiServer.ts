import { timingSafeEqual } from 'node:crypto'
import express, { type Express, type NextFunction, type Request, type Response } from 'express'
import cron, { type ScheduledTask } from 'node-cron'
import { NotificacaoService } from '../src/core/services/NotificacaoService.js'
import { AvisoService } from '../src/core/services/AvisoService.js'
import { validar } from '../src/core/validacaoUtil.js'
import { z } from 'zod'
import { Database } from '../src/core/database/Database.js'
import { AppError } from '../src/core/errors.js'
import { env } from '../src/core/config/env.js'

/**
 * API propria do projeto (4a situacao de consumo de API).
 *
 * Existe por um motivo real: o lembrete de 24h precisa disparar mesmo com o
 * aplicativo desktop fechado. O Electron nao serve para isso — ele so roda
 * quando alguem abre. Entao este servico fica de pe, executa o agendador
 * diario e e o unico responsavel pelos envios (lembretes aos clientes e avisos
 * aos profissionais), que o desktop consome pelo ApiPropriaClient.
 *
 * So existem aqui rotas que o desktop realmente chama.
 * Reaproveita exatamente as mesmas classes de dominio do app, sem duplicar regra.
 */
export class ApiServer {
  private readonly app: Express
  private tarefas: ScheduledTask[] = []

  constructor(
    private readonly notificacoes = new NotificacaoService(),
    private readonly avisos = new AvisoService()
  ) {
    this.app = express()
    this.configurar()
    this.registrarRotas()
    this.tratarErros()
  }

  private configurar(): void {
    // Sem CORS de proposito: quem chama e o processo principal do Electron (Node),
    // nao uma pagina web. Assim nenhum site aberto no navegador consegue ler as respostas.
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
        emailConfigurado: this.notificacoes.emailConfigurado,
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

    // Avisos internos aos profissionais sobre os atendimentos de amanha.
    // O desktop informa quem disparou; sem remetente, o aviso sai como "sistema".
    const corpoAvisos = z.object({ remetenteId: z.number().int().positive().nullish() })
    protegidas.post(
      '/avisos/executar',
      this.rota((req) => {
        const { remetenteId } = validar(corpoAvisos, req.body ?? {}, 'Avisos')
        return this.avisos.avisarSobreAmanha(remetenteId ?? null)
      })
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

  /**
   * Agendador diario: as 9h varre a agenda de amanha, envia o lembrete de 24h aos
   * clientes e avisa cada profissional dos proprios atendimentos. As duas tarefas
   * sao independentes: a falha de uma (ex.: SMTP fora) nao impede a outra.
   */
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

        try {
          const avisos = await this.avisos.avisarSobreAmanha(null)
          console.info(
            `[cron] avisos: ${avisos.profissionaisAvisados} profissional(is) avisado(s) sobre ${avisos.totalAgendamentos} atendimento(s)`
          )
        } catch (erro) {
          console.error('[cron] falha ao avisar profissionais:', erro)
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
        console.info(
          '[api] agendador ativo (diariamente as 09:00): lembretes aos clientes e avisos aos profissionais'
        )
        resolve()
      })
    })
  }

  parar(): void {
    for (const tarefa of this.tarefas) tarefa.stop()
    this.tarefas = []
  }
}
