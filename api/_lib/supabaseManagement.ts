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
  body: string,
): Promise<void> {
  // Atualização funciona como upsert via PATCH com source no body.
  // A API aceita raw body (Deno source) com content-type específico.
  // Se a função não existir, usamos POST; se existir, PATCH.
  const existing = await mgmtFetch(pat, 'GET', `/projects/${ref}/functions/${slug}`);
  const method = existing.status === 404 ? 'POST' : 'PATCH';
  const endpoint =
    method === 'POST'
      ? `/projects/${ref}/functions?slug=${encodeURIComponent(slug)}&name=${encodeURIComponent(slug)}&verify_jwt=false`
      : `/projects/${ref}/functions/${slug}?verify_jwt=false`;
  const res = await mgmtFetch(pat, method, endpoint, body, 'application/typescript');
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
