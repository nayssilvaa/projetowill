import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type ProcedimentoHabilitado, type ResultadoAtendimento } from '../servicos/api'
import { useSessao } from '../contexto/SessaoContexto'
import { Aviso, Campo, Carregando, Etiqueta, Modal, Vazio } from '../componentes/Comuns'
import { dataCurta, hoje, hora, moeda, somarDias } from '../util/formato'
import type { AgendamentoDetalhado, Cliente, FormaPagamento, Profissional } from '@shared/tipos'

export function Agenda(): React.JSX.Element {
  const { podeOperarCadastros, ehDono } = useSessao()
  const [dia, setDia] = useState(hoje())
  const [profissionais, setProfissionais] = useState<Profissional[]>([])
  const [filtroProfissional, setFiltroProfissional] = useState<string>('')
  const [agendamentos, setAgendamentos] = useState<AgendamentoDetalhado[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [abrindoNovo, setAbrindoNovo] = useState(false)
  const [fechando, setFechando] = useState<AgendamentoDetalhado | null>(null)

  const carregar = useCallback(async () => {
    setAgendamentos(null)
    try {
      const lista = await api.agenda.listar(
        `${dia}T00:00`,
        `${somarDias(dia, 1)}T00:00`,
        filtroProfissional ? Number(filtroProfissional) : undefined
      )
      setAgendamentos(lista)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar a agenda.')
      setAgendamentos([])
    }
  }, [dia, filtroProfissional])

  useEffect(() => {
    api.profissionais.listar().then(setProfissionais).catch(() => undefined)
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function cancelar(a: AgendamentoDetalhado): Promise<void> {
    const motivo = prompt(`Cancelar o horario de ${a.clienteNome}? Informe o motivo (opcional):`)
    if (motivo === null) return
    try {
      await api.agenda.cancelar(a.id, motivo || undefined)
      setMensagem('Agendamento cancelado.')
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao cancelar.')
    }
  }

  async function excluir(a: AgendamentoDetalhado): Promise<void> {
    if (!confirm(`Excluir definitivamente o agendamento de ${a.clienteNome}?`)) return
    try {
      await api.agenda.remover(a.id)
      setMensagem('Agendamento excluido.')
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao excluir.')
    }
  }

  async function confirmar(a: AgendamentoDetalhado): Promise<void> {
    try {
      await api.agenda.atualizar(a.id, { status: 'CONFIRMADO' })
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao confirmar.')
    }
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Agenda</h1>
          <p>{dataCurta(dia)} — horarios de todos os profissionais</p>
        </div>
        {podeOperarCadastros && (
          <button className="btn btn-primario" onClick={() => setAbrindoNovo(true)}>
            Novo agendamento
          </button>
        )}
      </div>

      {erro && (
        <Aviso tipo="erro" onFechar={() => setErro(null)}>
          {erro}
        </Aviso>
      )}
      {mensagem && (
        <Aviso tipo="sucesso" onFechar={() => setMensagem(null)}>
          {mensagem}
        </Aviso>
      )}

      <div className="barra-ferramentas">
        <button className="btn" onClick={() => setDia(somarDias(dia, -1))}>
          ← Dia anterior
        </button>
        <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
        <button className="btn" onClick={() => setDia(somarDias(dia, 1))}>
          Proximo dia →
        </button>
        <button className="btn" onClick={() => setDia(hoje())}>
          Hoje
        </button>

        <select
          value={filtroProfissional}
          onChange={(e) => setFiltroProfissional(e.target.value)}
          style={{ marginLeft: 'auto' }}
        >
          <option value="">Todos os profissionais</option>
          {profissionais.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="cartao">
        {!agendamentos ? (
          <Carregando />
        ) : agendamentos.length === 0 ? (
          <Vazio>Nenhum horario marcado para esse dia.</Vazio>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Horario</th>
                <th>Cliente</th>
                <th>Procedimento</th>
                <th>Profissional</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {agendamentos.map((a) => (
                <tr key={a.id}>
                  <td>
                    {hora(a.inicio)} — {hora(a.fim)}
                  </td>
                  <td>
                    <Link to={`/clientes/${a.clienteId}`}>{a.clienteNome}</Link>
                  </td>
                  <td>{a.procedimentoNome}</td>
                  <td>{a.profissionalNome}</td>
                  <td>
                    <Etiqueta status={a.status} />
                  </td>
                  <td className="acoes">
                    {a.status === 'AGENDADO' && (
                      <button className="btn btn-pequeno" onClick={() => void confirmar(a)}>
                        Confirmar
                      </button>
                    )}
                    {(a.status === 'AGENDADO' || a.status === 'CONFIRMADO') && (
                      <>
                        <button className="btn btn-pequeno" onClick={() => setFechando(a)}>
                          Registrar atendimento
                        </button>
                        {podeOperarCadastros && (
                          <button
                            className="btn btn-pequeno btn-perigo"
                            onClick={() => void cancelar(a)}
                          >
                            Cancelar
                          </button>
                        )}
                      </>
                    )}
                    {ehDono && a.status === 'CANCELADO' && (
                      <button
                        className="btn btn-pequeno btn-perigo"
                        onClick={() => void excluir(a)}
                      >
                        Excluir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {abrindoNovo && (
        <ModalAgendar
          diaInicial={dia}
          profissionais={profissionais}
          onFechar={() => setAbrindoNovo(false)}
          onSalvo={async () => {
            setAbrindoNovo(false)
            setMensagem('Agendamento criado.')
            await carregar()
          }}
        />
      )}

      {fechando && (
        <ModalAtendimento
          agendamento={fechando}
          onFechar={() => setFechando(null)}
          onSalvo={async (texto) => {
            setFechando(null)
            setMensagem(texto)
            await carregar()
          }}
        />
      )}
    </>
  )
}

function ModalAgendar({
  diaInicial,
  profissionais,
  onFechar,
  onSalvo
}: {
  diaInicial: string
  profissionais: Profissional[]
  onFechar: () => void
  onSalvo: () => Promise<void>
}): React.JSX.Element {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [procedimentos, setProcedimentos] = useState<ProcedimentoHabilitado[]>([])
  const [clienteId, setClienteId] = useState('')
  const [profissionalId, setProfissionalId] = useState('')
  const [procedimentoId, setProcedimentoId] = useState('')
  const [dia, setDia] = useState(diaInicial)
  const [horarios, setHorarios] = useState<string[] | null>(null)
  const [inicio, setInicio] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    api.clientes.listar().then(setClientes).catch(() => undefined)
  }, [])

  // Os procedimentos oferecidos dependem de quem vai atender.
  useEffect(() => {
    setProcedimentoId('')
    setProcedimentos([])
    if (!profissionalId) return
    api.profissionais
      .procedimentos(Number(profissionalId))
      .then((lista) => setProcedimentos(lista.filter((p) => p.ativo)))
      .catch(() => undefined)
  }, [profissionalId])

  // Os horarios livres dependem do profissional, do dia e da duracao do procedimento.
  useEffect(() => {
    setInicio('')
    setHorarios(null)
    if (!profissionalId || !procedimentoId || !dia) return
    api.agenda
      .horariosLivres(Number(profissionalId), dia, Number(procedimentoId))
      .then(setHorarios)
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : 'Falha ao buscar horarios.'))
  }, [profissionalId, procedimentoId, dia])

  async function salvar(): Promise<void> {
    setSalvando(true)
    setErro(null)
    try {
      await api.agenda.agendar({
        clienteId: Number(clienteId),
        profissionalId: Number(profissionalId),
        procedimentoId: Number(procedimentoId),
        inicio,
        observacoes: observacoes || null
      })
      await onSalvo()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao agendar.')
    } finally {
      setSalvando(false)
    }
  }

  const procedimentoEscolhido = procedimentos.find((p) => p.id === Number(procedimentoId))

  return (
    <Modal titulo="Novo agendamento" onFechar={onFechar}>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <Campo rotulo="Cliente">
        <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
          <option value="">Selecione...</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </Campo>

      <div className="linha-campos">
        <Campo rotulo="Profissional">
          <select value={profissionalId} onChange={(e) => setProfissionalId(e.target.value)}>
            <option value="">Selecione...</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </Campo>

        <Campo rotulo="Procedimento (so os que ele faz)">
          <select
            value={procedimentoId}
            disabled={!profissionalId}
            onChange={(e) => setProcedimentoId(e.target.value)}
          >
            <option value="">{profissionalId ? 'Selecione...' : 'Escolha o profissional'}</option>
            {procedimentos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} · {p.duracaoMinutos}min
              </option>
            ))}
          </select>
        </Campo>

        <Campo rotulo="Dia">
          <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
        </Campo>
      </div>

      <Campo rotulo="Horario disponivel">
        {!procedimentoId ? (
          <span className="texto-suave">Escolha profissional e procedimento primeiro.</span>
        ) : horarios === null ? (
          <span className="texto-suave">Buscando horarios livres...</span>
        ) : horarios.length === 0 ? (
          <span className="texto-alerta">
            Sem horario livre nesse dia para {procedimentoEscolhido?.duracaoMinutos} minutos.
          </span>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {horarios.map((h) => (
              <button
                key={h}
                className={`btn btn-pequeno${inicio === h ? ' btn-primario' : ''}`}
                style={{ marginLeft: 0 }}
                onClick={() => setInicio(h)}
              >
                {h.slice(11)}
              </button>
            ))}
          </div>
        )}
      </Campo>

      <Campo rotulo="Observacoes">
        <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
      </Campo>

      <div className="rodape-modal">
        <button className="btn" onClick={onFechar}>
          Cancelar
        </button>
        <button
          className="btn btn-primario"
          onClick={() => void salvar()}
          disabled={salvando || !clienteId || !inicio}
        >
          {salvando ? 'Agendando...' : 'Agendar'}
        </button>
      </div>
    </Modal>
  )
}

function ModalAtendimento({
  agendamento,
  onFechar,
  onSalvo
}: {
  agendamento: AgendamentoDetalhado
  onFechar: () => void
  onSalvo: (mensagem: string) => Promise<void>
}): React.JSX.Element {
  const [valor, setValor] = useState('')
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('PIX')
  const [anotacoes, setAnotacoes] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    api.procedimentos
      .listar()
      .then((lista) => {
        const p = lista.find((x) => x.id === agendamento.procedimentoId)
        if (p) setValor(String(p.precoBase))
      })
      .catch(() => undefined)
  }, [agendamento.procedimentoId])

  async function salvar(): Promise<void> {
    setSalvando(true)
    setErro(null)
    try {
      const r: ResultadoAtendimento = await api.atendimentos.registrar({
        agendamentoId: agendamento.id,
        valorCobrado: Number(valor),
        formaPagamento,
        anotacoesTecnicas: anotacoes || null
      })

      const partes = [`Atendimento registrado (${moeda(r.atendimento.valorCobrado)}).`]
      if (r.materiaisBaixados.length > 0) {
        partes.push(`${r.materiaisBaixados.length} material(is) baixado(s) do estoque.`)
      }
      if (r.dataRetornoSugerida) {
        partes.push(`Retorno sugerido para ${dataCurta(r.dataRetornoSugerida)}.`)
      }
      if (r.alertasEstoque.length > 0) {
        partes.push(
          `Atencao: ${r.alertasEstoque.map((m) => m.nome).join(', ')} chegou ao estoque minimo.`
        )
      }
      await onSalvo(partes.join(' '))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao registrar o atendimento.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal titulo={`Registrar atendimento — ${agendamento.clienteNome}`} onFechar={onFechar}>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <p className="texto-suave" style={{ marginTop: 0 }}>
        {agendamento.procedimentoNome} com {agendamento.profissionalNome}, {hora(agendamento.inicio)}.
        Ao salvar, o sistema baixa do estoque os materiais da ficha tecnica e calcula a data de
        retorno do cliente.
      </p>

      <div className="linha-campos">
        <Campo rotulo="Valor cobrado (R$)">
          <input
            type="number"
            step="0.01"
            min="0"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Forma de pagamento">
          <select
            value={formaPagamento}
            onChange={(e) => setFormaPagamento(e.target.value as FormaPagamento)}
          >
            <option value="PIX">PIX</option>
            <option value="DINHEIRO">Dinheiro</option>
            <option value="DEBITO">Debito</option>
            <option value="CREDITO">Credito</option>
            <option value="OUTRO">Outro</option>
          </select>
        </Campo>
      </div>

      <Campo rotulo="Anotacoes tecnicas">
        <textarea
          value={anotacoes}
          placeholder="Como o cliente reagiu, cuidados orientados, detalhes do procedimento..."
          onChange={(e) => setAnotacoes(e.target.value)}
        />
      </Campo>

      <div className="rodape-modal">
        <button className="btn" onClick={onFechar}>
          Cancelar
        </button>
        <button className="btn btn-primario" onClick={() => void salvar()} disabled={salvando}>
          {salvando ? 'Registrando...' : 'Registrar'}
        </button>
      </div>
    </Modal>
  )
}
