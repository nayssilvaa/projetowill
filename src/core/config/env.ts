import 'dotenv/config'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}. Copie .env.example para .env.`)
  return value
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback
}

export const env = {
  db: {
    host: optional('DB_HOST', 'localhost'),
    port: Number(optional('DB_PORT', '3306')),
    user: optional('DB_USER', 'root'),
    password: optional('DB_PASSWORD', ''),
    database: optional('DB_NAME', 'estudio')
  },
  appSecret: optional('APP_SECRET', 'dev-secret-trocar-em-producao'),
  api: {
    port: Number(optional('API_PORT', '3333')),
    baseUrl: optional('API_BASE_URL', 'http://localhost:3333')
  },
  viaCepBaseUrl: optional('VIACEP_BASE_URL', 'https://viacep.com.br/ws'),
  cambioBaseUrl: optional('CAMBIO_BASE_URL', 'https://economia.awesomeapi.com.br/json/last'),
  cotacaoAlertaPercentual: Number(optional('COTACAO_ALERTA_PERCENTUAL', '2.5')),
  smtp: {
    host: optional('SMTP_HOST', ''),
    port: Number(optional('SMTP_PORT', '587')),
    user: optional('SMTP_USER', ''),
    password: optional('SMTP_PASSWORD', ''),
    from: optional('SMTP_FROM', 'Estudio Manager <nao-responda@estudio.local>')
  },
  required
}
