import { contextBridge, ipcRenderer } from 'electron'

/**
 * Ponte entre o renderer e o processo principal.
 *
 * O renderer nao recebe `ipcRenderer` inteiro: so a funcao `invocar`, restrita a
 * uma lista fixa de canais. Assim um script injetado na interface nao consegue
 * inventar um canal novo nem falar direto com o Node.
 */
const CANAIS_PERMITIDOS = new Set([
  'auth:login',
  'auth:logout',
  'auth:sessao',
  'usuarios:listar',
  'usuarios:criar',
  'usuarios:atualizar',
  'usuarios:remover',
  'usuarios:alterarSenha',
  'clientes:listar',
  'clientes:buscar',
  'clientes:obter',
  'clientes:ficha',
  'clientes:consultarCep',
  'clientes:criar',
  'clientes:atualizar',
  'clientes:remover',
  'profissionais:listar',
  'profissionais:obter',
  'profissionais:procedimentos',
  'profissionais:criar',
  'profissionais:atualizar',
  'profissionais:remover',
  'profissionais:habilitar',
  'profissionais:desabilitar',
  'procedimentos:listar',
  'procedimentos:obter',
  'procedimentos:materiais',
  'procedimentos:criar',
  'procedimentos:atualizar',
  'procedimentos:remover',
  'procedimentos:vincularMaterial',
  'procedimentos:desvincularMaterial',
  'agenda:listar',
  'agenda:obter',
  'agenda:horariosLivres',
  'agenda:agendar',
  'agenda:atualizar',
  'agenda:cancelar',
  'agenda:remover',
  'atendimentos:listar',
  'atendimentos:obter',
  'atendimentos:historicoCliente',
  'atendimentos:retornosPendentes',
  'atendimentos:historicoRealizados',
  'atendimentos:registrar',
  'atendimentos:atualizar',
  'atendimentos:estornar',
  'estoque:listar',
  'estoque:obter',
  'estoque:historico',
  'estoque:emFalta',
  'estoque:criar',
  'estoque:atualizar',
  'estoque:remover',
  'estoque:comprar',
  'estoque:ajustar',
  'cotacao:consultar',
  'cotacao:ultima',
  'cotacao:historico',
  'avisos:enviarAmanha',
  'avisos:enviados',
  'avisos:meus',
  'avisos:marcarLido',
  'avisos:remover',
  'lembretes:status',
  'lembretes:pendentes',
  'lembretes:enviar',
  'relatorios:painel',
  'relatorios:faturamento'
])

contextBridge.exposeInMainWorld('api', {
  invocar: (canal: string, ...args: unknown[]): Promise<unknown> => {
    if (!CANAIS_PERMITIDOS.has(canal)) {
      return Promise.reject(new Error(`Canal IPC nao permitido: ${canal}`))
    }
    return ipcRenderer.invoke(canal, ...args)
  }
})
