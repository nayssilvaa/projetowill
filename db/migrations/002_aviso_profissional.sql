-- Avisos internos da recepcao para os profissionais.
-- Na vespera, a recepcao avisa cada profissional dos atendimentos do dia seguinte;
-- o aviso aparece no painel do profissional ate ele marcar como lido.

CREATE TABLE IF NOT EXISTS aviso_profissional (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  profissional_id    INT       NOT NULL,
  remetente_id       INT,
  dia_referencia     DATE      NOT NULL,
  total_agendamentos INT       NOT NULL DEFAULT 0,
  mensagem           TEXT      NOT NULL,
  criado_em          DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lido_em            DATETIME,
  CONSTRAINT fk_aviso_profissional FOREIGN KEY (profissional_id) REFERENCES profissional(id) ON DELETE CASCADE,
  CONSTRAINT fk_aviso_remetente    FOREIGN KEY (remetente_id)    REFERENCES usuario(id)      ON DELETE SET NULL,
  -- Um aviso por profissional por dia: reenviar atualiza o mesmo aviso em vez de duplicar.
  UNIQUE KEY uk_aviso_dia (profissional_id, dia_referencia)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
