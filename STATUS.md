# FinanceOS — Estado Atual

> **Este é o único lugar pra perguntar "onde estamos".** Atualize a cada
> retomada de trabalho. Arquitetura em `finance-CLAUDE.md` **e**
> `docs/ARCHITECTURE.md` (duplicados, ver seção abaixo).

**Repositório:** `rodneicalixto-prog/financeOS2` — público, branch `main`.
**Descrição no GitHub:** "CRM financeiro" — **imprecisa**: é um dashboard
financeiro pessoal (lê notificações bancárias do Gmail, categoriza com IA,
mostra receita/despesa/saldo/recorrentes), não um CRM. `[A PREENCHER]` se
vale corrigir a descrição do repo.
**Última atualização deste arquivo:** 2026-09-28.

---

## 🔴 Item crítico em aberto — validação de segurança nunca feita

Um commit de 22/05/2026 (`73ced30`, "import financeOS recovery baseline")
trouxe uma correção pra um **vazamento real**: o RPC `get_bootstrap_state`
era `SECURITY DEFINER` acessível por `anon` e podia expor `CRYPTO_KEY`/
`CRON_SECRET` gravados em `_bootstrap_state.metadata`. A correção
(`get_bootstrap_state_safe`, `SECURITY INVOKER`, só `authenticated`) foi
aplicada no código-fonte, mas ficou marcada em `docs/RECOVERY_PENDING.md`
como **"PENDENTE de validação em ambiente vivo"** — e a migration que
limpa os segredos já vazados de instâncias antigas
(`supabase/migrations/*00014*`) está **deliberadamente em `ROLLBACK`**,
esperando alguém confirmar `CRYPTO_KEY` nas envs do Vercel e trocar por
`COMMIT`.

**Isso nunca foi fechado.** Passaram-se 3 meses de desenvolvimento (várias
features entre 22/05 e 22/08) sem nenhum commit tocando
`RECOVERY_PENDING.md` de novo, e `docs/SMOKE_TEST_RESULTS.md` (onde o
resultado da validação deveria ir) **continua sendo o template vazio**
(`<YYYY-MM-DD>`, `<nome>`, todas as seções em branco).

**Não tentei validar isso eu mesmo nesta rodada** — exige credenciais
live (Supabase PAT, Vercel token, JWT de owner) que não tenho aqui, e o
próprio doc pede ambiente descartável, não produção. Fica registrado como
o item #1 antes de qualquer outra coisa neste projeto:

1. Rodar a checklist completa de `docs/RECOVERY_PENDING.md` num ambiente
   descartável.
2. Se passar: trocar `ROLLBACK` por `COMMIT` na migration `00014` **só**
   depois de confirmar `CRYPTO_KEY` presente nas envs — o próprio arquivo
   avisa que fazer isso sem a chave viva deixa `app_settings`
   indecifrável.
3. Preencher `docs/SMOKE_TEST_RESULTS.md` de verdade.
4. Só então seguir pra Prompt 4/6/3 (auditoria final), na ordem que o
   próprio `RECOVERY_PENDING.md` define.

Isso é especialmente relevante porque este é um **produto template**
distribuído via "Use this template" no GitHub — outras pessoas fazem fork
e deployam a própria instância. Um vazamento não validado como corrigido
afeta todo mundo que clonar o template até a validação acontecer.

## ⏸️ Status: pausado

**Último commit: `40f3f00`, 22/08/2026** ("branding settings + fix no sync
do Gmail"). ~37 dias sem atividade nesta data.

## Documentação duplicada — dois arquivos de arquitetura

`finance-CLAUDE.md` (raiz) e `docs/ARCHITECTURE.md` cobrem o mesmo terreno
(tabelas, Edge Functions, stack) com estruturas de seção diferentes. Não
diffei linha a linha nesta rodada — ficou como item a resolver: escolher
um como fonte única e apontar o outro pra ele (mesmo padrão já aplicado no
megacrm com `CLAUDE.md`/`AGENTS.md`). `[A PREENCHER]` qual dos dois é mais
atual/completo.

## O que existe

Produto "Agentise"-style (mesmo padrão de outros templates de Rodnei):
wizard `/setup` de 5 passos sem terminal, credenciais criptografadas
(AES-256-GCM) no próprio Supabase do usuário, "você é dono dos seus
dados" como diferencial central. Stack: Vite 6 + React 19 + TypeScript +
Tailwind + Supabase + Vercel + OpenAI (categorização) + Gmail OAuth
(ingestão).

## Infraestrutura

Não há URL de produção fixa documentada — é um template que cada usuário
deploya na própria conta Vercel/Supabase (diferente do megacrm/georadar,
que têm uma instância canônica do próprio Rodnei).

## Mapa de documentos deste repo

| Arquivo | Papel |
|---|---|
| `STATUS.md` (este arquivo) | Estado atual — único lugar de "onde estamos" |
| `docs/RECOVERY_PENDING.md` | **Checklist de segurança não validado — ver seção crítica acima** |
| `finance-CLAUDE.md` | Arquitetura — duplica `docs/ARCHITECTURE.md`, ver seção acima |
| `docs/ARCHITECTURE.md` | Arquitetura — duplica `finance-CLAUDE.md` |
| `docs/SMOKE_TEST.md` | Roteiro de smoke test |
| `docs/SMOKE_TEST_RESULTS.md` | Nunca preenchido — template vazio |
| `README.md` | Onboarding pro usuário final (wizard de 5 passos) |
| `CHANGELOG.md`, `CONTRIBUTING.md` | Padrão, não conferidos a fundo nesta rodada |
| `recovery-commits.sh` | Script auxiliar do "Prompt 5" — não executado ainda, ver `RECOVERY_PENDING.md` |
