import { useCallback, useEffect, useState } from 'react'
import { api } from '../servicos/api'
import { Aviso, Campo, Carregando, Modal, Vazio } from '../componentes/Comuns'
import type { PerfilUsuario, Usuario } from '@shared/tipos'

const PERFIS: Array<{ valor: PerfilUsuario; descricao: string }> = [
  { valor: 'DONO', descricao: 've tudo, inclusive estoque, dolar e financeiro' },
  { valor: 'RECEPCAO', descricao: 'opera agenda e cadastros, sem financeiro' },
  { valor: 'PROFISSIONAL', descricao: 'enxerga apenas a propria agenda' }
]

export function Usuarios(): React.JSX.Element {
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [editando, setEditando] = useState<Usuario | 'novo' | null>(null)

  const carregar = useCallback(async () => {
    try {
      setUsuarios(await api.usuarios.listar())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar os usuarios.')
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function remover(u: Usuario): Promise<void> {
    if (!confirm(`Desativar o acesso de ${u.nome}?`)) return
    try {
      await api.usuarios.remover(u.id)
      setMensagem(`Acesso de ${u.nome} desativado.`)
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao desativar.')
    }
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Usuarios e acessos</h1>
          <p>Quem entra no sistema e o que cada perfil pode fazer</p>
        </div>
        <button className="btn btn-primario" onClick={() => setEditando('novo')}>
          Novo usuario
        </button>
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

      <Aviso tipo="atencao">
        As senhas sao gravadas apenas como hash bcrypt. Nem o sistema nem o dono conseguem ler a
        senha de um usuario: em caso de esquecimento, cadastre uma nova.
      </Aviso>

      <div className="cartao">
        {!usuarios ? (
          <Carregando />
        ) : usuarios.length === 0 ? (
          <Vazio>Nenhum usuario cadastrado.</Vazio>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Permissoes</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} style={u.ativo ? undefined : { opacity: 0.5 }}>
                  <td>{u.nome}</td>
                  <td>{u.email}</td>
                  <td>{u.perfil}</td>
                  <td className="texto-suave">
                    {PERFIS.find((p) => p.valor === u.perfil)?.descricao}
                  </td>
                  <td className={u.ativo ? 'texto-sucesso' : 'texto-suave'}>
                    {u.ativo ? 'ativo' : 'inativo'}
                  </td>
                  <td className="acoes">
                    <button className="btn btn-pequeno" onClick={() => setEditando(u)}>
                      Editar
                    </button>
                    {u.ativo && (
                      <button className="btn btn-pequeno btn-perigo" onClick={() => void remover(u)}>
                        Desativar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editando !== null && (
        <ModalUsuario
          usuario={editando === 'novo' ? null : editando}
          onFechar={() => setEditando(null)}
          onSalvo={async (texto) => {
            setEditando(null)
            setMensagem(texto)
            await carregar()
          }}
        />
      )}
    </>
  )
}

function ModalUsuario({
  usuario,
  onFechar,
  onSalvo
}: {
  usuario: Usuario | null
  onFechar: () => void
  onSalvo: (mensagem: string) => Promise<void>
}): React.JSX.Element {
  const [nome, setNome] = useState(usuario?.nome ?? '')
  const [email, setEmail] = useState(usuario?.email ?? '')
  const [senha, setSenha] = useState('')
  const [perfil, setPerfil] = useState<PerfilUsuario>(usuario?.perfil ?? 'PROFISSIONAL')
  const [ativo, setAtivo] = useState(usuario?.ativo ?? true)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar(): Promise<void> {
    setSalvando(true)
    setErro(null)
    try {
      if (usuario) {
        await api.usuarios.atualizar(usuario.id, { nome, email, perfil, ativo })
        await onSalvo('Usuario atualizado.')
      } else {
        await api.usuarios.criar({ nome, email, senha, perfil, ativo })
        await onSalvo('Usuario criado.')
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal titulo={usuario ? `Editar ${usuario.nome}` : 'Novo usuario'} onFechar={onFechar}>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <Campo rotulo="Nome">
        <input value={nome} onChange={(e) => setNome(e.target.value)} />
      </Campo>

      <Campo rotulo="E-mail (usado para entrar)">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Campo>

      {!usuario && (
        <Campo rotulo="Senha (minimo 8 caracteres, com letra e numero)">
          <input
            type="password"
            value={senha}
            autoComplete="new-password"
            onChange={(e) => setSenha(e.target.value)}
          />
        </Campo>
      )}

      <div className="linha-campos">
        <Campo rotulo="Perfil">
          <select value={perfil} onChange={(e) => setPerfil(e.target.value as PerfilUsuario)}>
            {PERFIS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.valor}
              </option>
            ))}
          </select>
          <span className="texto-suave" style={{ fontSize: 12 }}>
            {PERFIS.find((p) => p.valor === perfil)?.descricao}
          </span>
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
