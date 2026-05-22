-- =============================================
-- FinanceOS — Migration 00011: Suporte ao convite nativo do Supabase
--
-- Migra o fluxo de convites pra usar `auth.admin.inviteUserByEmail` em vez de
-- token customizado em fo_invites. O trigger handle_new_user_financeos passa
-- a aceitar três caminhos:
--   1. Primeira conta da instância → owner (legado)
--   2. Convidado via Supabase Auth (NEW.invited_at não nulo) → role do metadata
--   3. Self-signup com invite_token em fo_invites (legado, mantido por compat)
-- =============================================

CREATE OR REPLACE FUNCTION handle_new_user_financeos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_count INT;
  v_invite_token TEXT;
  v_invite RECORD;
  v_role TEXT;
  v_name TEXT;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));

  SELECT COUNT(*) INTO v_user_count FROM public.fo_users;

  -- Caso 1: primeira conta da instância vira owner sem precisar de convite
  IF v_user_count = 0 THEN
    INSERT INTO public.fo_users (id, email, name, role)
    VALUES (NEW.id, NEW.email, v_name, 'owner');
    RETURN NEW;
  END IF;

  -- Caso 2: convite nativo via auth.admin.inviteUserByEmail
  --         (Supabase preenche invited_at antes do trigger rodar)
  IF NEW.invited_at IS NOT NULL THEN
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'member');
    IF v_role NOT IN ('owner', 'member') THEN
      v_role := 'member';
    END IF;
    INSERT INTO public.fo_users (id, email, name, role)
    VALUES (NEW.id, NEW.email, v_name, v_role);
    RETURN NEW;
  END IF;

  -- Caso 3 (legado): signup direto com invite_token de fo_invites
  v_invite_token := NEW.raw_user_meta_data->>'invite_token';

  IF v_invite_token IS NULL OR v_invite_token = '' THEN
    RAISE EXCEPTION 'Self-signup desabilitado. Solicite um convite ao owner desta instancia.';
  END IF;

  SELECT * INTO v_invite
  FROM public.fo_invites
  WHERE token = v_invite_token
    AND used_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > now()
    AND lower(email) = lower(NEW.email);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite invalido, expirado, ja utilizado ou email nao corresponde.';
  END IF;

  v_role := v_invite.role;

  UPDATE public.fo_invites
  SET used_at = now()
  WHERE id = v_invite.id;

  INSERT INTO public.fo_users (id, email, name, role)
  VALUES (NEW.id, NEW.email, v_name, v_role);

  RETURN NEW;
END;
$$;
