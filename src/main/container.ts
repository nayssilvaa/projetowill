import { AuthService } from '../core/services/AuthService.js'
import { ClienteService } from '../core/services/ClienteService.js'
import { ProfissionalService } from '../core/services/ProfissionalService.js'
import { ProcedimentoService } from '../core/services/ProcedimentoService.js'
import { AgendaService } from '../core/services/AgendaService.js'
import { AtendimentoService } from '../core/services/AtendimentoService.js'
import { EstoqueService } from '../core/services/EstoqueService.js'
import { NotificacaoService } from '../core/services/NotificacaoService.js'
import { RelatorioService } from '../core/services/RelatorioService.js'

/** Instancia unica de cada servico, compartilhada por todos os handlers IPC. */
export const servicos = {
  auth: new AuthService(),
  clientes: new ClienteService(),
  profissionais: new ProfissionalService(),
  procedimentos: new ProcedimentoService(),
  agenda: new AgendaService(),
  atendimentos: new AtendimentoService(),
  estoque: new EstoqueService(),
  notificacoes: new NotificacaoService(),
  relatorios: new RelatorioService()
}

export type Servicos = typeof servicos
