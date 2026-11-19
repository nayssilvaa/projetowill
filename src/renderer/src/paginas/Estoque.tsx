import { useCallback, useEffect, useState } from 'react'
import { api, type PainelCotacao } from '../servicos/api'
import { Aviso, Campo, Carregando, Modal, Vazio } from '../componentes/Comuns'
import { dataHora, moeda } from '../util/formato'
import type { CotacaoDolar, Material, MovimentacaoEstoque } from '@shared/tipos'

export function Estoque(): React.JSX.Element {
  const [materiais, setMateriais] = useState<Material[] | null>(null)
  const [cotacao, setCotacao] = useState<CotacaoDolar | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [alerta, setAlerta] = useState<string | null>(null)
  const [consultando, setConsultando] = useState(false)
  const [editando, setEditando] = useState<Material | 'novo' | null>(null)
  const [comprando, setComprando] = useState<Material | null>(null)
  const [ajustando, setAjustando] = useState<Material | null>(null)
  const [historico, setHistorico] = useState<Material | null>(null)

  const carregar = useCallback(async () => {
    try {
      setMateriais(await api.estoque.listar(false))
      setCotacao(await api.cotacao.ultima())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar o estoque.')
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function consultarDolar(): Promise<void> {
    setConsultando(true)
    setErro(null)
    try {
      const painel: PainelCotacao = await api.cotacao.consultar()
      setCotacao(painel.cotacao)
      if (painel.alerta) setAlerta(painel.mensagem)
      else setMensagem(painel.mensagem)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao consultar a cotacao.')
    } finally {
      setConsultando(false)
    }
  }

  async function remover(m: Material): Promise<void> {
    if (!confirm(`Remover "${m.nome}"? Se estiver em alguma ficha tecnica, sera desativado.`)) return
    try {
      const r = await api.estoque.remover(m.id)
      setMensagem(r.desativado ? `"${m.nome}" foi desativado.` : `"${m.nome}" foi removido.`)
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao remover.')
    }
  }

  const emFalta = materiais?.filter((m) => m.estoqueMinimo > 0 && m.estoqueAtual <= m.estoqueMinimo) ?? []

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Estoque e dolar</h1>
          <p>Materiais do estudio e o cambio na hora da compra importada</p>
        </div>
        <div>
          <button className="btn" onClick={() => void consultarDolar()} disabled={consultando}>
            {consultando ? 'Consultando...' : 'Consultar dolar agora'}
          </button>
          <button className="btn btn-primario btn-pequeno" onClick={() => setEditando('novo')}>
            Novo material
          </button>
        </div>
      </div>

      {erro && (
        <Aviso tipo="erro" onFechar={() => setErro(null)}>
          {erro}
        </Aviso>
      )}
      {alerta && (
        <Aviso tipo="atencao" onFechar={() => setAlerta(null)}>
          {alerta}
        </Aviso>
      )}
      {mensagem && (
        <Aviso tipo="sucesso" onFechar={() => setMensagem(null)}>
          {mensagem}
        </Aviso>
      )}

      <div className="grade grade-4" style={{ marginBottom: 18 }}>
        <div className="cartao indicador">
          <div className="rotulo">Dolar hoje</div>
          <div className="valor">{cotacao ? `R$ ${cotacao.valorBrl.toFixed(4)}` : '-'}</div>
          <div className="nota">
            {cotacao ? `consultado em ${dataHora(cotacao.consultadaEm)}` : 'nenhuma consulta ainda'}
          </div>
        </div>
        <div className="cartao indicador">
          <div className="rotulo">Variacao no dia</div>
          <div
            className={`valor ${(cotacao?.variacaoPct ?? 0) > 0 ? 'texto-alerta' : 'texto-sucesso'}`}
          >
            {cotacao?.variacaoPct != null ? `${cotacao.variacaoPct.toFixed(2)}%` : '-'}
          </div>
          <div className="nota">alerta acima de 2,5%</div>
        </div>
        <div className="cartao indicador">
          <div className="rotulo">Materiais importados</div>
          <div className="valor">{materiais?.filter((m) => m.importado).length ?? 0}</div>
          <div className="nota">sensiveis ao cambio</div>
        </div>
        <div className="cartao indicador">
          <div className="rotulo">Abaixo do minimo</div>
          <div className={`valor ${emFalta.length > 0 ? 'texto-alerta' : ''}`}>{emFalta.length}</div>
          <div className="nota">precisam de reposicao</div>
        </div>
      </div>

      <div className="cartao">
        {!materiais ? (
          <Carregando />
        ) : materiais.length === 0 ? (
          <Vazio>Nenhum material cadastrado.</Vazio>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th>Origem</th>
                <th>Preco USD</th>
                <th>Estoque</th>
                <th>Minimo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {materiais.map((m) => {
                const faltando = m.estoqueMinimo > 0 && m.estoqueAtual <= m.estoqueMinimo
                return (
                  <tr key={m.id} style={m.ativo ? undefined : { opacity: 0.5 }}>
                    <td>
                      {m.nome}
                      {!m.ativo && <span className="texto-suave"> (inativo)</span>}
                    </td>
                    <td className="texto-suave">{m.importado ? 'importado' : 'nacional'}</td>
                    <td>{m.precoUsd != null ? `US$ ${m.precoUsd.toFixed(2)}` : '-'}</td>
                    <td className={faltando ? 'texto-alerta' : undefined}>
                      {m.estoqueAtual} {m.unidade}
                    </td>
                    <td className="texto-suave">
                      {m.estoqueMinimo} {m.unidade}
                    </td>
                    <td className="acoes">
                      <button className="btn btn-pequeno" onClick={() => setComprando(m)}>
                        Comprar
                      </button>
                      <button className="btn btn-pequeno" onClick={() => setAjustando(m)}>
                        Ajustar
                      </button>
                      <button className="btn btn-pequeno" onClick={() => setHistorico(m)}>
                        Historico
                      </button>
                      <button className="btn btn-pequeno" onClick={() => setEditando(m)}>
                        Editar
                      </button>
                      <button className="btn btn-pequeno btn-perigo" onClick={() => void remover(m)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {editando !== null && (
        <ModalMaterial
          material={editando === 'novo' ? null : editando}
          onFechar={() => setEditando(null)}
          onSalvo={async (texto) => {
            setEditando(null)
            setMensagem(texto)
            await carregar()
          }}
        />
      )}

      {comprando && (
        <ModalCompra
          material={comprando}
          onFechar={() => setComprando(null)}
          onSalvo={async (texto) => {
            setComprando(null)
            setMensagem(texto)
            await carregar()
          }}
        />
      )}

      {ajustando && (
        <ModalAjuste
          material={ajustando}
          onFechar={() => setAjustando(null)}
          onSalvo={async (texto) => {
            setAjustando(null)
            setMensagem(texto)
            await carregar()
          }}
        />
      )}

      {historico && (
        <ModalHistorico material={historico} onFechar={() => setHistorico(null)} />
      )}
    </>
  )
}

function ModalMaterial({
  material,
  onFechar,
  onSalvo
}: {
  material: Material | null
  onFechar: () => void
  onSalvo: (mensagem: string) => Promise<void>
}): React.JSX.Element {
  const [nome, setNome] = useState(material?.nome ?? '')
  const [unidade, setUnidade] = useState(material?.unidade ?? 'un')
  const [importado, setImportado] = useState(material?.importado ?? false)
  const [precoUsd, setPrecoUsd] = useState(String(material?.precoUsd ?? ''))
  const [minimo, setMinimo] = useState(String(material?.estoqueMinimo ?? '0'))
  const [ativo, setAtivo] = useState(material?.ativo ?? true)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar(): Promise<void> {
    setSalvando(true)
    setErro(null)
    const corpo = {
      nome,
      unidade,
      importado,
      precoUsd: precoUsd ? Number(precoUsd) : null,
      estoqueMinimo: Number(minimo || 0),
      ativo
    }
    try {
      if (material) {
        await api.estoque.atualizar(material.id, corpo)
        await onSalvo('Material atualizado.')
      } else {
        await api.estoque.criar(corpo)
        await onSalvo('Material cadastrado. Use "Comprar" para dar entrada no estoque.')
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal titulo={material ? `Editar ${material.nome}` : 'Novo material'} onFechar={onFechar}>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <Campo rotulo="Nome">
        <input value={nome} onChange={(e) => setNome(e.target.value)} />
      </Campo>

      <div className="linha-campos">
        <Campo rotulo="Unidade">
          <input value={unidade} onChange={(e) => setUnidade(e.target.value)} />
        </Campo>
        <Campo rotulo="Importado">
          <select value={String(importado)} onChange={(e) => setImportado(e.target.value === 'true')}>
            <option value="false">Nao</option>
            <option value="true">Sim</option>
          </select>
        </Campo>
        <Campo rotulo="Preco em dolar (USD)">
          <input
            type="number"
            min="0"
            step="0.01"
            value={precoUsd}
            disabled={!importado}
            onChange={(e) => setPrecoUsd(e.target.value)}
          />
        </Campo>
      </div>

      <div className="linha-campos">
        <Campo rotulo="Estoque minimo (alerta)">
          <input type="number" min="0" step="0.01" value={minimo} onChange={(e) => setMinimo(e.target.value)} />
        </Campo>
        <Campo rotulo="Ativo">
          <select value={String(ativo)} onChange={(e) => setAtivo(e.target.value === 'true')}>
            <option value="true">Sim</option>
            <option value="false">Nao</option>
          </select>
        </Campo>
      </div>

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

function ModalCompra({
  material,
  onFechar,
  onSalvo
}: {
  material: Material
  onFechar: () => void
  onSalvo: (mensagem: string) => Promise<void>
}): React.JSX.Element {
  const [quantidade, setQuantidade] = useState('1')
  const [precoUsd, setPrecoUsd] = useState(String(material.precoUsd ?? ''))
  const [custoBrl, setCustoBrl] = useState('')
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar(): Promise<void> {
    setSalvando(true)
    setErro(null)
    try {
      const r = await api.estoque.comprar({
        materialId: material.id,
        quantidade: Number(quantidade),
        precoUnitarioUsd: material.importado && precoUsd ? Number(precoUsd) : null,
        custoUnitarioBrl: custoBrl ? Number(custoBrl) : null,
        observacao: observacao || null
      })
      const partes = [
        `Entrada de ${quantidade} ${material.unidade} registrada.`,
        `Custo total ${moeda(r.custoTotalBrl)}.`
      ]
      if (r.cotacaoUsada) {
        partes.push(`Cambio congelado: R$ ${r.cotacaoUsada.valorBrl.toFixed(4)} por dolar.`)
      }
      await onSalvo(partes.join(' '))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao registrar a compra.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal titulo={`Comprar — ${material.nome}`} onFechar={onFechar}>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {material.importado ? (
        <Aviso tipo="atencao">
          Material importado. Informando o preco em dolar, o sistema consulta a cotacao no momento da
          compra e grava o cambio praticado junto da entrada.
        </Aviso>
      ) : null}

      <div className="linha-campos">
        <Campo rotulo={`Quantidade (${material.unidade})`}>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
          />
        </Campo>
        {material.importado ? (
          <Campo rotulo="Preco unitario (USD)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={precoUsd}
              onChange={(e) => setPrecoUsd(e.target.value)}
            />
          </Campo>
        ) : (
          <Campo rotulo="Custo unitario (R$)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={custoBrl}
              onChange={(e) => setCustoBrl(e.target.value)}
            />
          </Campo>
        )}
      </div>

      <Campo rotulo="Observacao">
        <input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
      </Campo>

      <div className="rodape-modal">
        <button className="btn" onClick={onFechar}>
          Cancelar
        </button>
        <button className="btn btn-primario" onClick={() => void salvar()} disabled={salvando}>
          {salvando ? 'Registrando...' : 'Registrar entrada'}
        </button>
      </div>
    </Modal>
  )
}

function ModalAjuste({
  material,
  onFechar,
  onSalvo
}: {
  material: Material
  onFechar: () => void
  onSalvo: (mensagem: string) => Promise<void>
}): React.JSX.Element {
  const [tipo, setTipo] = useState<'SAIDA' | 'AJUSTE' | 'PERDA'>('SAIDA')
  const [quantidade, setQuantidade] = useState('1')
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar(): Promise<void> {
    setSalvando(true)
    setErro(null)
    try {
      const atualizado = await api.estoque.ajustar({
        materialId: material.id,
        tipo,
        quantidade: Number(quantidade),
        observacao: observacao || null
      })
      await onSalvo(
        `Estoque de ${material.nome} agora em ${atualizado.estoqueAtual} ${material.unidade}.`
      )
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao ajustar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal titulo={`Ajustar estoque — ${material.nome}`} onFechar={onFechar}>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <p className="texto-suave" style={{ marginTop: 0 }}>
        Estoque atual: {material.estoqueAtual} {material.unidade}.
      </p>

      <div className="linha-campos">
        <Campo rotulo="Tipo">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
            <option value="SAIDA">Saida manual</option>
            <option value="PERDA">Perda / descarte</option>
            <option value="AJUSTE">Ajuste de inventario (valor final)</option>
          </select>
        </Campo>
        <Campo rotulo={tipo === 'AJUSTE' ? 'Quantidade final' : 'Quantidade'}>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
          />
        </Campo>
      </div>

      <Campo rotulo="Observacao">
        <input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
      </Campo>

      <div className="rodape-modal">
        <button className="btn" onClick={onFechar}>
          Cancelar
        </button>
        <button className="btn btn-primario" onClick={() => void salvar()} disabled={salvando}>
          {salvando ? 'Aplicando...' : 'Aplicar'}
        </button>
      </div>
    </Modal>
  )
}

function ModalHistorico({
  material,
  onFechar
}: {
  material: Material
  onFechar: () => void
}): React.JSX.Element {
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoEstoque[] | null>(null)

  useEffect(() => {
    api.estoque.historico(material.id).then(setMovimentacoes).catch(() => undefined)
  }, [material.id])

  return (
    <Modal titulo={`Movimentacoes — ${material.nome}`} onFechar={onFechar}>
      {!movimentacoes ? (
        <Carregando />
      ) : movimentacoes.length === 0 ? (
        <Vazio>Nenhuma movimentacao registrada.</Vazio>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Quando</th>
              <th>Tipo</th>
              <th>Quantidade</th>
              <th>Custo unit.</th>
              <th>Observacao</th>
            </tr>
          </thead>
          <tbody>
            {movimentacoes.map((m) => (
              <tr key={m.id}>
                <td>{dataHora(m.criadoEm)}</td>
                <td className={m.tipo === 'ENTRADA' ? 'texto-sucesso' : 'texto-suave'}>{m.tipo}</td>
                <td>
                  {m.quantidade} {material.unidade}
                </td>
                <td>{m.custoUnitarioBrl != null ? moeda(m.custoUnitarioBrl) : '-'}</td>
                <td className="texto-suave">{m.observacao ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="rodape-modal">
        <button className="btn" onClick={onFechar}>
          Fechar
        </button>
      </div>
    </Modal>
  )
}
