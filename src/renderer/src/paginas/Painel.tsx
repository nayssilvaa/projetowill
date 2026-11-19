import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type PainelInicial, type ResultadoLembretes } from '../servicos/api'
import { useSessao } from '../contexto/SessaoContexto'
import { Aviso, Carregando, Etiqueta, Vazio } from '../componentes/Comuns'
import { dataCurta, hora, moeda } from '../util/formato'

export function Painel(): React.JSX.Element {
  const { sessao, ehDono, podeOperarCadastros } = useSessao()
  const [dados, setDados] = useState<PainelInicial | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const carregar = useCallback(async () => {
    try {
      setDados(await api.relatorios.painel())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar o painel.')
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function consultarDolar(): Promise<void> {
    setOcupado(true)
    setErro(null)
    try {
      const painel = await api.cotacao.consultar()
      setMensagem(painel.mensagem)
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao consultar a cotacao.')
    } finally {
      setOcupado(false)
    }
  }

  async function dispararLembretes(): Promise<void> {
    setOcupado(true)
    setErro(null)
    try {
      const r: ResultadoLembretes = await api.lembretes.enviar()
      setMensagem(
        r.analisados === 0
          ? 'Nenhum cliente com procedimento amanha aguardando lembrete.'
          : `${r.enviados} de ${r.analisados} lembretes enviados` +
              (r.simulados > 0 ? ` (${r.simulados} simulados: SMTP ainda nao configurado).` : '.')
      )
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar os lembretes.')
    } finally {
      setOcupado(false)
    }
  }

  if (!dados && !erro) return <Carregando />

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Ola, {sessao?.usuario.nome.split(' ')[0]}</h1>
          <p>Resumo do estudio em {dataCurta(new Date().toISOString())}</p>
        </div>
        {podeOperarCadastros && (
          <div>
            <button className="btn" onClick={dispararLembretes} disabled={ocupado}>
              Enviar lembretes de amanha
            </button>
            {ehDono && (
              <button
                className="btn btn-primario btn-pequeno"
                onClick={consultarDolar}
                disabled={ocupado}
              >
                Consultar dolar
              </button>
            )}
          </div>
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

      {dados && (
        <>
          <div className="grade grade-4" style={{ marginBottom: 18 }}>
            <div className="cartao indicador">
              <div className="rotulo">Agendamentos hoje</div>
              <div className="valor">{dados.agendamentosHoje.length}</div>
              <div className="nota">
                {dados.agendamentosHoje.filter((a) => a.status === 'REALIZADO').length} ja realizados
              </div>
            </div>

            <div className="cartao indicador">
              <div className="rotulo">Faturamento do mes</div>
              <div className="valor">{moeda(dados.faturamentoMes)}</div>
              <div className="nota">atendimentos fechados</div>
            </div>

            <div className="cartao indicador">
              <div className="rotulo">Materiais em falta</div>
              <div className={`valor ${dados.materiaisEmFalta.length > 0 ? 'texto-alerta' : ''}`}>
                {dados.materiaisEmFalta.length}
              </div>
              <div className="nota">no ou abaixo do estoque minimo</div>
            </div>

            <div className="cartao indicador">
              <div className="rotulo">Dolar (ultima consulta)</div>
              <div className="valor">
                {dados.ultimaCotacao ? `R$ ${dados.ultimaCotacao.valorBrl.toFixed(4)}` : '-'}
              </div>
              <div className="nota">
                {dados.ultimaCotacao
                  ? `${dados.ultimaCotacao.variacaoPct?.toFixed(2) ?? '0.00'}% no dia`
                  : 'nenhuma consulta registrada'}
              </div>
            </div>
          </div>

          <div className="grade grade-2">
            <section className="cartao">
              <h2>Agenda de hoje</h2>
              {dados.agendamentosHoje.length === 0 ? (
                <Vazio>Nenhum procedimento marcado para hoje.</Vazio>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Hora</th>
                      <th>Cliente</th>
                      <th>Procedimento</th>
                      <th>Profissional</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.agendamentosHoje.map((a) => (
                      <tr key={a.id}>
                        <td>{hora(a.inicio)}</td>
                        <td>
                          <Link to={`/clientes/${a.clienteId}`}>{a.clienteNome}</Link>
                        </td>
                        <td>{a.procedimentoNome}</td>
                        <td>{a.profissionalNome}</td>
                        <td>
                          <Etiqueta status={a.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="cartao">
              <h2>Materiais para repor</h2>
              {dados.materiaisEmFalta.length === 0 ? (
                <Vazio>Estoque saudavel.</Vazio>
              ) : (
                <ul className="lista-simples">
                  {dados.materiaisEmFalta.map((m) => (
                    <li key={m.id}>
                      <span>
                        {m.nome}
                        {m.importado && <span className="texto-suave"> · importado</span>}
                      </span>
                      <span className="texto-alerta">
                        {m.estoqueAtual} / min {m.estoqueMinimo} {m.unidade}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="cartao">
              <h2>Clientes para chamar de volta</h2>
              {dados.retornosPendentes.length === 0 ? (
                <Vazio>Nenhum retorno vencido sem novo agendamento.</Vazio>
              ) : (
                <ul className="lista-simples">
                  {dados.retornosPendentes.slice(0, 8).map((r) => (
                    <li key={`${r.clienteId}-${r.dataRetornoSugerida}`}>
                      <span>
                        <Link to={`/clientes/${r.clienteId}`}>{r.clienteNome}</Link>
                        <span className="texto-suave"> · {r.procedimentoNome}</span>
                      </span>
                      <span className="texto-alerta">{r.diasAtraso} dias</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </>
  )
}
