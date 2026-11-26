import { ipcMain } from 'electron'
import { servicos } from './container.js'
import { AppError, ForbiddenError } from '../core/errors.js'
import type { Identidade } from '../core/services/AuthService.js'
import type { Resultado } from '../shared/tipos.js'

/** Converte qualquer excecao em um Resultado serializavel: a ponte IPC nunca propaga stack. */
async function responder<T>(acao: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, dados: await acao() }
  } catch (erro) {
    if (erro instanceof AppError) {
      return { ok: false, erro: erro.message, codigo: erro.code }
    }
    console.error('[ipc] erro inesperado:', erro)
    return { ok: false, erro: 'Erro interno do sistema.', codigo: 'INTERNAL_ERROR' }
  }
}

/** Canal publico: nao exige sessao (usado so pelo login). */
function publico<A extends unknown[], T>(
  canal: string,
  acao: (...args: A) => Promise<T>
): void {
  ipcMain.handle(canal, (_evento, ...args) => responder(() => acao(...(args as A))))
}

/** Canal protegido: o primeiro argumento vindo do renderer e sempre o token da sessao. */
function protegido<A extends unknown[], T>(
  canal: string,
  acao: (identidade: Identidade, ...args: A) => Promise<T>
): void {
  ipcMain.handle(canal, (_evento, token: string, ...args) =>
    responder(() => acao(servicos.auth.autenticar(token), ...(args as A)))
  )
}

/** Id do profissional logado; falha se o usuario PROFISSIONAL nao tiver cadastro vinculado. */
function meuProfissionalId(identidade: Identidade): number {
  return servicos.auth.filtroProfissional(identidade) as number
}

/** DONO e RECEPCAO acessam qualquer cliente; o profissional, so os que atende. */
async function garantirAcessoAoCliente(identidade: Identidade, clienteId: number): Promise<void> {
  if (identidade.perfil !== 'PROFISSIONAL') return
  await servicos.clientes.garantirAcessoDoProfissional(clienteId, meuProfissionalId(identidade))
}

export function registrarHandlers(): void {
  // ---- Autenticacao e usuarios -------------------------------------------
  publico('auth:login', (credenciais: unknown) => servicos.auth.login(credenciais))

  protegido('auth:sessao', async (identidade) => identidade)

  publico('auth:logout', async (token: string) => {
    servicos.auth.logout(token)
    return true
  })

  protegido('usuarios:listar', async (identidade) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.auth.listarUsuarios()
  })

  protegido('usuarios:criar', async (identidade, dados: unknown) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.auth.criarUsuario(dados)
  })

  protegido('usuarios:atualizar', async (identidade, id: number, dados: unknown) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.auth.atualizarUsuario(id, dados)
  })

  protegido('usuarios:remover', async (identidade, id: number) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    await servicos.auth.removerUsuario(id)
    return true
  })

  protegido('usuarios:alterarSenha', async (identidade, atual: string, nova: string) => {
    await servicos.auth.alterarSenha(identidade.usuarioId, atual, nova)
    return true
  })

  // ---- Clientes ------------------------------------------------------------
  // A ficha do cliente tem dados de saude. O profissional so acessa os clientes que atende.
  protegido('clientes:listar', (identidade, apenasAtivos: boolean) =>
    identidade.perfil === 'PROFISSIONAL'
      ? servicos.clientes.listarDoProfissional(meuProfissionalId(identidade))
      : servicos.clientes.listar(apenasAtivos)
  )
  protegido('clientes:buscar', (identidade, termo: string) =>
    identidade.perfil === 'PROFISSIONAL'
      ? servicos.clientes.listarDoProfissional(meuProfissionalId(identidade), termo)
      : servicos.clientes.buscar(termo)
  )
  protegido('clientes:obter', async (identidade, id: number) => {
    await garantirAcessoAoCliente(identidade, id)
    return servicos.clientes.obter(id)
  })
  protegido('clientes:ficha', async (identidade, id: number) => {
    await garantirAcessoAoCliente(identidade, id)
    return servicos.clientes.ficha(id)
  })
  protegido('clientes:consultarCep', (_i, cep: string) => servicos.clientes.consultarCep(cep))

  protegido('clientes:criar', async (identidade, dados: unknown) => {
    servicos.auth.exigirPerfil(identidade, 'DONO', 'RECEPCAO')
    return servicos.clientes.criar(dados)
  })

  protegido('clientes:atualizar', async (identidade, id: number, dados: unknown) => {
    servicos.auth.exigirPerfil(identidade, 'DONO', 'RECEPCAO')
    return servicos.clientes.atualizar(id, dados)
  })

  protegido('clientes:remover', async (identidade, id: number) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.clientes.remover(id)
  })

  // ---- Profissionais -------------------------------------------------------
  protegido('profissionais:listar', (_i, apenasAtivos: boolean) =>
    servicos.profissionais.listar(apenasAtivos)
  )
  protegido('profissionais:obter', (_i, id: number) => servicos.profissionais.obter(id))
  protegido('profissionais:procedimentos', (_i, id: number) =>
    servicos.profissionais.listarProcedimentos(id)
  )

  protegido('profissionais:criar', async (identidade, dados: unknown) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.profissionais.criar(dados)
  })

  protegido('profissionais:atualizar', async (identidade, id: number, dados: unknown) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.profissionais.atualizar(id, dados)
  })

  protegido('profissionais:remover', async (identidade, id: number) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.profissionais.remover(id)
  })

  protegido('profissionais:habilitar', async (identidade, dados: unknown) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.profissionais.habilitarProcedimento(dados)
  })

  protegido('profissionais:desabilitar', async (identidade, pid: number, procId: number) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.profissionais.desabilitarProcedimento(pid, procId)
  })

  // ---- Procedimentos -------------------------------------------------------
  protegido('procedimentos:listar', (_i, apenasAtivos: boolean) =>
    servicos.procedimentos.listar(apenasAtivos)
  )
  protegido('procedimentos:obter', (_i, id: number) => servicos.procedimentos.obter(id))
  protegido('procedimentos:materiais', (_i, id: number) =>
    servicos.procedimentos.listarMateriais(id)
  )

  protegido('procedimentos:criar', async (identidade, dados: unknown) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.procedimentos.criar(dados)
  })

  protegido('procedimentos:atualizar', async (identidade, id: number, dados: unknown) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.procedimentos.atualizar(id, dados)
  })

  protegido('procedimentos:remover', async (identidade, id: number) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.procedimentos.remover(id)
  })

  protegido('procedimentos:vincularMaterial', async (identidade, dados: unknown) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.procedimentos.vincularMaterial(dados)
  })

  protegido('procedimentos:desvincularMaterial', async (identidade, pid: number, mid: number) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.procedimentos.desvincularMaterial(pid, mid)
  })

  // ---- Agenda --------------------------------------------------------------
  protegido('agenda:listar', (identidade, inicio: string, fim: string, profissionalId?: number) =>
    servicos.agenda.listarPeriodo(
      inicio,
      fim,
      servicos.auth.filtroProfissional(identidade, profissionalId)
    )
  )

  protegido('agenda:obter', (_i, id: number) => servicos.agenda.obter(id))

  protegido(
    'agenda:horariosLivres',
    (_i, profissionalId: number, dia: string, procId: number, ignorarId?: number) =>
      servicos.agenda.horariosLivres(profissionalId, dia, procId, ignorarId)
  )

  protegido('agenda:agendar', async (identidade, dados: unknown) => {
    servicos.auth.exigirPerfil(identidade, 'DONO', 'RECEPCAO')
    return servicos.agenda.agendar(dados)
  })

  // DONO e RECEPCAO remarcam qualquer horario. O profissional so pode mudar o
  // status (ex.: confirmar) dos proprios agendamentos — nunca remarcar.
  protegido('agenda:atualizar', async (identidade, id: number, dados: unknown) => {
    if (identidade.perfil === 'PROFISSIONAL') {
      const atual = await servicos.agenda.obter(id)
      servicos.auth.filtroProfissional(identidade, atual.profissionalId)
      const campos = Object.keys((dados ?? {}) as Record<string, unknown>)
      if (campos.some((c) => c !== 'status')) {
        throw new ForbiddenError('Somente a recepcao pode remarcar horarios.')
      }
    }
    return servicos.agenda.atualizar(id, dados)
  })

  protegido('agenda:cancelar', async (identidade, id: number, motivo?: string) => {
    servicos.auth.exigirPerfil(identidade, 'DONO', 'RECEPCAO')
    return servicos.agenda.cancelar(id, motivo)
  })

  protegido('agenda:remover', async (identidade, id: number) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.agenda.remover(id)
  })

  // ---- Atendimentos (historico) -------------------------------------------
  // Historico = anotacoes tecnicas e valores. Lista geral so para DONO e RECEPCAO;
  // o profissional ve o historico dos clientes que atende.
  protegido('atendimentos:listar', async (identidade) => {
    servicos.auth.exigirPerfil(identidade, 'DONO', 'RECEPCAO')
    return servicos.atendimentos.listar()
  })
  protegido('atendimentos:obter', async (identidade, id: number) => {
    if (identidade.perfil === 'PROFISSIONAL') {
      servicos.auth.filtroProfissional(
        identidade,
        await servicos.atendimentos.profissionalDoAtendimento(id)
      )
    }
    return servicos.atendimentos.obter(id)
  })
  protegido('atendimentos:historicoCliente', async (identidade, clienteId: number) => {
    await garantirAcessoAoCliente(identidade, clienteId)
    return servicos.atendimentos.historicoDoCliente(clienteId)
  })
  // Historico de procedimentos realizados. DONO: todos (com filtro opcional por
  // profissional) e com valores. PROFISSIONAL: so os proprios, sem valores.
  protegido(
    'atendimentos:historicoRealizados',
    async (identidade, inicio: string, fim: string, profissionalId?: number) => {
      servicos.auth.exigirPerfil(identidade, 'DONO', 'PROFISSIONAL')
      const ehDono = identidade.perfil === 'DONO'
      return servicos.atendimentos.historicoRealizados(String(inicio), String(fim), {
        profissionalId: ehDono
          ? profissionalId || undefined
          : servicos.auth.filtroProfissional(identidade),
        incluirValores: ehDono
      })
    }
  )

  protegido('atendimentos:retornosPendentes', async (identidade) => {
    servicos.auth.exigirPerfil(identidade, 'DONO', 'RECEPCAO')
    return servicos.atendimentos.retornosPendentes()
  })

  // O profissional so registra atendimento dos proprios agendamentos.
  protegido('atendimentos:registrar', async (identidade, dados: unknown) => {
    if (identidade.perfil === 'PROFISSIONAL') {
      const agendamentoId = Number((dados as { agendamentoId?: unknown } | null)?.agendamentoId)
      if (!Number.isInteger(agendamentoId) || agendamentoId <= 0) {
        throw new ForbiddenError('Agendamento invalido.')
      }
      servicos.auth.filtroProfissional(
        identidade,
        await servicos.atendimentos.profissionalDoAgendamento(agendamentoId)
      )
    }
    return servicos.atendimentos.registrar(dados, identidade.usuarioId)
  })

  // Editar valor e pagamento e financeiro: so o DONO. O profissional que atendeu pode
  // corrigir as proprias anotacoes tecnicas e a data de retorno. A recepcao nao edita.
  protegido('atendimentos:atualizar', async (identidade, id: number, dados: unknown) => {
    if (identidade.perfil === 'RECEPCAO') throw new ForbiddenError()
    if (identidade.perfil === 'PROFISSIONAL') {
      servicos.auth.filtroProfissional(
        identidade,
        await servicos.atendimentos.profissionalDoAtendimento(id)
      )
      const permitidos = ['anotacoesTecnicas', 'dataRetornoSugerida']
      const campos = Object.keys((dados ?? {}) as Record<string, unknown>)
      if (campos.some((c) => !permitidos.includes(c))) {
        throw new ForbiddenError('O profissional so pode editar anotacoes tecnicas e data de retorno.')
      }
    }
    return servicos.atendimentos.atualizar(id, dados)
  })

  protegido('atendimentos:estornar', async (identidade, id: number) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    await servicos.atendimentos.estornar(id, identidade.usuarioId)
    return true
  })

  // ---- Estoque e cotacao do dolar -----------------------------------------
  // Custos, compras e cambio sao informacao do dono: todo o modulo e so do DONO.
  protegido('estoque:listar', async (identidade, apenasAtivos: boolean) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.estoque.listar(apenasAtivos)
  })

  protegido('estoque:obter', async (identidade, id: number) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.estoque.obter(id)
  })
  protegido('estoque:historico', async (identidade, id: number) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.estoque.historico(id)
  })
  protegido('estoque:emFalta', async (identidade) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.estoque.abaixoDoMinimo()
  })

  protegido('estoque:criar', async (identidade, dados: unknown) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.estoque.criar(dados)
  })

  protegido('estoque:atualizar', async (identidade, id: number, dados: unknown) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.estoque.atualizar(id, dados)
  })

  protegido('estoque:remover', async (identidade, id: number) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.estoque.remover(id)
  })

  protegido('estoque:comprar', async (identidade, dados: unknown) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.estoque.registrarCompra(dados, identidade.usuarioId)
  })

  protegido('estoque:ajustar', async (identidade, dados: unknown) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.estoque.ajustar(dados, identidade.usuarioId)
  })

  protegido('cotacao:consultar', async (identidade) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.estoque.consultarCotacao()
  })

  protegido('cotacao:ultima', async (identidade) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.estoque.ultimaCotacao()
  })
  protegido('cotacao:historico', async (identidade, limite: number) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.estoque.historicoCotacoes(Math.min(Math.max(1, Number(limite) || 15), 100))
  })

  // ---- Lembretes e relatorios ---------------------------------------------
  // Lembretes passam pela API propria: ela e a dona do agendador e do envio.
  protegido('lembretes:status', () => servicos.apiPropria.status())

  // Devolve nome e e-mail de clientes: so quem opera a agenda.
  protegido('lembretes:pendentes', async (identidade) => {
    servicos.auth.exigirPerfil(identidade, 'DONO', 'RECEPCAO')
    return servicos.apiPropria.lembretesPendentes()
  })

  protegido('lembretes:enviar', async (identidade) => {
    servicos.auth.exigirPerfil(identidade, 'DONO', 'RECEPCAO')
    return servicos.apiPropria.executarLembretes()
  })

  // ---- Avisos internos para os profissionais -------------------------------
  // O envio passa pela API propria, a mesma que dispara os avisos sozinha as 09:00.
  protegido('avisos:enviarAmanha', async (identidade) => {
    servicos.auth.exigirPerfil(identidade, 'DONO', 'RECEPCAO')
    return servicos.apiPropria.executarAvisos(identidade.usuarioId)
  })

  protegido('avisos:enviados', async (identidade) => {
    servicos.auth.exigirPerfil(identidade, 'DONO', 'RECEPCAO')
    return servicos.avisos.enviadosParaAmanha()
  })

  protegido('avisos:meus', async (identidade) => {
    servicos.auth.exigirPerfil(identidade, 'PROFISSIONAL')
    return servicos.avisos.meus(servicos.auth.filtroProfissional(identidade) as number)
  })

  protegido('avisos:marcarLido', async (identidade, id: number) => {
    servicos.auth.exigirPerfil(identidade, 'PROFISSIONAL')
    return servicos.avisos.marcarLido(id, servicos.auth.filtroProfissional(identidade) as number)
  })

  protegido('avisos:remover', async (identidade, id: number) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    await servicos.avisos.remover(id)
    return true
  })

  protegido('relatorios:painel', (identidade) =>
    servicos.relatorios.painelInicial(
      servicos.auth.filtroProfissional(identidade),
      identidade.perfil === 'DONO'
    )
  )

  protegido('relatorios:faturamento', async (identidade, inicio: string, fim: string) => {
    servicos.auth.exigirPerfil(identidade, 'DONO')
    return servicos.relatorios.faturamentoPorProfissional(inicio, fim)
  })
}
