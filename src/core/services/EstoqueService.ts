import { Database } from '../database/Database.js'
import { MaterialRepository } from '../repositories/MaterialRepository.js'
import { CotacaoRepository } from '../repositories/CotacaoRepository.js'
import { CambioClient } from '../integrations/CambioClient.js'
import {
  ajusteEstoqueSchema,
  compraMaterialSchema,
  materialSchema,
  materialUpdateSchema
} from '../../shared/validacao.js'
import { validar } from '../validacaoUtil.js'
import { ConflictError, ValidationError } from '../errors.js'
import { env } from '../config/env.js'
import type { CotacaoDolar, Material, MovimentacaoEstoque } from '../../shared/tipos.js'

export interface PainelCotacao {
  cotacao: CotacaoDolar
  alerta: boolean
  mensagem: string
  materiaisImportados: number
}

export interface ResultadoCompra {
  material: Material
  cotacaoUsada: CotacaoDolar | null
  custoTotalBrl: number
  custoUnitarioBrl: number
}

export class EstoqueService {
  constructor(
    private readonly db = Database.getInstance(),
    private readonly materiais = new MaterialRepository(),
    private readonly cotacoes = new CotacaoRepository(),
    private readonly cambio = new CambioClient()
  ) {}

  async listar(apenasAtivos = true): Promise<Material[]> {
    return this.materiais.listar(apenasAtivos)
  }

  async obter(id: number): Promise<Material> {
    return this.materiais.obrigatorio(id)
  }

  async criar(entrada: unknown): Promise<Material> {
    return this.materiais.criar(validar(materialSchema, entrada, 'Material'))
  }

  async atualizar(id: number, entrada: unknown): Promise<Material> {
    return this.materiais.atualizar(id, validar(materialUpdateSchema, entrada, 'Material'))
  }

  async remover(id: number): Promise<{ removido: boolean; desativado: boolean }> {
    if (await this.materiais.usadoEmProcedimentos(id)) {
      await this.materiais.desativar(id)
      return { removido: false, desativado: true }
    }
    await this.materiais.remover(id)
    return { removido: true, desativado: false }
  }

  async abaixoDoMinimo(): Promise<Material[]> {
    return this.materiais.abaixoDoMinimo()
  }

  async historico(materialId: number): Promise<MovimentacaoEstoque[]> {
    return this.materiais.historico(materialId)
  }

  /**
   * Consulta a cotacao do dolar e a registra no historico.
   * Responde ao pedido do dono: saber o cambio na hora de comprar material importado.
   */
  async consultarCotacao(): Promise<PainelCotacao> {
    const atual = await this.cambio.cotacaoDolar()
    const cotacao = await this.cotacoes.registrar(atual)
    const importados = await this.materiais.listarImportados()

    const alerta =
      cotacao.variacaoPct !== null && cotacao.variacaoPct >= env.cotacaoAlertaPercentual

    return {
      cotacao,
      alerta,
      mensagem: alerta
        ? `Dolar subiu ${cotacao.variacaoPct?.toFixed(2)}% hoje (R$ ${cotacao.valorBrl.toFixed(4)}). Talvez valha adiar a compra de material importado.`
        : `Dolar em R$ ${cotacao.valorBrl.toFixed(4)}.`,
      materiaisImportados: importados.length
    }
  }

  async ultimaCotacao(): Promise<CotacaoDolar | null> {
    return this.cotacoes.maisRecente()
  }

  async historicoCotacoes(limite = 30): Promise<CotacaoDolar[]> {
    return this.cotacoes.historico(limite)
  }

  /**
   * Entrada de material por compra. Se o material e importado e o preco veio em
   * dolar, busca a cotacao do momento e congela o cambio usado naquela compra.
   */
  async registrarCompra(entrada: unknown, usuarioId: number): Promise<ResultadoCompra> {
    const dados = validar(compraMaterialSchema, entrada, 'Compra de material')
    const material = await this.materiais.obrigatorio(dados.materialId)

    let cotacao: CotacaoDolar | null = null
    let custoUnitarioBrl = dados.custoUnitarioBrl ?? null

    if (material.importado && dados.precoUnitarioUsd != null) {
      const atual = await this.cambio.cotacaoDolar()
      cotacao = await this.cotacoes.registrar(atual)
      custoUnitarioBrl = Number((dados.precoUnitarioUsd * cotacao.valorBrl).toFixed(2))
    }

    if (custoUnitarioBrl == null) {
      throw new ValidationError(
        'Informe o custo unitario em reais, ou o preco em dolar para material importado.'
      )
    }

    await this.db.transaction(async (conn) => {
      await this.materiais.movimentar(conn, {
        materialId: dados.materialId,
        tipo: 'ENTRADA',
        quantidade: dados.quantidade,
        custoUnitarioBrl,
        cotacaoDolarId: cotacao?.id ?? null,
        usuarioId,
        observacao: dados.observacao ?? 'Compra de material'
      })
      if (dados.precoUnitarioUsd != null) {
        await conn.execute('UPDATE material SET preco_usd = ? WHERE id = ?', [
          dados.precoUnitarioUsd,
          dados.materialId
        ])
      }
    })

    return {
      material: await this.materiais.obrigatorio(dados.materialId),
      cotacaoUsada: cotacao,
      custoUnitarioBrl,
      custoTotalBrl: Number((custoUnitarioBrl * dados.quantidade).toFixed(2))
    }
  }

  /** Saida manual, perda ou acerto de inventario. */
  async ajustar(entrada: unknown, usuarioId: number): Promise<Material> {
    const dados = validar(ajusteEstoqueSchema, entrada, 'Ajuste de estoque')
    const material = await this.materiais.obrigatorio(dados.materialId)

    if (dados.tipo !== 'AJUSTE' && dados.quantidade > material.estoqueAtual) {
      throw new ConflictError(
        `Estoque insuficiente de ${material.nome}: disponivel ${material.estoqueAtual} ${material.unidade}.`
      )
    }

    await this.db.transaction(async (conn) => {
      await this.materiais.movimentar(conn, {
        materialId: dados.materialId,
        tipo: dados.tipo,
        quantidade: dados.quantidade,
        usuarioId,
        observacao: dados.observacao ?? null
      })
    })

    return this.materiais.obrigatorio(dados.materialId)
  }
}
