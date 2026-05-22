-- =============================================
-- FinanceOS — Migration 00002: RLS Policies
-- =============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE fo_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE fo_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fo_gmail_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE fo_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE fo_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fo_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE fo_transaction_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE fo_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE fo_cnpj_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE fo_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fo_alerts ENABLE ROW LEVEL SECURITY;

-- =============================================
-- fo_users: apenas dados proprios
-- =============================================
DROP POLICY IF EXISTS "fo_users_select_own" ON fo_users;
CREATE POLICY "fo_users_select_own" ON fo_users
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "fo_users_update_own" ON fo_users;
CREATE POLICY "fo_users_update_own" ON fo_users
  FOR UPDATE USING (id = auth.uid());

-- =============================================
-- fo_bank_accounts: apenas dados proprios
-- =============================================
DROP POLICY IF EXISTS "fo_bank_accounts_all_own" ON fo_bank_accounts;
CREATE POLICY "fo_bank_accounts_all_own" ON fo_bank_accounts
  FOR ALL USING (user_id = auth.uid());

-- =============================================
-- fo_gmail_connections: apenas dados proprios
-- =============================================
DROP POLICY IF EXISTS "fo_gmail_connections_all_own" ON fo_gmail_connections;
CREATE POLICY "fo_gmail_connections_all_own" ON fo_gmail_connections
  FOR ALL USING (user_id = auth.uid());

-- =============================================
-- fo_categories: padrao visivel a todos, custom por user_id
-- =============================================
DROP POLICY IF EXISTS "fo_categories_select" ON fo_categories;
CREATE POLICY "fo_categories_select" ON fo_categories
  FOR SELECT USING (is_default = true OR user_id = auth.uid());

DROP POLICY IF EXISTS "fo_categories_insert_own" ON fo_categories;
CREATE POLICY "fo_categories_insert_own" ON fo_categories
  FOR INSERT WITH CHECK (user_id = auth.uid() AND is_default = false);

DROP POLICY IF EXISTS "fo_categories_update_own" ON fo_categories;
CREATE POLICY "fo_categories_update_own" ON fo_categories
  FOR UPDATE USING (user_id = auth.uid() AND is_default = false);

DROP POLICY IF EXISTS "fo_categories_delete_own" ON fo_categories;
CREATE POLICY "fo_categories_delete_own" ON fo_categories
  FOR DELETE USING (user_id = auth.uid() AND is_default = false);

-- =============================================
-- fo_transactions: apenas dados proprios
-- =============================================
DROP POLICY IF EXISTS "fo_transactions_all_own" ON fo_transactions;
CREATE POLICY "fo_transactions_all_own" ON fo_transactions
  FOR ALL USING (user_id = auth.uid());

-- =============================================
-- fo_tags: apenas dados proprios
-- =============================================
DROP POLICY IF EXISTS "fo_tags_all_own" ON fo_tags;
CREATE POLICY "fo_tags_all_own" ON fo_tags
  FOR ALL USING (user_id = auth.uid());

-- =============================================
-- fo_transaction_tags: apenas se a transacao pertence ao usuario
-- =============================================
DROP POLICY IF EXISTS "fo_transaction_tags_select" ON fo_transaction_tags;
CREATE POLICY "fo_transaction_tags_select" ON fo_transaction_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM fo_transactions
      WHERE fo_transactions.id = fo_transaction_tags.transaction_id
      AND fo_transactions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "fo_transaction_tags_insert" ON fo_transaction_tags;
CREATE POLICY "fo_transaction_tags_insert" ON fo_transaction_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM fo_transactions
      WHERE fo_transactions.id = fo_transaction_tags.transaction_id
      AND fo_transactions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "fo_transaction_tags_delete" ON fo_transaction_tags;
CREATE POLICY "fo_transaction_tags_delete" ON fo_transaction_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM fo_transactions
      WHERE fo_transactions.id = fo_transaction_tags.transaction_id
      AND fo_transactions.user_id = auth.uid()
    )
  );

-- =============================================
-- fo_budgets: apenas dados proprios
-- =============================================
DROP POLICY IF EXISTS "fo_budgets_all_own" ON fo_budgets;
CREATE POLICY "fo_budgets_all_own" ON fo_budgets
  FOR ALL USING (user_id = auth.uid());

-- =============================================
-- fo_cnpj_cache: leitura publica, escrita via service_role
-- =============================================
DROP POLICY IF EXISTS "fo_cnpj_cache_select_public" ON fo_cnpj_cache;
CREATE POLICY "fo_cnpj_cache_select_public" ON fo_cnpj_cache
  FOR SELECT USING (true);

-- =============================================
-- fo_sync_logs: apenas dados proprios
-- =============================================
DROP POLICY IF EXISTS "fo_sync_logs_all_own" ON fo_sync_logs;
CREATE POLICY "fo_sync_logs_all_own" ON fo_sync_logs
  FOR ALL USING (user_id = auth.uid());

-- =============================================
-- fo_alerts: apenas dados proprios
-- =============================================
DROP POLICY IF EXISTS "fo_alerts_all_own" ON fo_alerts;
CREATE POLICY "fo_alerts_all_own" ON fo_alerts
  FOR ALL USING (user_id = auth.uid());
