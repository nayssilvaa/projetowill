import { ProfissionalRepository, type ProcedimentoHabilitado } from '../repositories/ProfissionalRepository.js'
import { UsuarioRepository } from '../repositories/UsuarioRepository.js'
import { ProcedimentoRepository } from '../repositories/ProcedimentoRepository.js'
import {
  profissionalSchema,
  profissionalUpdateSchema,
  vinculoProfissionalProcedimentoSchema
} from '../../shared/validacao.js'
import { validar } from '../validacaoUtil.js'
import { ConflictError } from '../errors.js'
import type { Profissional } from '../../shared/tipos.js'

export class ProfissionalService {
  constructor(
    private readonly profissionais = new ProfissionalRepository(),
    private readonly usuarios = new UsuarioRepository(),
    private readonly procedimentos = new ProcedimentoRepository()
  ) {}

  async listar(apenasAtivos = true): Promise<Profissional[]> {
    return this.profissionais.listar(apenasAtivos)
  }

  async obter(id: number): Promise<Profissional> {
    return this.profissionais.obrigatorio(id)
  }

  async criar(entrada: unknown): Promise<Profissional> {
    const dados = validar(profissionalSchema, entrada, 'Profissional')
    await this.usuarios.obrigatorio(dados.usuarioId)
    if (await this.profissionais.buscarPorUsuarioId(dados.usuarioId)) {
      throw new ConflictError('Esse usuario ja esta vinculado a um profissional.')
    }
    return this.profissionais.criar(dados)
  }

  async atualizar(id: number, entrada: unknown): Promise<Profissional> {
    return this.profissionais.atualizar(
      id,
      validar(profissionalUpdateSchema, entrada, 'Profissional')
    )
  }

  async remover(id: number): Promise<{ removido: boolean; desativado: boolean }> {
    if (await this.profissionais.temAgendamentos(id)) {
      await this.profissionais.desativar(id)
      return { removido: false, desativado: true }
    }
    await this.profissionais.remover(id)
    return { removido: true, desativado: false }
  }

  async listarProcedimentos(profissionalId: number): Promise<ProcedimentoHabilitado[]> {
    return this.profissionais.listarProcedimentos(profissionalId)
  }

  /** Define quais procedimentos cada profissional esta habilitado a executar. */
  async habilitarProcedimento(entrada: unknown): Promise<ProcedimentoHabilitado[]> {
    const dados = validar(vinculoProfissionalProcedimentoSchema, entrada, 'Habilitacao')
    await this.profissionais.obrigatorio(dados.profissionalId)
    await this.procedimentos.obrigatorio(dados.procedimentoId)
    await this.profissionais.vincularProcedimento(
      dados.profissionalId,
      dados.procedimentoId,
      dados.precoPraticado ?? null
    )
    return this.profissionais.listarProcedimentos(dados.profissionalId)
  }

  async desabilitarProcedimento(
    profissionalId: number,
    procedimentoId: number
  ): Promise<ProcedimentoHabilitado[]> {
    await this.profissionais.desvincularProcedimento(profissionalId, procedimentoId)
    return this.profissionais.listarProcedimentos(profissionalId)
  }
}
