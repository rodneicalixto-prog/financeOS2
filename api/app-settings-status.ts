// =============================================================================
// /api/app-settings-status — informa quais credenciais estão configuradas.
// -----------------------------------------------------------------------------
// Retorna apenas BOOLEANOS — não vaza nenhum valor. Usado pelos componentes do
// dashboard pra decidir se mostram banners de "configure IA" etc.
// =============================================================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { handlePreflight, jsonError, jsonOk } from './_lib/http.js';

const CHECK_KEYS = [
  'openai_api_key',
  'gmail_client_id',
  'gmail_client_secret',
  'gmail_redirect_uri',
] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'GET') {
    return jsonError(res, 405, 'method_not_allowed', 'Use GET.');
  }

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    return jsonOk(res, {
      status: Object.fromEntries(CHECK_KEYS.map((k) => [k, false])),
      has_openai: false,
      has_gmail: false,
    });
  }

  try {
    const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from('app_settings')
      .select('key')
      .in('key', CHECK_KEYS as readonly string[] as string[]);
    if (error) throw error;
    const present = new Set<string>((data ?? []).map((r) => (r as { key: string }).key));
    const status = Object.fromEntries(CHECK_KEYS.map((k) => [k, present.has(k)]));
    return jsonOk(res, {
      status,
      has_openai: status.openai_api_key,
      has_gmail: status.gmail_client_id && status.gmail_client_secret && status.gmail_redirect_uri,
    });
  } catch (e) {
    return jsonError(res, 500, 'status_failed', e instanceof Error ? e.message : String(e));
  }
}
