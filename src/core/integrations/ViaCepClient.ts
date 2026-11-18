import { HttpClient } from './HttpClient.js'
import { env } from '../config/env.js'
import { IntegracaoError } from '../errors.js'
import { cepSchema } from '../../shared/validacao.js'

interface ViaCepResposta {
  cep?: string
  logradouro?: string
  complemento?: string
  bairro?: string
  localidade?: string
  uf?: string
  erro?: boolean | string
}

export interface EnderecoViaCep {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
}

/**
 * API externa 1/4 — ViaCEP.
 * Usada no cadastro de cliente: o operador digita so o CEP e o endereco vem pronto.
 */
export class ViaCepClient extends HttpClient {
  protected readonly servico = 'ViaCEP'

  /** Cache em memoria: o mesmo CEP costuma ser digitado varias vezes na mesma sessao. */
  private readonly cache = new Map<string, EnderecoViaCep>()

  async buscar(cepBruto: string): Promise<EnderecoViaCep> {
    const analise = cepSchema.safeParse(cepBruto)
    if (!analise.success) throw new IntegracaoError(this.servico, 'CEP deve ter 8 digitos.')
    const cep = analise.data

    const emCache = this.cache.get(cep)
    if (emCache) return emCache

    const dados = await this.getJson<ViaCepResposta>(`${env.viaCepBaseUrl}/${cep}/json/`)
    if (dados.erro) throw new IntegracaoError(this.servico, `CEP ${cep} nao encontrado.`)

    const endereco: EnderecoViaCep = {
      cep,
      logradouro: dados.logradouro ?? '',
      complemento: dados.complemento ?? '',
      bairro: dados.bairro ?? '',
      cidade: dados.localidade ?? '',
      uf: (dados.uf ?? '').toUpperCase()
    }
    this.cache.set(cep, endereco)
    return endereco
  }
}
