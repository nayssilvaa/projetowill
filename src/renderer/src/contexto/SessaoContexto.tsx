import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { api } from '../servicos/api'
import { definirToken, obterToken } from '../servicos/ipc'
import type { PerfilUsuario, SessaoUsuario } from '@shared/tipos'

interface ValorSessao {
  sessao: SessaoUsuario | null
  entrar: (email: string, senha: string) => Promise<void>
  sair: () => void
  ehDono: boolean
  podeOperarCadastros: boolean
  perfil: PerfilUsuario | null
}

const Contexto = createContext<ValorSessao | null>(null)

export function ProvedorSessao({ children }: { children: ReactNode }): React.JSX.Element {
  const [sessao, setSessao] = useState<SessaoUsuario | null>(null)

  const entrar = useCallback(async (email: string, senha: string) => {
    const nova = await api.auth.login(email, senha)
    definirToken(nova.token)
    setSessao(nova)
  }, [])

  const sair = useCallback(() => {
    const token = obterToken()
    if (token) void window.api.invocar('auth:logout', token)
    definirToken(null)
    setSessao(null)
  }, [])

  const valor = useMemo<ValorSessao>(
    () => ({
      sessao,
      entrar,
      sair,
      perfil: sessao?.usuario.perfil ?? null,
      ehDono: sessao?.usuario.perfil === 'DONO',
      podeOperarCadastros:
        sessao?.usuario.perfil === 'DONO' || sessao?.usuario.perfil === 'RECEPCAO'
    }),
    [sessao, entrar, sair]
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useSessao(): ValorSessao {
  const valor = useContext(Contexto)
  if (!valor) throw new Error('useSessao precisa estar dentro de ProvedorSessao.')
  return valor
}
