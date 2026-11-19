import bcrypt from 'bcryptjs'
import { Database } from '../src/core/database/Database.js'

/**
 * Popula o banco com um cenario realista do estudio para desenvolvimento e demonstracao.
 * E idempotente: limpa as tabelas antes de inserir.
 */

const db = Database.getInstance()

function emDias(dias: number, hora = 10, minuto = 0): string {
  const data = new Date()
  data.setDate(data.getDate() + dias)
  data.setHours(hora, minuto, 0, 0)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())} ${pad(data.getHours())}:${pad(data.getMinutes())}:00`
}

function somarMinutos(dataSql: string, minutos: number): string {
  const data = new Date(dataSql.replace(' ', 'T'))
  data.setMinutes(data.getMinutes() + minutos)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())} ${pad(data.getHours())}:${pad(data.getMinutes())}:00`
}

async function limpar(): Promise<void> {
  await db.execute('SET FOREIGN_KEY_CHECKS = 0')
  for (const tabela of [
    'movimentacao_estoque',
    'atendimento',
    'agendamento',
    'procedimento_material',
    'profissional_procedimento',
    'cotacao_dolar',
    'material',
    'procedimento',
    'profissional',
    'cliente',
    'endereco',
    'usuario'
  ]) {
    await db.execute(`TRUNCATE TABLE ${tabela}`)
  }
  await db.execute('SET FOREIGN_KEY_CHECKS = 1')
}

async function main(): Promise<void> {
  console.log('Limpando dados anteriores...')
  await limpar()

  const senha = await bcrypt.hash('Estudio@2026', 12)

  console.log('Criando usuarios...')
  const usuarios = [
    ['Will Cotil', 'dono@estudio.com', 'DONO'],
    ['Recepcao Estudio', 'recepcao@estudio.com', 'RECEPCAO'],
    ['Marina Alves', 'marina@estudio.com', 'PROFISSIONAL'],
    ['Diego Prado', 'diego@estudio.com', 'PROFISSIONAL'],
    ['Thais Moreno', 'thais@estudio.com', 'PROFISSIONAL']
  ] as const

  const usuarioIds: number[] = []
  for (const [nome, email, perfil] of usuarios) {
    const r = await db.execute(
      'INSERT INTO usuario (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)',
      [nome, email, senha, perfil]
    )
    usuarioIds.push(r.insertId)
  }

  console.log('Criando profissionais...')
  const profissionalIds: number[] = []
  for (const [indice, comissao, registro, bio] of [
    [2, 45, 'TAT-0291', 'Tatuadora, especialista em fineline e blackwork.'],
    [3, 40, 'PIE-1130', 'Body piercer certificado, 8 anos de experiencia.'],
    [4, 50, 'EST-4477', 'Esteticista, limpeza de pele e pos-procedimento.']
  ] as const) {
    const r = await db.execute(
      'INSERT INTO profissional (usuario_id, registro_conselho, comissao_percentual, bio) VALUES (?, ?, ?, ?)',
      [usuarioIds[indice], registro, comissao, bio]
    )
    profissionalIds.push(r.insertId)
  }

  console.log('Criando enderecos e clientes...')
  const enderecos = [
    ['01310100', 'Avenida Paulista', '1578', 'Bela Vista', 'Sao Paulo', 'SP'],
    ['04538133', 'Avenida Brigadeiro Faria Lima', '3477', 'Itaim Bibi', 'Sao Paulo', 'SP'],
    ['05407002', 'Rua Teodoro Sampaio', '1020', 'Pinheiros', 'Sao Paulo', 'SP'],
    ['03164200', 'Rua Padre Adelino', '700', 'Belenzinho', 'Sao Paulo', 'SP']
  ] as const

  const enderecoIds: number[] = []
  for (const [cep, logradouro, numero, bairro, cidade, uf] of enderecos) {
    const r = await db.execute(
      'INSERT INTO endereco (cep, logradouro, numero, bairro, cidade, uf) VALUES (?, ?, ?, ?, ?, ?)',
      [cep, logradouro, numero, bairro, cidade, uf]
    )
    enderecoIds.push(r.insertId)
  }

  const clientes = [
    ['Ana Beatriz Souza', '52998224725', 'ana.souza@email.com', '11991234567', '1996-04-12', 0, 'Alergia a latex.', null],
    ['Carlos Eduardo Lima', '16899535009', 'carlos.lima@email.com', '11987654321', '1990-11-03', 1, null, 'Usa anticoagulante; avaliar antes de tatuar.'],
    ['Juliana Prado', '11144477735', 'juliana.prado@email.com', '11996543210', '2000-02-27', 2, null, null],
    ['Rafael Nunes', '39053344705', 'rafael.nunes@email.com', '11993456789', '1988-07-19', 3, 'Alergia a niquel: usar joia de titanio.', null]
  ] as const

  const clienteIds: number[] = []
  for (const [nome, cpf, email, telefone, nascimento, idxEndereco, alergias, obs] of clientes) {
    const r = await db.execute(
      `INSERT INTO cliente (nome, cpf, email, telefone, data_nascimento, endereco_id, alergias, observacoes_saude)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nome, cpf, email, telefone, nascimento, enderecoIds[idxEndereco], alergias, obs]
    )
    clienteIds.push(r.insertId)
  }

  console.log('Criando procedimentos...')
  const procedimentos = [
    ['Tatuagem pequena (ate 10cm)', 'TATUAGEM', 120, 450.0, 30],
    ['Tatuagem media (sessao 3h)', 'TATUAGEM', 180, 900.0, 30],
    ['Retoque de tatuagem', 'TATUAGEM', 60, 0.0, null],
    ['Piercing na orelha', 'PIERCING', 30, 180.0, 45],
    ['Piercing no septo', 'PIERCING', 40, 220.0, 45],
    ['Troca de joia', 'PIERCING', 20, 80.0, null],
    ['Limpeza de pele profunda', 'ESTETICA', 90, 250.0, 30],
    ['Peeling quimico', 'ESTETICA', 60, 320.0, 21],
    ['Design de sobrancelha', 'ESTETICA', 30, 70.0, 25]
  ] as const

  const procedimentoIds: number[] = []
  for (const [nome, categoria, duracao, preco, retorno] of procedimentos) {
    const r = await db.execute(
      `INSERT INTO procedimento (nome, categoria, duracao_minutos, preco_base, dias_retorno_sugerido)
       VALUES (?, ?, ?, ?, ?)`,
      [nome, categoria, duracao, preco, retorno]
    )
    procedimentoIds.push(r.insertId)
  }

  console.log('Habilitando profissionais nos procedimentos...')
  // Marina: tatuagens | Diego: piercings | Thais: estetica
  const habilitacoes: Array<[number, number[]]> = [
    [0, [0, 1, 2]],
    [1, [3, 4, 5]],
    [2, [6, 7, 8]]
  ]
  for (const [idxProf, procs] of habilitacoes) {
    for (const idxProc of procs) {
      await db.execute(
        'INSERT INTO profissional_procedimento (profissional_id, procedimento_id) VALUES (?, ?)',
        [profissionalIds[idxProf], procedimentoIds[idxProc]]
      )
    }
  }

  console.log('Criando materiais...')
  const materiais = [
    ['Tinta preta Eternal Ink 30ml', 'un', true, 24.9, 12, 5],
    ['Tinta vermelha Eternal Ink 30ml', 'un', true, 26.5, 4, 5],
    ['Agulha RL 07 descartavel', 'un', true, 1.2, 180, 100],
    ['Agulha MG 09 descartavel', 'un', true, 1.4, 60, 100],
    ['Luva nitrilica (par)', 'par', false, null, 320, 150],
    ['Filme protetor 10cm x 10m', 'rolo', false, null, 6, 3],
    ['Joia de titanio ASTM F136', 'un', true, 18.0, 25, 10],
    ['Pomada cicatrizante 30g', 'un', false, null, 14, 6],
    ['Acido salicilico 2% 100ml', 'un', false, null, 3, 4],
    ['Mascara calmante pos-peeling', 'un', false, null, 22, 8],
    ['Gaze esteril pacote', 'pct', false, null, 40, 15]
  ] as const

  const materialIds: number[] = []
  for (const [nome, unidade, importado, usd, estoque, minimo] of materiais) {
    const r = await db.execute(
      `INSERT INTO material (nome, unidade, importado, preco_usd, estoque_atual, estoque_minimo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nome, unidade, importado, usd, estoque, minimo]
    )
    materialIds.push(r.insertId)
  }

  console.log('Montando a ficha tecnica dos procedimentos...')
  const fichas: Array<[number, Array<[number, number]>]> = [
    [0, [[0, 0.3], [2, 3], [4, 2], [5, 0.2], [7, 0.4], [10, 1]]],
    [1, [[0, 0.8], [1, 0.3], [2, 5], [3, 3], [4, 4], [5, 0.5], [7, 1], [10, 2]]],
    [2, [[0, 0.2], [2, 2], [4, 2], [7, 0.3]]],
    [3, [[6, 1], [4, 1], [10, 1]]],
    [4, [[6, 1], [4, 1], [10, 2]]],
    [5, [[6, 1], [4, 1]]],
    [6, [[4, 1], [8, 0.2], [9, 1], [10, 2]]],
    [7, [[4, 1], [8, 0.5], [9, 1]]],
    [8, [[4, 1], [10, 1]]]
  ]
  for (const [idxProc, itens] of fichas) {
    for (const [idxMat, quantidade] of itens) {
      await db.execute(
        'INSERT INTO procedimento_material (procedimento_id, material_id, quantidade_padrao) VALUES (?, ?, ?)',
        [procedimentoIds[idxProc], materialIds[idxMat], quantidade]
      )
    }
  }

  console.log('Criando cotacoes do dolar...')
  const cotacaoIds: number[] = []
  for (const [valor, variacao, diasAtras] of [
    [5.3821, -0.42, 20],
    [5.4615, 1.48, 10],
    [5.5902, 2.36, 2]
  ] as const) {
    const r = await db.execute(
      'INSERT INTO cotacao_dolar (valor_brl, variacao_pct, consultada_em) VALUES (?, ?, DATE_SUB(NOW(), INTERVAL ? DAY))',
      [valor, variacao, diasAtras]
    )
    cotacaoIds.push(r.insertId)
  }

  console.log('Criando agendamentos...')
  // Passados (viram historico), de hoje e futuros (alvo dos lembretes).
  const agenda: Array<[number, number, number, string, string]> = [
    [0, 0, 0, emDias(-45, 14), 'REALIZADO'],
    [1, 1, 3, emDias(-30, 11), 'REALIZADO'],
    [2, 2, 6, emDias(-25, 16), 'REALIZADO'],
    [0, 2, 8, emDias(-12, 9, 30), 'REALIZADO'],
    [3, 1, 4, emDias(-5, 15), 'REALIZADO'],
    [1, 0, 1, emDias(0, 14), 'CONFIRMADO'],
    [2, 2, 7, emDias(0, 17), 'AGENDADO'],
    [3, 0, 0, emDias(1, 10), 'AGENDADO'],
    [0, 1, 5, emDias(1, 16), 'CONFIRMADO'],
    [2, 0, 2, emDias(4, 11), 'AGENDADO'],
    [1, 2, 6, emDias(6, 9), 'AGENDADO']
  ]

  const agendamentoIds: number[] = []
  for (const [idxCliente, idxProf, idxProc, inicio, status] of agenda) {
    const duracao = procedimentos[idxProc][2]
    const r = await db.execute(
      `INSERT INTO agendamento (cliente_id, profissional_id, procedimento_id, inicio, fim, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        clienteIds[idxCliente],
        profissionalIds[idxProf],
        procedimentoIds[idxProc],
        inicio,
        somarMinutos(inicio, duracao),
        status
      ]
    )
    agendamentoIds.push(r.insertId)
  }

  console.log('Registrando atendimentos do historico...')
  const atendimentos: Array<[number, number, number, string, string | null]> = [
    [0, 0, 450, 'PIX', 'Fineline no antebraco. Cliente tolerou bem.'],
    [1, 3, 180, 'CREDITO', 'Lobulo direito. Joia de titanio.'],
    [2, 6, 250, 'DEBITO', 'Pele mista, extracao leve.'],
    [3, 8, 70, 'DINHEIRO', null],
    [4, 4, 220, 'PIX', 'Septo. Orientado sobre higienizacao.']
  ]

  for (const [idxAgendamento, idxProc, valor, pagamento, anotacoes] of atendimentos) {
    const retorno = procedimentos[idxProc][4]
    await db.execute(
      `INSERT INTO atendimento (agendamento_id, realizado_em, valor_cobrado, forma_pagamento, anotacoes_tecnicas, data_retorno_sugerida)
       SELECT a.id, a.inicio, ?, ?, ?, ${retorno === null ? 'NULL' : `DATE_ADD(DATE(a.inicio), INTERVAL ${retorno} DAY)`}
       FROM agendamento a WHERE a.id = ?`,
      [valor, pagamento, anotacoes, agendamentoIds[idxAgendamento]]
    )
  }

  console.log('Registrando movimentacoes de estoque...')
  await db.execute(
    `INSERT INTO movimentacao_estoque (material_id, tipo, quantidade, custo_unitario_brl, cotacao_dolar_id, usuario_id, observacao)
     VALUES (?, 'ENTRADA', 10, ?, ?, ?, 'Compra inicial de tinta importada')`,
    [materialIds[0], (24.9 * 5.3821).toFixed(2), cotacaoIds[0], usuarioIds[0]]
  )
  await db.execute(
    `INSERT INTO movimentacao_estoque (material_id, tipo, quantidade, custo_unitario_brl, cotacao_dolar_id, usuario_id, observacao)
     VALUES (?, 'ENTRADA', 200, ?, ?, ?, 'Compra de agulhas importadas')`,
    [materialIds[2], (1.2 * 5.4615).toFixed(2), cotacaoIds[1], usuarioIds[0]]
  )

  const [{ total: totalTabelas }] = await db.query<never>(
    "SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME <> '_migracao'"
  )

  console.log('\nSeed concluido.')
  console.log(`  ${totalTabelas} tabelas populadas`)
  console.log(`  ${usuarios.length} usuarios | ${clientes.length} clientes | ${procedimentos.length} procedimentos`)
  console.log(`  ${materiais.length} materiais | ${agenda.length} agendamentos | ${atendimentos.length} atendimentos`)
  console.log('\nLogin para testes:')
  console.log('  dono@estudio.com     / Estudio@2026   (acesso total)')
  console.log('  recepcao@estudio.com / Estudio@2026   (agenda e cadastros)')
  console.log('  marina@estudio.com   / Estudio@2026   (so a propria agenda)')

  await db.close()
}

main().catch(async (erro) => {
  console.error('Falha no seed:', erro instanceof Error ? erro.message : erro)
  await db.close().catch(() => undefined)
  process.exit(1)
})
