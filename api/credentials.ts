// =============================================================================
// /api/credentials — salva credenciais de aplicação em app_settings.
// -----------------------------------------------------------------------------
// Gate:
//   - Setup inicial (sem step 'app_credentials_saved'): aceita anônimo.
//   - Pós-setup: exige Authorization: Bearer <supabase_jwt> de um user com
//     role='owner' em fo_users.
//
// Body (POST): { [key]: string, ... } — chaves coincidem com setupConfig.appCredentials.
//
// GET /api/credentials?keys=a,b — retorna APENAS existência { a: { exists },
// b: { exists } }. Nunca devolve valores (plaintext nem cifrado). Mesmo gate
// condicional do POST: anônimo durante o setup, owner depois.
// =============================================================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { handlePreflight, jsonError, jsonOk, withCors } from './_lib/http.js';
import { setCredential, hasBootstrapStep, markBootstrapStep } from './_lib/credentials.js';

async function isOwner(authHeader: string): Promise<boolean> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) return false;
  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from('fo_users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  return (profile as { role?: string } | null)?.role === 'owner';
}

// Mesmo gate condicional do POST, isolado para o GET — o fluxo do POST permanece
// intacto (escopo do Prompt 5: não tocar no POST condicional ainda).
type ReadGate = { ok: true } | { status: number; code: string; message: string };

async function gateForRead(req: VercelRequest): Promise<ReadGate> {
  const alreadyDone = await hasBootstrapStep('app_credentials_saved');
  if (!alreadyDone) return { ok: true };
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return { status: 401, code: 'auth_required', message: 'Setup já concluído — necessário Authorization Bearer de um owner.' };
  }
  if (!(await isOwner(authHeader))) {
    return { status: 403, code: 'not_owner', message: 'Apenas o owner pode consultar credenciais.' };
  }
  return { ok: true };
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
  const keys = String(req.query.keys ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  if (keys.length === 0) {
    return jsonError(res, 400, 'invalid_input', 'Parâmetro "keys" obrigatório (lista separada por vírgula).');
  }

  let gate: ReadGate;
  try {
    gate = await gateForRead(req);
  } catch (e) {
    return jsonError(res, 500, 'gate_check_failed', e instanceof Error ? e.message : String(e));
  }
  if ('status' in gate) return jsonError(res, gate.status, gate.code, gate.message);

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    return jsonError(res, 503, 'not_initialized', 'Envs Supabase ausentes no ambiente serverless.');
  }
  try {
    const admin = createClient(url, serviceRole, { auth: { persistSession: false } });
    // Seleciona SOMENTE a coluna `key` — value_encrypted nunca sai daqui.
    const { data, error } = await admin.from('app_settings').select('key').in('key', keys);
    if (error) throw error;
    const present = new Set<string>((data ?? []).map((r) => (r as { key: string }).key));
    const result = Object.fromEntries(keys.map((k) => [k, { exists: present.has(k) }]));
    withCors(res);
    return res.status(200).json(result);
  } catch (e) {
    return jsonError(res, 500, 'read_failed', e instanceof Error ? e.message : String(e));
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;

  // GET: consulta apenas EXISTÊNCIA (booleanos), nunca valores.
  if (req.method === 'GET') {
    return handleGet(req, res);
  }

  if (req.method !== 'POST') {
    return jsonError(res, 405, 'method_not_allowed', 'Use POST ou GET.');
  }

  let body: Record<string, string>;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return jsonError(res, 400, 'invalid_json', 'Body precisa ser JSON válido.');
  }
  if (!body || typeof body !== 'object') {
    return jsonError(res, 400, 'invalid_input', 'Body precisa ser objeto chave→valor.');
  }

  // Gate de autorização.
  try {
    const alreadyDone = await hasBootstrapStep('app_credentials_saved');
    if (alreadyDone) {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return jsonError(
          res,
          401,
          'auth_required',
          'Setup já concluído — necessário Authorization Bearer de um owner.',
        );
      }
      const ok = await isOwner(authHeader);
      if (!ok) {
        return jsonError(res, 403, 'not_owner', 'Apenas o owner pode atualizar credenciais.');
      }
    }
  } catch (e) {
    return jsonError(
      res,
      500,
      'gate_check_failed',
      e instanceof Error ? e.message : String(e),
    );
  }

  // Persistir cada credencial.
  const saved: string[] = [];
  try {
    for (const [key, value] of Object.entries(body)) {
      if (typeof value !== 'string' || value.length === 0) continue;
      await setCredential(key, value);
      saved.push(key);
    }
    await markBootstrapStep('app_credentials_saved', { count: saved.length, keys: saved });
    return jsonOk(res, { saved });
  } catch (e) {
    return jsonError(
      res,
      500,
      'save_failed',
      e instanceof Error ? e.message : String(e),
    );
  }
}
