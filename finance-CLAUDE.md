# FinanceOS — CLAUDE.md

> Para "onde estamos agora" — inclusive um item crítico de segurança
> nunca validado (`docs/RECOVERY_PENDING.md`) — ver `STATUS.md`. Este
> arquivo duplica `docs/ARCHITECTURE.md`; ainda não consolidado num só.

## Visão Geral

FinanceOS é uma ferramenta de relatório financeiro pessoal para empreendedores brasileiros. O sistema lê notificações de transações bancárias recebidas por email (Gmail), extrai dados via AI, categoriza automaticamente por CNPJ e exibe um dashboard com métricas financeiras. Uso interno da Agentise.

## Stack

- **Frontend:** React + TypeScript + Vite
- **Backend:** Supabase (Auth, Database, Edge Functions, RLS)
- **Deploy:** Vercel
- **AI:** GPT 4.1 Mini (via Edge Functions) para parsing de emails e categorização
- **Email:** Gmail API com OAuth por usuário (polling a cada 5 min via Edge Function)
- **CNPJ:** cnpj.ws API gratuita (`GET https://publica.cnpj.ws/cnpj/{CNPJ}`) com cache no Supabase
- **Gráficos:** Recharts (ou Chart.js — livre escolha)
- **Idioma:** PT-BR only
- **Tema:** Dark mode com glassmorphism
- **Auth:** Email/senha via Supabase Auth

## Arquitetura de Dados

### Tabela: `users`
- `id` (uuid, PK, ref auth.users)
- `email`
- `name`
- `created_at`

### Tabela: `bank_accounts`
- `id` (uuid, PK)
- `user_id` (FK → users)
- `bank_name` (text) — ex: Nubank, Itaú, Inter
- `account_label` (text) — apelido definido pelo usuário
- `initial_balance` (numeric, default 0)
- `created_at`

### Tabela: `gmail_connections`
- `id` (uuid, PK)
- `user_id` (FK → users)
- `access_token` (text, encrypted)
- `refresh_token` (text, encrypted)
- `token_expires_at` (timestamptz)
- `connected_at`
- `last_sync_at`

### Tabela: `transactions`
Tabela unificada com identificação do banco.
- `id` (uuid, PK)
- `user_id` (FK → users)
- `bank_account_id` (FK → bank_accounts)
- `type` (enum: 'income' | 'expense' | 'transfer')
- `amount` (numeric)
- `description` (text)
- `date` (date)
- `category_id` (FK → categories)
- `cnpj` (text, nullable) — CNPJ extraído da transação
- `status` (enum: 'pending' | 'confirmed')
- `is_recurring` (boolean, default false)
- `source_email_id` (text) — Gmail message ID para dedup
- `raw_email_data` (jsonb) — email original para debug
- `ai_parsed_data` (jsonb) — resposta do GPT
- `created_at`
- `updated_at`

### Tabela: `categories`
- `id` (uuid, PK)
- `name` (text)
- `icon` (text) — emoji
- `is_default` (boolean)
- `user_id` (FK → users, nullable) — null = categoria padrão do sistema

Categorias padrão:
| Nome | Ícone |
|------|-------|
| Alimentação | 🍔 |
| Transporte | 🚗 |
| Saúde | 🏥 |
| Moradia | 🏠 |
| Lazer | 🎮 |
| Educação | 📚 |
| Assinaturas | 🔄 |
| Outros | 📦 |

### Tabela: `tags`
- `id` (uuid, PK)
- `name` (text)
- `user_id` (FK → users)

Lista pré-definida por usuário (não texto livre).

### Tabela: `transaction_tags`
- `transaction_id` (FK → transactions)
- `tag_id` (FK → tags)

### Tabela: `budgets`
- `id` (uuid, PK)
- `user_id` (FK → users)
- `category_id` (FK → categories)
- `month` (date) — primeiro dia do mês
- `amount_limit` (numeric)

### Tabela: `cnpj_cache`
- `cnpj` (text, PK)
- `company_name` (text)
- `main_activity` (text) — atividade principal (CNAE)
- `category_suggestion` (text) — categoria sugerida baseada no CNAE
- `raw_data` (jsonb)
- `fetched_at` (timestamptz)

### Tabela: `sync_logs`
- `id` (uuid, PK)
- `user_id` (FK → users)
- `started_at` (timestamptz)
- `finished_at` (timestamptz)
- `status` (enum: 'success' | 'partial' | 'failed')
- `emails_found` (int)
- `emails_processed` (int)
- `errors` (jsonb, nullable)

### Tabela: `alerts`
- `id` (uuid, PK)
- `user_id` (FK → users)
- `type` (enum: 'budget_exceeded' | 'low_balance' | 'large_transaction' | 'recurring_detected')
- `message` (text)
- `is_read` (boolean, default false)
- `metadata` (jsonb)
- `created_at`

## RLS (Row Level Security)

TODAS as tabelas possuem RLS habilitado. Policies:
- `SELECT/INSERT/UPDATE/DELETE` apenas onde `user_id = auth.uid()`
- `categories`: padrão (is_default = true) visíveis para todos; custom filtrado por user_id
- `cnpj_cache`: leitura pública (compartilhado entre usuários), escrita via service_role

## Edge Functions

### `sync-emails`
- Triggered: polling a cada 5 min (Supabase cron ou pg_cron) + botão manual "Sync Agora"
- Fluxo:
  1. Busca emails não lidos com filtro por remetente bancário (por banco selecionado)
  2. Dedup via `source_email_id`
  3. Envia conteúdo (HTML e/ou texto) ao GPT 4.1 Mini
  4. GPT retorna JSON: `{ amount, date, description, type, cnpj?, counterpart_name }`
  5. Se CNPJ presente → consulta `cnpj_cache` → se miss, chama cnpj.ws → cacheia
  6. Categoriza: PJ com CNPJ → categoria baseada no CNAE; PF sem CNPJ → "Outros"
  7. Detecta transferências entre contas próprias → `type: 'transfer'` (não contabiliza)
  8. Insere em `transactions`
  9. Loga em `sync_logs`
- Retry: até 3 tentativas se AI falhar; loga erro em `sync_logs.errors`

### `check-budgets`
- Triggered: após cada sync
- Verifica se gastos do mês por categoria excederam `budgets.amount_limit`
- Gera alerta em `alerts` se excedido

### `detect-recurring`
- Triggered: sob demanda ou pós-sync
- Usa GPT 4.1 Mini para detectar assinaturas recorrentes (mesmo destinatário + valor similar + periodicidade)
- Marca `is_recurring = true` nas transações identificadas

### `export-data`
- Gera CSV, PDF ou XLSX
- Aceita filtros: período, categoria, banco, tipo
- Exporta transações filtradas OU relatório do dashboard (métricas + gráficos)

## Fluxo de Onboarding (Wizard)

4 steps:
1. **Conectar Gmail** — OAuth flow, solicita permissão de leitura de emails
2. **Selecionar Banco(s)** — interface para escolher quais bancos o usuário usa (lista de bancos suportados)
3. **Importação Inicial** — dispara sync dos emails a partir da data de conexão (não importa histórico)
4. **Pronto** — redireciona ao dashboard

## Dashboard — Componentes

### Cards superiores
- **Saldo Atual** — calculado: soma(income) - soma(expense) de todas as contas
- **Receita do Período** — soma de income no período selecionado
- **Despesa do Período** — soma de expense no período selecionado
- **Comparativo Mês a Mês** — ex: "Gastou 20% mais em Alimentação que mês passado"

### Filtros
- Período: diário, semanal, mensal, anual, custom range
- Banco: filtro por conta bancária
- Categoria: filtro por categoria

### Gráficos
- **Donut Chart 1:** Distribuição de gastos por categoria
- **Donut Chart 2:** Entrada vs Saída (proporção)
- **Bar Chart 1:** Receita vs Despesa por período (barras verticais agrupadas)
- **Bar Chart 2:** Gastos por categoria (barras verticais)

### Feed/Timeline de Transações
- Lista paginada (20 por página)
- Cada item: ícone da categoria + descrição + valor + data + banco + status (pending/confirmed)
- Busca e filtro por valor, categoria, data, descrição
- Ações: editar categoria, adicionar tags, marcar como confirmada

### Alertas
- Notificações in-app (badge + dropdown)
- Tipos: orçamento excedido, saldo baixo, transação grande, assinatura detectada

### Assinaturas Recorrentes
- Card ou seção dedicada listando assinaturas detectadas
- Valor mensal total de recorrências

## Transações Manuais

O usuário pode adicionar transações manualmente (ex: dinheiro físico):
- Campos: valor, data, descrição, tipo (entrada/saída), categoria, banco (opcional), tags

## Configurações

- **Contas bancárias:** adicionar, remover, editar label
- **Gmail:** reconectar, ver status do sync, último sync
- **Categorias:** visualizar padrão + criar custom
- **Tags:** gerenciar lista pré-definida
- **Orçamentos:** definir limite por categoria por mês
- **Exportação:** acessar exports

## UI/UX

### Design System
- **Tema:** Dark mode only, glassmorphism (blur, transparência, bordas sutis)
- **Cores:** Palette escura com acentos vibrantes para categorias
- **Loading:** Skeleton/shimmer em todos os cards e listas enquanto carrega
- **Empty States:** Mensagens customizadas por seção (ex: "Nenhuma transação ainda — conecte seu Gmail para começar")
- **Responsivo:** Mobile-first

### Ícones de Categoria
Cada categoria possui emoji associado exibido na UI (ver tabela em `categories`).

## GPT 4.1 Mini — Prompts

### Parsing de Email
```
System: Você é um parser financeiro. Extraia os dados da transação bancária do email abaixo.
Responda APENAS com JSON válido, sem markdown.

Schema:
{
  "amount": number,
  "date": "YYYY-MM-DD",
  "description": "string",
  "type": "income" | "expense",
  "cnpj": "string | null",
  "counterpart_name": "string"
}

Se não conseguir extrair, retorne: { "error": "unable_to_parse" }
```

### Detecção de Recorrência
```
System: Analise as transações abaixo e identifique assinaturas/pagamentos recorrentes.
Critérios: mesmo destinatário, valor similar (±10%), periodicidade mensal.
Responda APENAS com JSON: array de { transaction_ids: string[], service_name: string, avg_amount: number, frequency: "monthly" }
```

## Testes

- **Unit tests:** Vitest para utils, parsers, cálculos
- **Integration tests:** Edge Functions com mock de Gmail API e OpenAI
- **E2E:** Considerar Playwright para fluxos críticos (onboarding, sync, dashboard)

## Estrutura de Pastas

```
src/
├── components/
│   ├── ui/              # Componentes base (Button, Card, Input, Modal, Skeleton)
│   ├── dashboard/       # Cards, Charts, Feed, Alerts
│   ├── onboarding/      # Wizard steps
│   ├── transactions/    # Lista, filtros, form manual
│   ├── settings/        # Páginas de config
│   └── layout/          # Sidebar, Header, Shell
├── hooks/               # useTransactions, useBudgets, useSync, useAlerts
├── lib/
│   ├── supabase.ts      # Client config
│   ├── gmail.ts         # Gmail OAuth helpers
│   ├── format.ts        # Formatação BRL, datas
│   └── constants.ts     # Categorias padrão, bancos suportados
├── pages/               # Rotas principais
├── types/               # TypeScript interfaces
├── styles/              # Global CSS, glassmorphism tokens
└── tests/               # Testes unitários e integração

supabase/
├── functions/
│   ├── sync-emails/
│   ├── check-budgets/
│   ├── detect-recurring/
│   └── export-data/
├── migrations/          # SQL migrations
└── seed.sql             # Categorias padrão, dados iniciais
```

## Regras para o Agente

1. **Sempre implementar com RLS** — nunca criar tabela sem policy
2. **Edge Functions em Deno/TypeScript** — padrão Supabase
3. **Dedup obrigatório** — checar `source_email_id` antes de inserir transação
4. **Cache CNPJ** — nunca chamar cnpj.ws sem antes checar `cnpj_cache`
5. **Transferências entre contas próprias** — detectar e marcar como `transfer`, não contabilizar em receita/despesa
6. **Transações de cartão** — cada compra individual, status `pending` até fatura confirmada
7. **Retry AI** — até 3 tentativas com backoff; logar falhas
8. **Glassmorphism** — aplicar `backdrop-filter: blur()`, bordas com `border: 1px solid rgba(255,255,255,0.1)`, backgrounds com `rgba()`
9. **Skeletons** — toda seção que depende de async deve ter loading skeleton
10. **Empty states** — toda lista vazia deve ter mensagem contextual e CTA
11. **Formato monetário** — sempre BRL (`R$ 1.234,56`) usando `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`
12. **Datas** — formato brasileiro (`dd/mm/aaaa`), usar `date-fns` com locale `pt-BR`
13. **Commits** — em português, prefixo convencional: `feat:`, `fix:`, `refactor:`, `chore:`
14. **Implementação modular** — uma feature por prompt, nunca tentar tudo de uma vez
15. **Sem roles/permissões** — sistema single-role, todo usuário autenticado tem acesso total aos seus dados
