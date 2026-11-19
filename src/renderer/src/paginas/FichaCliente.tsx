import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type FichaCliente as Ficha } from '../servicos/api'
import { Aviso, Carregando, Etiqueta, Vazio } from '../componentes/Comuns'
import { cep, cpf, dataCurta, dataHora, moeda, telefone } from '../util/formato'

export function FichaCliente(): React.JSX.Element {
  const { id } = useParams<{ id: string }>()
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    api.clientes
      .ficha(Number(id))
      .then(setFicha)
      .catch((e: unknown) =>
        setErro(e instanceof Error ? e.message : 'Falha ao carregar a ficha do cliente.')
      )
  }, [id])

  if (erro) return <Aviso tipo="erro">{erro}</Aviso>
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
