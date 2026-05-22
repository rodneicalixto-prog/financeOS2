-- Permitir múltiplas conexões Gmail por usuário
-- Trocar unique(user_id) por unique(user_id, email_address)

DROP INDEX IF EXISTS idx_fo_gmail_connections_user;

ALTER TABLE fo_gmail_connections ADD COLUMN IF NOT EXISTS email_address TEXT;

CREATE UNIQUE INDEX idx_fo_gmail_connections_user_email
  ON fo_gmail_connections(user_id, email_address);
