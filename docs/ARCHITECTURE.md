# Arquitetura — financeOS

> Visão de alto nível para quem está se familiarizando com o código.
> Para detalhes finos do produto e regras de negócio, ver `finance-CLAUDE.md` (raiz).

---

## Visão geral

financeOS é uma SPA React 19 + Vite que conversa com um único projeto Supabase. Toda a lógica server-side está em Edge Functions (Deno). Não há servidor próprio nem fila externa — `pg_cron` + `pg_net` (extensões nativas do Postgres) disparam as funções recorrentes.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser (React 19 + Vite + Tailwind)                                │
│  ─ Auth via supabase-js                                              │
│  ─ Queries via @tanstack/react-query                                 │
│  ─ Estado de servidor: hooks em src/hooks/use<Entidade>.ts           │
└─────────────┬──────────────────────────────────────┬─────────────────┘
              │ HTTPS (anon JWT do user)             │ HTTPS (anon JWT)
              ▼                                      ▼
┌──────────────────────────────┐       ┌──────────────────────────────┐
│  Supabase Postgres           │       │  Supabase Edge Functions     │
│  ─ 13 tabelas fo_*           │       │  ─ 9 funções (Deno/TS)       │
│  ─ RLS por user_id           │       │  ─ usam service_role server  │
│  ─ pg_cron, pg_net           │       │     ─side via Deno.env       │
│                              │       │                              │
│  cron(*/30 min) ── pg_net ─► │       │  Chama:                      │
│                              │       │   ─ Gmail API                │
│                              │       │   ─ OpenAI / Gemini          │
│                              │       │   ─ publica.cnpj.ws          │
└──────────────────────────────┘       └──────────────────────────────┘
```

Single-tenant por instância (cada deploy serve um cliente final). Multi-user dentro da instância: cada `auth.users` é isolado por RLS via `user_id = auth.uid()`. Não há conceito de tenant nem roles.

---

## Stack

| Camada            | Tecnologia                                                        |
|-------------------|-------------------------------------------------------------------|
| Frontend          | React 19, Vite 6, TypeScript 5.7, Tailwind 3.4, Recharts          |
| Estado de servidor| @tanstack/react-query 5                                           |
| Roteamento        | react-router-dom 7                                                |
| Ícones            | lucide-react                                                      |
| UI base           | Componentes próprios em `src/components/ui/` (Button, Card, …)    |
| Backend           | Supabase Cloud — Auth, Postgres 15, Edge Functions (Deno), Storage|
| Cron              | `pg_cron` + `pg_net` (extensões Postgres do próprio Supabase)     |
| AI                | OpenAI GPT-4o mini ou Google Gemini 1.5 Flash (BYOK por user)     |
| CNPJ enrichment   | `https://publica.cnpj.ws/cnpj/{CNPJ}` com cache em `fo_cnpj_cache`|
| Email source      | Gmail API via OAuth 2.0 por usuário                               |
| Testes            | Vitest 2 + @testing-library/react                                 |
| Deploy            | Vercel                                                            |

---

## Tabelas

Todas com prefixo `fo_` (de `financeOS`) e RLS habilitado. Policies sempre em torno de `user_id = auth.uid()` (exceto `fo_categories.is_default = true` e `fo_cnpj_cache`, que são compartilhadas entre users).

| Tabela                  | Papel                                                                        |
|-------------------------|------------------------------------------------------------------------------|
| `fo_users`              | Espelho de `auth.users` populado por trigger; FK alvo de várias tabelas.     |
| `fo_bank_accounts`      | Contas do usuário (Nubank, Itaú, Inter, etc.).                               |
| `fo_gmail_connections`  | Tokens OAuth do Gmail; suporta múltiplas contas por user (`is_primary`).     |
| `fo_categories`         | Categorias do sistema (`is_default = true`) e custom por user.               |
| `fo_transactions`       | Coração do produto. Cada transação extraída de email ou criada manualmente.  |
| `fo_tags`               | Lista pré-definida de tags por user (não texto livre).                       |
| `fo_transaction_tags`   | M:N entre transações e tags.                                                 |
| `fo_budgets`            | Limite mensal por categoria.                                                 |
| `fo_cnpj_cache`         | Cache global (compartilhado) das consultas a `publica.cnpj.ws`.              |
| `fo_sync_logs`          | Histórico de cada execução de sync (status, contagens, errors).              |
| `fo_alerts`             | Alertas in-app: orçamento excedido, saldo baixo, transação grande, recurring.|
| `fo_ai_configs`         | BYOK do user — provider (OpenAI/Gemini) + key + modelo escolhido.            |
| `fo_ai_insights`        | Insights gerados (resumo mensal, anomalias, forecast, sugestões orçamento).  |

> Total: **13 tabelas**. (A auditoria menciona 12 — a 13ª é `fo_ai_insights`, adicionada na migration `00006_ai_insights.sql`.)

Auxiliar:

- Trigger `handle_new_user_financeos()` em `auth.users` — espelha cada signup em `fo_users`.
- Função `cron-sync-all` chamada por `pg_cron` a cada 30 minutos via `pg_net.http_post` (configurada via `supabase/setup-cron.sh`).

---

## Edge Functions

Localização: `supabase/functions/<nome>/index.ts`. Helpers comuns em `_shared/`.

| Função              | Quando roda                                  | O que faz                                                                                       |
|---------------------|----------------------------------------------|-------------------------------------------------------------------------------------------------|
| `sync-emails`       | Manual (botão "Sync Agora") ou via `cron-sync-all`. | Para um único user: lista IDs novos no Gmail, parseia via AI, deduplica por `source_email_id`, insere em `fo_transactions` e registra em `fo_sync_logs`. |
| `cron-sync-all`     | A cada 30 min via `pg_cron`+`pg_net`.        | Itera `fo_gmail_connections` e dispara `sync-emails` por user. Sem JWT do user — usa service role. |
| `gmail-auth`        | Callback do OAuth.                           | Troca authorization code por access/refresh token, salva em `fo_gmail_connections`.             |
| `check-budgets`     | Pós-sync (chamada por `sync-emails`).        | Soma despesas do mês por categoria; se ultrapassar `fo_budgets.amount_limit`, cria alerta.      |
| `detect-recurring`  | Manual ou pós-sync.                          | Detecta assinaturas recorrentes (mesmo destinatário + valor similar + periodicidade) via IA.     |
| `compute-insights`  | Chamada por `ai-insights`.                   | Calcula métricas determinísticas (sem IA): totais, médias, anomalias estatísticas.              |
| `ai-insights`       | Sob demanda (botão "Gerar insight").         | Combina output de `compute-insights` com prompt → IA → grava em `fo_ai_insights`.               |
| `export-data`       | Sob demanda (Configurações → Exportar).      | Gera CSV/PDF/XLSX a partir de filtros (período, categoria, banco, tipo).                        |

Helpers em `_shared/`:

- `cors.ts` — `corsHeaders` reusados.
- `gmail-client.ts` — wrapper sobre Gmail API (list + get + auth refresh).
- `ai-parser.ts` — chama OpenAI/Gemini com o system prompt de parsing e valida o JSON de saída.
- `cnpj-lookup.ts` — consulta `publica.cnpj.ws` com cache em `fo_cnpj_cache` e mapeamento CNAE → categoria.
- `compute-insights.ts` — métricas estatísticas reusadas pelos insights.
- `sync-user-emails.ts` — orquestração do sync por user (compartilhado entre `sync-emails` e `cron-sync-all`).

> Total: **9 funções** (8 endpoints + `_shared`).

---

## Fluxo de sync de email

Caminho do gatilho até a transação no banco. Implementação em `_shared/sync-user-emails.ts`.

1. **Trigger.** Cron (`*/30 * * * *`) ou clique manual no botão "Sync Agora" no `SettingsPage`.
2. **Auth check.** Quando vem do user, valida JWT; quando vem do cron, usa service role.
3. **Carrega conexões Gmail.** `SELECT * FROM fo_gmail_connections WHERE user_id = ...`. Refresh do access token se expirado.
4. **Lista mensagens novas.** `gmail.users.messages.list` com query `from:(banco@...) newer_than:7d` (ou desde `last_sync_at`).
5. **Filtra duplicadas.** `SELECT id FROM fo_transactions WHERE source_email_id = ANY(...)` para descartar IDs já processados.
6. **Para cada email novo:**
   - `gmail.users.messages.get` traz HTML/texto.
   - `ai-parser.parseEmail()` envia ao LLM (OpenAI ou Gemini, conforme `fo_ai_configs.provider`).
   - LLM retorna `{ amount, date, description, type, cnpj?, counterpart_name }` ou `{ error: "unable_to_parse" }`.
   - Se `cnpj` presente → `cnpj-lookup.lookup(cnpj)` (consulta cache, depois API se miss).
   - Categoria inferida do CNAE; fallback para "Outros".
   - Detecção de transferência interna (mesmo amount, descrições simétricas, contas próprias) → `type = 'transfer'`.
   - `INSERT INTO fo_transactions ...` com `raw_email_data` e `ai_parsed_data` para debug.
7. **Atualiza `last_sync_at`** em `fo_gmail_connections`.
8. **Loga em `fo_sync_logs`** (`emails_found`, `emails_processed`, `errors`).
9. **Pós-sync:** chama `check-budgets` (alerta se estouro) e opcionalmente `detect-recurring`.

Retry: até 3 tentativas com backoff em falhas de IA antes de logar erro e seguir para o próximo email.

---

## Fluxo de geração de insights

Implementação em `compute-insights.ts` + `ai-insights/index.ts`.

1. User clica em "Gerar insight" no dashboard ou em um card específico (resumo mensal, anomalias, forecast, sugestões de orçamento).
2. Frontend chama Edge Function `ai-insights` com `{ kind, period }`.
3. `compute-insights` calcula a parte determinística:
   - Totais do mês por categoria.
   - Comparativo mês-a-mês.
   - Outliers (transações > 2σ acima da média da categoria).
   - Saldo projetado linear-fit nos últimos N dias.
4. Resultado serializado vira contexto para o prompt da IA, que escreve um texto em pt-BR explicando o número.
5. Insights persistidos em `fo_ai_insights` com `kind` e `period_start/period_end` para evitar regeneração.
6. Frontend lê via hook `useAIInsights` (subhooks: `useMonthlySummary`, `useSpendingForecast`, `useBudgetSuggestions`, etc.).

---

## Mapa Page → Hook → Tabela

Hooks de domínio em `src/hooks/use<Entidade>.ts`. Cada um encapsula uma ou mais queries do React Query e um conjunto pequeno de mutations.

| Page                      | Hooks principais                                                                                              | Tabelas tocadas                                                                 |
|---------------------------|---------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------|
| `LoginPage`               | `useAuth`                                                                                                     | `auth.users` (via Supabase Auth).                                               |
| `OnboardingPage`          | `useOnboarding`, `useGmailConnection`, `useBankAccounts`                                                      | `fo_users`, `fo_gmail_connections`, `fo_bank_accounts`.                         |
| `GmailCallbackPage`       | `useGmailConnection`                                                                                          | `fo_gmail_connections` (via Edge `gmail-auth`).                                 |
| `DashboardPage`           | `useDashboardMetrics`, `useChartData`, `useAllTransactions`, `useAlerts`, `useRecurringTransactions`, `useAIInsights` | `fo_transactions`, `fo_categories`, `fo_bank_accounts`, `fo_alerts`, `fo_ai_insights`. |
| `TransactionsPage`        | `useTransactions`, `useCategories`, `useBankAccounts`, `useTags`                                              | `fo_transactions`, `fo_categories`, `fo_bank_accounts`, `fo_tags`, `fo_transaction_tags`. |
| `SettingsPage`            | `useAIConfig`, `useGmailConnection`, `useBankAccounts`, `useCategories`, `useTags`                            | `fo_ai_configs`, `fo_gmail_connections`, `fo_bank_accounts`, `fo_categories`, `fo_tags`, `fo_budgets`. |

---

## Layout do código

```
financeOS/
├── src/
│   ├── components/
│   │   ├── ui/             # Componentes base próprios (Button, Card, Input, …)
│   │   ├── dashboard/      # Cards, Charts, Feed, Alerts
│   │   ├── onboarding/     # 4 steps do wizard
│   │   ├── transactions/   # Lista, filtros, form manual, modal de edição
│   │   ├── settings/       # Páginas de config (IA, Gmail, contas, categorias, tags, orçamentos)
│   │   ├── tags/           # UI de tags
│   │   └── layout/         # Shell, sidebar, header
│   ├── hooks/              # use<Entidade> (React Query)
│   ├── lib/
│   │   ├── supabase.ts     # Client config + flag isSupabaseConfigured
│   │   ├── gmail.ts        # Helpers de OAuth + URL builder
│   │   ├── format.ts       # BRL, datas, percentuais
│   │   └── constants.ts    # Categorias padrão, bancos suportados
│   ├── pages/              # Rotas principais (6 páginas)
│   ├── types/              # database.ts (Insert/Row types) e domínio
│   └── tests/              # Vitest (cobertura mínima — apenas format.test.ts)
├── supabase/
│   ├── migrations/         # 6 SQL files (00001 → 00006)
│   ├── functions/          # 8 Edge Functions + _shared
│   ├── seed.sql            # Categorias padrão, dados iniciais
│   └── setup-cron.sh       # Script para criar/atualizar cron `fo-sync-emails-cron`
├── docs/                   # Esta pasta
├── migration/              # Prompts FASE-1/2/3 da migração SaaS → OSS
├── finance-CLAUDE.md       # Doc primária do produto (escopo + regras de negócio)
├── AUDIT_REPORT.md         # Auditoria que motivou a migração
├── MIGRATION_PLAN.md       # Plano consolidado das 3 fases
├── CHANGELOG.md
├── CONTRIBUTING.md
├── README.md
└── LICENSE
```

---

## Decisões e pontos não-óbvios

- **Nada de tenants.** O projeto não tem nem nunca teve `tenant_id`. Multi-tenancy é resolvido por instância (cada cliente self-hosts o próprio Supabase). Ver `AUDIT_REPORT.md` seção 2 para a auditoria que confirmou isso.
- **BYOK por user, não por tenant.** A tabela `fo_ai_configs` mantém provider+key por `user_id`. Decisão da Fase 2: manter (zero redeploy ao trocar key, RLS isola entre users na mesma instância).
- **Cron via SQL, não via cron externo.** `pg_cron` chama `pg_net.http_post` para invocar `cron-sync-all`. O script `supabase/setup-cron.sh` é o único caminho oficial — não há credencial hardcoded em migration (corrigido na Fase 1).
- **Tema fixo.** Tokens Agentise (dark + glass + accent azul) estão hardcoded em `tailwind.config.ts`. Não há white-label, não há CSS variables dinâmicas.
- **Single-role.** Qualquer user autenticado tem acesso completo aos próprios dados. Não há `role` em lugar nenhum.
- **`fo_users` espelha `auth.users`.** Existe pra simplificar JOINs e FKs. O trigger garante consistência. Não duplique informação.
- **`fo_cnpj_cache` é leitura pública.** Compartilhado entre todos os users da instância — economiza chamadas a `publica.cnpj.ws`. Escrita só via service role nas Edge Functions.
