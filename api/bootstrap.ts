// =============================================================================
// /api/bootstrap — Orquestrador do wizard /setup
// -----------------------------------------------------------------------------
// Idempotente. Cada step grava em _bootstrap_state; re-execuções pulam o que
// já está concluído. Fatiado em 3 fases para respeitar o timeout 60s do
// Vercel Hobby — o wizard chama em sequência:
//
//   POST /api/bootstrap?phase=migrations
//   POST /api/bootstrap?phase=deploy
//   POST /api/bootstrap?phase=redeploy
//
// Body em todas as fases:
//   { supabase_url, supabase_anon_key, supabase_service_role_key,
//     supabase_pat, vercel_token, app_origin }
//
// O `app_origin` é o `window.location.origin` do wizard — o backend usa pra
// achar o projeto Vercel (pelo subdomínio) e setar APP_URL.
// =============================================================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { handlePreflight, jsonError, jsonOk } from './_lib/http.js';
import {
  runSql,
  deployFunction,
  setSecrets,
  extractRef,
  MgmtError,
} from './_lib/supabaseManagement.js';
import {
  getProjectByDomain,
  upsertEnv,
  triggerRedeploy,
  VercelError,
} from './_lib/vercel.js';
import { bundleEdgeFunction } from './_lib/edgeBundler.js';
import { randomBytes } from 'node:crypto';

interface BootstrapBody {
  supabase_url: string;
  supabase_anon_key: string;
  supabase_service_role_key: string;
  supabase_pat: string;
  vercel_token: string;
  app_origin: string;
}

const CORE_MIGRATION_SLUG = '00013_setup_infra';

function validate(body: BootstrapBody): string | null {
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/i.test(body.supabase_url ?? '')) {
    return 'supabase_url inválido — formato esperado: https://abc1234.supabase.co';
  }
  for (const k of [
    'supabase_anon_key',
    'supabase_service_role_key',
    'supabase_pat',
    'vercel_token',
    'app_origin',
  ] as const) {
    if (!body[k] || typeof body[k] !== 'string' || body[k].length < 8) {
      return `${k} ausente ou inválido`;
    }
  }
  return null;
}

// -----------------------------------------------------------------------------
// Cliente direto via PostgREST com service_role pra ler/escrever _bootstrap_state
// (a tabela já existe após a primeira migration ser rodada).
// -----------------------------------------------------------------------------
function adminClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

async function listMigrationFiles(): Promise<Array<{ name: string; sql: string }>> {
  const dir = path.join(process.cwd(), 'supabase', 'migrations');
  const files = await fs.readdir(dir);
  const sorted = files.filter((f) => f.endsWith('.sql')).sort();
  const out: Array<{ name: string; sql: string }> = [];
  for (const f of sorted) {
    const sql = await fs.readFile(path.join(dir, f), 'utf8');
    out.push({ name: f.replace(/\.sql$/, ''), sql });
  }
  return out;
}

async function listEdgeFunctionSlugs(): Promise<string[]> {
  const dir = path.join(process.cwd(), 'supabase', 'functions');
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
    .map((e) => e.name);
}

// -----------------------------------------------------------------------------
// PHASE: migrations
// -----------------------------------------------------------------------------
async function phaseMigrations(body: BootstrapBody) {
  const ref = extractRef(body.supabase_url);
  const migrations = await listMigrationFiles();

  // 1. Sempre rodar 00013 primeiro (auto-IF NOT EXISTS, idempotente).
  //    Cria _bootstrap_state e app_settings.
  const infra = migrations.find((m) => m.name === CORE_MIGRATION_SLUG);
  if (!infra) {
    throw new Error(`Migration ${CORE_MIGRATION_SLUG} não encontrada no repo.`);
  }
  await runSql(body.supabase_pat, ref, infra.sql);

  // Agora podemos abrir cliente PostgREST com service_role pra checkpoint.
  const admin = adminClient(body.supabase_url, body.supabase_service_role_key);

  // 2. Lista de checkpoints existentes (idempotência).
  const { data: existing } = await admin
    .from('_bootstrap_state')
    .select('step')
    .like('step', 'migration:%');
  const done = new Set<string>((existing ?? []).map((r) => (r as { step: string }).step));

  // 3. Rodar cada migration restante em ordem (incluindo a 00013 que vira no-op).
  const ran: string[] = [];
  for (const m of migrations) {
    const stepKey = `migration:${m.name}`;
    if (done.has(stepKey)) continue;
    if (m.name !== CORE_MIGRATION_SLUG) {
      await runSql(body.supabase_pat, ref, m.sql);
    }
    await admin.from('_bootstrap_state').upsert(
      { step: stepKey, completed_at: new Date().toISOString(), metadata: {} },
      { onConflict: 'step' },
    );
    ran.push(m.name);
  }

  await admin.from('_bootstrap_state').upsert(
    {
      step: 'migrations_complete',
      completed_at: new Date().toISOString(),
      metadata: { total: migrations.length, ran_now: ran.length },
    },
    { onConflict: 'step' },
  );

  return { migrations_total: migrations.length, migrations_run_now: ran.length };
}

// -----------------------------------------------------------------------------
// PHASE: deploy (EFs + secrets + Vercel envs)
// -----------------------------------------------------------------------------
async function phaseDeploy(body: BootstrapBody) {
  const ref = extractRef(body.supabase_url);
  const admin = adminClient(body.supabase_url, body.supabase_service_role_key);

  // 1. Resolver CRYPTO_KEY. Fonte de verdade: a env do Vercel (process.env).
  //    Em re-run pós-redeploy ela está viva e é reusada. NUNCA gravamos a chave
  //    em _bootstrap_state — era exatamente o vetor do leak via get_bootstrap_state
  //    (auditoria Prompt 3). Guard fail-loud: se a env sumiu mas já existem
  //    credenciais cifradas em app_settings, regenerar tornaria tudo ilegível —
  //    abortamos alto em vez de corromper silenciosamente.
  let cryptoKey = process.env.CRYPTO_KEY;
  if (!cryptoKey) {
    const { count } = await admin
      .from('app_settings')
      .select('key', { count: 'exact', head: true });
    if ((count ?? 0) > 0) {
      throw new Error(
        'CRYPTO_KEY ausente no ambiente, mas app_settings já contém dados cifrados. ' +
          'Regenerar a chave tornaria as credenciais ilegíveis. Restaure CRYPTO_KEY na ' +
          'env do Vercel (ou refaça o setup num projeto limpo) antes de re-rodar o bootstrap.',
      );
    }
    cryptoKey = randomBytes(32).toString('hex');
  }

  // 2. CRON_SECRET: o cron real (setup-cron.sh) autentica com service_role, então
  //    este segredo não precisa ser estável. Geramos a cada run e setamos como
  //    secret da EF logo abaixo. Não é persistido em lugar nenhum do banco.
  const cronSecret = randomBytes(32).toString('hex');

  // 3. Setar Supabase Edge Function secrets.
  //    SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são auto-injetadas; só precisamos
  //    setar CRYPTO_KEY e CRON_SECRET pro nosso helper getCredential funcionar.
  await setSecrets(body.supabase_pat, ref, {
    CRYPTO_KEY: cryptoKey,
    CRON_SECRET: cronSecret,
  });
  await admin.from('_bootstrap_state').upsert(
    { step: 'supabase_secrets_set', completed_at: new Date().toISOString(), metadata: {} },
    { onConflict: 'step' },
  );

  // 4. Deploy Edge Functions (bundled).
  const functionsRoot = path.join(process.cwd(), 'supabase', 'functions');
  const slugs = await listEdgeFunctionSlugs();
  const deployResults: Array<{ slug: string; ok: boolean; error?: string }> = [];
  for (const slug of slugs) {
    const stepKey = `function:${slug}`;
    const { data: already } = await admin
      .from('_bootstrap_state')
      .select('step')
      .eq('step', stepKey)
      .maybeSingle();
    if (already) {
      deployResults.push({ slug, ok: true });
      continue;
    }
    try {
      const bundled = await bundleEdgeFunction(functionsRoot, slug);
      await deployFunction(body.supabase_pat, ref, slug, bundled);
      await admin.from('_bootstrap_state').upsert(
        { step: stepKey, completed_at: new Date().toISOString(), metadata: {} },
        { onConflict: 'step' },
      );
      deployResults.push({ slug, ok: true });
    } catch (err) {
      deployResults.push({
        slug,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  const okCount = deployResults.filter((r) => r.ok).length;
  await admin.from('_bootstrap_state').upsert(
    {
      step: 'edge_functions_deployed',
      completed_at: new Date().toISOString(),
      metadata: { ok: okCount, total: slugs.length, results: deployResults },
    },
    { onConflict: 'step' },
  );

  // 5. Setar envs no Vercel.
  const project = await getProjectByDomain(body.vercel_token, body.app_origin);
  const envs: Record<string, string> = {
    VITE_SUPABASE_URL: body.supabase_url,
    VITE_SUPABASE_ANON_KEY: body.supabase_anon_key,
    SUPABASE_URL: body.supabase_url,
    SUPABASE_ANON_KEY: body.supabase_anon_key,
    SUPABASE_SERVICE_ROLE_KEY: body.supabase_service_role_key,
    CRYPTO_KEY: cryptoKey,
  };
  for (const [k, v] of Object.entries(envs)) {
    await upsertEnv(body.vercel_token, project.id, k, v);
  }
  await admin.from('_bootstrap_state').upsert(
    {
      step: 'vercel_envs_set',
      completed_at: new Date().toISOString(),
      metadata: { project_id: project.id, project_name: project.name, count: Object.keys(envs).length },
    },
    { onConflict: 'step' },
  );

  // 6. Setar APP_URL na app_settings (não é segredo — é só conveniência pra EFs
  //    que mandam emails de invite). Usa o app_origin do wizard.
  const { encrypt } = await import('./_lib/credentials.js');
  // Passa a chave explícita: na first-run, process.env.CRYPTO_KEY ainda não está
  // viva (a env setada acima só vale no próximo deploy). Antes isso quebrava o
  // app_url write na primeira execução.
  await admin.from('app_settings').upsert(
    { key: 'app_url', value_encrypted: encrypt(body.app_origin, cryptoKey), updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  );

  return {
    edge_functions: { ok: okCount, total: slugs.length, results: deployResults },
    vercel_project: { id: project.id, name: project.name },
  };
}

// -----------------------------------------------------------------------------
// PHASE: redeploy
// -----------------------------------------------------------------------------
async function phaseRedeploy(body: BootstrapBody) {
  const admin = adminClient(body.supabase_url, body.supabase_service_role_key);
  const project = await getProjectByDomain(body.vercel_token, body.app_origin);
  const dep = await triggerRedeploy(body.vercel_token, project);
  await admin.from('_bootstrap_state').upsert(
    {
      step: 'redeploy_triggered',
      completed_at: new Date().toISOString(),
      metadata: { deployment_id: dep.id, url: dep.url, state: dep.readyState },
    },
    { onConflict: 'step' },
  );

  // NÃO marca 'setup_completed' aqui. O setup só termina de fato quando o owner é
  // criado (/api/create-owner). Marcar antes criava deadlock: se a criação do owner
  // falhasse, o gate passava a exigir um JWT de owner que ainda não existia.

  return { deployment: dep };
}

// -----------------------------------------------------------------------------
// Handler principal
// -----------------------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') {
    return jsonError(res, 405, 'method_not_allowed', 'Use POST.');
  }

  let body: BootstrapBody;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return jsonError(res, 400, 'invalid_json', 'Body precisa ser JSON válido.');
  }
  const err = validate(body);
  if (err) return jsonError(res, 400, 'invalid_input', err);

  // === Gate de uso único ===
  // O bootstrap é executável anonimamente APENAS enquanto o setup não terminou.
  // Após o step 'setup_completed' existir (gravado no fim da fase redeploy),
  // qualquer re-execução exige JWT de um owner (fo_users.role='owner').
  // Na primeira run a tabela _bootstrap_state pode nem existir ainda — nesse caso
  // o probe falha e tratamos como first-run (segue anônimo).
  try {
    const probe = adminClient(body.supabase_url, body.supabase_service_role_key);
    const { data: done } = await probe
      .from('_bootstrap_state')
      .select('step')
      .eq('step', 'setup_completed')
      .maybeSingle();
    if (done) {
      // Auto-cura de deadlock: 'setup_completed' pode ter sido marcado numa run
      // que falhou ANTES de criar o owner. Sem owner, o setup não terminou de fato
      // — libera a re-execução anônima (senão ninguém consegue criar o owner).
      const { count: ownerCount } = await probe
        .from('fo_users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'owner');
      if ((ownerCount ?? 0) > 0) {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
          return jsonError(
            res,
            403,
            'setup_already_completed',
            'Setup já foi concluído. Autenticação de owner é necessária para re-executar o bootstrap.',
          );
        }
        const userClient = createClient(body.supabase_url, body.supabase_anon_key, {
          global: { headers: { Authorization: authHeader } },
          auth: { persistSession: false },
        });
        const { data: { user } } = await userClient.auth.getUser();
        if (!user) {
          return jsonError(res, 401, 'invalid_jwt', 'Sessão inválida ou expirada.');
        }
        const { data: profile } = await probe
          .from('fo_users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        if ((profile as { role?: string } | null)?.role !== 'owner') {
          return jsonError(res, 403, 'not_owner', 'Apenas o owner pode re-executar o setup.');
        }
      }
    }
  } catch (probeErr) {
    // Tabela ainda não existe (first-run) ou probe falhou — seguir como primeira
    // execução. NUNCA logar body (segredos). Só a mensagem do erro.
    console.warn(
      '[bootstrap] probe de setup_completed falhou (provável first-run):',
      probeErr instanceof Error ? probeErr.message : String(probeErr),
    );
  }

  const phase = String(req.query.phase ?? '');
  try {
    switch (phase) {
      case 'migrations': {
        const result = await phaseMigrations(body);
        return jsonOk(res, { phase, ...result });
      }
      case 'deploy': {
        const result = await phaseDeploy(body);
        return jsonOk(res, { phase, ...result });
      }
      case 'redeploy': {
        const result = await phaseRedeploy(body);
        return jsonOk(res, { phase, ...result });
      }
      default:
        return jsonError(
          res,
          400,
          'invalid_phase',
          'Use ?phase=migrations | deploy | redeploy',
        );
    }
  } catch (e) {
    const code =
      e instanceof MgmtError ? 'supabase_management_error'
      : e instanceof VercelError ? 'vercel_api_error'
      : 'unexpected_error';
    const status =
      e instanceof MgmtError && e.status === 401 ? 401
      : e instanceof VercelError && e.status === 401 ? 401
      : 500;
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[bootstrap:${phase}]`, message);
    return jsonError(res, status, code, message, { phase });
  }
}
