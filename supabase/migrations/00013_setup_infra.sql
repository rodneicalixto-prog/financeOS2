-- =============================================================================
-- FinanceOS — Migration 00013: Infraestrutura do wizard /setup
--
-- Tabelas que suportam o fluxo zero-env-var:
--
--   app_settings       — credenciais de aplicação criptografadas (AES-256-GCM),
--                        lidas server-side via getCredential(). Anon/auth NÃO
--                        têm acesso direto; apenas o service_role bypassa RLS.
--
--   _bootstrap_state   — checkpoint do wizard /setup para idempotência e
--                        retomada após refresh / timeout do Vercel.
--
-- Esta migration é executada pelo próprio wizard via Supabase Management API
-- (`POST /v1/projects/{ref}/database/query`) durante o step "Bootstrap".
-- Por isso TUDO usa IF NOT EXISTS / ON CONFLICT — re-executar é seguro.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- app_settings
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value_encrypted text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy pública. Acesso somente via service_role nas API Routes
-- Vercel e nas Edge Functions. Anon/auth não lêem nem escrevem.
DROP POLICY IF EXISTS "Service role only" ON public.app_settings;

-- -----------------------------------------------------------------------------
-- _bootstrap_state
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public._bootstrap_state (
  step text PRIMARY KEY,
  completed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public._bootstrap_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only" ON public._bootstrap_state;

-- -----------------------------------------------------------------------------
-- Leitura do estado do bootstrap para o wizard.
--
-- ⚠️ SEGURANÇA (corrigido — auditoria Prompt 3): a versão antiga
-- (get_bootstrap_state) era SECURITY DEFINER, retornava a coluna `metadata` jsonb
-- e era concedida a `anon`. Como o bootstrap grava CRYPTO_KEY/CRON_SECRET dentro
-- de metadata, qualquer um com a anon key pública lia a chave-mestra via
-- PostgREST. Aqui expomos APENAS step + completed_at, como SECURITY INVOKER
-- (respeita RLS — _bootstrap_state não tem policy, logo só service_role lê) e só
-- para `authenticated`. Metadata NUNCA sai por aqui.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_bootstrap_state_safe()
RETURNS TABLE(step text, completed_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT step, completed_at FROM public._bootstrap_state ORDER BY completed_at;
$$;

REVOKE ALL ON FUNCTION public.get_bootstrap_state_safe() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_bootstrap_state_safe() TO authenticated;

-- is_setup_complete() removida: era SECURITY DEFINER + anon e não tinha uso no
-- código (o status de setup é servido server-side por /api/setup-status, que usa
-- service_role e não expõe metadata).
