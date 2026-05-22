-- =============================================
-- FinanceOS — Migration 00001: Criar todas as tabelas
-- Prefixo fo_ em todos os nomes para evitar conflito
-- =============================================

-- Enums (CREATE TYPE não suporta IF NOT EXISTS — usar bloco DO)
DO $$ BEGIN
  CREATE TYPE fo_transaction_type AS ENUM ('income', 'expense', 'transfer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fo_transaction_status AS ENUM ('pending', 'confirmed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fo_sync_status AS ENUM ('success', 'partial', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fo_alert_type AS ENUM ('budget_exceeded', 'low_balance', 'large_transaction', 'recurring_detected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
-- Tabela: fo_users
-- =============================================
CREATE TABLE IF NOT EXISTS fo_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================
-- Tabela: fo_bank_accounts
-- =============================================
CREATE TABLE IF NOT EXISTS fo_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES fo_users(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_label TEXT NOT NULL,
  initial_balance NUMERIC(15,2) DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fo_bank_accounts_user ON fo_bank_accounts(user_id);

-- =============================================
-- Tabela: fo_gmail_connections
-- =============================================
CREATE TABLE IF NOT EXISTS fo_gmail_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES fo_users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  connected_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  last_sync_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fo_gmail_connections_user ON fo_gmail_connections(user_id);

-- =============================================
-- Tabela: fo_categories
-- =============================================
CREATE TABLE IF NOT EXISTS fo_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false NOT NULL,
  user_id UUID REFERENCES fo_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fo_categories_user ON fo_categories(user_id);

-- =============================================
-- Tabela: fo_transactions
-- =============================================
CREATE TABLE IF NOT EXISTS fo_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES fo_users(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES fo_bank_accounts(id) ON DELETE SET NULL,
  type fo_transaction_type NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  description TEXT NOT NULL,
  date DATE NOT NULL,
  category_id UUID REFERENCES fo_categories(id) ON DELETE SET NULL,
  cnpj TEXT,
  status fo_transaction_status DEFAULT 'pending' NOT NULL,
  is_recurring BOOLEAN DEFAULT false NOT NULL,
  source_email_id TEXT,
  raw_email_data JSONB,
  ai_parsed_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index para dedup de emails
CREATE UNIQUE INDEX IF NOT EXISTS idx_fo_transactions_source_email
  ON fo_transactions(source_email_id)
  WHERE source_email_id IS NOT NULL;

-- Indexes para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_fo_transactions_user_date ON fo_transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_fo_transactions_user_category ON fo_transactions(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_fo_transactions_user_type ON fo_transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_fo_transactions_user_bank ON fo_transactions(user_id, bank_account_id);

-- =============================================
-- Tabela: fo_tags
-- =============================================
CREATE TABLE IF NOT EXISTS fo_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES fo_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fo_tags_user ON fo_tags(user_id);

-- =============================================
-- Tabela: fo_transaction_tags
-- =============================================
CREATE TABLE IF NOT EXISTS fo_transaction_tags (
  transaction_id UUID NOT NULL REFERENCES fo_transactions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES fo_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, tag_id)
);

-- =============================================
-- Tabela: fo_budgets
-- =============================================
CREATE TABLE IF NOT EXISTS fo_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES fo_users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES fo_categories(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  amount_limit NUMERIC(15,2) NOT NULL,
  UNIQUE (user_id, category_id, month)
);

CREATE INDEX IF NOT EXISTS idx_fo_budgets_user_month ON fo_budgets(user_id, month);

-- =============================================
-- Tabela: fo_cnpj_cache
-- =============================================
CREATE TABLE IF NOT EXISTS fo_cnpj_cache (
  cnpj TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  main_activity TEXT NOT NULL,
  category_suggestion TEXT NOT NULL,
  raw_data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================
-- Tabela: fo_sync_logs
-- =============================================
CREATE TABLE IF NOT EXISTS fo_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES fo_users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  finished_at TIMESTAMPTZ,
  status fo_sync_status NOT NULL,
  emails_found INT DEFAULT 0 NOT NULL,
  emails_processed INT DEFAULT 0 NOT NULL,
  errors JSONB
);

CREATE INDEX IF NOT EXISTS idx_fo_sync_logs_user ON fo_sync_logs(user_id, started_at DESC);

-- =============================================
-- Tabela: fo_alerts
-- =============================================
CREATE TABLE IF NOT EXISTS fo_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES fo_users(id) ON DELETE CASCADE,
  type fo_alert_type NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fo_alerts_user ON fo_alerts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fo_alerts_user_unread ON fo_alerts(user_id) WHERE is_read = false;

-- =============================================
-- Trigger: updated_at automatico para fo_transactions
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_financeos()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transactions_updated_at_financeos ON fo_transactions;
CREATE TRIGGER transactions_updated_at_financeos
  BEFORE UPDATE ON fo_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_financeos();

-- =============================================
-- Trigger: criar registro em fo_users apos signup
-- =============================================
CREATE OR REPLACE FUNCTION handle_new_user_financeos()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.fo_users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_financeos ON auth.users;
CREATE TRIGGER on_auth_user_created_financeos
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_financeos();
