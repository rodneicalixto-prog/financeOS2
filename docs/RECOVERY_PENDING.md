# Recovery Pendente — financeOS

> **Status:** correções estruturais do **Prompt 5** aplicadas no working tree,
> **PENDENTES de validação em ambiente vivo**. Sem push. **Não** aplicar Prompt 4
> antes de validar esta pilha (aplicar fix em cima de mudança não-validada
> compounda risco, incluindo uma migration destrutiva).

## Ordem de aplicação na próxima janela (com ambiente descartável)

1. **Validação live** das mudanças do Prompt 5 (curls + SQL abaixo).
2. **Pré-requisito antes do `COMMIT` da migration `00014`:**
   `vercel env ls production | grep CRYPTO_KEY` — se vazio, **NÃO** rodar o
   `DELETE` (estado inconsistente → recovery manual antes). Só então trocar
   `ROLLBACK` → `COMMIT` no `00014`.
3. **Prompt 4** — auth incondicional em `/api/credentials` + auto-login no fim do
   Step 3 (o Step 4 hoje faz POST sem JWT, por design, na janela de setup).
4. **Prompt 6.**
5. **Prompt 3 (auditoria final)** — alvo 🟢/🟡 sem achados críticos.

## Mudanças aplicadas no Prompt 5 (pendentes de validação)

- `DROP get_bootstrap_state` → `CREATE get_bootstrap_state_safe` (SECURITY INVOKER,
  só `authenticated`, sem `metadata`). Fonte: `00013_setup_infra.sql`. Remediação
  de DBs já deployados: `00014_secure_bootstrap_state_rpc.sql`.
- `is_setup_complete()` removida (era SECURITY DEFINER + anon, sem uso).
- Cleanup defensivo de `_bootstrap_state.metadata` — `00014` com `BEGIN … ROLLBACK`
  **ativo** (trocar p/ `COMMIT` só após o pré-requisito do item 2).
- Gate de uso único no `/api/bootstrap` (step `setup_completed`) com role lookup em
  `fo_users` (`role='owner'`).
- `CRYPTO_KEY`: reuse via env do Vercel + guard fail-loud (não regenera se já há
  dados cifrados em `app_settings`). `CRON_SECRET`: regenerado a cada run, sem
  storage (o cron real autentica com service_role — `setup-cron.sh:126`).
- `GET /api/credentials?keys=` → `{ [k]: { exists } }` (apenas booleanos).
- **Bug fix descoberto:** `phaseDeploy` cifrava `app_url` com `encrypt()` lendo
  `process.env.CRYPTO_KEY` indefinida no first-run → agora passa a chave explícita.

## Validações live pendentes (checklist do Prompt 5)

Variáveis: `APP`=URL do deploy, `OWNER_JWT`=`session.access_token` do owner,
`SUPABASE_URL`/`ANON`/`SUPABASE_PAT`/`REF` conforme projeto.

### Correção 1 — `/api/credentials`
- [ ] `grep -rn "rest/v1/app_settings" src/` → zero (frontend não escreve direto).
- [ ] POST sem JWT (pós-setup) → `401`.
- [ ] POST JWT não-owner → `403`; POST JWT owner → `200` + row em `app_settings` (confirmar via SELECT).
- [ ] GET só booleanos, sem plaintext:
  ```bash
  curl -s "$APP/api/credentials?keys=openai_api_key,gmail_client_id" \
    -H "Authorization: Bearer $OWNER_JWT"
  # esperado: { "openai_api_key": { "exists": ... }, "gmail_client_id": { "exists": ... } }
  ```

### Correção 2 — gate do `/api/bootstrap`
- [ ] 1ª run anônima (sem `setup_completed`) → passa.
- [ ] 2ª run anônima → `403 setup_already_completed`:
  ```bash
  curl -s -X POST "$APP/api/bootstrap?phase=migrations" \
    -H "Content-Type: application/json" -d "$BOOTSTRAP_BODY"
  ```
- [ ] 2ª run JWT não-owner → `403 not_owner`; JWT owner → passa.

### Correção 3 — segredos fora do banco
- [ ] `SELECT step, metadata FROM _bootstrap_state WHERE step IN ('crypto_key_generated','cron_secret_generated');` → zero rows (após `00014` `COMMIT`).
- [ ] `SELECT proname FROM pg_proc WHERE proname='get_bootstrap_state';` → zero.
- [ ] `SELECT prosecdef FROM pg_proc WHERE proname='get_bootstrap_state_safe';` → `false` (INVOKER).
- [ ] anon não lê CRYPTO_KEY:
  ```bash
  curl -s "$SUPABASE_URL/rest/v1/rpc/get_bootstrap_state_safe" \
    -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
  # em nenhuma circunstância retorna CRYPTO_KEY / CRON_SECRET
  ```
- [ ] CRYPTO_KEY presente onde precisa: `vercel env ls production | grep CRYPTO_KEY`
  e `curl -H "Authorization: Bearer $SUPABASE_PAT" https://api.supabase.com/v1/projects/$REF/secrets`.

## Notas
- `error_code` em snake_case (`setup_already_completed`) — alinhado à convenção do
  repo (`method_not_allowed`, `invalid_json`).
- A leak crítica (anon lendo CRYPTO_KEY via `get_bootstrap_state`) está fechada na
  **fonte** (`00013`) para forks novos; `00014` é só para instâncias já deployadas.
