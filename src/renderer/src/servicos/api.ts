import { invocar, invocarPublico } from './ipc'
import type {
  Agendamento,
  AgendamentoDetalhado,
  Atendimento,
  AvisoProfissional,
  Cliente,
  CotacaoDolar,
  Material,
  MovimentacaoEstoque,
  Procedimento,
  ProcedimentoRealizado,
  Profissional,
  ResultadoAvisos,
  SessaoUsuario,
  Usuario
} from '@shared/tipos'

export interface EnderecoViaCep {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
}

export interface ItemHistorico {
  atendimentoId: number
  agendamentoId: number
  procedimentoNome: string
  profissionalNome: string
  realizadoEm: string
  valorCobrado: number
  anotacoesTecnicas: string | null
  dataRetornoSugerida: string | null
  retornoVencido: boolean
}

export interface FichaCliente {
  cliente: Cliente & { endereco: Record<string, string> | null }
  historico: ItemHistorico[]
  proximosAgendamentos: AgendamentoDetalhado[]
  totalGasto: number
  ultimoAtendimentoEm: string | null
}

export interface RetornoPendente {
  clienteId: number
  clienteNome: string
  clienteEmail: string | null
  procedimentoNome: string
  dataRetornoSugerida: string
  diasAtraso: number
}

export interface PainelInicial {
  agendamentosHoje: AgendamentoDetalhado[]
  retornosPendentes: RetornoPendente[]
  /** Dados de gestao: so chegam para o DONO; nos outros perfis vem nulo. */
  materiaisEmFalta: Material[] | null
  ultimaCotacao: CotacaoDolar | null
  faturamentoMes: number | null
}

export interface PainelCotacao {
  cotacao: CotacaoDolar
  alerta: boolean
  mensagem: string
  materiaisImportados: number
}

export interface ResultadoAtendimento {
  atendimento: Atendimento
  materiaisBaixados: Array<{ materialId: number; nome: string; quantidade: number }>
  alertasEstoque: Material[]
  dataRetornoSugerida: string | null
}

export interface ResultadoCompra {
  material: Material
  cotacaoUsada: CotacaoDolar | null
  custoTotalBrl: number
  custoUnitarioBrl: number
}

export interface ResultadoLembretes {
  analisados: number
  enviados: number
  simulados: number
  falhas: Array<{ agendamentoId: number; motivo: string }>
}

export interface StatusServicoLembretes {
  online: boolean
  agendadorAtivo: boolean
  emailConfigurado: boolean
  bancoOk: boolean
  pendentes: number
  verificadoEm: string
  erro?: string
}

export interface MaterialDoProcedimento {
  materialId: number
  materialNome: string
  unidade: string
  quantidadePadrao: number
  estoqueAtual: number
}

export interface ProcedimentoHabilitado extends Procedimento {
  precoPraticado: number | null
}

/** Fachada tipada sobre a ponte IPC: as telas nunca montam nome de canal a mao. */
export const api = {
  auth: {
    login: (email: string, senha: string) =>
      invocarPublico<SessaoUsuario>('auth:login', { email, senha }),
    alterarSenha: (atual: string, nova: string) =>
      invocar<boolean>('usuarios:alterarSenha', atual, nova)
  },

  usuarios: {
    listar: () => invocar<Usuario[]>('usuarios:listar'),
    criar: (dados: unknown) => invocar<Usuario>('usuarios:criar', dados),
    atualizar: (id: number, dados: unknown) => invocar<Usuario>('usuarios:atualizar', id, dados),
    remover: (id: number) => invocar<boolean>('usuarios:remover', id)
  },

  clientes: {
    listar: (apenasAtivos = true) => invocar<Cliente[]>('clientes:listar', apenasAtivos),
    buscar: (termo: string) => invocar<Cliente[]>('clientes:buscar', termo),
    ficha: (id: number) => invocar<FichaCliente>('clientes:ficha', id),
    consultarCep: (cep: string) => invocar<EnderecoViaCep>('clientes:consultarCep', cep),
    criar: (dados: unknown) => invocar<Cliente>('clientes:criar', dados),
    atualizar: (id: number, dados: unknown) => invocar<Cliente>('clientes:atualizar', id, dados),
    remover: (id: number) =>
      invocar<{ removido: boolean; desativado: boolean }>('clientes:remover', id)
  },

  profissionais: {
    listar: (apenasAtivos = true) => invocar<Profissional[]>('profissionais:listar', apenasAtivos),
    procedimentos: (id: number) =>
      invocar<ProcedimentoHabilitado[]>('profissionais:procedimentos', id),
    criar: (dados: unknown) => invocar<Profissional>('profissionais:criar', dados),
    atualizar: (id: number, dados: unknown) =>
      invocar<Profissional>('profissionais:atualizar', id, dados),
    remover: (id: number) =>
      invocar<{ removido: boolean; desativado: boolean }>('profissionais:remover', id),
    habilitar: (dados: unknown) =>
      invocar<ProcedimentoHabilitado[]>('profissionais:habilitar', dados),
    desabilitar: (pid: number, procId: number) =>
      invocar<ProcedimentoHabilitado[]>('profissionais:desabilitar', pid, procId)
  },

  procedimentos: {
    listar: (apenasAtivos = true) => invocar<Procedimento[]>('procedimentos:listar', apenasAtivos),
    materiais: (id: number) => invocar<MaterialDoProcedimento[]>('procedimentos:materiais', id),
    criar: (dados: unknown) => invocar<Procedimento>('procedimentos:criar', dados),
    atualizar: (id: number, dados: unknown) =>
      invocar<Procedimento>('procedimentos:atualizar', id, dados),
    remover: (id: number) =>
      invocar<{ removido: boolean; desativado: boolean }>('procedimentos:remover', id),
    vincularMaterial: (dados: unknown) =>
      invocar<MaterialDoProcedimento[]>('procedimentos:vincularMaterial', dados),
    desvincularMaterial: (pid: number, mid: number) =>
      invocar<MaterialDoProcedimento[]>('procedimentos:desvincularMaterial', pid, mid)
  },

  agenda: {
    listar: (inicio: string, fim: string, profissionalId?: number) =>
      invocar<AgendamentoDetalhado[]>('agenda:listar', inicio, fim, profissionalId),
    horariosLivres: (
      profissionalId: number,
      dia: string,
      procedimentoId: number,
      ignorarAgendamentoId?: number
    ) =>
      invocar<string[]>(
        'agenda:horariosLivres',
        profissionalId,
        dia,
        procedimentoId,
        ignorarAgendamentoId
      ),
    agendar: (dados: unknown) => invocar<Agendamento>('agenda:agendar', dados),
    atualizar: (id: number, dados: unknown) => invocar<Agendamento>('agenda:atualizar', id, dados),
    cancelar: (id: number, motivo?: string) =>
      invocar<Agendamento>('agenda:cancelar', id, motivo),
    remover: (id: number) => invocar<{ removido: boolean }>('agenda:remover', id)
  },

  atendimentos: {
    registrar: (dados: unknown) => invocar<ResultadoAtendimento>('atendimentos:registrar', dados),
    historicoCliente: (clienteId: number) =>
      invocar<ItemHistorico[]>('atendimentos:historicoCliente', clienteId),
    retornosPendentes: () => invocar<RetornoPendente[]>('atendimentos:retornosPendentes'),
    historicoRealizados: (inicio: string, fim: string, profissionalId?: number) =>
      invocar<ProcedimentoRealizado[]>(
        'atendimentos:historicoRealizados',
        inicio,
        fim,
        profissionalId
      ),
    estornar: (id: number) => invocar<boolean>('atendimentos:estornar', id)
  },

  estoque: {
    listar: (apenasAtivos = true) => invocar<Material[]>('estoque:listar', apenasAtivos),
    historico: (id: number) => invocar<MovimentacaoEstoque[]>('estoque:historico', id),
    emFalta: () => invocar<Material[]>('estoque:emFalta'),
    criar: (dados: unknown) => invocar<Material>('estoque:criar', dados),
    atualizar: (id: number, dados: unknown) => invocar<Material>('estoque:atualizar', id, dados),
    remover: (id: number) =>
      invocar<{ removido: boolean; desativado: boolean }>('estoque:remover', id),
    comprar: (dados: unknown) => invocar<ResultadoCompra>('estoque:comprar', dados),
    ajustar: (dados: unknown) => invocar<Material>('estoque:ajustar', dados)
  },

  cotacao: {
    consultar: () => invocar<PainelCotacao>('cotacao:consultar'),
    ultima: () => invocar<CotacaoDolar | null>('cotacao:ultima'),
    historico: (limite = 15) => invocar<CotacaoDolar[]>('cotacao:historico', limite)
  },

  avisos: {
    enviarAmanha: () => invocar<ResultadoAvisos>('avisos:enviarAmanha'),
    enviados: () => invocar<AvisoProfissional[]>('avisos:enviados'),
    meus: () => invocar<AvisoProfissional[]>('avisos:meus'),
    marcarLido: (id: number) => invocar<AvisoProfissional>('avisos:marcarLido', id),
    remover: (id: number) => invocar<boolean>('avisos:remover', id)
  },

  lembretes: {
    status: () => invocar<StatusServicoLembretes>('lembretes:status'),
    pendentes: () => invocar<AgendamentoDetalhado[]>('lembretes:pendentes'),
    enviar: () => invocar<ResultadoLembretes>('lembretes:enviar')
  },

  relatorios: {
    painel: () => invocar<PainelInicial>('relatorios:painel'),
    faturamento: (inicio: string, fim: string) =>
      invocar<Array<{ profissionalNome: string; totalAtendimentos: number; totalFaturado: number }>>(
        'relatorios:faturamento',
        inicio,
        fim
      )
  }
}
