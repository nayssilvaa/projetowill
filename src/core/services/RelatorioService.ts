import { AtendimentoRepository } from '../repositories/AtendimentoRepository.js'
import { AgendamentoRepository } from '../repositories/AgendamentoRepository.js'
import { MaterialRepository } from '../repositories/MaterialRepository.js'
import { CotacaoRepository } from '../repositories/CotacaoRepository.js'
import type { AgendamentoDetalhado, CotacaoDolar, Material } from '../../shared/tipos.js'

export interface PainelInicial {
  agendamentosHoje: AgendamentoDetalhado[]
  retornosPendentes: Awaited<ReturnType<AtendimentoRepository['retornosPendentes']>>
  /** Dados de gestao: so o DONO recebe; para os outros perfis vem nulo. */
  materiaisEmFalta: Material[] | null
  ultimaCotacao: CotacaoDolar | null
  faturamentoMes: number | null
}

/** Data no horario local. toISOString() usaria UTC e viraria o dia as 21h no Brasil. */
function diaLocal(data: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`
}

function inicioDoDia(data = new Date()): string {
  return `${diaLocal(data)} 00:00:00`
}

function fimDoDia(data = new Date()): string {
  const amanha = new Date(data)
  amanha.setDate(amanha.getDate() + 1)
  return `${diaLocal(amanha)} 00:00:00`
}

export class RelatorioService {
  constructor(
    private readonly atendimentos = new AtendimentoRepository(),
    private readonly agendamentos = new AgendamentoRepository(),
    private readonly materiais = new MaterialRepository(),
    private readonly cotacoes = new CotacaoRepository()
  ) {}

  /**
   * @param profissionalId restringe a agenda do dia ao profissional logado
   * @param incluirGestao  faturamento, estoque e cotacao: so para o DONO
   */
  async painelInicial(profissionalId?: number, incluirGestao = false): Promise<PainelInicial> {
    const agora = new Date()
    const primeiroDoMes = `${diaLocal(new Date(agora.getFullYear(), agora.getMonth(), 1))} 00:00:00`
    const proximoMes = `${diaLocal(new Date(agora.getFullYear(), agora.getMonth() + 1, 1))} 00:00:00`

    const agendamentosHoje = await this.agendamentos.listarPorPeriodo(
      inicioDoDia(),
      fimDoDia(),
      profissionalId
    )
    // O profissional so ve os retornos dos proprios clientes.
    const retornos = await this.atendimentos.retornosPendentes()
    const retornosPendentes =
      profissionalId === undefined
        ? retornos
        : await this.filtrarRetornosDoProfissional(retornos, profissionalId)

    if (!incluirGestao) {
      return {
        agendamentosHoje,
        retornosPendentes,
        materiaisEmFalta: null,
        ultimaCotacao: null,
        faturamentoMes: null
      }
    }

    const faturamento = await this.atendimentos.faturamentoPorPeriodo(primeiroDoMes, proximoMes)
    return {
      agendamentosHoje,
      retornosPendentes,
      materiaisEmFalta: await this.materiais.abaixoDoMinimo(),
      ultimaCotacao: await this.cotacoes.maisRecente(),
      faturamentoMes: faturamento.reduce((soma, linha) => soma + linha.totalFaturado, 0)
    }
  }

  private async filtrarRetornosDoProfissional(
    retornos: PainelInicial['retornosPendentes'],
    profissionalId: number
  ): Promise<PainelInicial['retornosPendentes']> {
    const meus = new Set(await this.agendamentos.clientesDoProfissional(profissionalId))
    return retornos.filter((r) => meus.has(r.clienteId))
  }

  async faturamentoPorProfissional(inicio: string, fim: string) {
    return this.atendimentos.faturamentoPorPeriodo(`${inicio} 00:00:00`, `${fim} 23:59:59`)
  }
}
