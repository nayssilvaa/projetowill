import type { ReactNode } from 'react'
import type { StatusAgendamento } from '@shared/tipos'

export function Aviso({
  tipo,
  children,
  onFechar
}: {
  tipo: 'erro' | 'sucesso' | 'atencao'
  children: ReactNode
  onFechar?: () => void
}): React.JSX.Element {
  return (
    <div className={`aviso aviso-${tipo}`} role={tipo === 'erro' ? 'alert' : 'status'}>
      {children}
      {onFechar && (
        <button className="btn btn-pequeno" style={{ float: 'right' }} onClick={onFechar}>
          fechar
        </button>
      )}
    </div>
  )
}

export function Modal({
  titulo,
  children,
  onFechar
}: {
  titulo: string
  children: ReactNode
  onFechar: () => void
}): React.JSX.Element {
  return (
    <div
      className="fundo-modal"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFechar()
      }}
    >
      <div className="modal" role="dialog" aria-label={titulo}>
        <h2>{titulo}</h2>
        {children}
      </div>
    </div>
  )
}

export function Campo({
  rotulo,
  erro,
  children
}: {
  rotulo: string
  erro?: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="campo">
      <label>{rotulo}</label>
      {children}
      {erro && <span className="erro-campo">{erro}</span>}
    </div>
  )
}

export function Etiqueta({ status }: { status: StatusAgendamento }): React.JSX.Element {
  return <span className={`etiqueta etiqueta-${status}`}>{status}</span>
}

export function Vazio({ children }: { children: ReactNode }): React.JSX.Element {
  return <p className="vazio">{children}</p>
}

export function Carregando(): React.JSX.Element {
  return <p className="carregando">Carregando...</p>
}
