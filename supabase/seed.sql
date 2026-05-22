-- =============================================
-- FinanceOS — Seed: Categorias padrão
-- (Nomes batem com sync-user-emails.ts e cnpj-lookup.ts)
-- =============================================

INSERT INTO fo_categories (name, icon, is_default, user_id) VALUES
  ('Alimentação', '🍔', true, NULL),
  ('Transporte', '🚗', true, NULL),
  ('Saúde', '🏥', true, NULL),
  ('Moradia', '🏠', true, NULL),
  ('Lazer', '🎮', true, NULL),
  ('Educação', '📚', true, NULL),
  ('Assinaturas', '🔄', true, NULL),
  ('Outros', '📦', true, NULL);
