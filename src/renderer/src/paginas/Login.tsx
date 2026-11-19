import { useState, type FormEvent } from 'react'
import { useSessao } from '../contexto/SessaoContexto'
import { Aviso, Campo } from '../componentes/Comuns'

export function Login(): React.JSX.Element {
  const { entrar } = useSessao()
  const [email, setEmail] = useState('dono@estudio.com')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function aoEnviar(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      await entrar(email, senha)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Nao foi possivel entrar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="tela-login">
      <form className="caixa-login" onSubmit={aoEnviar}>
        <h1>
          Estudio<span style={{ color: 'var(--destaque-suave)' }}>Manager</span>
        </h1>
        <p className="sub">Gestao de tatuagem, piercing e estetica</p>

        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <Campo rotulo="E-mail">
          <input
            type="email"
            value={email}
            autoComplete="username"
            required
            onChange={(e) => setEmail(e.target.value)}
          />
        </Campo>

        <Campo rotulo="Senha">
          <input
            type="password"
            value={senha}
            autoComplete="current-password"
            required
            onChange={(e) => setSenha(e.target.value)}
          />
        </Campo>

        <button className="btn btn-primario" style={{ width: '100%' }} disabled={enviando}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>

        <div className="dica-login">
          Usuarios de demonstracao (senha <code>Estudio@2026</code>):
          <br />
          <code>dono@estudio.com</code> — acesso total
          <br />
          <code>recepcao@estudio.com</code> — agenda e cadastros
          <br />
          <code>marina@estudio.com</code> — so a propria agenda
        </div>
      </form>
    </div>
  )
}
