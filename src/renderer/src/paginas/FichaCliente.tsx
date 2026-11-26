import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type FichaCliente as Ficha, type ItemHistorico } from '../servicos/api'
import { useSessao } from '../contexto/SessaoContexto'
import { Aviso, Campo, Carregando, Etiqueta, Modal, Vazio } from '../componentes/Comuns'
import { cep, cpf, dataCurta, dataHora, moeda, telefone } from '../util/formato'
import type { FormaPagamento } from '@shared/tipos'

export function FichaCliente(): React.JSX.Element {
  const { id } = useParams<{ id: string }>()
  const { sessao, ehDono } = useSessao()
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [editando, setEditando] = useState<ItemHistorico | null>(null)

  const carregar = useCallback(async () => {
    if (!id) return
    try {
      setFicha(await api.clientes.ficha(Number(id)))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar a ficha do cliente.')
    }
  }, [id])

  useEffect(() => {
    void carregar()
  }, [carregar])

  /** DONO edita qualquer atendimento; o profissional, so os que ele realizou. */
  function podeEditar(h: ItemHistorico): boolean {
    return ehDono || (sessao?.profissionalId != null && sessao.profissionalId === h.profissionalId)
  }

  async function estornar(h: ItemHistorico): Promise<void> {
    const ok = confirm(
      `Estornar o atendimento "${h.procedimentoNome}" de ${dataCurta(h.realizadoEm)}?\n\n` +
        '- os materiais usados voltam para o estoque\n' +
        '- o agendamento volta para "agendado"\n' +
        '- o atendimento sai do historico do cliente'
    )
    if (!ok) return
    try {
      await api.atendimentos.estornar(h.atendimentoId)
      setMensagem('Atendimento estornado. Os materiais voltaram para o estoque.')
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao estornar o atendimento.')
    }
  }

  if (erro && !ficha) return <Aviso tipo="erro">{erro}</Aviso>
  if (!ficha) return <Carregando />

  const { cliente, historico, proximosAgendamentos } = ficha
  const endereco = cliente.endereco

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>{cliente.nome}</h1>
          <p>
            Cliente desde {dataCurta(historico[historico.length - 1]?.realizadoEm ?? null)} ·{' '}
            {historico.length} procedimento(s) realizado(s)
          </p>
        </div>
        <Link className="btn" to="/clientes">
          Voltar
        </Link>
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

      {(cliente.alergias || cliente.observacoesSaude) && (
        <Aviso tipo="atencao">
          <strong>Atencao antes do procedimento.</strong>
          {cliente.alergias && (
            <div>
              <strong>Alergias:</strong> {cliente.alergias}
            </div>
          )}
          {cliente.observacoesSaude && (
            <div>
              <strong>Observacoes:</strong> {cliente.observacoesSaude}
            </div>
          )}
        </Aviso>
      )}

      <div className="grade grade-4" style={{ marginBottom: 18 }}>
        <div className="cartao indicador">
          <div className="rotulo">Total gasto</div>
          <div className="valor">{moeda(ficha.totalGasto)}</div>
        </div>
        <div className="cartao indicador">
          <div className="rotulo">Ultimo atendimento</div>
          <div className="valor" style={{ fontSize: 19 }}>
            {dataCurta(ficha.ultimoAtendimentoEm)}
          </div>
        </div>
        <div className="cartao indicador">
          <div className="rotulo">Proximos agendamentos</div>
          <div className="valor">{proximosAgendamentos.length}</div>
        </div>
        <div className="cartao indicador">
          <div className="rotulo">Retorno vencido</div>
          <div className={`valor ${historico.some((h) => h.retornoVencido) ? 'texto-alerta' : ''}`}>
            {historico.filter((h) => h.retornoVencido).length}
          </div>
        </div>
      </div>

      <div className="grade grade-2">
        <section className="cartao">
          <h2>Dados cadastrais</h2>
          <ul className="lista-simples">
            <li>
              <span className="texto-suave">CPF</span>
              <span>{cpf(cliente.cpf)}</span>
            </li>
            <li>
              <span className="texto-suave">Telefone</span>
              <span>{telefone(cliente.telefone)}</span>
            </li>
            <li>
              <span className="texto-suave">E-mail</span>
              <span>{cliente.email ?? '-'}</span>
            </li>
            <li>
              <span className="texto-suave">Nascimento</span>
              <span>{dataCurta(cliente.dataNascimento)}</span>
            </li>
            <li>
              <span className="texto-suave">Endereco</span>
              <span style={{ textAlign: 'right' }}>
                {endereco
                  ? `${endereco.logradouro}, ${endereco.numero ?? 's/n'} — ${endereco.bairro ?? ''} ${endereco.cidade}/${endereco.uf} · ${cep(endereco.cep)}`
                  : '-'}
              </span>
            </li>
          </ul>
        </section>

        <section className="cartao">
          <h2>Proximos agendamentos</h2>
          {proximosAgendamentos.length === 0 ? (
            <Vazio>Sem agendamento futuro.</Vazio>
          ) : (
            <ul className="lista-simples">
              {proximosAgendamentos.map((a) => (
                <li key={a.id}>
                  <span>
                    {dataHora(a.inicio)}
                    <span className="texto-suave"> · {a.procedimentoNome}</span>
                  </span>
                  <Etiqueta status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="cartao" style={{ marginTop: 16 }}>
        <h2>Historico de procedimentos</h2>
        {historico.length === 0 ? (
          <Vazio>Esse cliente ainda nao realizou nenhum procedimento.</Vazio>
        ) : (
          <ul className="linha-tempo">
            {historico.map((h) => (
              <li key={h.atendimentoId}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <strong>{h.procedimentoNome}</strong>
                  <span>{moeda(h.valorCobrado)}</span>
                </div>
                <div className="texto-suave">
                  {dataHora(h.realizadoEm)} · com {h.profissionalNome}
                </div>
                {h.anotacoesTecnicas && <div style={{ marginTop: 4 }}>{h.anotacoesTecnicas}</div>}
                {h.dataRetornoSugerida && (
                  <div
                    className={h.retornoVencido ? 'texto-alerta' : 'texto-suave'}
                    style={{ marginTop: 4 }}
                  >
                    Retorno sugerido: {dataCurta(h.dataRetornoSugerida)}
                    {h.retornoVencido && ' — vencido'}
                  </div>
                )}
                {(podeEditar(h) || ehDono) && (
                  <div style={{ marginTop: 6 }}>
                    {podeEditar(h) && (
                      <button
                        className="btn btn-pequeno"
                        style={{ marginLeft: 0 }}
                        onClick={() => setEditando(h)}
                      >
                        Editar
                      </button>
                    )}
                    {ehDono && (
                      <button
                        className="btn btn-pequeno btn-perigo"
                        onClick={() => void estornar(h)}
                      >
                        Estornar
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {editando && (
        <ModalEditarAtendimento
          item={editando}
          completo={ehDono}
          onFechar={() => setEditando(null)}
          onSalvo={async () => {
            setEditando(null)
            setMensagem('Atendimento atualizado.')
            await carregar()
          }}
        />
      )}
    </>
  )
}

/**
 * Edicao de um atendimento ja registrado. `completo` (DONO) libera valor e forma de
 * pagamento; o profissional so corrige as proprias anotacoes e a data de retorno.
 * O processo principal aplica a mesma regra, entao a tela nao e a unica barreira.
 */
function ModalEditarAtendimento({
  item,
  completo,
  onFechar,
  onSalvo
}: {
  item: ItemHistorico
  completo: boolean
  onFechar: () => void
  onSalvo: () => Promise<void>
}): React.JSX.Element {
  const [valor, setValor] = useState(String(item.valorCobrado))
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>(item.formaPagamento)
  const [anotacoes, setAnotacoes] = useState(item.anotacoesTecnicas ?? '')
  const [retorno, setRetorno] = useState(item.dataRetornoSugerida ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar(): Promise<void> {
    setSalvando(true)
    setErro(null)
    try {
      const dados: Record<string, unknown> = {
        anotacoesTecnicas: anotacoes.trim() || null,
        dataRetornoSugerida: retorno || null
      }
      if (completo) {
        dados.valorCobrado = Number(valor)
        dados.formaPagamento = formaPagamento
      }
      await api.atendimentos.atualizar(item.atendimentoId, dados)
      await onSalvo()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar o atendimento.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal titulo={`Editar — ${item.procedimentoNome}`} onFechar={onFechar}>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <p className="texto-suave" style={{ marginTop: 0 }}>
        Realizado em {dataHora(item.realizadoEm)} com {item.profissionalNome}.
      </p>

      {completo && (
        <div className="linha-campos">
          <Campo rotulo="Valor cobrado (R$)">
            <input
              type="number"
              min="0"
              step="0.01"
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
      )}

      <Campo rotulo="Anotacoes tecnicas">
        <textarea value={anotacoes} onChange={(e) => setAnotacoes(e.target.value)} />
      </Campo>

      <Campo rotulo="Data de retorno sugerida">
        <input type="date" value={retorno} onChange={(e) => setRetorno(e.target.value)} />
      </Campo>

      <div className="rodape-modal">
        <button className="btn" onClick={onFechar}>
          Cancelar
        </button>
        <button
          className="btn btn-primario"
          onClick={() => void salvar()}
          disabled={salvando || (completo && !(Number(valor) >= 0 && valor !== ''))}
        >
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </Modal>
  )
}
