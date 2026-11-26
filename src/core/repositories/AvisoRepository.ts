import type { RowDataPacket } from 'mysql2/promise'
import { BaseRepository } from './BaseRepository.js'
import type { AvisoProfissional } from '../../shared/tipos.js'

function dataIso(valor: unknown): string {
  if (valor instanceof Date) {
    const pad = (n: number): string => String(n).padStart(2, '0')
    return `${valor.getFullYear()}-${pad(valor.getMonth() + 1)}-${pad(valor.getDate())}T${pad(valor.getHours())}:${pad(valor.getMinutes())}`
  }
  return String(valor ?? '')
}

export class AvisoRepository extends BaseRepository<AvisoProfissional> {
  protected readonly tabela = 'aviso_profissional'
  protected readonly rotulo = 'Aviso'

  private readonly selectDetalhado = `
    SELECT av.*,
           up.nome AS profissional_nome,
           ur.nome AS remetente_nome
    FROM aviso_profissional av
    JOIN profissional p ON p.id = av.profissional_id
    JOIN usuario up     ON up.id = p.usuario_id
    LEFT JOIN usuario ur ON ur.id = av.remetente_id`

  protected mapear(linha: RowDataPacket): AvisoProfissional {
    return {
      id: linha.id,
      profissionalId: linha.profissional_id,
      profissionalNome: linha.profissional_nome ?? '',
      remetenteNome: linha.remetente_nome ?? null,
      diaReferencia: dataIso(linha.dia_referencia).slice(0, 10),
      totalAgendamentos: linha.total_agendamentos,
      mensagem: linha.mensagem,
      criadoEm: dataIso(linha.criado_em),
      lidoEm: linha.lido_em ? dataIso(linha.lido_em) : null
    }
  }

  override async buscarPorId(id: number): Promise<AvisoProfissional | null> {
    const linha = await this.db.queryOne<RowDataPacket>(`${this.selectDetalhado} WHERE av.id = ?`, [
      id
    ])
    return linha ? this.mapear(linha) : null
  }

  /**
   * Cria o aviso do dia ou, se ja existir, substitui o conteudo e volta a marca-lo
   * como nao lido — a agenda pode ter mudado desde o ultimo envio.
   */
  async salvarDoDia(dados: {
    profissionalId: number
    remetenteId: number | null
    diaReferencia: string
    totalAgendamentos: number
    mensagem: string
  }): Promise<void> {
    await this.db.execute(
      `INSERT INTO aviso_profissional
         (profissional_id, remetente_id, dia_referencia, total_agendamentos, mensagem)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         remetente_id = VALUES(remetente_id),
         total_agendamentos = VALUES(total_agendamentos),
         mensagem = VALUES(mensagem),
         criado_em = NOW(),
         lido_em = NULL`,
      [
        dados.profissionalId,
        dados.remetenteId,
        dados.diaReferencia,
        dados.totalAgendamentos,
        dados.mensagem
      ]
    )
  }

  async listarDoProfissional(profissionalId: number, limite = 10): Promise<AvisoProfissional[]> {
    const linhas = await this.db.query<RowDataPacket>(
      `${this.selectDetalhado}
       WHERE av.profissional_id = ?
       ORDER BY av.dia_referencia DESC
       LIMIT ${Math.max(1, Math.min(50, Math.trunc(limite)))}`,
      [profissionalId]
    )
    return linhas.map((l) => this.mapear(l))
  }

  async listarDoDia(diaReferencia: string): Promise<AvisoProfissional[]> {
    const linhas = await this.db.query<RowDataPacket>(
      `${this.selectDetalhado} WHERE av.dia_referencia = ? ORDER BY up.nome`,
      [diaReferencia]
    )
    return linhas.map((l) => this.mapear(l))
  }

  async marcarLido(id: number): Promise<void> {
    await this.db.execute(
      'UPDATE aviso_profissional SET lido_em = COALESCE(lido_em, NOW()) WHERE id = ?',
      [id]
    )
  }
}
