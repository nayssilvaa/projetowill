import { AuthService } from '../src/core/services/AuthService.js'
import { ClienteService } from '../src/core/services/ClienteService.js'
import { AgendaService } from '../src/core/services/AgendaService.js'
import { AtendimentoService } from '../src/core/services/AtendimentoService.js'
import { EstoqueService } from '../src/core/services/EstoqueService.js'
import { ProfissionalService } from '../src/core/services/ProfissionalService.js'
import { Database } from '../src/core/database/Database.js'

const auth = new AuthService()
const clientes = new ClienteService()
const agenda = new AgendaService()
const atendimentos = new AtendimentoService()
const estoque = new EstoqueService()
const profissionais = new ProfissionalService()

let passou = 0
let falhou = 0

async function teste(nome: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
    console.log(`  OK   ${nome}`)
    passou++
  } catch (erro) {
    console.log(`  FALHA ${nome}`)
    console.log(`        ${erro instanceof Error ? erro.message : erro}`)
    falhou++
  }
}

function afirmar(condicao: boolean, mensagem: string): void {
  if (!condicao) throw new Error(mensagem)
}

async function esperaErro(fn: () => Promise<unknown>, trecho: string): Promise<void> {
  try {
    await fn()
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message : String(erro)
    afirmar(msg.toLowerCase().includes(trecho.toLowerCase()), `erro inesperado: ${msg}`)
    return
  }
  throw new Error(`esperava falhar com "${trecho}", mas passou`)
}

async function main(): Promise<void> {
  console.log('\n== Autenticacao e controle de acesso ==')

  const sessaoDono = await auth.login({ email: 'dono@estudio.com', senha: 'Estudio@2026' })
  const sessaoProf = await auth.login({ email: 'marina@estudio.com', senha: 'Estudio@2026' })

  await teste('login do dono devolve perfil DONO', async () => {
    afirmar(sessaoDono.usuario.perfil === 'DONO', 'perfil errado')
  })

  await teste('senha errada e recusada', () =>
    esperaErro(() => auth.login({ email: 'dono@estudio.com', senha: 'senhaerrada1' }), 'credenciais')
  )

  await teste('e-mail inexistente e recusado sem revelar nada', () =>
    esperaErro(() => auth.login({ email: 'ninguem@estudio.com', senha: 'Estudio@2026' }), 'credenciais')
  )

  await teste('token adulterado e rejeitado', () =>
    esperaErro(async () => auth.autenticar(`${sessaoDono.token}x`), 'sessao invalida')
  )

  await teste('profissional nao acessa agenda de outro', () => {
    const identidade = auth.autenticar(sessaoProf.token)
    const outro = sessaoProf.profissionalId === 1 ? 2 : 1
    return esperaErro(async () => auth.filtroProfissional(identidade, outro), 'permissao')
  })

  await teste('profissional nao pode criar usuario', () => {
    const identidade = auth.autenticar(sessaoProf.token)
    return esperaErro(async () => auth.exigirPerfil(identidade, 'DONO'), 'permissao')
  })

  console.log('\n== Validacao de entrada ==')

  await teste('CPF invalido e rejeitado', () =>
    esperaErro(() => clientes.criar({ nome: 'Teste Silva', cpf: '11111111111' }), 'invalid')
  )

  await teste('nome muito curto e rejeitado', () =>
    esperaErro(() => clientes.criar({ nome: 'Ze' }), 'invalid')
  )

  await teste('senha fraca e rejeitada', () =>
    esperaErro(
      () => auth.criarUsuario({ nome: 'Teste Novo', email: 't@t.com', senha: '123', perfil: 'RECEPCAO' }),
      'invalid'
    )
  )

  console.log('\n== API externa: ViaCEP ==')

  await teste('CEP valido preenche o endereco', async () => {
    const endereco = await clientes.consultarCep('01310-100')
    afirmar(endereco.cidade === 'São Paulo', `cidade inesperada: ${endereco.cidade}`)
    afirmar(endereco.uf === 'SP', 'uf inesperada')
    afirmar(endereco.logradouro.includes('Paulista'), 'logradouro inesperado')
  })

  await teste('CEP malformado e rejeitado antes de chamar a API', () =>
    esperaErro(() => clientes.consultarCep('123'), '8 digitos')
  )

  console.log('\n== API externa: cotacao do dolar ==')

  await teste('cotacao e consultada e gravada', async () => {
    const painel = await estoque.consultarCotacao()
    afirmar(painel.cotacao.valorBrl > 1 && painel.cotacao.valorBrl < 20, 'cotacao fora do esperado')
    afirmar(painel.cotacao.id > 0, 'cotacao nao foi gravada')
  })

  console.log('\n== Regras da agenda ==')

  const listaProfissionais = await profissionais.listar()
  const marina = listaProfissionais.find((p) => p.nome.startsWith('Marina'))!
  const diego = listaProfissionais.find((p) => p.nome.startsWith('Diego'))!
  const habilidadesMarina = await profissionais.listarProcedimentos(marina.id)
  const tatuagem = habilidadesMarina.find((p) => p.nome.includes('pequena'))!

  const listaClientes = await clientes.listar()
  const cliente = listaClientes[0]

  // Dia util bem no futuro, para nao colidir com o seed.
  const futuro = new Date()
  futuro.setDate(futuro.getDate() + 45)
  const dia = futuro.toISOString().slice(0, 10)

  let agendamentoId = 0

  await teste('horarios livres respeitam a duracao do procedimento', async () => {
    const livres = await agenda.horariosLivres(marina.id, dia, tatuagem.id)
    afirmar(livres.length > 0, 'nenhum horario livre devolvido')
    afirmar(livres.every((h) => h.startsWith(dia)), 'horario fora do dia pedido')
  })

  await teste('agendamento e criado', async () => {
    const criado = await agenda.agendar({
      clienteId: cliente.id,
      profissionalId: marina.id,
      procedimentoId: tatuagem.id,
      inicio: `${dia}T10:00`
    })
    agendamentoId = criado.id
    afirmar(criado.fim.slice(11) === '12:00', `fim calculado errado: ${criado.fim}`)
  })

  await teste('horario sobreposto e bloqueado', () =>
    esperaErro(
      () =>
        agenda.agendar({
          clienteId: cliente.id,
          profissionalId: marina.id,
          procedimentoId: tatuagem.id,
          inicio: `${dia}T11:00`
        }),
      'ja tem um atendimento'
    )
  )

  await teste('profissional nao habilitado e bloqueado', () =>
    esperaErro(
      () =>
        agenda.agendar({
          clienteId: cliente.id,
          profissionalId: diego.id,
          procedimentoId: tatuagem.id,
          inicio: `${dia}T15:00`
        }),
      'nao esta habilitado'
    )
  )

  console.log('\n== Atendimento: baixa de estoque e retorno ==')

  const materiaisAntes = await estoque.listar()
  const mapaAntes = new Map(materiaisAntes.map((m) => [m.id, m.estoqueAtual]))
  let atendimentoId = 0

  await teste('registrar atendimento baixa o estoque e calcula o retorno', async () => {
    const r = await atendimentos.registrar(
      {
        agendamentoId,
        valorCobrado: 450,
        formaPagamento: 'PIX',
        anotacoesTecnicas: 'Teste automatizado.'
      },
      sessaoDono.usuario.id
    )
    atendimentoId = r.atendimento.id

    afirmar(r.materiaisBaixados.length > 0, 'nenhum material baixado')
    afirmar(r.dataRetornoSugerida !== null, 'retorno nao calculado')

    const depois = await estoque.listar()
    for (const item of r.materiaisBaixados) {
      const antes = mapaAntes.get(item.materialId)!
      const agora = depois.find((m) => m.id === item.materialId)!.estoqueAtual
      afirmar(
        Math.abs(antes - item.quantidade - agora) < 0.001,
        `estoque errado no material ${item.materialId}: ${antes} -> ${agora}`
      )
    }
  })

  await teste('atendimento duplicado e bloqueado', () =>
    esperaErro(
      () =>
        atendimentos.registrar(
          { agendamentoId, valorCobrado: 100, formaPagamento: 'PIX' },
          sessaoDono.usuario.id
        ),
      'ja tem atendimento'
    )
  )

  await teste('agendamento com atendimento nao pode ser excluido', () =>
    esperaErro(() => agenda.remover(agendamentoId), 'historico')
  )

  await teste('historico do cliente mostra o atendimento', async () => {
    const historico = await atendimentos.historicoDoCliente(cliente.id)
    afirmar(
      historico.some((h) => h.atendimentoId === atendimentoId),
      'atendimento nao apareceu no historico'
    )
  })

  await teste('estorno devolve o estoque ao valor original', async () => {
    await atendimentos.estornar(atendimentoId, sessaoDono.usuario.id)
    const depois = await estoque.listar()
    for (const [id, valor] of mapaAntes) {
      const agora = depois.find((m) => m.id === id)?.estoqueAtual
      if (agora === undefined) continue
      afirmar(Math.abs(valor - agora) < 0.001, `estoque nao voltou no material ${id}`)
    }
  })

  console.log('\n== Estoque ==')

  await teste('saida maior que o estoque e bloqueada', async () => {
    const material = (await estoque.listar())[0]
    await esperaErro(
      () =>
        estoque.ajustar(
          { materialId: material.id, tipo: 'SAIDA', quantidade: material.estoqueAtual + 9999 },
          sessaoDono.usuario.id
        ),
      'insuficiente'
    )
  })

  await teste('compra de material importado congela a cotacao', async () => {
    const importado = (await estoque.listar()).find((m) => m.importado)!
    const antes = importado.estoqueAtual
    const r = await estoque.registrarCompra(
      { materialId: importado.id, quantidade: 5, precoUnitarioUsd: 10 },
      sessaoDono.usuario.id
    )
    afirmar(r.cotacaoUsada !== null, 'cotacao nao foi registrada na compra')
    afirmar(r.custoUnitarioBrl > 10, 'custo em reais nao foi convertido')
    afirmar(Math.abs(r.material.estoqueAtual - (antes + 5)) < 0.001, 'estoque nao aumentou')

    await estoque.ajustar(
      { materialId: importado.id, tipo: 'AJUSTE', quantidade: antes },
      sessaoDono.usuario.id
    )
  })

  // Limpa o agendamento de teste.
  await agenda.remover(agendamentoId).catch(() => undefined)

  console.log(`\n${passou} testes passaram, ${falhou} falharam.\n`)
  await Database.getInstance().close()
  process.exit(falhou > 0 ? 1 : 0)
}

main().catch(async (erro) => {
  console.error('Erro fatal:', erro)
  await Database.getInstance().close().catch(() => undefined)
  process.exit(1)
})
