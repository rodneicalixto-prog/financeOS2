# Changelog

Todas as mudanças relevantes deste projeto serão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o versionamento segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

## v0.1.0 — 2026-05-03

Primeira versão pública open source self-hosted.

### Added

- Onboarding em 4 steps (Gmail / Banks / Import / Done).
- Dashboard com saldo, métricas, gráficos (Recharts), alertas, recorrentes.
- Sync automática de emails do Gmail via `pg_cron` + `pg_net` a cada 30 min.
- Parsing AI de transações bancárias via OpenAI ou Gemini (BYOK em Configurações → IA).
- Categorização automática por CNPJ (cnpj.ws + cache em `fo_cnpj_cache`).
- Insights AI: resumo mensal, anomalias, forecast, sugestões de orçamento.
- Exportação de dados (CSV, PDF, XLSX) via Edge Function `export-data`.
- Multi-conta Gmail por usuário (tabela `fo_gmail_connections` com flag `is_primary`).
- Detecção de transações recorrentes (Edge Function `detect-recurring`).
- Verificação automática de orçamentos pós-sync (Edge Function `check-budgets`).

### Migration history

- Migrações idempotentes em `supabase/migrations/` (uso consistente de `IF NOT EXISTS`, `DO` blocks, `DROP POLICY IF EXISTS`).
- Numeração contígua: `00001` → `00006` (renumeração feita na Fase 1; era `00007` antes).
- Cron schedule via script externo `supabase/setup-cron.sh` (sem credencial hardcoded — lê do `.env` ou de flags).
