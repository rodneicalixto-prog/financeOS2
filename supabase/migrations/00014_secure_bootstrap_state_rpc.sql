-- =============================================================================
-- FinanceOS — Migration 00014: Remediar vazamento de segredos via _bootstrap_state
--
-- Para QUEM: instâncias que JÁ aplicaram a versão antiga da 00013 (com o RPC
-- get_bootstrap_state SECURITY DEFINER + anon retornando metadata). Forks novos
-- já nascem corrigidos pela 00013 atual e NÃO precisam disto (esta migration
-- vira no-op num DB limpo).
--
-- O QUE faz:
--   1. Dropa o RPC vazante get_bootstrap_state() e o is_setup_complete() (anon,
--      SECURITY DEFINER, sem uso no código).
--   2. (Re)cria get_bootstrap_state_safe() — SECURITY INVOKER, só step +
--      completed_at, só para authenticated. Metadata NUNCA exposto.
--   3. Apaga as linhas de _bootstrap_state que existem só para carregar segredos
--      (CRYPTO_KEY / CRON_SECRET em metadata.value). Predicado derivado do código
--      (api/bootstrap.ts grava nos steps 'crypto_key_generated' e
--      'cron_secret_generated').
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️  PRÉ-REQUISITO INEGOCIÁVEL antes de aplicar em produção:
--     Confirmar que CRYPTO_KEY está populada nas envs do Vercel:
--         vercel env ls production | grep CRYPTO_KEY
--     Se NÃO estiver, ABORTAR — não rode o DELETE. Apagar as linhas sem a chave
--     viva nas envs deixa app_settings indecifrável (estado inconsistente que
--     precisa de recovery manual antes de qualquer cleanup).
--
-- ⚠️  DESTRUTIVA (DROP FUNCTION + DELETE). Está envelopada em BEGIN ... ROLLBACK
--     para FORÇAR revisão humana e impedir que o auto-run de migrations do
--     bootstrap a aplique sozinha (ela vira no-op nesse caminho). Para aplicar
--     de verdade: rode o SELECT de inspeção abaixo, confira, e troque o ROLLBACK
--     final por COMMIT.
--
-- ⚠️  VALIDAÇÃO LIVE PENDENTE: escrita sem ambiente para executar (sem DB/tokens).
--     O refactor de api/bootstrap.ts JÁ foi aplicado neste codebase: o bootstrap
--     não grava mais CRYPTO_KEY/CRON_SECRET no metadata (CRYPTO_KEY vem da env do
--     Vercel; CRON_SECRET é regenerado a cada run). Logo o DELETE abaixo é
--     definitivo — re-runs do bootstrap não repopulam estas linhas. Forks novos
--     nem chegam a criá-las.
-- =============================================================================

BEGIN;

-- (1) Dropar os RPCs vazantes / anon SECURITY DEFINER sem uso no código.
DROP FUNCTION IF EXISTS public.get_bootstrap_state();
DROP FUNCTION IF EXISTS public.is_setup_complete();

-- (2) (Re)criar leitura de estado SEM metadata, respeitando RLS, só authenticated.
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

-- Inspeção ANTES do DELETE — rode e confira que estes são os únicos steps que
-- carregam segredos em metadata (predicado do código: { value: <segredo> }):
--   SELECT step, jsonb_object_keys(metadata) AS meta_key
--   FROM public._bootstrap_state
--   WHERE metadata IS NOT NULL
--   ORDER BY step;

-- (3) Apagar as linhas que existem só para carregar segredos.
DELETE FROM public._bootstrap_state
WHERE step IN ('crypto_key_generated', 'cron_secret_generated');

-- Revisar o resultado acima. Para APLICAR de verdade: trocar ROLLBACK por COMMIT.
ROLLBACK;
-- COMMIT;
