import nodemailer, { type Transporter } from 'nodemailer'
import { env } from '../config/env.js'

export interface MensagemEmail {
  para: string
  assunto: string
  textoSimples: string
  html: string
}

/**
 * API externa 3/4 — servico SMTP de e-mail.
 * Envia o lembrete automatico 24h antes do procedimento.
 * Sem SMTP configurado o cliente entra em modo simulado: registra no console
 * em vez de falhar, para o app continuar utilizavel em desenvolvimento.
 */
export class EmailClient {
  private transporter: Transporter | null = null

  get configurado(): boolean {
    return Boolean(env.smtp.host && env.smtp.user && env.smtp.password)
  }

  private obterTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.port === 465,
        auth: { user: env.smtp.user, pass: env.smtp.password }
      })
    }
    return this.transporter
  }

  async enviar(mensagem: MensagemEmail): Promise<{ enviado: boolean; simulado: boolean }> {
    if (!this.configurado) {
      console.info(`[email simulado] para=${mensagem.para} assunto="${mensagem.assunto}"`)
      return { enviado: true, simulado: true }
    }

    await this.obterTransporter().sendMail({
      from: env.smtp.from,
      to: mensagem.para,
      subject: mensagem.assunto,
      text: mensagem.textoSimples,
      html: mensagem.html
    })
    return { enviado: true, simulado: false }
  }
}
