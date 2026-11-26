import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useSessao } from './contexto/SessaoContexto'
import { Login } from './paginas/Login'
import { Painel } from './paginas/Painel'
import { Clientes } from './paginas/Clientes'
import { FichaCliente } from './paginas/FichaCliente'
import { Agenda } from './paginas/Agenda'
import { Profissionais } from './paginas/Profissionais'
import { Procedimentos } from './paginas/Procedimentos'
import { Estoque } from './paginas/Estoque'
import { Usuarios } from './paginas/Usuarios'
import { Historico } from './paginas/Historico'
import type { PerfilUsuario } from '@shared/tipos'

interface ItemMenu {
  rota: string
  rotulo: string
  icone: string
  somenteDono?: boolean
  /** Perfis que veem o item; sem a lista, todos veem. */
  perfis?: PerfilUsuario[]
}

const MENU: ItemMenu[] = [
  { rota: '/', rotulo: 'Painel', icone: '◴' },
  { rota: '/agenda', rotulo: 'Agenda', icone: '🗓' },
  { rota: '/clientes', rotulo: 'Clientes', icone: '👤' },
  { rota: '/historico', rotulo: 'Historico', icone: '📋', perfis: ['DONO', 'PROFISSIONAL'] },
  { rota: '/profissionais', rotulo: 'Profissionais', icone: '✂' },
  { rota: '/procedimentos', rotulo: 'Procedimentos', icone: '💉' },
  { rota: '/estoque', rotulo: 'Estoque e dolar', icone: '📦', somenteDono: true },
  { rota: '/usuarios', rotulo: 'Usuarios', icone: '🔐', somenteDono: true }
]

export function App(): React.JSX.Element {
  const { sessao, sair, ehDono, perfil } = useSessao()

  if (!sessao) return <Login />

  const itens = MENU.filter(
    (item) =>
      (!item.somenteDono || ehDono) && (!item.perfis || (perfil && item.perfis.includes(perfil)))
  )
  const veHistorico = perfil === 'DONO' || perfil === 'PROFISSIONAL'

  return (
    <div className="app">
      <aside className="barra-lateral">
        <div className="marca">
          Estudio<span>Manager</span>
          <small>Gestao do estudio</small>
        </div>

        <nav style={{ marginTop: 10 }}>
          {itens.map((item) => (
            <NavLink
              key={item.rota}
              to={item.rota}
              end={item.rota === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' ativo' : ''}`}
            >
              <span aria-hidden>{item.icone}</span>
              {item.rotulo}
            </NavLink>
          ))}
        </nav>

        <div className="rodape-lateral">
          <strong>{sessao.usuario.nome}</strong>
          {sessao.usuario.perfil}
          <button className="btn btn-pequeno" style={{ marginTop: 10, marginLeft: 0 }} onClick={sair}>
            Sair
          </button>
        </div>
      </aside>

      <main className="conteudo">
        <Routes>
          <Route path="/" element={<Painel />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/clientes/:id" element={<FichaCliente />} />
          {veHistorico && <Route path="/historico" element={<Historico />} />}
          <Route path="/profissionais" element={<Profissionais />} />
          <Route path="/procedimentos" element={<Procedimentos />} />
          {ehDono && <Route path="/estoque" element={<Estoque />} />}
          {ehDono && <Route path="/usuarios" element={<Usuarios />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
