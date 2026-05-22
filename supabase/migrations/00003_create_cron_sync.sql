-- =============================================
-- FinanceOS — Migration 00003: Extensões para sync automático de emails
--
-- Esta migration apenas habilita as extensões pg_cron e pg_net.
-- O agendamento (cron.schedule) NÃO é feito aqui porque depende de
-- credenciais específicas da instância (SUPABASE_URL + SERVICE_ROLE_KEY)
-- e versionar isso no SQL deixaria credenciais hardcoded no histórico.
--
-- Para criar/atualizar o cron job após rodar esta migration, execute:
--
--   ./supabase/setup-cron.sh
--
-- O script lê SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY do .env (ou flags)
-- e gera o cron.schedule correto contra a sua instância Supabase.
-- =============================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =============================================
-- Comandos úteis (executar manualmente no SQL Editor):
--
--   -- Verificar o cron job:
--   SELECT * FROM cron.job WHERE jobname = 'fo-sync-emails-cron';
--
--   -- Ver execuções recentes:
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
--
--   -- Remover o cron job:
--   SELECT cron.unschedule('fo-sync-emails-cron');
-- =============================================
