export type PerfilUsuario = 'DONO' | 'PROFISSIONAL' | 'RECEPCAO'
export type CategoriaProcedimento = 'TATUAGEM' | 'PIERCING' | 'ESTETICA' | 'OUTRO'
export type StatusAgendamento = 'AGENDADO' | 'CONFIRMADO' | 'REALIZADO' | 'CANCELADO' | 'FALTOU'
export type FormaPagamento = 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO' | 'OUTRO'
export type TipoMovimentacao = 'ENTRADA' | 'SAIDA' | 'AJUSTE' | 'PERDA'

export interface Usuario {
  id: number
  nome: string
  email: string
  perfil: PerfilUsuario
  ativo: boolean
}

export interface Endereco {
  id: number
  cep: string
  logradouro: string
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string
  uf: string
}

export interface Cliente {
  id: number
  nome: string
  cpf: string | null
  email: string | null
  telefone: string | null
  dataNascimento: string | null
  enderecoId: number | null
  alergias: string | null
  observacoesSaude: string | null
  ativo: boolean
}

export interface Profissional {
  id: number
  usuarioId: number
  nome: string
  email: string
  registroConselho: string | null
  comissaoPercentual: number
  bio: string | null
  ativo: boolean
}

export interface Procedimento {
  id: number
  nome: string
  categoria: CategoriaProcedimento
  descricao: string | null
  duracaoMinutos: number
  precoBase: number
  diasRetornoSugerido: number | null
  ativo: boolean
}

export interface Agendamento {
  id: number
  clienteId: number
  profissionalId: number
  procedimentoId: number
  inicio: string
  fim: string
  status: StatusAgendamento
  observacoes: string | null
  lembreteEnviadoEm: string | null
}

export interface AgendamentoDetalhado extends Agendamento {
  clienteNome: string
  clienteEmail: string | null
  profissionalNome: string
  procedimentoNome: string
}

export interface Atendimento {
  id: number
  agendamentoId: number
  realizadoEm: string
  valorCobrado: number
  formaPagamento: FormaPagamento
  anotacoesTecnicas: string | null
  dataRetornoSugerida: string | null
}

export interface Material {
  id: number
  nome: string
  unidade: string
  importado: boolean
  precoUsd: number | null
  estoqueAtual: number
  estoqueMinimo: number
  ativo: boolean
}

export interface CotacaoDolar {
  id: number
  valorBrl: number
  variacaoPct: number | null
  fonte: string
  consultadaEm: string
}

export interface MovimentacaoEstoque {
  id: number
  materialId: number
  tipo: TipoMovimentacao
  quantidade: number
  custoUnitarioBrl: number | null
  cotacaoDolarId: number | null
  atendimentoId: number | null
  usuarioId: number | null
  observacao: string | null
  criadoEm: string
}

export interface SessaoUsuario {
  usuario: Usuario
  profissionalId: number | null
  token: string
  expiraEm: number
}

/** Resposta padrao de toda chamada IPC: nunca lanca excecao atraves da ponte. */
export type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: string; codigo: string }
