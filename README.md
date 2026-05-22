# FinanceOS — Comece por aqui 👋

Seu relatório financeiro pessoal, na sua infra. O FinanceOS lê suas notificações bancárias do Gmail, identifica transações automaticamente com IA, categoriza por CNPJ e te dá um dashboard claro de receita, despesa, saldo e gastos recorrentes.

**Você é dono dos seus dados.** Tudo roda na sua conta Supabase + Vercel. Sem servidor de terceiros vendo suas finanças.

[![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

---

## 🚀 Setup — 5 passos, sem terminal e sem Claude Code

O setup acontece dentro do próprio app deployado, em uma página `/setup` que valida tudo automaticamente. Você não precisa instalar nada local, editar arquivo, nem rodar comando.

### Pré-requisitos (5 minutos)

1. **Conta Supabase** — https://supabase.com (free tier serve)
2. **Conta Vercel** — https://vercel.com (login com GitHub é o mais rápido)
3. **Conta Google Cloud** — https://console.cloud.google.com (pra OAuth do Gmail)
4. **Chave OpenAI** — https://platform.openai.com/api-keys (com crédito mínimo)

### Passo a passo

1. **Importe o template na Vercel** — clica em "Use this template" no GitHub e em seguida "Add new → Project" na Vercel apontando para o seu fork. Aguarde o primeiro deploy (~2min).
2. **Acesse a URL do deploy** — vai ser algo tipo `https://seu-app.vercel.app`.
3. **O app detecta que está cru e redireciona pra `/setup`**.
4. **Siga o wizard de 5 etapas:**
   - Crie projeto Supabase, gere PAT + Vercel Token (links no próprio wizard)
   - Cole as 5 credenciais core — validação inline em tempo real
   - Aguarde o bootstrap (migrations + Edge Functions + envs + redeploy)
   - Cole as credenciais de aplicação (OpenAI + Gmail OAuth)
   - Crie sua conta de owner
5. **Pronto.** O app está 100% funcional, sem que você precise tocar em terminal.

> Cada credencial fica **criptografada (AES-256-GCM) no seu próprio Supabase**. O PAT do Supabase e o Vercel Token são descartados após o bootstrap.

---

## 🎉 Como usar depois do setup

Faça login com o email/senha do passo 5. Siga o onboarding na tela: conectar Gmail, cadastrar bancos, primeira sincronização. A IA lê seus emails de transação dos últimos 30 dias e popula o dashboard.

### Convidar pessoas

Vai em `/equipe` (visível só pro owner). Digite o email da pessoa → **"Enviar convite"**. Ela recebe email do Supabase Auth, clica no link, define a própria senha e entra como `member`.

⚠️ **Cada pessoa tem dados isolados** — não há compartilhamento de finanças entre usuários. O sistema de convites é só pra controlar quem pode criar conta na sua instância.

📧 Email enviado pelo SMTP default do Supabase (~4 emails/hora). Pra uso intenso, configure SMTP custom em **Supabase Dashboard → Project Settings → Auth → SMTP Settings**.

---

## ❓ Deu problema?

| Problema | Solução |
|---|---|
| Wizard trava no step 3 com erro 401 | PAT Supabase ou Vercel Token expirado/sem permissão. Gere de novo e cole. |
| Wizard trava no step 3 com timeout | O Vercel Hobby tem limite de 60s — o wizard já fatia em fases. Se der timeout em uma fase, clique em "Tentar de novo" — é idempotente. |
| Quero refazer o setup do zero | Acesse `/setup?reset=1` — limpa o localStorage. Atenção: dados em `app_settings` continuam. |
| "Credenciais Gmail não configuradas" | Vai em **Configurações → IA e Gmail** (owner-only) e cola os 3 valores. |
| Email de convite não chega | Default SMTP do Supabase tem rate limit baixo. Espera ~1h ou configura SMTP custom no Dashboard. |
| AI parser retorna erro | Confira em **Configurações → IA** que sua chave OpenAI está válida e a conta tem crédito. |
| Esqueci a senha do banco Supabase | Reset em **Supabase Dashboard → Project Settings → Database → Reset database password**. |
| Quero entender a arquitetura | Veja [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md). |

---

## 📚 Documentação adicional

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — como o sistema funciona por dentro
- [`docs/SMOKE_TEST.md`](./docs/SMOKE_TEST.md) — checklist de verificação pós-setup
- [`finance-CLAUDE.md`](./finance-CLAUDE.md) — regras de negócio e contexto do produto
- [`setup.config.ts`](./setup.config.ts) — manifesto declarativo de credenciais (1 lugar pra plugar nova ferramenta)

---

## 🛠️ Stack técnica

| Camada       | Tecnologia                                                            |
|--------------|-----------------------------------------------------------------------|
| Frontend     | React 19, Vite 6, TypeScript 5.7, Tailwind 3.4, Recharts              |
| Estado       | TanStack Query 5                                                      |
| Backend      | Supabase Cloud — Postgres 15, Auth, Edge Functions (Deno), pg_cron    |
| Setup        | Wizard React (`/setup`) + API Routes Vercel (`api/`)                  |
| Cripto       | AES-256-GCM (Node + Deno WebCrypto)                                   |
| IA           | OpenAI (chave app-wide gerenciada pelo owner)                         |
| Email        | Gmail API com OAuth 2.0 por usuário                                   |
| CNPJ         | `publica.cnpj.ws` com cache em `fo_cnpj_cache`                        |
| Deploy       | Vercel (frontend + Serverless Functions) + Supabase Management API    |

---

**MIT License** — use, modifique, compartilhe. Sem garantias, sem suporte oficial. Boa! 🚀
