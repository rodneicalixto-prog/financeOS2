-- =============================================================================
-- FinanceOS — Migration 00015: auto-seed das regras de sync sugeridas
-- -----------------------------------------------------------------------------
-- Toda conta nova nasce com um conjunto curado de regras (classificação de
-- direção pix/pagamento). Idempotente: pula regras que já existem (por padrão).
--   1) função SECURITY DEFINER que insere os defaults para um usuário
--   2) trigger AFTER INSERT em fo_users → cobre owner + convidados
--   3) backfill único dos usuários já existentes (a migration roda 1x, via
--      checkpoint migration:00015_* em _bootstrap_state)
-- =============================================================================

CREATE OR REPLACE FUNCTION seed_default_email_rules_financeos(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  INSERT INTO fo_email_rules (user_id, name, sender_pattern, subject_pattern, action, category_id, enabled)
  SELECT p_user_id, s.name, NULL, s.subject_pattern, s.action, NULL, TRUE
  FROM (VALUES
    -- Receitas (dinheiro entrando)
    ('Pix recebido',             'pix recebido',             'force_income'),
    ('Você recebeu (Pix)',       'você recebeu',             'force_income'),
    ('Pagamento recebido',       'pagamento recebido',       'force_income'),
    ('Transferência recebida',   'transferência recebida',   'force_income'),
    -- Despesas (dinheiro saindo)
    ('Pix enviado',              'pix enviado',              'force_expense'),
    ('Pagamento confirmado',     'pagamento confirmado',     'force_expense'),
    ('Confirmação de pagamento', 'confirmação de pagamento', 'force_expense'),
    ('Pagamento efetuado',       'pagamento efetuado',       'force_expense'),
    ('Pagamento realizado',      'pagamento realizado',      'force_expense'),
    ('Pagamento executado',      'pagamento executado',      'force_expense'),
    ('Compra aprovada',          'compra aprovada',          'force_expense'),
    ('Transferência enviada',    'transferência enviada',    'force_expense')
  ) AS s(name, subject_pattern, action)
  WHERE NOT EXISTS (
    SELECT 1 FROM fo_email_rules r
    WHERE r.user_id = p_user_id
      AND lower(r.subject_pattern) = lower(s.subject_pattern)
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION on_fo_user_seed_rules_financeos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  PERFORM seed_default_email_rules_financeos(NEW.id);
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS fo_users_seed_rules_financeos ON fo_users;
CREATE TRIGGER fo_users_seed_rules_financeos
  AFTER INSERT ON fo_users
  FOR EACH ROW EXECUTE FUNCTION on_fo_user_seed_rules_financeos();

-- Backfill único: usuários já existentes (ex.: o owner atual).
DO $backfill$
DECLARE u RECORD;
BEGIN
  FOR u IN SELECT id FROM fo_users LOOP
    PERFORM seed_default_email_rules_financeos(u.id);
  END LOOP;
END
$backfill$;
