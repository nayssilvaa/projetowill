import { AtendimentoRepository } from '../repositories/AtendimentoRepository.js'
import { AgendamentoRepository } from '../repositories/AgendamentoRepository.js'
import { MaterialRepository } from '../repositories/MaterialRepository.js'
import { CotacaoRepository } from '../repositories/CotacaoRepository.js'
import type { AgendamentoDetalhado, CotacaoDolar, Material } from '../../shared/tipos.js'

export interface PainelInicial {
  agendamentosHoje: AgendamentoDetalhado[]
  materiaisEmFalta: Material[]
  retornosPendentes: Awaited<ReturnType<AtendimentoRepository['retornosPendentes']>>
  ultimaCotacao: CotacaoDolar | null
  faturamentoMes: number
}

function inicioDoDia(data = new Date()): string {
  return `${data.toISOString().slice(0, 10)} 00:00:00`
}

function fimDoDia(data = new Date()): string {
  const amanha = new Date(data)
  amanha.setDate(amanha.getDate() + 1)
  return `${amanha.toISOString().slice(0, 10)} 00:00:00`
}

export class RelatorioService {
  constructor(
    private readonly atendimentos = new AtendimentoRepository(),
    private readonly agendamentos = new AgendamentoRepository(),
    private readonly materiais = new MaterialRepository(),
    private readonly cotacoes = new CotacaoRepository()
  ) {}

  async painelInicial(profissionalId?: number): Promise<PainelInicial> {
    const agora = new Date()
    const primeiroDoMes = `${agora.toISOString().slice(0, 8)}01 00:00:00`
    const proximoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1)
      .toISOString()
      .slice(0, 10)

    const faturamento = await this.atendimentos.faturamentoPorPeriodo(
      primeiroDoMes,
      `${proximoMes} 00:00:00`
    )

    return {
      agendamentosHoje: await this.agendamentos.listarPorPeriodo(
        inicioDoDia(),
        fimDoDia(),
        profissionalId
      ),
      materiaisEmFalta: await this.materiais.abaixoDoMinimo(),
      retornosPendentes: await this.atendimentos.retornosPendentes(),
      ultimaCotacao: await this.cotacoes.maisRecente(),
      faturamentoMes: faturamento.reduce((soma, linha) => soma + linha.totalFaturado, 0)
    }
  }

  async faturamentoPorProfissional(inicio: string, fim: string) {
    return this.atendimentos.faturamentoPorPeriodo(`${inicio} 00:00:00`, `${fim} 23:59:59`)
  }
}
