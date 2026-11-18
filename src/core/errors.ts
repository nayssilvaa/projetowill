export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string = 'APP_ERROR',
    readonly status: number = 400
  ) {
    super(message)
    this.name = new.target.name
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    readonly campos: Record<string, string[]> = {}
  ) {
    super(message, 'VALIDATION_ERROR', 422)
  }
}

export class NotFoundError extends AppError {
  constructor(entidade: string, id: number | string) {
    super(`${entidade} ${id} nao encontrado(a).`, 'NOT_FOUND', 404)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Credenciais invalidas.') {
    super(message, 'UNAUTHORIZED', 401)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Seu perfil nao tem permissao para esta acao.') {
    super(message, 'FORBIDDEN', 403)
  }
}

export class IntegracaoError extends AppError {
  constructor(servico: string, detalhe: string) {
    super(`Falha ao consultar ${servico}: ${detalhe}`, 'INTEGRACAO_ERROR', 502)
  }
}
