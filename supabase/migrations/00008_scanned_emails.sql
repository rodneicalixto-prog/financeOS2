-- =============================================
-- FinanceOS — Migration 00008: Caixa de emails analisados
--
-- Registra TODOS os emails que o sync olhou (parseados, declinados pela IA,
-- com erro, ou classificados manualmente). Permite ao usuário revisar emails
-- que a IA não conseguiu identificar como transação e criá-las manualmente.
-- =============================================

CREATE TABLE IF NOT EXISTS fo_scanned_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_connection_id UUID REFERENCES fo_gmail_connections(id) ON DELETE SET NULL,
  message_id TEXT NOT NULL,
  subject TEXT,
  from_address TEXT,
  snippet TEXT,
  received_at TIMESTAMPTZ,
  kind TEXT NOT NULL CHECK (kind IN ('parsed','declined','error','ignored','manually_created')),
  error_message TEXT,
  transaction_id UUID REFERENCES fo_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_fo_scanned_emails_user_kind
  ON fo_scanned_emails (user_id, kind, received_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_fo_scanned_emails_transaction
  ON fo_scanned_emails (transaction_id)
  WHERE transaction_id IS NOT NULL;

-- Trigger updated_at (reaproveita função criada em 00001)
DROP TRIGGER IF EXISTS scanned_emails_updated_at_financeos ON fo_scanned_emails;
CREATE TRIGGER scanned_emails_updated_at_financeos
  BEFORE UPDATE ON fo_scanned_emails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_financeos();

-- RLS
ALTER TABLE fo_scanned_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fo_scanned_emails_select_own" ON fo_scanned_emails;
CREATE POLICY "fo_scanned_emails_select_own" ON fo_scanned_emails
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "fo_scanned_emails_insert_own" ON fo_scanned_emails;
CREATE POLICY "fo_scanned_emails_insert_own" ON fo_scanned_emails
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "fo_scanned_emails_update_own" ON fo_scanned_emails;
CREATE POLICY "fo_scanned_emails_update_own" ON fo_scanned_emails
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "fo_scanned_emails_delete_own" ON fo_scanned_emails;
CREATE POLICY "fo_scanned_emails_delete_own" ON fo_scanned_emails
  FOR DELETE USING (user_id = auth.uid());
