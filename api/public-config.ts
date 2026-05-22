// =============================================================================
// /api/public-config — config semi-pública lida do app_settings.
// -----------------------------------------------------------------------------
// O Gmail Client ID e Redirect URI aparecem na URL OAuth (são semi-públicos
// por design), mas decidimos guardar em app_settings junto com o secret pra
// manter "single source of truth". O frontend chama este endpoint pra montar
// a URL de autorização do Gmail.
//
// NÃO expõe Client Secret nem OpenAI key.
// =============================================================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handlePreflight, jsonError, jsonOk } from './_lib/http.js';
import { getCredential } from './_lib/credentials.js';

const PUBLIC_KEYS = ['gmail_client_id', 'gmail_redirect_uri', 'app_url'] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'GET') {
    return jsonError(res, 405, 'method_not_allowed', 'Use GET.');
  }
  try {
    const out: Record<string, string | null> = {};
    for (const key of PUBLIC_KEYS) {
      out[key] = await getCredential(key);
    }
    return jsonOk(res, { config: out });
  } catch (e) {
    return jsonError(
      res,
      500,
      'fetch_failed',
      e instanceof Error ? e.message : String(e),
    );
  }
}
