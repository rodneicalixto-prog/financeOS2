-- =============================================================================
-- FinanceOS — Migration 00015: Branding (nome, logo, favicon, cor, tema)
-- -----------------------------------------------------------------------------
-- Linha única (singleton) com a identidade visual da instância. Leitura
-- liberada para qualquer usuário autenticado (usada no shell inteiro:
-- sidebar, header, título da aba); escrita restrita ao owner.
-- =============================================================================

CREATE TABLE IF NOT EXISTS fo_branding_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id), -- garante linha única
  app_name TEXT NOT NULL DEFAULT 'FinanceOS',
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#3B82F6',
  theme_mode TEXT NOT NULL DEFAULT 'dark' CHECK (theme_mode IN ('dark', 'light')),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO fo_branding_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE fo_branding_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated reads branding" ON fo_branding_settings;
CREATE POLICY "Authenticated reads branding"
  ON fo_branding_settings
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Owner writes branding" ON fo_branding_settings;
CREATE POLICY "Owner writes branding"
  ON fo_branding_settings
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM fo_users WHERE id = auth.uid() AND role = 'owner')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM fo_users WHERE id = auth.uid() AND role = 'owner')
  );
