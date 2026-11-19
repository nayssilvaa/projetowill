import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../servicos/api'
import { useSessao } from '../contexto/SessaoContexto'
import { Aviso, Campo, Carregando, Modal, Vazio } from '../componentes/Comuns'
import { cpf as formatarCpf, dataCurta, telefone } from '../util/formato'
import type { Cliente } from '@shared/tipos'

interface FormularioCliente {
  nome: string
  cpf: string
  email: string
  telefone: string
  dataNascimento: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  alergias: string
  observacoesSaude: string
}

const FORMULARIO_VAZIO: FormularioCliente = {
  nome: '',
  cpf: '',
  email: '',
  telefone: '',
  dataNascimento: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  alergias: '',
  observacoesSaude: ''
}

export function Clientes(): React.JSX.Element {
  const { podeOperarCadastros, ehDono } = useSessao()
  const [clientes, setClientes] = useState<Cliente[] | null>(null)
  const [termo, setTermo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [editando, setEditando] = useState<number | 'novo' | null>(null)
  const [form, setForm] = useState<FormularioCliente>(FORMULARIO_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)

  const carregar = useCallback(async () => {
    try {
      setClientes(termo.trim().length >= 2 ? await api.clientes.buscar(termo) : await api.clientes.listar(false))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar os clientes.')
    }
  }, [termo])

  useEffect(() => {
    const atraso = setTimeout(() => void carregar(), 250)
    return () => clearTimeout(atraso)
  }, [carregar])

  function alterar<C extends keyof FormularioCliente>(campo: C, valor: string): void {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  /** Autopreenchimento pedido pelo dono: digitou o CEP, o endereco vem da ViaCEP. */
  async function buscarCep(valor: string): Promise<void> {
    const limpo = valor.replace(/\D/g, '')
    if (limpo.length !== 8) return
    setBuscandoCep(true)
    setErro(null)
    try {
      const endereco = await api.clientes.consultarCep(limpo)
      setForm((atual) => ({
        ...atual,
        logradouro: endereco.logradouro,
        bairro: endereco.bairro,
        cidade: endereco.cidade,
        uf: endereco.uf,
        complemento: atual.complemento || endereco.complemento
      }))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao consultar o CEP.')
    } finally {
      setBuscandoCep(false)
    }
  }

  async function abrirEdicao(id: number): Promise<void> {
    setErro(null)
    try {
      const ficha = await api.clientes.ficha(id)
      const e = ficha.cliente.endereco
      setForm({
        nome: ficha.cliente.nome,
        cpf: ficha.cliente.cpf ?? '',
        email: ficha.cliente.email ?? '',
        telefone: ficha.cliente.telefone ?? '',
        dataNascimento: ficha.cliente.dataNascimento ?? '',
        cep: e?.cep ?? '',
        logradouro: e?.logradouro ?? '',
        numero: e?.numero ?? '',
        complemento: e?.complemento ?? '',
        bairro: e?.bairro ?? '',
        cidade: e?.cidade ?? '',
        uf: e?.uf ?? '',
        alergias: ficha.cliente.alergias ?? '',
        observacoesSaude: ficha.cliente.observacoesSaude ?? ''
      })
      setEditando(id)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao abrir o cliente.')
    }
  }

  async function salvar(): Promise<void> {
    setSalvando(true)
    setErro(null)
    const temEndereco = form.cep.replace(/\D/g, '').length === 8 && form.logradouro && form.cidade
    const corpo = {
      nome: form.nome,
      cpf: form.cpf || null,
      email: form.email || null,
      telefone: form.telefone || null,
      dataNascimento: form.dataNascimento || null,
      alergias: form.alergias || null,
      observacoesSaude: form.observacoesSaude || null,
      endereco: temEndereco
        ? {
            cep: form.cep,
            logradouro: form.logradouro,
            numero: form.numero || null,
            complemento: form.complemento || null,
            bairro: form.bairro || null,
            cidade: form.cidade,
            uf: form.uf
          }
        : null
    }

    try {
      if (editando === 'novo') {
        await api.clientes.criar(corpo)
        setMensagem('Cliente cadastrado.')
      } else if (typeof editando === 'number') {
        await api.clientes.atualizar(editando, corpo)
        setMensagem('Cliente atualizado.')
      }
      setEditando(null)
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar o cliente.')
    } finally {
      setSalvando(false)
    }
  }

  async function remover(cliente: Cliente): Promise<void> {
    if (!confirm(`Remover ${cliente.nome}? Se ja tiver historico, sera apenas desativado(a).`)) return
    setErro(null)
    try {
      const r = await api.clientes.remover(cliente.id)
      setMensagem(
        r.desativado
          ? `${cliente.nome} foi desativado(a): o historico de procedimentos foi preservado.`
          : `${cliente.nome} foi removido(a).`
      )
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao remover o cliente.')
    }
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Clientes</h1>
          <p>Cadastro, contato e restricoes de saude</p>
        </div>
        {podeOperarCadastros && (
          <button
            className="btn btn-primario"
            onClick={() => {
              setForm(FORMULARIO_VAZIO)
              setEditando('novo')
            }}
          >
            Novo cliente
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

      <div className="barra-ferramentas">
        <input
          type="search"
          placeholder="Buscar por nome, CPF, e-mail ou telefone..."
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
        <span className="texto-suave">{clientes?.length ?? 0} cliente(s)</span>
      </div>

      <div className="cartao">
        {!clientes ? (
          <Carregando />
        ) : clientes.length === 0 ? (
          <Vazio>Nenhum cliente encontrado.</Vazio>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>CPF</th>
                <th>Telefone</th>
                <th>E-mail</th>
                <th>Nascimento</th>
                <th>Saude</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} style={c.ativo ? undefined : { opacity: 0.5 }}>
                  <td>
                    <Link to={`/clientes/${c.id}`}>{c.nome}</Link>
                    {!c.ativo && <span className="texto-suave"> (inativo)</span>}
                  </td>
                  <td>{formatarCpf(c.cpf)}</td>
                  <td>{telefone(c.telefone)}</td>
                  <td>{c.email ?? '-'}</td>
                  <td>{dataCurta(c.dataNascimento)}</td>
                  <td>
                    {c.alergias ? (
                      <span className="texto-alerta" title={c.alergias}>
                        alergia
                      </span>
                    ) : c.observacoesSaude ? (
                      <span className="texto-suave">observacao</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="acoes">
                    {podeOperarCadastros && (
                      <button className="btn btn-pequeno" onClick={() => void abrirEdicao(c.id)}>
                        Editar
                      </button>
                    )}
                    {ehDono && (
                      <button
                        className="btn btn-pequeno btn-perigo"
                        onClick={() => void remover(c)}
                      >
                        Excluir
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
        <Modal
          titulo={editando === 'novo' ? 'Novo cliente' : 'Editar cliente'}
          onFechar={() => setEditando(null)}
        >
          <div className="linha-campos">
            <Campo rotulo="Nome completo">
              <input value={form.nome} onChange={(e) => alterar('nome', e.target.value)} />
            </Campo>
            <Campo rotulo="CPF">
              <input
                value={form.cpf}
                placeholder="somente numeros"
                onChange={(e) => alterar('cpf', e.target.value)}
              />
            </Campo>
          </div>

          <div className="linha-campos">
            <Campo rotulo="E-mail (recebe os lembretes)">
              <input type="email" value={form.email} onChange={(e) => alterar('email', e.target.value)} />
            </Campo>
            <Campo rotulo="Telefone">
              <input value={form.telefone} onChange={(e) => alterar('telefone', e.target.value)} />
            </Campo>
            <Campo rotulo="Nascimento">
              <input
                type="date"
                value={form.dataNascimento}
                onChange={(e) => alterar('dataNascimento', e.target.value)}
              />
            </Campo>
          </div>

          <h3 style={{ fontSize: 13, color: 'var(--texto-suave)', margin: '14px 0 8px' }}>
            Endereco {buscandoCep && <span>· consultando ViaCEP...</span>}
          </h3>

          <div className="linha-campos">
            <Campo rotulo="CEP (preenche o resto sozinho)">
              <input
                value={form.cep}
                placeholder="00000-000"
                onChange={(e) => {
                  alterar('cep', e.target.value)
                  void buscarCep(e.target.value)
                }}
              />
            </Campo>
            <Campo rotulo="Logradouro">
              <input value={form.logradouro} onChange={(e) => alterar('logradouro', e.target.value)} />
            </Campo>
            <Campo rotulo="Numero">
              <input value={form.numero} onChange={(e) => alterar('numero', e.target.value)} />
            </Campo>
          </div>

          <div className="linha-campos">
            <Campo rotulo="Complemento">
              <input value={form.complemento} onChange={(e) => alterar('complemento', e.target.value)} />
            </Campo>
            <Campo rotulo="Bairro">
              <input value={form.bairro} onChange={(e) => alterar('bairro', e.target.value)} />
            </Campo>
            <Campo rotulo="Cidade">
              <input value={form.cidade} onChange={(e) => alterar('cidade', e.target.value)} />
            </Campo>
            <Campo rotulo="UF">
              <input
                value={form.uf}
                maxLength={2}
                onChange={(e) => alterar('uf', e.target.value.toUpperCase())}
              />
            </Campo>
          </div>

          <h3 style={{ fontSize: 13, color: 'var(--texto-suave)', margin: '14px 0 8px' }}>
            Dados de saude
          </h3>

          <Campo rotulo="Alergias">
            <textarea
              value={form.alergias}
              placeholder="Latex, niquel, anestesico..."
              onChange={(e) => alterar('alergias', e.target.value)}
            />
          </Campo>

          <Campo rotulo="Observacoes de saude">
            <textarea
              value={form.observacoesSaude}
              placeholder="Medicamentos em uso, condicoes relevantes ao procedimento..."
              onChange={(e) => alterar('observacoesSaude', e.target.value)}
            />
          </Campo>

          <div className="rodape-modal">
            <button className="btn" onClick={() => setEditando(null)}>
              Cancelar
            </button>
            <button className="btn btn-primario" onClick={() => void salvar()} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
