-- Projeto Final DAD - Estudio Manager
-- Schema inicial: 11 tabelas relacionadas por chaves estrangeiras.

CREATE TABLE IF NOT EXISTS usuario (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  nome            VARCHAR(120)  NOT NULL,
  email           VARCHAR(160)  NOT NULL UNIQUE,
  senha_hash      VARCHAR(255)  NOT NULL,
  perfil          ENUM('DONO','PROFISSIONAL','RECEPCAO') NOT NULL,
  ativo           BOOLEAN       NOT NULL DEFAULT TRUE,
  criado_em       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS endereco (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  cep             CHAR(8)       NOT NULL,
  logradouro      VARCHAR(160)  NOT NULL,
  numero          VARCHAR(20),
  complemento     VARCHAR(80),
  bairro          VARCHAR(120),
  cidade          VARCHAR(120)  NOT NULL,
  uf              CHAR(2)       NOT NULL,
  criado_em       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_endereco_cep (cep)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cliente (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  nome            VARCHAR(140)  NOT NULL,
  cpf             CHAR(11)      UNIQUE,
  email           VARCHAR(160),
  telefone        VARCHAR(20),
  data_nascimento DATE,
  endereco_id     INT,
  -- Dados sensiveis de saude: usados pelo profissional antes do procedimento.
  alergias        TEXT,
  observacoes_saude TEXT,
  ativo           BOOLEAN       NOT NULL DEFAULT TRUE,
  criado_em       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cliente_endereco FOREIGN KEY (endereco_id) REFERENCES endereco(id) ON DELETE SET NULL,
  INDEX idx_cliente_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS profissional (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id         INT           NOT NULL UNIQUE,
  registro_conselho  VARCHAR(40),
  comissao_percentual DECIMAL(5,2) NOT NULL DEFAULT 0,
  bio                TEXT,
  ativo              BOOLEAN       NOT NULL DEFAULT TRUE,
  criado_em          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_profissional_usuario FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS procedimento (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  nome                VARCHAR(140)  NOT NULL,
  categoria           ENUM('TATUAGEM','PIERCING','ESTETICA','OUTRO') NOT NULL,
  descricao           TEXT,
  duracao_minutos     INT           NOT NULL,
  preco_base          DECIMAL(10,2) NOT NULL,
  -- Em quantos dias o cliente deve voltar (retoque, troca de joia, nova sessao de limpeza).
  dias_retorno_sugerido INT,
  ativo               BOOLEAN       NOT NULL DEFAULT TRUE,
  criado_em           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS profissional_procedimento (
  profissional_id   INT NOT NULL,
  procedimento_id   INT NOT NULL,
  preco_praticado   DECIMAL(10,2),
  PRIMARY KEY (profissional_id, procedimento_id),
  CONSTRAINT fk_pp_profissional FOREIGN KEY (profissional_id) REFERENCES profissional(id) ON DELETE CASCADE,
  CONSTRAINT fk_pp_procedimento FOREIGN KEY (procedimento_id) REFERENCES procedimento(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agendamento (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id       INT       NOT NULL,
  profissional_id  INT       NOT NULL,
  procedimento_id  INT       NOT NULL,
  inicio           DATETIME  NOT NULL,
  fim              DATETIME  NOT NULL,
  status           ENUM('AGENDADO','CONFIRMADO','REALIZADO','CANCELADO','FALTOU') NOT NULL DEFAULT 'AGENDADO',
  observacoes      TEXT,
  lembrete_enviado_em DATETIME,
  criado_em        DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em    DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ag_cliente      FOREIGN KEY (cliente_id)      REFERENCES cliente(id)      ON DELETE RESTRICT,
  CONSTRAINT fk_ag_profissional FOREIGN KEY (profissional_id) REFERENCES profissional(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ag_procedimento FOREIGN KEY (procedimento_id) REFERENCES procedimento(id) ON DELETE RESTRICT,
  INDEX idx_ag_agenda (profissional_id, inicio),
  INDEX idx_ag_lembrete (status, inicio, lembrete_enviado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS atendimento (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  agendamento_id    INT           NOT NULL UNIQUE,
  realizado_em      DATETIME      NOT NULL,
  valor_cobrado     DECIMAL(10,2) NOT NULL,
  forma_pagamento   ENUM('DINHEIRO','PIX','DEBITO','CREDITO','OUTRO') NOT NULL DEFAULT 'PIX',
  anotacoes_tecnicas TEXT,
  data_retorno_sugerida DATE,
  criado_em         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_at_agendamento FOREIGN KEY (agendamento_id) REFERENCES agendamento(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS material (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  nome             VARCHAR(140)  NOT NULL,
  unidade          VARCHAR(20)   NOT NULL DEFAULT 'un',
  importado        BOOLEAN       NOT NULL DEFAULT FALSE,
  preco_usd        DECIMAL(10,2),
  estoque_atual    DECIMAL(10,2) NOT NULL DEFAULT 0,
  estoque_minimo   DECIMAL(10,2) NOT NULL DEFAULT 0,
  ativo            BOOLEAN       NOT NULL DEFAULT TRUE,
  criado_em        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_material_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS procedimento_material (
  procedimento_id   INT NOT NULL,
  material_id       INT NOT NULL,
  -- Quanto esse procedimento consome por execucao: usado na baixa automatica de estoque.
  quantidade_padrao DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (procedimento_id, material_id),
  CONSTRAINT fk_pm_procedimento FOREIGN KEY (procedimento_id) REFERENCES procedimento(id) ON DELETE CASCADE,
  CONSTRAINT fk_pm_material     FOREIGN KEY (material_id)     REFERENCES material(id)     ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cotacao_dolar (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  valor_brl      DECIMAL(10,4) NOT NULL,
  variacao_pct   DECIMAL(7,3),
  fonte          VARCHAR(60)   NOT NULL DEFAULT 'awesomeapi',
  consultada_em  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cotacao_data (consultada_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS movimentacao_estoque (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  material_id       INT           NOT NULL,
  tipo              ENUM('ENTRADA','SAIDA','AJUSTE','PERDA') NOT NULL,
  quantidade        DECIMAL(10,2) NOT NULL,
  custo_unitario_brl DECIMAL(10,2),
  -- Preenchido quando a entrada e de material importado: congela o cambio da compra.
  cotacao_dolar_id  INT,
  -- Preenchido quando a saida veio da baixa automatica de um atendimento.
  atendimento_id    INT,
  usuario_id        INT,
  observacao        VARCHAR(255),
  criado_em         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_me_material     FOREIGN KEY (material_id)      REFERENCES material(id)      ON DELETE CASCADE,
  CONSTRAINT fk_me_cotacao      FOREIGN KEY (cotacao_dolar_id) REFERENCES cotacao_dolar(id) ON DELETE SET NULL,
  CONSTRAINT fk_me_atendimento  FOREIGN KEY (atendimento_id)   REFERENCES atendimento(id)   ON DELETE SET NULL,
  CONSTRAINT fk_me_usuario      FOREIGN KEY (usuario_id)       REFERENCES usuario(id)       ON DELETE SET NULL,
  INDEX idx_me_material_data (material_id, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
