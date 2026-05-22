-- =============================================
-- FinanceOS — Migration 00004: Configurações de IA por usuário
-- Permite cada usuário usar sua própria chave OpenAI ou Gemini
-- =============================================

DO $$ BEGIN
  CREATE TYPE fo_ai_provider AS ENUM ('openai', 'gemini');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS fo_ai_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES fo_users(id) ON DELETE CASCADE,
  provider fo_ai_provider NOT NULL,
  api_key TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fo_ai_configs_user ON fo_ai_configs(user_id);

-- =============================================
-- RLS
-- =============================================
ALTER TABLE fo_ai_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fo_ai_configs_select_own" ON fo_ai_configs;
CREATE POLICY "fo_ai_configs_select_own" ON fo_ai_configs
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "fo_ai_configs_insert_own" ON fo_ai_configs;
CREATE POLICY "fo_ai_configs_insert_own" ON fo_ai_configs
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "fo_ai_configs_update_own" ON fo_ai_configs;
CREATE POLICY "fo_ai_configs_update_own" ON fo_ai_configs
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "fo_ai_configs_delete_own" ON fo_ai_configs;
CREATE POLICY "fo_ai_configs_delete_own" ON fo_ai_configs
  FOR DELETE USING (user_id = auth.uid());

-- =============================================
-- Trigger: updated_at automático
-- =============================================
DROP TRIGGER IF EXISTS ai_configs_updated_at_financeos ON fo_ai_configs;
CREATE TRIGGER ai_configs_updated_at_financeos
  BEFORE UPDATE ON fo_ai_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_financeos();
