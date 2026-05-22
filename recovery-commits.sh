#!/usr/bin/env bash
# =============================================================================
# recovery-commits.sh — financeOS / fechamento do Prompt 5
#
# ⚠️  RODAR APÓS a validação live do Prompt 5 (ver docs/RECOVERY_PENDING.md).
#
# Por que um script (e não commits já feitos): a árvore HOJE não é um repo git.
# O histórico/baseline do template é decisão de produto (distribuição via
# fork/template pros alunos) — então o git init + baseline ficam com você, pra
# evitar churn depois. Este script só materializa os 2 commits do Prompt 5 com
# as mensagens combinadas. NÃO faz push.
#
# Uso:
#   bash recovery-commits.sh
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")"

# -----------------------------------------------------------------------------
# PRÉ-REQUISITOS (live — rodar/confirmar ANTES de aplicar a migration destrutiva
# 00014). Estão aqui como referência; precisam de acesso ao banco e à Vercel.
# -----------------------------------------------------------------------------
# 1) Backup do estado do bootstrap antes de qualquer cleanup (SQL editor / psql):
#
#      CREATE TABLE IF NOT EXISTS public._bootstrap_state_backup_20260522 AS
#      SELECT * FROM public._bootstrap_state;
#
# 2) Confirmar CRYPTO_KEY viva nas envs do Vercel ANTES de trocar ROLLBACK→COMMIT
#    em supabase/migrations/00014_secure_bootstrap_state_rpc.sql:
#
#      vercel env ls production | grep CRYPTO_KEY
#
#    Vazio  → ABORTAR o DELETE (apagar sem a chave deixa app_settings ilegível).
# -----------------------------------------------------------------------------

if [ -d .git ]; then
  echo "Já existe um repositório git aqui. Abortando para não mexer no seu histórico." >&2
  echo "Se quer mesmo recriar os commits, faça manualmente." >&2
  exit 1
fi

# Arquivos alterados/criados pelo Prompt 5 (referência — o que entra no commit 1):
#   api/credentials.ts                                  (GET ?keys= -> { exists })
#   api/bootstrap.ts                                    (gate setup_completed + refactor de chaves)
#   api/_lib/credentials.ts                             (encrypt/decrypt com chave explícita)
#   supabase/migrations/00013_setup_infra.sql           (RPC segura na fonte)
#   supabase/migrations/00014_secure_bootstrap_state_rpc.sql  (cleanup p/ DBs existentes)
#
# OBS: como NÃO há baseline anterior, o commit 1 captura a árvore inteira do
# template (não só o diff do Prompt 5). Se você quer um baseline separado e
# limpo, crie-o ANTES (commitando o template) e ajuste este script para
# adicionar só os 5 arquivos acima no commit do Prompt 5.

git init

# --- Commit 1: correções estruturais do Prompt 5 -----------------------------
git add -A
# RECOVERY_PENDING.md e este script ficam fora do commit 1 (doc vai no commit 2;
# o script é tooling, fica sem versionar).
git reset -q docs/RECOVERY_PENDING.md recovery-commits.sh 2>/dev/null || true

git commit \
  -m "feat(setup): Prompt 5 structural fixes [PENDING LIVE VALIDATION]" \
  -m "- Drop de get_bootstrap_state, criação de get_bootstrap_state_safe (SECURITY INVOKER, sem metadata, só authenticated)
- Cleanup defensivo de _bootstrap_state.metadata (migration 00014 com ROLLBACK ativo)
- Bootstrap auth gate (setup_completed) com role lookup em fo_users
- Refatoração de CRYPTO_KEY/CRON_SECRET (env reuse + guard fail-loud, sem armazenamento no banco)
- Bug fix descoberto: phaseDeploy.encrypt() lia process.env.CRYPTO_KEY indefinida no first-run
- Bug fix descoberto: CRON_SECRET é inerte (cron usa service_role) — sem storage
- error_code: setup_already_completed (snake_case, alinhado à convenção do repo)

PENDENTE de validação live — ver docs/RECOVERY_PENDING.md." \
  -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

# --- Commit 2: documentação de recovery ---------------------------------------
git add docs/RECOVERY_PENDING.md
git commit \
  -m "docs(recovery): checklist de validação live pendente + ordem de aplicação [Prompt 5]" \
  -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

echo
echo "Pronto. 2 commits criados localmente. NENHUM push foi feito."
echo "Revise com:  git log --stat"
