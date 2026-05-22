-- =============================================
-- FinanceOS — Migration 00010: Seed das categorias padrão
--
-- Garante que a instância tem as 8 categorias padrão (is_default=true, user_id=null).
-- Idempotente: só insere quem ainda não existe.
-- Os nomes batem com o que o sync espera (sync-user-emails.ts e cnpj-lookup.ts).
-- =============================================

INSERT INTO fo_categories (name, icon, is_default, user_id)
SELECT v.name, v.icon, TRUE, NULL
FROM (VALUES
  ('Alimentação', '🍔'),
  ('Transporte', '🚗'),
  ('Saúde', '🏥'),
  ('Moradia', '🏠'),
  ('Lazer', '🎮'),
  ('Educação', '📚'),
  ('Assinaturas', '🔄'),
  ('Outros', '📦')
) AS v(name, icon)
WHERE NOT EXISTS (
  SELECT 1 FROM fo_categories c
  WHERE c.name = v.name
    AND c.is_default = TRUE
    AND c.user_id IS NULL
);
