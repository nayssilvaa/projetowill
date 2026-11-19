import { useCallback, useEffect, useState } from 'react'
import { api, type MaterialDoProcedimento } from '../servicos/api'
import { useSessao } from '../contexto/SessaoContexto'
import { Aviso, Campo, Carregando, Modal, Vazio } from '../componentes/Comuns'
import { moeda } from '../util/formato'
import type { CategoriaProcedimento, Material, Procedimento } from '@shared/tipos'

const CATEGORIAS: CategoriaProcedimento[] = ['TATUAGEM', 'PIERCING', 'ESTETICA', 'OUTRO']

export function Procedimentos(): React.JSX.Element {
  const { ehDono } = useSessao()
  const [procedimentos, setProcedimentos] = useState<Procedimento[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [editando, setEditando] = useState<Procedimento | 'novo' | null>(null)
  const [ficha, setFicha] = useState<Procedimento | null>(null)

  const carregar = useCallback(async () => {
    try {
      setProcedimentos(await api.procedimentos.listar(false))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar os procedimentos.')
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function remover(p: Procedimento): Promise<void> {
    if (!confirm(`Remover "${p.nome}"? Se ja tiver agendamentos, sera apenas desativado.`)) return
    try {
      const r = await api.procedimentos.remover(p.id)
      setMensagem(r.desativado ? `"${p.nome}" foi desativado.` : `"${p.nome}" foi removido.`)
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao remover.')
    }
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Procedimentos</h1>
          <p>Catalogo de servicos, duracao, preco e materiais consumidos</p>
        </div>
        {ehDono && (
          <button className="btn btn-primario" onClick={() => setEditando('novo')}>
            Novo procedimento
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

      <div className="cartao">
        {!procedimentos ? (
          <Carregando />
        ) : procedimentos.length === 0 ? (
          <Vazio>Nenhum procedimento cadastrado.</Vazio>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Categoria</th>
                <th>Duracao</th>
                <th>Preco base</th>
                <th>Retorno</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {procedimentos.map((p) => (
                <tr key={p.id} style={p.ativo ? undefined : { opacity: 0.5 }}>
                  <td>
                    {p.nome}
                    {!p.ativo && <span className="texto-suave"> (inativo)</span>}
                  </td>
                  <td className="texto-suave">{p.categoria}</td>
                  <td>{p.duracaoMinutos} min</td>
                  <td>{moeda(p.precoBase)}</td>
                  <td>
                    {p.diasRetornoSugerido ? `${p.diasRetornoSugerido} dias` : <span className="texto-suave">-</span>}
                  </td>
                  <td className="acoes">
                    <button className="btn btn-pequeno" onClick={() => setFicha(p)}>
                      Ficha tecnica
                    </button>
                    {ehDono && (
                      <>
                        <button className="btn btn-pequeno" onClick={() => setEditando(p)}>
                          Editar
                        </button>
                        <button className="btn btn-pequeno btn-perigo" onClick={() => void remover(p)}>
                          Excluir
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editando !== null && (
        <ModalProcedimento
          procedimento={editando === 'novo' ? null : editando}
          onFechar={() => setEditando(null)}
          onSalvo={async (texto) => {
            setEditando(null)
            setMensagem(texto)
            await carregar()
          }}
        />
      )}

      {ficha && (
        <ModalFichaTecnica
          procedimento={ficha}
          somenteLeitura={!ehDono}
          onFechar={() => setFicha(null)}
        />
      )}
    </>
  )
}

function ModalProcedimento({
  procedimento,
  onFechar,
  onSalvo
}: {
  procedimento: Procedimento | null
  onFechar: () => void
  onSalvo: (mensagem: string) => Promise<void>
}): React.JSX.Element {
  const [nome, setNome] = useState(procedimento?.nome ?? '')
  const [categoria, setCategoria] = useState<CategoriaProcedimento>(
    procedimento?.categoria ?? 'TATUAGEM'
  )
  const [duracao, setDuracao] = useState(String(procedimento?.duracaoMinutos ?? 60))
  const [preco, setPreco] = useState(String(procedimento?.precoBase ?? ''))
  const [retorno, setRetorno] = useState(String(procedimento?.diasRetornoSugerido ?? ''))
  const [descricao, setDescricao] = useState(procedimento?.descricao ?? '')
  const [ativo, setAtivo] = useState(procedimento?.ativo ?? true)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar(): Promise<void> {
    setSalvando(true)
    setErro(null)
    const corpo = {
      nome,
      categoria,
      duracaoMinutos: Number(duracao),
      precoBase: Number(preco || 0),
      diasRetornoSugerido: retorno ? Number(retorno) : null,
      descricao: descricao || null,
      ativo
    }
    try {
      if (procedimento) {
        await api.procedimentos.atualizar(procedimento.id, corpo)
        await onSalvo('Procedimento atualizado.')
      } else {
        await api.procedimentos.criar(corpo)
        await onSalvo('Procedimento cadastrado.')
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal titulo={procedimento ? `Editar ${procedimento.nome}` : 'Novo procedimento'} onFechar={onFechar}>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <Campo rotulo="Nome">
        <input value={nome} onChange={(e) => setNome(e.target.value)} />
      </Campo>

      <div className="linha-campos">
        <Campo rotulo="Categoria">
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as CategoriaProcedimento)}
          >
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Duracao (minutos)">
          <input type="number" min="5" step="5" value={duracao} onChange={(e) => setDuracao(e.target.value)} />
        </Campo>
        <Campo rotulo="Preco base (R$)">
          <input type="number" min="0" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} />
        </Campo>
      </div>

      <div className="linha-campos">
        <Campo rotulo="Retorno sugerido (dias)">
          <input
            type="number"
            min="0"
            value={retorno}
            placeholder="deixe vazio se nao houver"
            onChange={(e) => setRetorno(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Ativo">
          <select value={String(ativo)} onChange={(e) => setAtivo(e.target.value === 'true')}>
            <option value="true">Sim</option>
            <option value="false">Nao</option>
          </select>
        </Campo>
      </div>

      <Campo rotulo="Descricao">
        <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </Campo>

      <div className="rodape-modal">
        <button className="btn" onClick={onFechar}>
          Cancelar
        </button>
        <button className="btn btn-primario" onClick={() => void salvar()} disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </Modal>
  )
}

function ModalFichaTecnica({
  procedimento,
  somenteLeitura,
  onFechar
}: {
  procedimento: Procedimento
  somenteLeitura: boolean
  onFechar: () => void
}): React.JSX.Element {
  const [itens, setItens] = useState<MaterialDoProcedimento[] | null>(null)
  const [materiais, setMateriais] = useState<Material[]>([])
  const [materialId, setMaterialId] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    api.procedimentos.materiais(procedimento.id).then(setItens).catch(() => undefined)
    api.estoque
      .listar()
      .then(setMateriais)
      .catch(() => undefined)
  }, [procedimento.id])

  async function vincular(): Promise<void> {
    setErro(null)
    try {
      setItens(
        await api.procedimentos.vincularMaterial({
          procedimentoId: procedimento.id,
          materialId: Number(materialId),
          quantidadePadrao: Number(quantidade)
        })
      )
      setMaterialId('')
      setQuantidade('1')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao vincular o material.')
    }
  }

  async function desvincular(id: number): Promise<void> {
    setErro(null)
    try {
      setItens(await api.procedimentos.desvincularMaterial(procedimento.id, id))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao desvincular.')
    }
  }

  const disponiveis = materiais.filter((m) => !itens?.some((i) => i.materialId === m.id))

  return (
    <Modal titulo={`Ficha tecnica — ${procedimento.nome}`} onFechar={onFechar}>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <p className="texto-suave" style={{ marginTop: 0 }}>
        Define o que cada execucao consome. Ao registrar o atendimento, essas quantidades saem do
        estoque automaticamente.
      </p>

      {!itens ? (
        <Carregando />
      ) : itens.length === 0 ? (
        <Vazio>Nenhum material vinculado: nada sera baixado do estoque.</Vazio>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>Consumo por execucao</th>
              <th>Em estoque</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {itens.map((i) => (
              <tr key={i.materialId}>
                <td>{i.materialNome}</td>
                <td>
                  {i.quantidadePadrao} {i.unidade}
                </td>
                <td className={i.estoqueAtual < i.quantidadePadrao ? 'texto-alerta' : undefined}>
                  {i.estoqueAtual} {i.unidade}
                </td>
                <td className="acoes">
                  {!somenteLeitura && (
                    <button
                      className="btn btn-pequeno btn-perigo"
                      onClick={() => void desvincular(i.materialId)}
                    >
                      Remover
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!somenteLeitura && (
        <div className="linha-campos" style={{ marginTop: 16, alignItems: 'end' }}>
          <Campo rotulo="Material">
            <select value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
              <option value="">Selecione...</option>
              {disponiveis.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome} ({m.unidade})
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Quantidade">
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
          </Campo>
          <div className="campo">
            <label>&nbsp;</label>
            <button
              className="btn btn-primario"
              disabled={!materialId}
              onClick={() => void vincular()}
            >
              Vincular
            </button>
          </div>
        </div>
      )}

      <div className="rodape-modal">
        <button className="btn" onClick={onFechar}>
          Fechar
        </button>
      </div>
    </Modal>
  )
}
