# Smoke Test — financeOS

> Roteiro de validação manual end-to-end para um fork limpo do financeOS.
> Use junto com o wizard `/setup` deployado. Marque cada item com `[x]` (passou),
> `[!]` (passou parcialmente / com observação) ou `[ ]` (falhou / não executado).
> O resultado consolidado vai em `docs/SMOKE_TEST_RESULTS.md`.

---

## Pré-requisitos do tester

- [ ] **Node.js 20+** instalado (`node -v`).
- [ ] `npm` 10+ ou `pnpm`/`yarn` equivalentes (os scripts usam `npm run`).
- [ ] **`psql`** disponível no `PATH` (necessário para `supabase/setup-cron.sh`).
- [ ] **Supabase CLI** instalado (`supabase --version`) — usado para `db push` e `functions deploy`.
- [ ] **Conta Supabase** ativa (free tier serve).
- [ ] **Conta Google Cloud** com billing habilitado, projeto novo, **Gmail API** ativada e credencial **OAuth 2.0 Web** criada.
- [ ] **Key OpenAI ou Gemini** ativa (para parsing de email + insights).
- [ ] **1 conta Gmail real** com pelo menos **5 emails de notificação bancária recentes** (Nubank, Itaú, Inter ou similar).
- [ ] (Opcional) Conta Vercel para deploy de produção.

---

## Parte 1 — Setup zero-to-hero

> Use o wizard `/setup` do app deployado. Cada checkbox aqui valida que uma etapa do wizard funcionou de ponta a ponta.

### 1.1 Clone e instalação

- [ ] `git clone <repo>` em diretório novo (ex.: `/tmp/financeOS-fresh`).
- [ ] `cd /tmp/financeOS-fresh && npm install` finaliza sem erros.
- [ ] `cp .env.example .env` e arquivo aparece na raiz.
- [ ] `.env` preenchido com as 6 variáveis (4 públicas `VITE_*` + 2 server-side `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_DB_URL`).

### 1.2 Supabase — projeto e credenciais

- [ ] Projeto novo criado em [app.supabase.com](https://app.supabase.com), status `Active`.
- [ ] **Project URL** copiado para `VITE_SUPABASE_URL` e `SUPABASE_URL`.
- [ ] **anon public** copiado para `VITE_SUPABASE_ANON_KEY`.
- [ ] **service_role secret** copiado para `SUPABASE_SERVICE_ROLE_KEY` (apenas no `.env` local, nunca no Vercel).
- [ ] Connection string copiada para `SUPABASE_DB_URL` com a senha real preenchida em `<password>`.

### 1.3 Migrations

- [ ] `supabase link --project-ref <ref>` autenticado com sucesso.
- [ ] `supabase db push` aplica as 6 migrations (`00001` → `00006`) sem erro.
- [ ] **Idempotência:** rodar `supabase db push` uma segunda vez termina sem erro (validar `IF NOT EXISTS` + `DO $$ EXCEPTION` nos blocos).
- [ ] As 13 tabelas `fo_*` aparecem em **Table Editor** do Dashboard:
  `fo_users`, `fo_bank_accounts`, `fo_gmail_connections`, `fo_categories`, `fo_transactions`, `fo_tags`, `fo_transaction_tags`, `fo_budgets`, `fo_cnpj_cache`, `fo_sync_logs`, `fo_alerts`, `fo_ai_configs`, `fo_ai_insights`.
- [ ] Validação de RLS (SQL Editor): todas as `fo_*` retornam `rowsecurity = true`:
  ```sql
  SELECT tablename, rowsecurity FROM pg_tables
  WHERE schemaname='public' AND tablename LIKE 'fo_%' ORDER BY tablename;
  ```

### 1.4 Edge Functions

- [ ] `supabase functions deploy` finaliza sem erro para todas as funções (deploy em massa).
- [ ] `supabase functions deploy cron-sync-all --no-verify-jwt` redeploy com flag específica (cron não tem JWT do user).
- [ ] Em **Edge Functions** do Dashboard aparecem as **8 funções**:
  `ai-insights`, `check-budgets`, `compute-insights`, `cron-sync-all`, `detect-recurring`, `export-data`, `gmail-auth`, `sync-emails`.

### 1.5 Cron job

- [ ] `chmod +x supabase/setup-cron.sh && ./supabase/setup-cron.sh` finaliza com mensagem `✓ Cron job 'fo-sync-emails-cron' configurado com schedule '*/30 * * * *'.`
- [ ] `psql "$SUPABASE_DB_URL" -c "SELECT * FROM cron.job WHERE jobname='fo-sync-emails-cron';"` retorna 1 linha com `active = true`.

### 1.6 Dev server

- [ ] `npm run dev` sobe em `http://localhost:5173` sem erros no terminal.
- [ ] Console do browser sem `Uncaught` / `404 Supabase` ao carregar `/login`.

---

## Parte 2 — Auth e Onboarding

### 2.1 Signup

- [ ] `/login` renderiza com tema dark glassmorphism Agentise.
- [ ] Botão **Criar conta** abre formulário de signup.
- [ ] Submit com email + senha → email de confirmação chega na inbox.
- [ ] Clicar no magic link → user logado, redirect para `/onboarding`.
- [ ] No Supabase Table Editor: row criada em `auth.users` **e** em `fo_users` (trigger `handle_new_user_financeos` espelhou).

### 2.2 Onboarding — Step 1 (Gmail)

- [ ] `/onboarding` exibe Step 1 — "Conectar Gmail".
- [ ] Botão **Conectar com Google** → redirect para `accounts.google.com/o/oauth2/...`.
- [ ] Tela de consentimento mostra escopo `gmail.readonly`.
- [ ] Após autorizar → redirect para `/auth/gmail/callback` → spinner → volta ao Step 2.
- [ ] Row criada em `fo_gmail_connections` (`access_token`, `refresh_token` populados, `email_address` = email autorizado).

### 2.3 Onboarding — Step 2 (Banks)

- [ ] Step 2 lista bancos brasileiros (Nubank, Itaú, Inter, Bradesco, Santander, etc.).
- [ ] Selecionar 1+ bancos → botão **Próximo** habilita.
- [ ] Avançar para Step 3.

### 2.4 Onboarding — Step 3 (Import)

- [ ] Step 3 oferece disparar import inicial.
- [ ] Acionar import → loading → response sem erro.
- [ ] Avançar para Step 4.

### 2.5 Onboarding — Step 4 (Done)

- [ ] Step 4 mostra mensagem de conclusão.
- [ ] Botão **Concluir** → redirect para `/` (dashboard).
- [ ] Refresh em `/onboarding` agora redireciona para `/` (não volta para o wizard).

---

## Parte 3 — Configuração de IA (BYOK)

- [ ] `/configuracoes` carrega sem erro.
- [ ] Seção **IA** visível.
- [ ] Selecionar provider (OpenAI ou Gemini) → input de API key aparece.
- [ ] Colar key + escolher modelo → **Salvar** retorna sucesso (toast/alerta verde).
- [ ] No Supabase Table Editor: 1 row em `fo_ai_configs` para o user atual com `provider`, `api_key`, `model` preenchidos.
- [ ] RLS: criar segundo user temporário e confirmar que `SELECT * FROM fo_ai_configs` (logado como user 2) **não** retorna a row do user 1.

---

## Parte 4 — Sync de emails

### 4.1 Sync manual

- [ ] `/configuracoes` → seção **Gmail** → botão **Sync Agora**.
- [ ] Response chega em 10–60s sem erro de UI.
- [ ] Em `fo_sync_logs` o último log tem:
  - `status = 'success'`
  - `emails_processed > 0`
  - `transactions_created >= 0` (pode ser 0 se todos os emails já foram processados antes)
- [ ] `fo_gmail_connections.last_sync_at` foi atualizado.

### 4.2 Transações geradas

- [ ] `fo_transactions` tem ao menos 1 row do user com `amount`, `description`, `transaction_date`, `category_id`, `bank_account_id` populados.
- [ ] `fo_cnpj_cache` tem rows enriquecidas com `legal_name`, `trade_name`, `main_activity` (para emails que continham CNPJ).

### 4.3 Idempotência do sync

- [ ] Rodar **Sync Agora** uma segunda vez → log mostra os mesmos emails como já processados (dedupe via `source_email_id`); `transactions_created = 0`.

---

## Parte 5 — Dashboard

### 5.1 Cards superiores

- [ ] Card **Saldo total** renderiza com valor numérico em BRL.
- [ ] Card **Receita do período** renderiza.
- [ ] Card **Despesa do período** renderiza.
- [ ] Card **Comparativo período anterior** renderiza com seta de tendência.

### 5.2 Gráficos

- [ ] Donut chart **Distribuição de gastos por categoria** renderiza com legendas.
- [ ] Donut chart **Entrada vs Saída** renderiza.
- [ ] Bar chart **Receita vs Despesa por período** renderiza.
- [ ] Bar chart **Gastos por categoria** renderiza.
- [ ] Hover em cada gráfico mostra tooltip Recharts customizado.

### 5.3 Feed e widgets

- [ ] Feed de transações lista 10–20 transações recentes com ícone, descrição, valor, data, banco.
- [ ] **AlertsDropdown** renderiza no header (badge com contagem se houver `fo_alerts`).
- [ ] **AISummaryCard** renderiza (mesmo que vazio na primeira execução, antes de rodar `compute-insights`).
- [ ] **ForecastCard** renderiza.
- [ ] **BudgetSuggestionsCard** renderiza.

### 5.4 Filtros do dashboard

- [ ] Seletor de período (mês atual, mês passado, últimos 3 meses, etc.) refresca os cards e gráficos.
- [ ] Filtro por banco (se houver) restringe os totais.

---

## Parte 6 — Página Transações

- [ ] `/transacoes` lista todas as transações paginadas (default 20 por página).
- [ ] Filtro por **período** funciona.
- [ ] Filtro por **categoria** funciona.
- [ ] Filtro por **banco** funciona.
- [ ] Busca por **descrição** filtra em tempo real.
- [ ] Click em uma transação abre modal de edição.
- [ ] Editar `category_id` + adicionar tag → **Salvar** persiste e o feed reflete a mudança.
- [ ] A mesma alteração reflete no dashboard ao voltar para `/`.

---

## Parte 7 — Cron automático

> O cron roda a Edge Function `cron-sync-all` a cada 30 minutos por padrão.

- [ ] Aguardar **30 minutos** OU acionar manualmente via SQL Editor:
  ```sql
  SELECT net.http_post(
    url := '<SUPABASE_URL>/functions/v1/cron-sync-all',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SUPABASE_SERVICE_ROLE_KEY>',
      'Content-Type', 'application/json'
    )
  );
  ```
- [ ] Novo log aparece em `fo_sync_logs` (último `created_at` < 1 minuto).
- [ ] `cron.job_run_details` mostra `status = 'succeeded'` para o último run:
  ```sql
  SELECT * FROM cron.job_run_details
   WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname='fo-sync-emails-cron')
   ORDER BY start_time DESC LIMIT 5;
  ```

---

## Parte 8 — Tema visual (Agentise dark glassmorphism)

- [ ] Background base `#0A0A0F` em todas as telas (`/login`, `/onboarding`, `/`, `/transacoes`, `/configuracoes`).
- [ ] Cards têm `backdrop-filter: blur(40px)` (inspect → computed style).
- [ ] Borda dos cards `1px solid rgba(59, 130, 246, 0.15)`.
- [ ] Hover em card: glow azul aumenta, borda muda para `rgba(59, 130, 246, 0.45)`.
- [ ] Botões primários: gradient 135° de `#1E3A8A` → `#3B82F6`.
- [ ] Tipografia **Inter** carregada.
- [ ] Texto primário `#F8FAFC`, secundário `#94A3B8`.
- [ ] Sem nenhum vestígio de light mode (sem `bg-white`, sem `text-black`).

---

## Parte 9 — Responsividade

> Editor de canvas não se aplica aqui — financeOS é mobile-first segundo `finance-CLAUDE.md`.

- [ ] DevTools 375px (mobile): layout não quebra; navegação principal acessível (menu hamburger se houver).
- [ ] DevTools 768px (tablet): layout intermediário sem overlap.
- [ ] DevTools 1280px (desktop): layout completo com sidebar visível.
- [ ] Gráficos do dashboard respondem ao resize sem cortar conteúdo.

---

## Parte 10 — Segurança básica

### 10.1 Logout e proteção de rotas

- [ ] **Logout** limpa sessão.
- [ ] Tentar acessar `/`, `/transacoes`, `/configuracoes` sem login → redirect para `/login`.

### 10.2 RLS via REST direta

- [ ] `curl -s "$VITE_SUPABASE_URL/rest/v1/fo_transactions" -H "apikey: $VITE_SUPABASE_ANON_KEY"` retorna `[]` ou erro 401 (RLS bloqueia leitura sem JWT).
- [ ] Mesma chamada com header `Authorization: Bearer <jwt-do-user>` retorna apenas as transações do user.

### 10.3 Isolamento entre users

- [ ] Criar segundo user (signup com outro email).
- [ ] Logar como user 2 → `/` mostra dashboard vazio (zero transações do user 1).
- [ ] Logar de volta como user 1 → dados originais intactos.

### 10.4 .env.example sem credenciais reais

- [ ] `grep -E "eyJ[A-Za-z0-9_-]{20,}" .env.example` não encontra nada (sem JWT vazado).
- [ ] `grep -E "https://[a-z]{15,}\.supabase\.co" .env.example` não encontra URL de projeto real (apenas placeholders `your-project`).

---

## Parte 11 — Build de produção

- [ ] `npm run build` finaliza sem erro de TypeScript ou Vite.
- [ ] `npm run preview` sobe build estático e renderiza igual ao `dev`.
- [ ] (Opcional) Deploy na Vercel: `vercel --prod` ou push para `main` → deploy automático verde.

---

## Resumo

Total de itens nesta lista: **>= 50**.
Após executar todos, registre o resultado consolidado em `docs/SMOKE_TEST_RESULTS.md`.

**Critério de aprovação para merge em `main`:**
- 100% das Partes 1–6 e 10 passam.
- Partes 7–9 e 11 podem ser parciais (`[!]`) com observação justificando.
- Qualquer falha (`[ ]`) bloqueia o merge — abrir Fase 4 corretiva.
