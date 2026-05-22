-- =============================================
-- FinanceOS — Migration 00009: Regras de sync por remetente/assunto
--
-- Permite ao usuário criar regras que afetam o comportamento do sync:
--   - ignore: pula o email (kind=ignored em fo_scanned_emails)
--   - force_expense / force_income: força tipo e categoria após parse da IA
-- =============================================

CREATE TABLE IF NOT EXISTS fo_email_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  sender_pattern TEXT,
  subject_pattern TEXT,
  action TEXT NOT NULL CHECK (action IN ('ignore','force_expense','force_income')),
  category_id UUID REFERENCES fo_categories(id) ON DELETE SET NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  match_count INTEGER NOT NULL DEFAULT 0,
  last_matched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT email_rules_at_least_one_pattern
    CHECK (sender_pattern IS NOT NULL OR subject_pattern IS NOT NULL),
  CONSTRAINT email_rules_ignore_no_category
    CHECK (action != 'ignore' OR category_id IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_fo_email_rules_user_enabled
  ON fo_email_rules (user_id, enabled);

-- Trigger updated_at
DROP TRIGGER IF EXISTS email_rules_updated_at_financeos ON fo_email_rules;
CREATE TRIGGER email_rules_updated_at_financeos
  BEFORE UPDATE ON fo_email_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_financeos();

-- RLS
ALTER TABLE fo_email_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fo_email_rules_select_own" ON fo_email_rules;
CREATE POLICY "fo_email_rules_select_own" ON fo_email_rules
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "fo_email_rules_insert_own" ON fo_email_rules;
CREATE POLICY "fo_email_rules_insert_own" ON fo_email_rules
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "fo_email_rules_update_own" ON fo_email_rules;
CREATE POLICY "fo_email_rules_update_own" ON fo_email_rules
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "fo_email_rules_delete_own" ON fo_email_rules;
CREATE POLICY "fo_email_rules_delete_own" ON fo_email_rules
  FOR DELETE USING (user_id = auth.uid());
