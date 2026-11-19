import { useCallback, useEffect, useState } from 'react'
import { api, type ProcedimentoHabilitado } from '../servicos/api'
import { useSessao } from '../contexto/SessaoContexto'
import { Aviso, Campo, Carregando, Modal, Vazio } from '../componentes/Comuns'
import { moeda } from '../util/formato'
import type { Procedimento, Profissional, Usuario } from '@shared/tipos'

export function Profissionais(): React.JSX.Element {
  const { ehDono } = useSessao()
  const [profissionais, setProfissionais] = useState<Profissional[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [editando, setEditando] = useState<Profissional | 'novo' | null>(null)
  const [habilidades, setHabilidades] = useState<Profissional | null>(null)

  const carregar = useCallback(async () => {
    try {
      setProfissionais(await api.profissionais.listar(false))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar os profissionais.')
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function remover(p: Profissional): Promise<void> {
    if (!confirm(`Remover ${p.nome}? Se ja tiver agenda, sera apenas desativado(a).`)) return
    try {
      const r = await api.profissionais.remover(p.id)
      setMensagem(r.desativado ? `${p.nome} foi desativado(a).` : `${p.nome} foi removido(a).`)
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao remover.')
    }
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Profissionais</h1>
          <p>Quem trabalha no estudio e quais procedimentos cada um executa</p>
        </div>
        {ehDono && (
          <button className="btn btn-primario" onClick={() => setEditando('novo')}>
            Novo profissional
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
        {!profissionais ? (
          <Carregando />
        ) : profissionais.length === 0 ? (
          <Vazio>Nenhum profissional cadastrado.</Vazio>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Registro</th>
                <th>Comissao</th>
                <th>Bio</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {profissionais.map((p) => (
                <tr key={p.id} style={p.ativo ? undefined : { opacity: 0.5 }}>
                  <td>
                    {p.nome}
                    {!p.ativo && <span className="texto-suave"> (inativo)</span>}
                  </td>
                  <td>{p.email}</td>
                  <td>{p.registroConselho ?? '-'}</td>
                  <td>{p.comissaoPercentual}%</td>
                  <td className="texto-suave">{p.bio ?? '-'}</td>
                  <td className="acoes">
                    <button className="btn btn-pequeno" onClick={() => setHabilidades(p)}>
                      Procedimentos
                    </button>
                    {ehDono && (
                      <>
                        <button className="btn btn-pequeno" onClick={() => setEditando(p)}>
                          Editar
                        </button>
                        <button
                          className="btn btn-pequeno btn-perigo"
                          onClick={() => void remover(p)}
                        >
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
        <ModalProfissional
          profissional={editando === 'novo' ? null : editando}
          onFechar={() => setEditando(null)}
          onSalvo={async (texto) => {
            setEditando(null)
            setMensagem(texto)
            await carregar()
          }}
        />
      )}

      {habilidades && (
        <ModalHabilidades
          profissional={habilidades}
          somenteLeitura={!ehDono}
          onFechar={() => setHabilidades(null)}
        />
      )}
    </>
  )
}

function ModalProfissional({
  profissional,
  onFechar,
  onSalvo
}: {
  profissional: Profissional | null
  onFechar: () => void
  onSalvo: (mensagem: string) => Promise<void>
}): React.JSX.Element {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [usuarioId, setUsuarioId] = useState(String(profissional?.usuarioId ?? ''))
  const [registro, setRegistro] = useState(profissional?.registroConselho ?? '')
  const [comissao, setComissao] = useState(String(profissional?.comissaoPercentual ?? '40'))
  const [bio, setBio] = useState(profissional?.bio ?? '')
  const [ativo, setAtivo] = useState(profissional?.ativo ?? true)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!profissional) {
      api.usuarios
        .listar()
        .then((lista) => setUsuarios(lista.filter((u) => u.perfil === 'PROFISSIONAL' && u.ativo)))
        .catch(() => undefined)
    }
  }, [profissional])

  async function salvar(): Promise<void> {
    setSalvando(true)
    setErro(null)
    try {
      const corpo = {
        registroConselho: registro || null,
        comissaoPercentual: Number(comissao),
        bio: bio || null,
        ativo
      }
      if (profissional) {
        await api.profissionais.atualizar(profissional.id, corpo)
        await onSalvo('Profissional atualizado.')
      } else {
        await api.profissionais.criar({ ...corpo, usuarioId: Number(usuarioId) })
        await onSalvo('Profissional cadastrado.')
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal titulo={profissional ? `Editar ${profissional.nome}` : 'Novo profissional'} onFechar={onFechar}>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {!profissional && (
        <Campo rotulo="Usuario de acesso (perfil PROFISSIONAL)">
          <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
            <option value="">Selecione...</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome} — {u.email}
              </option>
            ))}
          </select>
          {usuarios.length === 0 && (
            <span className="texto-suave">
              Cadastre antes um usuario com perfil PROFISSIONAL na tela de Usuarios.
            </span>
          )}
        </Campo>
      )}

      <div className="linha-campos">
        <Campo rotulo="Registro / conselho">
          <input value={registro} onChange={(e) => setRegistro(e.target.value)} />
        </Campo>
        <Campo rotulo="Comissao (%)">
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={comissao}
            onChange={(e) => setComissao(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Ativo">
          <select value={String(ativo)} onChange={(e) => setAtivo(e.target.value === 'true')}>
            <option value="true">Sim</option>
            <option value="false">Nao</option>
          </select>
        </Campo>
      </div>

      <Campo rotulo="Bio / especialidade">
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} />
      </Campo>

      <div className="rodape-modal">
        <button className="btn" onClick={onFechar}>
          Cancelar
        </button>
        <button
          className="btn btn-primario"
          onClick={() => void salvar()}
          disabled={salvando || (!profissional && !usuarioId)}
        >
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </Modal>
  )
}

function ModalHabilidades({
  profissional,
  somenteLeitura,
  onFechar
}: {
  profissional: Profissional
  somenteLeitura: boolean
  onFechar: () => void
}): React.JSX.Element {
  const [habilitados, setHabilitados] = useState<ProcedimentoHabilitado[] | null>(null)
  const [todos, setTodos] = useState<Procedimento[]>([])
  const [novoId, setNovoId] = useState('')
  const [preco, setPreco] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    api.profissionais.procedimentos(profissional.id).then(setHabilitados).catch(() => undefined)
    api.procedimentos.listar().then(setTodos).catch(() => undefined)
  }, [profissional.id])

  async function habilitar(): Promise<void> {
    setErro(null)
    try {
      setHabilitados(
        await api.profissionais.habilitar({
          profissionalId: profissional.id,
          procedimentoId: Number(novoId),
          precoPraticado: preco ? Number(preco) : null
        })
      )
      setNovoId('')
      setPreco('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao habilitar.')
    }
  }

  async function desabilitar(procedimentoId: number): Promise<void> {
    setErro(null)
    try {
      setHabilitados(await api.profissionais.desabilitar(profissional.id, procedimentoId))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao desabilitar.')
    }
  }

  const disponiveis = todos.filter((t) => !habilitados?.some((h) => h.id === t.id))

  return (
    <Modal titulo={`Procedimentos de ${profissional.nome}`} onFechar={onFechar}>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <p className="texto-suave" style={{ marginTop: 0 }}>
        A agenda so permite marcar um procedimento com quem esta habilitado a executa-lo.
      </p>

      {!habilitados ? (
        <Carregando />
      ) : habilitados.length === 0 ? (
        <Vazio>Nenhum procedimento habilitado.</Vazio>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Procedimento</th>
              <th>Categoria</th>
              <th>Duracao</th>
              <th>Preco</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {habilitados.map((p) => (
              <tr key={p.id}>
                <td>{p.nome}</td>
                <td className="texto-suave">{p.categoria}</td>
                <td>{p.duracaoMinutos} min</td>
                <td>{moeda(p.precoPraticado ?? p.precoBase)}</td>
                <td className="acoes">
                  {!somenteLeitura && (
                    <button
                      className="btn btn-pequeno btn-perigo"
                      onClick={() => void desabilitar(p.id)}
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
          <Campo rotulo="Habilitar procedimento">
            <select value={novoId} onChange={(e) => setNovoId(e.target.value)}>
              <option value="">Selecione...</option>
              {disponiveis.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Preco praticado (opcional)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
            />
          </Campo>
          <div className="campo">
            <label>&nbsp;</label>
            <button className="btn btn-primario" disabled={!novoId} onClick={() => void habilitar()}>
              Habilitar
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
