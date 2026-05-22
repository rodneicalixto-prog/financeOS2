#!/usr/bin/env bash
# =============================================================================
# FinanceOS — setup-cron.sh
#
# Cria/atualiza o cron job 'fo-sync-emails-cron' no Postgres do seu Supabase.
# Executa a Edge Function `cron-sync-all` a cada 30 minutos via pg_net.
#
# Pré-requisitos:
#   - Migration 00003_create_cron_sync.sql aplicada (extensões pg_cron + pg_net)
#   - Edge Function `cron-sync-all` deployada no projeto Supabase
#   - psql instalado localmente
#
# Uso:
#   1. Defina as variáveis no .env (raiz do projeto):
#        SUPABASE_URL=https://xxxxxxxx.supabase.co
#        SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
#        SUPABASE_DB_URL=postgresql://postgres:<password>@db.xxxx.supabase.co:5432/postgres
#
#      OU passe via flags:
#        ./supabase/setup-cron.sh --url <SUPABASE_URL> --key <SERVICE_ROLE_KEY> --db <DB_URL>
#
#   2. Execute:
#        ./supabase/setup-cron.sh
#
#   3. Para alterar a frequência, edite a variável CRON_EXPR abaixo (default '*/30 * * * *')
#      OU passe --schedule "0 * * * *" para rodar de hora em hora.
#
# Para remover o job depois:
#   psql "$SUPABASE_DB_URL" -c "SELECT cron.unschedule('fo-sync-emails-cron');"
# =============================================================================

set -euo pipefail

JOB_NAME="fo-sync-emails-cron"
CRON_EXPR="*/30 * * * *"
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
SUPABASE_DB_URL="${SUPABASE_DB_URL:-}"

# Parse flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)       SUPABASE_URL="$2"; shift 2 ;;
    --key)       SUPABASE_SERVICE_ROLE_KEY="$2"; shift 2 ;;
    --db)        SUPABASE_DB_URL="$2"; shift 2 ;;
    --schedule)  CRON_EXPR="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,30p' "$0"
      exit 0
      ;;
    *)
      echo "Erro: flag desconhecida '$1'" >&2
      echo "Use --help para ver as opções." >&2
      exit 1
      ;;
  esac
done

# Carregar .env se existir e variáveis ainda estiverem vazias
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

# Revalidar após source
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
SUPABASE_DB_URL="${SUPABASE_DB_URL:-}"

# Validar variáveis obrigatórias
missing=()
[[ -z "$SUPABASE_URL" ]] && missing+=("SUPABASE_URL")
[[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]] && missing+=("SUPABASE_SERVICE_ROLE_KEY")
[[ -z "$SUPABASE_DB_URL" ]] && missing+=("SUPABASE_DB_URL")

if (( ${#missing[@]} > 0 )); then
  echo "Erro: variáveis obrigatórias ausentes: ${missing[*]}" >&2
  echo "Defina no .env (raiz do projeto) ou passe via flags --url / --key / --db." >&2
  exit 1
fi

# Validar formato básico da URL
if [[ ! "$SUPABASE_URL" =~ ^https://.+ ]]; then
  echo "Erro: SUPABASE_URL deve começar com 'https://' (recebido: $SUPABASE_URL)" >&2
  exit 1
fi

# Garantir psql disponível
if ! command -v psql >/dev/null 2>&1; then
  echo "Erro: 'psql' não encontrado no PATH. Instale o cliente PostgreSQL antes de rodar." >&2
  exit 1
fi

EDGE_URL="${SUPABASE_URL%/}/functions/v1/cron-sync-all"

echo "→ Job:      $JOB_NAME"
echo "→ Schedule: $CRON_EXPR"
echo "→ Endpoint: $EDGE_URL"
echo

# Compor SQL — usar dollar-quoting com tag única para não conflitar com o conteúdo
SQL=$(cat <<SQL_EOF
-- Garantir que extensões existem (idempotente)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remover job anterior (se existir) e recriar com a config atual
DO \$do\$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = '${JOB_NAME}') THEN
    PERFORM cron.unschedule('${JOB_NAME}');
  END IF;
END
\$do\$;

SELECT cron.schedule(
  '${JOB_NAME}',
  '${CRON_EXPR}',
  \$cron\$
  SELECT net.http_post(
    url := '${EDGE_URL}',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ${SUPABASE_SERVICE_ROLE_KEY}'
    ),
    body := '{}'::jsonb
  );
  \$cron\$
);

-- Confirmar criação
SELECT jobname, schedule, active FROM cron.job WHERE jobname = '${JOB_NAME}';
SQL_EOF
)

echo "→ Aplicando no banco..."
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -X -q -f - <<<"$SQL"

echo
echo "✓ Cron job '${JOB_NAME}' configurado com schedule '${CRON_EXPR}'."
echo "  Verificar execuções: psql \"\$SUPABASE_DB_URL\" -c \"SELECT * FROM cron.job_run_details WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname='${JOB_NAME}') ORDER BY start_time DESC LIMIT 10;\""
