import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { UsuarioRepository } from '../repositories/UsuarioRepository.js'
import { ProfissionalRepository } from '../repositories/ProfissionalRepository.js'
import { env } from '../config/env.js'
import { ConflictError, ForbiddenError, UnauthorizedError, ValidationError } from '../errors.js'
import { camposDeErro } from '../validacaoUtil.js'
import { loginSchema, usuarioSchema, usuarioUpdateSchema } from '../../shared/validacao.js'
import type { PerfilUsuario, SessaoUsuario, Usuario } from '../../shared/tipos.js'

const CUSTO_BCRYPT = 12
const DURACAO_SESSAO_MS = 8 * 60 * 60 * 1000
/** Protecao contra forca bruta: depois de N senhas erradas, o e-mail fica bloqueado. */
const MAX_TENTATIVAS_LOGIN = 5
const BLOQUEIO_LOGIN_MS = 5 * 60 * 1000

export interface Identidade {
  usuarioId: number
  perfil: PerfilUsuario
  profissionalId: number | null
}

/**
 * Autenticacao e autorizacao do sistema.
 *
 * Decisoes de seguranca:
 * - Senhas gravadas apenas como hash bcrypt (custo 12); o hash nunca sai do processo principal.
 * - Login com mensagem de erro generica e comparacao sempre executada, para nao revelar
 *   por tempo de resposta se o e-mail existe.
 * - Sessao e um token aleatorio assinado com HMAC-SHA256 usando APP_SECRET, com validade de 8h.
 * - Perfis: DONO ve tudo; RECEPCAO opera agenda e cadastros; PROFISSIONAL so acessa a propria agenda.
 */
export class AuthService {
  private readonly sessoes = new Map<string, { identidade: Identidade; expiraEm: number }>()
  /** Falhas de login por e-mail. Vale para e-mails existentes ou nao, para nao revelar quais existem. */
  private readonly falhasLogin = new Map<string, { tentativas: number; bloqueadoAte: number }>()

  private verificarBloqueio(email: string): void {
    const registro = this.falhasLogin.get(email)
    if (!registro || registro.bloqueadoAte <= Date.now()) return
    const minutos = Math.ceil((registro.bloqueadoAte - Date.now()) / 60_000)
    throw new UnauthorizedError(
      `Muitas tentativas de login. Tente novamente em ${minutos} minuto(s).`
    )
  }

  private registrarFalha(email: string): void {
    const atual = this.falhasLogin.get(email)
    // Bloqueio anterior ja venceu: recomeca a contagem.
    const tentativas = atual && atual.bloqueadoAte <= Date.now() && atual.bloqueadoAte > 0
      ? 1
      : (atual?.tentativas ?? 0) + 1
    this.falhasLogin.set(email, {
      tentativas,
      bloqueadoAte: tentativas >= MAX_TENTATIVAS_LOGIN ? Date.now() + BLOQUEIO_LOGIN_MS : 0
    })
  }

  constructor(
    private readonly usuarios = new UsuarioRepository(),
    private readonly profissionais = new ProfissionalRepository()
  ) {}

  private assinar(valor: string): string {
    return createHmac('sha256', env.appSecret).update(valor).digest('hex')
  }

  private gerarToken(): string {
    const corpo = randomBytes(32).toString('hex')
    return `${corpo}.${this.assinar(corpo)}`
  }

  private tokenIntegro(token: string): boolean {
    const [corpo, assinatura] = token.split('.')
    if (!corpo || !assinatura) return false
    const esperada = Buffer.from(this.assinar(corpo))
    const recebida = Buffer.from(assinatura)
    return esperada.length === recebida.length && timingSafeEqual(esperada, recebida)
  }

  async login(entrada: unknown): Promise<SessaoUsuario> {
    const analise = loginSchema.safeParse(entrada)
    if (!analise.success) throw new UnauthorizedError()

    const chave = analise.data.email.trim().toLowerCase()
    this.verificarBloqueio(chave)

    const registro = await this.usuarios.buscarPorEmailComSenha(analise.data.email)
    // Hash descartavel: garante que o bcrypt rode mesmo sem usuario, igualando o tempo de resposta.
    const hashComparacao = registro?.senhaHash ?? '$2b$12$invalidoinvalidoinvalidoinvalidoinvalidoinvalidoinvalid'
    const senhaConfere = await bcrypt.compare(analise.data.senha, hashComparacao)

    if (!registro || !senhaConfere || !registro.ativo) {
      this.registrarFalha(chave)
      throw new UnauthorizedError()
    }
    this.falhasLogin.delete(chave)

    const profissional = await this.profissionais.buscarPorUsuarioId(registro.id)
    const token = this.gerarToken()
    const expiraEm = Date.now() + DURACAO_SESSAO_MS

    this.sessoes.set(token, {
      identidade: {
        usuarioId: registro.id,
        perfil: registro.perfil,
        profissionalId: profissional?.id ?? null
      },
      expiraEm
    })

    return {
      usuario: {
        id: registro.id,
        nome: registro.nome,
        email: registro.email,
        perfil: registro.perfil,
        ativo: registro.ativo
      },
      profissionalId: profissional?.id ?? null,
      token,
      expiraEm
    }
  }

  logout(token: string): void {
    this.sessoes.delete(token)
  }

  /** Resolve o token em uma identidade; lanca se ausente, adulterado ou expirado. */
  autenticar(token: string | undefined): Identidade {
    if (!token || !this.tokenIntegro(token)) throw new UnauthorizedError('Sessao invalida.')
    const sessao = this.sessoes.get(token)
    if (!sessao) throw new UnauthorizedError('Sessao invalida.')
    if (sessao.expiraEm < Date.now()) {
      this.sessoes.delete(token)
      throw new UnauthorizedError('Sessao expirada. Entre novamente.')
    }
    return sessao.identidade
  }

  exigirPerfil(identidade: Identidade, ...perfis: PerfilUsuario[]): void {
    if (!perfis.includes(identidade.perfil)) throw new ForbiddenError()
  }

  /** O profissional so enxerga a propria agenda; DONO e RECEPCAO enxergam todas. */
  filtroProfissional(identidade: Identidade, solicitado?: number): number | undefined {
    if (identidade.perfil !== 'PROFISSIONAL') return solicitado
    if (identidade.profissionalId === null) throw new ForbiddenError('Usuario sem profissional vinculado.')
    if (solicitado !== undefined && solicitado !== identidade.profissionalId) throw new ForbiddenError()
    return identidade.profissionalId
  }

  async criarUsuario(entrada: unknown): Promise<Usuario> {
    const analise = usuarioSchema.safeParse(entrada)
    if (!analise.success) {
      throw new ValidationError('Dados do usuario invalidos.', camposDeErro(analise.error))
    }
    const dados = analise.data

    if (await this.usuarios.emailEmUso(dados.email)) {
      throw new ConflictError('Ja existe um usuario com esse e-mail.')
    }

    return this.usuarios.criar({
      nome: dados.nome,
      email: dados.email,
      senhaHash: await bcrypt.hash(dados.senha, CUSTO_BCRYPT),
      perfil: dados.perfil,
      ativo: dados.ativo
    })
  }

  async atualizarUsuario(id: number, entrada: unknown): Promise<Usuario> {
    const analise = usuarioUpdateSchema.safeParse(entrada)
    if (!analise.success) {
      throw new ValidationError('Dados do usuario invalidos.', camposDeErro(analise.error))
    }
    const dados = analise.data
    const atual = await this.usuarios.obrigatorio(id)

    if (dados.email && (await this.usuarios.emailEmUso(dados.email, id))) {
      throw new ConflictError('Ja existe um usuario com esse e-mail.')
    }
    // Impede que o estudio fique sem ninguem com acesso administrativo.
    const perdendoDono =
      atual.perfil === 'DONO' && (dados.ativo === false || (dados.perfil && dados.perfil !== 'DONO'))
    if (perdendoDono && (await this.usuarios.contarDonosAtivos()) <= 1) {
      throw new ConflictError('O sistema precisa de pelo menos um usuario DONO ativo.')
    }

    return this.usuarios.atualizar(id, dados)
  }

  async alterarSenha(id: number, senhaAtual: string, senhaNova: string): Promise<void> {
    const usuario = await this.usuarios.obrigatorio(id)
    const registro = await this.usuarios.buscarPorEmailComSenha(usuario.email)
    if (!registro || !(await bcrypt.compare(senhaAtual, registro.senhaHash))) {
      throw new UnauthorizedError('Senha atual incorreta.')
    }
    const analise = usuarioSchema.shape.senha.safeParse(senhaNova)
    if (!analise.success) {
      throw new ValidationError(analise.error.issues[0]?.message ?? 'Senha nova invalida.')
    }
    await this.usuarios.atualizarSenha(id, await bcrypt.hash(senhaNova, CUSTO_BCRYPT))
    for (const [token, sessao] of this.sessoes) {
      if (sessao.identidade.usuarioId === id) this.sessoes.delete(token)
    }
  }

  async listarUsuarios(): Promise<Usuario[]> {
    return this.usuarios.listar()
  }

  async removerUsuario(id: number): Promise<void> {
    const usuario = await this.usuarios.obrigatorio(id)
    if (usuario.perfil === 'DONO' && (await this.usuarios.contarDonosAtivos()) <= 1) {
      throw new ConflictError('Nao e possivel remover o unico usuario DONO ativo.')
    }
    await this.usuarios.desativar(id)
  }
}
