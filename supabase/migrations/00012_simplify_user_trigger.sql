-- =============================================
-- FinanceOS — Migration 00012: Simplifica handle_new_user_financeos
--
-- Contexto: o Supabase Auth não preenche `invited_at` antes do trigger rodar,
-- então a checagem baseada nele em 00011 não funciona. Em vez disso,
-- desabilitamos self-signup no Supabase Auth (via Management API: disable_signup=true)
-- e confiamos que qualquer INSERT em auth.users foi feito por admin
-- (auth.admin.inviteUserByEmail, createUser, ou ação no Dashboard).
--
-- Novo trigger:
--   - Primeira conta da instância → role 'owner' (auto)
--   - Qualquer outra → role do raw_user_meta_data.role, default 'member'
-- =============================================

CREATE OR REPLACE FUNCTION handle_new_user_financeos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_count INT;
  v_role TEXT;
  v_name TEXT;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));

  SELECT COUNT(*) INTO v_user_count FROM public.fo_users;

  -- Primeira conta da instância → owner
  IF v_user_count = 0 THEN
    INSERT INTO public.fo_users (id, email, name, role)
    VALUES (NEW.id, NEW.email, v_name, 'owner');
    RETURN NEW;
  END IF;

  -- Demais: role do metadata, default member
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'member');
  IF v_role NOT IN ('owner', 'member') THEN
    v_role := 'member';
  END IF;

  INSERT INTO public.fo_users (id, email, name, role)
  VALUES (NEW.id, NEW.email, v_name, v_role);

  RETURN NEW;
END;
$$;
