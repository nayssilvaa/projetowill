import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { ProvedorSessao } from './contexto/SessaoContexto'
import { App } from './App'
import './estilos.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <ProvedorSessao>
        <App />
      </ProvedorSessao>
    </HashRouter>
  </StrictMode>
)
