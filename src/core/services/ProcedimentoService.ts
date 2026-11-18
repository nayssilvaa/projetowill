import { ProcedimentoRepository, type MaterialDoProcedimento } from '../repositories/ProcedimentoRepository.js'
import { MaterialRepository } from '../repositories/MaterialRepository.js'
import {
  procedimentoSchema,
  procedimentoUpdateSchema,
  vinculoProcedimentoMaterialSchema
} from '../../shared/validacao.js'
import { validar } from '../validacaoUtil.js'
import type { Procedimento } from '../../shared/tipos.js'

export class ProcedimentoService {
  constructor(
    private readonly procedimentos = new ProcedimentoRepository(),
    private readonly materiais = new MaterialRepository()
  ) {}

  async listar(apenasAtivos = true): Promise<Procedimento[]> {
    return this.procedimentos.listar(apenasAtivos)
  }

  async obter(id: number): Promise<Procedimento> {
    return this.procedimentos.obrigatorio(id)
  }

  async criar(entrada: unknown): Promise<Procedimento> {
    return this.procedimentos.criar(validar(procedimentoSchema, entrada, 'Procedimento'))
  }

  async atualizar(id: number, entrada: unknown): Promise<Procedimento> {
    return this.procedimentos.atualizar(
      id,
      validar(procedimentoUpdateSchema, entrada, 'Procedimento')
    )
  }

  async remover(id: number): Promise<{ removido: boolean; desativado: boolean }> {
    if (await this.procedimentos.temAgendamentos(id)) {
      await this.procedimentos.desativar(id)
      return { removido: false, desativado: true }
    }
    await this.procedimentos.remover(id)
    return { removido: true, desativado: false }
  }

  async listarMateriais(procedimentoId: number): Promise<MaterialDoProcedimento[]> {
    return this.procedimentos.listarMateriais(procedimentoId)
  }

  /** Ficha tecnica: define o que cada procedimento consome, base da baixa automatica. */
  async vincularMaterial(entrada: unknown): Promise<MaterialDoProcedimento[]> {
    const dados = validar(vinculoProcedimentoMaterialSchema, entrada, 'Ficha tecnica')
    await this.procedimentos.obrigatorio(dados.procedimentoId)
    await this.materiais.obrigatorio(dados.materialId)
    await this.procedimentos.vincularMaterial(
      dados.procedimentoId,
      dados.materialId,
      dados.quantidadePadrao
    )
    return this.procedimentos.listarMateriais(dados.procedimentoId)
  }

  async desvincularMaterial(
    procedimentoId: number,
    materialId: number
  ): Promise<MaterialDoProcedimento[]> {
    await this.procedimentos.desvincularMaterial(procedimentoId, materialId)
    return this.procedimentos.listarMateriais(procedimentoId)
  }
}
