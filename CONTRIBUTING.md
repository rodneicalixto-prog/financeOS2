# Contribuindo com o financeOS

Obrigado por considerar contribuir. Este guia descreve as convenções do repositório para que qualquer pessoa consiga fazer fork, evoluir o código e mandar PRs sem fricção.

Toda a documentação e mensagens internas estão em **pt-BR**. Código (identificadores, comentários quando necessários) em inglês quando fizer sentido para o ecossistema.

---

## Branch model

- `main` — branch estável. Cada commit aqui deve buildar e ter migrations idempotentes.
- `oss-self-hosted` — branch viva da migração SaaS → self-hosted (atual).
- `feat/<nome-curto>` — feature branches a partir de `main`.
- `fix/<nome-curto>` — correções pontuais.
- `migration/<descricao>` — quando o trabalho for principalmente em `supabase/migrations/`.

Não existe processo de release automatizado por enquanto. Mudanças aprovadas viram tag manual quando justificarem (ex: `v0.2.0`).

---

## Conventional Commits

Mensagens em português, seguindo o padrão:

| Prefixo      | Quando usar                                                                 |
|--------------|-----------------------------------------------------------------------------|
| `feat:`      | Nova funcionalidade visível ao usuário.                                     |
| `fix:`       | Correção de bug.                                                            |
| `chore:`     | Tarefa de manutenção (deps, configs, scripts) sem impacto funcional.        |
| `refactor:`  | Mudança de código sem alterar comportamento.                                |
| `migration:` | Trabalho em `supabase/migrations/` ou em estrutura de banco.                |
| `docs:`      | Apenas documentação (`README.md`, `docs/*`, `finance-CLAUDE.md`).           |
| `test:`      | Adição/ajuste de testes.                                                    |

Exemplos:

```
feat: detecta transferências entre contas próprias e marca como transfer
fix: trata 429 do cnpj.ws com backoff exponencial
migration(fase2): documentação final e DX
```

Quando o commit fizer parte de uma fase de migração planejada (ver `migration/FASE-N.prompt.md`), use o formato `migration(faseN): <descrição>`.

---

## Como rodar localmente

Pré-requisitos: Node.js 20+, `npm`, conta Supabase com migrations já aplicadas (via wizard `/setup` em produção, ou manualmente apontando para um projeto Supabase pré-configurado). Em dev local, basta preencher `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env` apontando para esse projeto.

```bash
cp .env.example .env
# preencher .env
npm install
npm run dev
```

Scripts úteis (de `package.json`):

| Script                | O que faz                                              |
|-----------------------|--------------------------------------------------------|
| `npm run dev`         | Sobe Vite em `http://localhost:5173`.                  |
| `npm run build`       | `tsc -b && vite build`. Falha em qualquer erro de tipo.|
| `npm run preview`     | Serve o build de produção localmente.                  |
| `npm run test`        | Roda Vitest uma vez (CI mode).                         |
| `npm run test:watch`  | Vitest em modo watch.                                  |
| `npm run lint`        | ESLint sobre todo o repo.                              |

Antes de abrir um PR, garanta que `npm run build` e `npm run lint` passam.

---

## Como adicionar uma migration nova

1. Crie um arquivo SQL numerado em `supabase/migrations/`, mantendo a numeração contígua (`00007_descricao_curta.sql`, `00008_...`).
2. Use **idempotência** consistentemente — padrão estabelecido na Fase 1:
   - `CREATE TABLE IF NOT EXISTS ...`
   - `CREATE TYPE ...` envolto em `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
   - `DROP POLICY IF EXISTS <nome> ON <tabela>;` antes de cada `CREATE POLICY`.
   - `CREATE INDEX IF NOT EXISTS ...`.
3. Habilite RLS em qualquer tabela nova:
   ```sql
   ALTER TABLE fo_nova_tabela ENABLE ROW LEVEL SECURITY;
   ```
4. Crie policies por user, seguindo o padrão das outras migrations:
   ```sql
   CREATE POLICY fo_nova_tabela_select ON fo_nova_tabela
     FOR SELECT USING (user_id = auth.uid());
   ```
5. Não embuta credenciais (URLs, JWTs) em SQL. Credenciais que dependem do projeto Supabase devem ser injetadas via script externo (ex: `supabase/setup-cron.sh`).
6. Aplique localmente com `supabase db push` (ou via SQL Editor do Dashboard) e valide.

---

## Edge Functions

Edge Functions vivem em `supabase/functions/<nome>/index.ts`. Cada função:

- Valida JWT do usuário via Supabase Auth quando a chamada vem do frontend.
- Usa `corsHeaders` do `_shared/` para permitir requests do domínio do app.
- Retorna `Response` com `Content-Type: application/json` e códigos HTTP coerentes.
- Trata erros via `try/catch` com log estruturado.

Helpers compartilhados ficam em `supabase/functions/_shared/`. Reutilize `gmail-client.ts`, `ai-parser.ts`, `cnpj-lookup.ts` em vez de duplicar lógica.

Deploy:

```bash
supabase functions deploy <nome-da-funcao>
# ou todas de uma vez:
supabase functions deploy
```

Para a função `cron-sync-all`, que é invocada pelo `pg_cron` sem JWT do usuário, deploye com `--no-verify-jwt`.

---

## Padrão de Pull Request

Descrição em três blocos curtos:

1. **O quê** — uma frase descrevendo a mudança em linguagem de produto.
2. **Por quê** — motivação (bug, feature solicitada, dívida técnica).
3. **Como testar** — passos manuais ou comandos para o revisor reproduzir.

Exemplo:

```
**O quê:** Adiciona filtro de banco no dashboard.

**Por quê:** Usuários com várias contas precisavam ver receita/despesa por banco.

**Como testar:**
1. Login com conta que tenha 2+ bancos cadastrados.
2. No dashboard, abrir o filtro "Banco" no header.
3. Escolher um banco e verificar que cards/gráficos atualizam.
```

PRs pequenos (até ~400 linhas mudadas) são revisados mais rápido. Para mudanças grandes, abra um draft cedo e separe em commits temáticos.

---

## Código

- TypeScript strict — sem `any` ou `as any` salvo casos justificados em comentário.
- Tailwind utility-first; tokens de design já estão em `tailwind.config.ts`.
- Componentes UI próprios em `src/components/ui/` — não introduza shadcn/ui (decisão da Fase 0; ver `AUDIT_REPORT.md` seção 7).
- Hooks de domínio em `src/hooks/use<Entidade>.ts`, retornando objetos do React Query.
- Formato monetário sempre BRL via `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
- Datas no formato brasileiro (`dd/MM/yyyy`) via `date-fns` com locale `pt-BR`.

---

## Customizando sem conflitos

Se você forkou este projeto para uso self-hosted e quer adicionar código próprio sem dor de cabeça quando puxar atualizações do upstream, faça em `src/customizations/`. Esse diretório é "zona livre" — o upstream nunca edita nada lá. Garante que `git pull` (ou "Sync fork" no GitHub) não gere conflito nas suas customizações.

Para mais detalhes, leia [`src/customizations/README.md`](./src/customizations/README.md).

---

## Reportando bugs

Abra uma issue com:

- Versão do Node, browser e SO.
- Variáveis do `.env` configuradas (sem expor as secrets — apenas confirmar que estão presentes).
- Passos para reproduzir.
- Logs relevantes (console do browser, logs da Edge Function via `supabase functions logs <nome>`).

Para problemas de sync de Gmail, anexe a entrada mais recente de `fo_sync_logs` (sem o conteúdo bruto dos emails).
