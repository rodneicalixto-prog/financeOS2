-- =============================================
-- FinanceOS — Migration 00007: Convites + role owner/member
--
-- Modelo: o primeiro user da instancia vira owner. A partir do segundo,
-- self-signup fica desabilitado e novos users so entram via convite emitido
-- pelo owner (link com token valido por 7 dias).
--
-- RLS continua isolando dados por user_id — owner nao ve dados dos members,
-- e vice-versa. O role serve apenas para gatekeeping de convites.
-- =============================================

-- 1. Adicionar coluna role em fo_users (default 'member' para users existentes)
ALTER TABLE fo_users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member'
  CHECK (role IN ('owner', 'member'));

-- 2. Promover o primeiro user existente (se houver) a owner por compatibilidade
UPDATE fo_users
SET role = 'owner'
WHERE id = (SELECT id FROM fo_users ORDER BY created_at ASC LIMIT 1)
  AND role <> 'owner';

-- 3. Tabela de convites
CREATE TABLE IF NOT EXISTS fo_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fo_invites_token_active
  ON fo_invites(token)
  WHERE used_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fo_invites_email ON fo_invites(email);
CREATE INDEX IF NOT EXISTS idx_fo_invites_invited_by ON fo_invites(invited_by);

-- 4. RLS: apenas owner pode ler/escrever convites via cliente autenticado.
--    Validacao publica de token usa RPC SECURITY DEFINER (passo 7).
ALTER TABLE fo_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages invites" ON fo_invites;
CREATE POLICY "Owner manages invites"
  ON fo_invites
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM fo_users
      WHERE id = auth.uid() AND role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM fo_users
      WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- 5. Substituir o trigger antigo handle_new_user_financeos.
--    Logica nova:
--      - Se nao existe nenhum user em fo_users: o novo vira 'owner'
--      - Senao: exige invite_token valido em raw_user_meta_data, marca como
--        usado e cria fo_users com o role do convite
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

  -- Caso 1: primeira conta da instancia vira owner sem precisar de convite
  IF v_user_count = 0 THEN
    INSERT INTO public.fo_users (id, email, name, role)
    VALUES (NEW.id, NEW.email, v_name, 'owner');
    RETURN NEW;
  END IF;

  -- Caso 2: signup so com invite_token valido
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

DROP TRIGGER IF EXISTS on_auth_user_created_financeos ON auth.users;
CREATE TRIGGER on_auth_user_created_financeos
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_financeos();

-- 6. Helper: is_owner() pode ser usado em policies futuras
CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.fo_users
    WHERE id = auth.uid() AND role = 'owner'
  );
$$;

-- 7. RPCs publicas (sem auth) usadas pelo frontend de signup/invite

-- 7.1 Status do signup: a tela de cadastro consulta para decidir se libera
--     self-signup (primeiro user) ou exibe mensagem "use convite".
CREATE OR REPLACE FUNCTION get_signup_status()
RETURNS TABLE(first_user_pending BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (SELECT COUNT(*) FROM public.fo_users) = 0;
$$;

-- 7.2 Validacao de token sem auth: usado pela pagina /invite para confirmar
--     que o link e valido antes de mostrar o formulario de signup.
--     Retorna apenas email e role, nao expoe outras infos do convite.
CREATE OR REPLACE FUNCTION validate_invite_token(p_token TEXT)
RETURNS TABLE(email TEXT, role TEXT, valid BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.email,
    i.role,
    (i.used_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()) AS valid
  FROM public.fo_invites i
  WHERE i.token = p_token
  LIMIT 1;
$$;

-- Permitir execucao publica das duas RPCs
GRANT EXECUTE ON FUNCTION get_signup_status() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION validate_invite_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_owner() TO authenticated;
