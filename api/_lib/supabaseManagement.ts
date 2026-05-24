// =============================================================================
// Cliente fino da Supabase Management API.
// -----------------------------------------------------------------------------
// Usado pelo /api/bootstrap para:
//   - rodar migrations (POST /v1/projects/{ref}/database/query)
//   - criar/atualizar Edge Functions
//   - setar secrets das Edge Functions
//
// O PAT (Personal Access Token) é fornecido pelo aluno no step 2 do wizard
// e descartado após o bootstrap — nunca persiste em app_settings.
// =============================================================================

const BASE = 'https://api.supabase.com/v1';

export class MgmtError extends Error {
  constructor(public status: number, public body: string, public endpoint: string) {
    super(`Supabase Management API ${status} em ${endpoint}: ${body}`);
  }
}

async function mgmtFetch(
  pat: string,
  method: string,
  path: string,
  body?: unknown,
  contentType: string = 'application/json',
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${pat}`,
  };
  let bodyToSend: string | undefined;
  if (body !== undefined) {
    if (contentType === 'application/json') {
      headers['Content-Type'] = 'application/json';
      bodyToSend = JSON.stringify(body);
    } else {
      headers['Content-Type'] = contentType;
      bodyToSend = body as string;
    }
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: bodyToSend });
  return res;
}

export async function runSql(pat: string, ref: string, sql: string): Promise<unknown> {
  const res = await mgmtFetch(pat, 'POST', `/projects/${ref}/database/query`, { query: sql });
  if (!res.ok) {
    const txt = await res.text();
    throw new MgmtError(res.status, txt, `/projects/${ref}/database/query`);
  }
  return res.json();
}

const SYNC_CRON_JOB = 'fo-sync-emails-cron';

/**
 * Agenda (ou re-agenda) o pg_cron que chama a Edge Function `cron-sync-all` via
 * pg_net. Substitui o setup-cron.sh manual — roda direto na Management API
 * durante o bootstrap. Idempotente: derruba o job anterior e recria com o
 * CRON_SECRET corrente (mantém sincronia com o secret setado na EF nesta run).
 */
export async function scheduleEmailSyncCron(
  pat: string,
  ref: string,
  supabaseUrl: string,
  cronSecret: string,
  schedule: string,
): Promise<void> {
  // O schedule vem do manifesto (setup.config). Guarda contra quebra do literal SQL.
  if (/['\\;]/.test(schedule)) {
    throw new Error(`Cron schedule inválido (caracteres proibidos): "${schedule}"`);
  }
  const edgeUrl = `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/cron-sync-all`;
  const sql = `
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = '${SYNC_CRON_JOB}') THEN
    PERFORM cron.unschedule('${SYNC_CRON_JOB}');
  END IF;
END
$do$;
SELECT cron.schedule(
  '${SYNC_CRON_JOB}',
  '${schedule}',
  $cron$
  SELECT net.http_post(
    url := '${edgeUrl}',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ${cronSecret}'
    ),
    body := '{}'::jsonb
  );
  $cron$
);`;
  await runSql(pat, ref, sql);
}

export async function listFunctions(pat: string, ref: string): Promise<Array<{ slug: string }>> {
  const res = await mgmtFetch(pat, 'GET', `/projects/${ref}/functions`);
  if (!res.ok) {
    const txt = await res.text();
    throw new MgmtError(res.status, txt, `/projects/${ref}/functions`);
  }
  const list = (await res.json()) as Array<{ slug: string }>;
  return list;
}

export async function deployFunction(
  pat: string,
  ref: string,
  slug: string,
  source: string,
): Promise<void> {
  // Deploy via multipart/form-data no endpoint atual (upsert por slug). O método
  // antigo (raw body application/typescript em POST/PATCH /functions) foi
  // descontinuado — era a causa do "0/10 EFs" no bootstrap. Mandamos o `index.ts`
  // já com os _shared inlined pelo edgeBundler.
  const endpoint = `/projects/${ref}/functions/deploy?slug=${encodeURIComponent(slug)}`;
  const form = new FormData();
  form.append(
    'metadata',
    new Blob(
      [JSON.stringify({ name: slug, entrypoint_path: 'index.ts', verify_jwt: false })],
      { type: 'application/json' },
    ),
  );
  form.append('file', new Blob([source], { type: 'application/typescript' }), 'index.ts');

  // NÃO setar Content-Type manualmente: o fetch injeta o boundary do multipart.
  const res = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat}` },
    body: form,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new MgmtError(res.status, txt, endpoint);
  }
}

export async function setSecrets(
  pat: string,
  ref: string,
  secrets: Record<string, string>,
): Promise<void> {
  const payload = Object.entries(secrets).map(([name, value]) => ({ name, value }));
  const res = await mgmtFetch(pat, 'POST', `/projects/${ref}/secrets`, payload);
  if (!res.ok) {
    const txt = await res.text();
    throw new MgmtError(res.status, txt, `/projects/${ref}/secrets`);
  }
}

export function extractRef(supabaseUrl: string): string {
  // https://abc1234.supabase.co → "abc1234"
  const match = supabaseUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i);
  if (!match) throw new Error(`SUPABASE_URL inválida: "${supabaseUrl}"`);
  return match[1];
}
