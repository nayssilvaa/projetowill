import { z } from 'zod'

/** Valida CPF pelos digitos verificadores, nao so pelo tamanho. */
export function cpfValido(cpf: string): boolean {
  const n = cpf.replace(/\D/g, '')
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false
  const digito = (ate: number): number => {
    let soma = 0
    for (let i = 0; i < ate; i++) soma += Number(n[i]) * (ate + 1 - i)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  return digito(9) === Number(n[9]) && digito(10) === Number(n[10])
}

const somenteDigitos = (v: string): string => v.replace(/\D/g, '')

export const cepSchema = z
  .string()
  .transform(somenteDigitos)
  .refine((v) => v.length === 8, 'CEP deve ter 8 digitos.')

export const cpfSchema = z
  .string()
  .transform(somenteDigitos)
  .refine(cpfValido, 'CPF invalido.')

export const loginSchema = z.object({
  email: z.email('E-mail invalido.').max(160),
  senha: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.').max(200)
})

export const usuarioSchema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome completo.').max(120),
  email: z.email('E-mail invalido.').max(160),
  senha: z
    .string()
    .min(8, 'A senha deve ter ao menos 8 caracteres.')
    .max(200)
    .regex(/[a-zA-Z]/, 'A senha deve conter ao menos uma letra.')
    .regex(/\d/, 'A senha deve conter ao menos um numero.'),
  perfil: z.enum(['DONO', 'PROFISSIONAL', 'RECEPCAO']),
  ativo: z.boolean().default(true)
})

export const usuarioUpdateSchema = usuarioSchema.partial().omit({ senha: true })

export const enderecoSchema = z.object({
  cep: cepSchema,
  logradouro: z.string().trim().min(3).max(160),
  numero: z.string().trim().max(20).nullish(),
  complemento: z.string().trim().max(80).nullish(),
  bairro: z.string().trim().max(120).nullish(),
  cidade: z.string().trim().min(2).max(120),
  uf: z.string().trim().length(2).toUpperCase()
})

export const clienteSchema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome completo.').max(140),
  cpf: cpfSchema.nullish(),
  email: z.email('E-mail invalido.').max(160).nullish(),
  telefone: z
    .string()
    .transform(somenteDigitos)
    .refine((v) => v === '' || (v.length >= 10 && v.length <= 11), 'Telefone invalido.')
    .nullish(),
  dataNascimento: z.iso.date('Data de nascimento invalida.').nullish(),
  endereco: enderecoSchema.nullish(),
  alergias: z.string().trim().max(2000).nullish(),
  observacoesSaude: z.string().trim().max(4000).nullish(),
  ativo: z.boolean().default(true)
})

export const clienteUpdateSchema = clienteSchema.partial()

export const profissionalSchema = z.object({
  usuarioId: z.number().int().positive(),
  registroConselho: z.string().trim().max(40).nullish(),
  comissaoPercentual: z.number().min(0, 'Comissao nao pode ser negativa.').max(100),
  bio: z.string().trim().max(2000).nullish(),
  ativo: z.boolean().default(true)
})

export const profissionalUpdateSchema = profissionalSchema.partial().omit({ usuarioId: true })

export const procedimentoSchema = z.object({
  nome: z.string().trim().min(3).max(140),
  categoria: z.enum(['TATUAGEM', 'PIERCING', 'ESTETICA', 'OUTRO']),
  descricao: z.string().trim().max(2000).nullish(),
  duracaoMinutos: z.number().int().min(5, 'Duracao minima de 5 minutos.').max(600),
  precoBase: z.number().min(0),
  diasRetornoSugerido: z.number().int().min(0).max(3650).nullish(),
  ativo: z.boolean().default(true)
})

export const procedimentoUpdateSchema = procedimentoSchema.partial()

export const agendamentoSchema = z.object({
  clienteId: z.number().int().positive(),
  profissionalId: z.number().int().positive(),
  procedimentoId: z.number().int().positive(),
  inicio: z.iso.datetime({ local: true }),
  observacoes: z.string().trim().max(2000).nullish()
})

export const agendamentoUpdateSchema = z.object({
  inicio: z.iso.datetime({ local: true }).optional(),
  profissionalId: z.number().int().positive().optional(),
  procedimentoId: z.number().int().positive().optional(),
  status: z.enum(['AGENDADO', 'CONFIRMADO', 'REALIZADO', 'CANCELADO', 'FALTOU']).optional(),
  observacoes: z.string().trim().max(2000).nullish()
})

export const atendimentoSchema = z.object({
  agendamentoId: z.number().int().positive(),
  valorCobrado: z.number().min(0),
  formaPagamento: z.enum(['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'OUTRO']),
  anotacoesTecnicas: z.string().trim().max(4000).nullish(),
  materiaisConsumidos: z
    .array(
      z.object({
        materialId: z.number().int().positive(),
        quantidade: z.number().positive()
      })
    )
    .default([])
})

export const materialSchema = z.object({
  nome: z.string().trim().min(2).max(140),
  unidade: z.string().trim().min(1).max(20).default('un'),
  importado: z.boolean().default(false),
  precoUsd: z.number().min(0).nullish(),
  estoqueMinimo: z.number().min(0).default(0),
  ativo: z.boolean().default(true)
})

export const materialUpdateSchema = materialSchema.partial()

export const compraMaterialSchema = z.object({
  materialId: z.number().int().positive(),
  quantidade: z.number().positive('Quantidade deve ser maior que zero.'),
  precoUnitarioUsd: z.number().min(0).nullish(),
  custoUnitarioBrl: z.number().min(0).nullish(),
  observacao: z.string().trim().max(255).nullish()
})

export const ajusteEstoqueSchema = z.object({
  materialId: z.number().int().positive(),
  tipo: z.enum(['SAIDA', 'AJUSTE', 'PERDA']),
  quantidade: z.number().positive(),
  observacao: z.string().trim().max(255).nullish()
})

export const vinculoProcedimentoMaterialSchema = z.object({
  procedimentoId: z.number().int().positive(),
  materialId: z.number().int().positive(),
  quantidadePadrao: z.number().positive()
})

export const vinculoProfissionalProcedimentoSchema = z.object({
  profissionalId: z.number().int().positive(),
  procedimentoId: z.number().int().positive(),
  precoPraticado: z.number().min(0).nullish()
})

export type LoginInput = z.infer<typeof loginSchema>
export type UsuarioInput = z.infer<typeof usuarioSchema>
export type ClienteInput = z.infer<typeof clienteSchema>
export type EnderecoInput = z.infer<typeof enderecoSchema>
export type ProfissionalInput = z.infer<typeof profissionalSchema>
export type ProcedimentoInput = z.infer<typeof procedimentoSchema>
export type AgendamentoInput = z.infer<typeof agendamentoSchema>
export type AtendimentoInput = z.infer<typeof atendimentoSchema>
export type MaterialInput = z.infer<typeof materialSchema>
export type CompraMaterialInput = z.infer<typeof compraMaterialSchema>
export type AjusteEstoqueInput = z.infer<typeof ajusteEstoqueSchema>
