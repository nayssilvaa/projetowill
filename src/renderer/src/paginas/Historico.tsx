import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../servicos/api'
import { useSessao } from '../contexto/SessaoContexto'
import { Aviso, Carregando, Vazio } from '../componentes/Comuns'
import { dataCurta, hoje, hora, moeda, somarDias } from '../util/formato'
import type { ProcedimentoRealizado, Profissional } from '@shared/tipos'

/**
 * Historico de procedimentos realizados: cliente, procedimento, profissional e quando.
 * DONO ve todos (e pode filtrar por profissional); o profissional ve so os proprios.
 * O filtro do profissional e aplicado no processo principal, nao so aqui na tela.
 */
export function Historico(): React.JSX.Element {
  const { ehDono } = useSessao()
  const [inicio, setInicio] = useState(somarDias(hoje(), -30))
  const [fim, setFim] = useState(hoje())
  const [profissionalId, setProfissionalId] = useState('')
  const [profissionais, setProfissionais] = useState<Profissional[]>([])
  const [busca, setBusca] = useState('')
  const [itens, setItens] = useState<ProcedimentoRealizado[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (ehDono) api.profissionais.listar(false).then(setProfissionais).catch(() => undefined)
  }, [ehDono])

  const carregar = useCallback(async () => {
    setItens(null)
    setErro(null)
    try {
      setItens(
        await api.atendimentos.historicoRealizados(
          inicio,
          fim,
          profissionalId ? Number(profissionalId) : undefined
        )
      )
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar o historico.')
      setItens([])
    }
  }, [inicio, fim, profissionalId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  // Busca local por cliente ou procedimento, sem ir ao banco a cada letra.
  const filtrados = useMemo(() => {
    if (!itens) return null
    const termo = busca.trim().toLowerCase()
    if (!termo) return itens
    return itens.filter(
      (i) =>
        i.clienteNome.toLowerCase().includes(termo) ||
        i.procedimentoNome.toLowerCase().includes(termo)
    )
  }, [itens, busca])

  const total = filtrados?.reduce((soma, i) => soma + (i.valorCobrado ?? 0), 0) ?? 0

  function periodo(dias: number): void {
    setFim(hoje())
    setInicio(somarDias(hoje(), -dias))
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Historico de procedimentos</h1>
          <p>
            {ehDono
              ? 'Todos os procedimentos realizados no estudio'
              : 'Os procedimentos que voce realizou'}
          </p>
        </div>
      </div>

      {erro && (
        <Aviso tipo="erro" onFechar={() => setErro(null)}>
          {erro}
        </Aviso>
      )}

      <div className="barra-ferramentas">
        <label>
          De{' '}
          <input type="date" value={inicio} max={fim} onChange={(e) => setInicio(e.target.value)} />
        </label>
        <label>
          ate{' '}
          <input type="date" value={fim} min={inicio} onChange={(e) => setFim(e.target.value)} />
        </label>
        <button className="btn btn-pequeno" onClick={() => periodo(7)}>
          7 dias
        </button>
        <button className="btn btn-pequeno" onClick={() => periodo(30)}>
          30 dias
        </button>
        <button className="btn btn-pequeno" onClick={() => periodo(365)}>
          12 meses
        </button>

        {ehDono && (
          <select value={profissionalId} onChange={(e) => setProfissionalId(e.target.value)}>
            <option value="">Todos os profissionais</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        )}

        <input
          placeholder="Buscar cliente ou procedimento"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ marginLeft: 'auto' }}
        />
      </div>

      <div className="cartao">
        {!filtrados ? (
          <Carregando />
        ) : filtrados.length === 0 ? (
          <Vazio>Nenhum procedimento realizado nesse periodo.</Vazio>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Cliente</th>
                  <th>Procedimento</th>
                  <th>Profissional</th>
                  {ehDono && <th style={{ textAlign: 'right' }}>Valor</th>}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((i) => (
                  <tr key={i.atendimentoId}>
                    <td>
                      {dataCurta(i.realizadoEm)} {hora(i.realizadoEm)}
                    </td>
                    <td>
                      <Link to={`/clientes/${i.clienteId}`}>{i.clienteNome}</Link>
                    </td>
                    <td>{i.procedimentoNome}</td>
                    <td>{i.profissionalNome}</td>
                    {ehDono && <td style={{ textAlign: 'right' }}>{moeda(i.valorCobrado)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="texto-suave" style={{ marginBottom: 0 }}>
              {filtrados.length} procedimento(s) realizado(s)
              {ehDono && ` · total ${moeda(total)}`}
            </p>
          </>
        )}
      </div>
    </>
  )
}
