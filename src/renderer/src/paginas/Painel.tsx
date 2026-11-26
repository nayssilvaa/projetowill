import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  api,
  type PainelInicial,
  type ResultadoLembretes,
  type StatusServicoLembretes
} from '../servicos/api'
import { useSessao } from '../contexto/SessaoContexto'
import { Aviso, Carregando, Etiqueta, Vazio } from '../componentes/Comuns'
import { dataCurta, hora, moeda } from '../util/formato'
import type { AvisoProfissional } from '@shared/tipos'

/** Painel do profissional: avisos da recepcao sobre os atendimentos de amanha. */
function AvisosDoProfissional(): React.JSX.Element {
  const [avisos, setAvisos] = useState<AvisoProfissional[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      setAvisos(await api.avisos.meus())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar os avisos.')
      setAvisos([])
    }
  }, [])

  useEffect(() => {
    void carregar()
    const intervalo = setInterval(() => void carregar(), 60_000)
    return () => clearInterval(intervalo)
  }, [carregar])

  async function marcarLido(id: number): Promise<void> {
    try {
      await api.avisos.marcarLido(id)
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao marcar como lido.')
    }
  }

  const naoLidos = avisos?.filter((a) => !a.lidoEm) ?? []
  const lidos = avisos?.filter((a) => a.lidoEm).slice(0, 3) ?? []

  return (
    <section
      className="cartao"
      style={{
        marginBottom: 18,
        borderColor: naoLidos.length > 0 ? 'var(--destaque)' : undefined
      }}
    >
      <h2>
        Avisos da recepcao
        {naoLidos.length > 0 && (
          <span className="etiqueta etiqueta-AGENDADO" style={{ marginLeft: 8 }}>
            {naoLidos.length} novo{naoLidos.length > 1 ? 's' : ''}
          </span>
        )}
      </h2>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {!avisos ? (
        <Carregando />
      ) : avisos.length === 0 ? (
        <Vazio>Nenhum aviso por enquanto.</Vazio>
      ) : (
        <>
          {naoLidos.map((a) => (
            <div key={a.id} style={{ marginBottom: 12 }}>
              <p style={{ whiteSpace: 'pre-line', margin: '0 0 6px' }}>{a.mensagem}</p>
              <span className="texto-suave">
                Enviado por {a.remetenteNome ?? 'sistema'} em {dataCurta(a.criadoEm)} as{' '}
                {hora(a.criadoEm)}
              </span>
              <button className="btn btn-pequeno" onClick={() => void marcarLido(a.id)}>
                Marcar como lido
              </button>
            </div>
          ))}
          {lidos.length > 0 && (
            <ul className="lista-simples">
              {lidos.map((a) => (
                <li key={a.id}>
                  <span className="texto-suave">
                    {dataCurta(a.diaReferencia)} · {a.totalAgendamentos} atendimento(s)
                  </span>
                  <span className="texto-suave">lido</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

/** Painel da recepcao/dono: dispara e acompanha os avisos de amanha. */
function AvisosParaProfissionais({
  apiOnline,
  onMensagem,
  onErro
}: {
  apiOnline: boolean
  onMensagem: (texto: string) => void
  onErro: (texto: string) => void
}): React.JSX.Element {
  const [enviados, setEnviados] = useState<AvisoProfissional[] | null>(null)
  const [enviando, setEnviando] = useState(false)

  const carregar = useCallback(async () => {
    try {
      setEnviados(await api.avisos.enviados())
    } catch {
      setEnviados([])
    }
  }, [])

  useEffect(() => {
    void carregar()
    const intervalo = setInterval(() => void carregar(), 60_000)
    return () => clearInterval(intervalo)
  }, [carregar])

  async function enviar(): Promise<void> {
    setEnviando(true)
    try {
      const r = await api.avisos.enviarAmanha()
      onMensagem(
        r.profissionaisAvisados === 0
          ? 'Nenhum atendimento marcado para amanha: nenhum profissional precisou ser avisado.'
          : `${r.profissionaisAvisados} profissional(is) avisado(s) sobre ${r.totalAgendamentos} atendimento(s) de amanha.`
      )
      await carregar()
    } catch (e) {
      onErro(e instanceof Error ? e.message : 'Falha ao avisar os profissionais.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="cartao">
      <h2>Avisos aos profissionais</h2>
      {!enviados ? (
        <Carregando />
      ) : enviados.length === 0 ? (
        <Vazio>Os profissionais ainda nao foram avisados sobre amanha.</Vazio>
      ) : (
        <ul className="lista-simples">
          {enviados.map((a) => (
            <li key={a.id}>
              <span>
                {a.profissionalNome}
                <span className="texto-suave"> · {a.totalAgendamentos} atendimento(s)</span>
              </span>
              <span className={a.lidoEm ? '' : 'texto-alerta'}>
                {a.lidoEm ? `lido as ${hora(a.lidoEm)}` : 'ainda nao leu'}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="texto-suave">
        O servico de lembretes avisa todos automaticamente as 09:00. Use o botao se a agenda de
        amanha mudar depois disso: o aviso de cada profissional e atualizado.
      </p>
      {!apiOnline && (
        <p className="texto-alerta">
          Servico de lembretes fora do ar: os avisos nao podem ser enviados agora.
        </p>
      )}
      <button
        className="btn"
        style={{ marginLeft: 0 }}
        onClick={() => void enviar()}
        disabled={enviando || !apiOnline}
      >
        {enviando ? 'Avisando...' : 'Avisar profissionais sobre amanha'}
      </button>
    </section>
  )
}

export function Painel(): React.JSX.Element {
  const { sessao, ehDono, podeOperarCadastros, perfil } = useSessao()
  const [dados, setDados] = useState<PainelInicial | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [statusLembretes, setStatusLembretes] = useState<StatusServicoLembretes | null>(null)

  const carregar = useCallback(async () => {
    try {
      setDados(await api.relatorios.painel())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar o painel.')
    }
  }, [])

  // Consulta a API propria: ela diz se o envio automatico das 09:00 esta de pe.
  const verificarLembretes = useCallback(async () => {
    try {
      setStatusLembretes(await api.lembretes.status())
    } catch {
      setStatusLembretes(null)
    }
  }, [])

  useEffect(() => {
    void carregar()
    void verificarLembretes()
    const intervalo = setInterval(() => void verificarLembretes(), 60_000)
    return () => clearInterval(intervalo)
  }, [carregar, verificarLembretes])

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
      if (r.analisados === 0) {
        setMensagem('Nenhum cliente com procedimento amanha aguardando lembrete.')
      } else if (r.simulados > 0) {
        setErro(
          `E-mail nao configurado: ${r.simulados} lembrete(s) NAO foram entregues e continuam pendentes. ` +
            'Preencha SMTP_USER e SMTP_PASSWORD no .env e reinicie o servico de lembretes.'
        )
      } else if (r.falhas.length > 0) {
        setErro(
          `${r.enviados} de ${r.analisados} lembretes enviados. Falha: ${r.falhas[0].motivo}`
        )
      } else {
        setMensagem(`${r.enviados} lembrete(s) enviado(s) por e-mail aos clientes.`)
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar os lembretes.')
    } finally {
      setOcupado(false)
      void verificarLembretes()
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
        {ehDono && (
          <div>
            <button
              className="btn btn-primario btn-pequeno"
              onClick={consultarDolar}
              disabled={ocupado}
            >
              Consultar dolar
            </button>
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

      {perfil === 'PROFISSIONAL' && <AvisosDoProfissional />}

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

            {/* Indicadores de gestao: o servidor so envia para o DONO. */}
            {dados.faturamentoMes !== null && (
              <div className="cartao indicador">
                <div className="rotulo">Faturamento do mes</div>
                <div className="valor">{moeda(dados.faturamentoMes)}</div>
                <div className="nota">atendimentos fechados</div>
              </div>
            )}

            {dados.materiaisEmFalta !== null && (
              <div className="cartao indicador">
                <div className="rotulo">Materiais em falta</div>
                <div className={`valor ${dados.materiaisEmFalta.length > 0 ? 'texto-alerta' : ''}`}>
                  {dados.materiaisEmFalta.length}
                </div>
                <div className="nota">no ou abaixo do estoque minimo</div>
              </div>
            )}

            {ehDono && (
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
            )}
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

            {dados.materiaisEmFalta !== null && (
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
            )}

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

            <section className="cartao">
              <h2>Lembretes automaticos</h2>
              {!statusLembretes ? (
                <Carregando />
              ) : (
                <>
                  <ul className="lista-simples">
                    <li>
                      <span>Servico de lembretes (API)</span>
                      <span className={statusLembretes.online ? '' : 'texto-alerta'}>
                        {statusLembretes.online ? 'no ar' : 'fora do ar'}
                      </span>
                    </li>
                    <li>
                      <span>Envio diario das 09:00 (clientes e profissionais)</span>
                      <span className={statusLembretes.agendadorAtivo ? '' : 'texto-alerta'}>
                        {statusLembretes.agendadorAtivo ? 'ativo' : 'parado'}
                      </span>
                    </li>
                    <li>
                      <span>Envio de e-mail</span>
                      <span className={statusLembretes.emailConfigurado ? '' : 'texto-alerta'}>
                        {!statusLembretes.online
                          ? '-'
                          : statusLembretes.emailConfigurado
                            ? 'configurado'
                            : 'nao configurado'}
                      </span>
                    </li>
                    <li>
                      <span>Clientes de amanha aguardando lembrete</span>
                      <span>{statusLembretes.online ? statusLembretes.pendentes : '-'}</span>
                    </li>
                  </ul>

                  {!statusLembretes.online && (
                    <p className="texto-alerta">
                      Os clientes nao estao recebendo o aviso de 24h. Inicie o servico com{' '}
                      <code>npm run api:dev</code>.
                      {statusLembretes.erro && (
                        <span className="texto-suave"> ({statusLembretes.erro})</span>
                      )}
                    </p>
                  )}

                  {statusLembretes.online && !statusLembretes.emailConfigurado && (
                    <p className="texto-alerta">
                      Sem conta de e-mail configurada, os lembretes nao chegam aos clientes.
                      Preencha <code>SMTP_USER</code> e <code>SMTP_PASSWORD</code> no{' '}
                      <code>.env</code>.
                    </p>
                  )}

                  <p className="texto-suave">
                    Verificado as {hora(statusLembretes.verificadoEm)}.
                  </p>

                  {podeOperarCadastros && (
                    <button
                      className="btn"
                      style={{ marginLeft: 0 }}
                      onClick={dispararLembretes}
                      disabled={ocupado || !statusLembretes.online}
                    >
                      {ocupado ? 'Enviando e-mails...' : 'Enviar lembretes de amanha agora'}
                    </button>
                  )}
                </>
              )}
            </section>

            {podeOperarCadastros && (
              <AvisosParaProfissionais
                apiOnline={statusLembretes?.online ?? false}
                onMensagem={setMensagem}
                onErro={setErro}
              />
            )}
          </div>
        </>
      )}
    </>
  )
}
