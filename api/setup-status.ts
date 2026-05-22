// =============================================================================
// /api/setup-status — estado do wizard pro frontend.
// -----------------------------------------------------------------------------
// Retorna:
//   - steps completos (lista de strings)
//   - has_users (boolean) — se já existe pelo menos 1 user em fo_users
//   - is_complete (boolean) — se app_credentials_saved está marcado
//
// Não precisa de auth. Não vaza informação sensível — só estado de progresso.
// =============================================================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { handlePreflight, jsonError, jsonOk } from './_lib/http.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'GET') {
    return jsonError(res, 405, 'method_not_allowed', 'Use GET.');
  }

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Antes da fase 1 do bootstrap, as envs não existem — devolvemos estado vazio
  // sem 500. O wizard interpreta isso como "começar do zero".
  if (!url || !serviceRole) {
    return jsonOk(res, {
      configured: false,
      steps: [],
      has_users: false,
      is_complete: false,
    });
  }

  try {
    const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });

    // _bootstrap_state pode ainda não existir (antes da migration 00013).
    const stateRes = await supabase
      .from('_bootstrap_state')
      .select('step, metadata, completed_at')
      .order('completed_at', { ascending: true });

    const steps =
      stateRes.error || !stateRes.data
        ? []
        : stateRes.data.map((r) => ({
            step: (r as { step: string }).step,
            completed_at: (r as { completed_at: string }).completed_at,
          }));

    // has_users só dá pra checar se fo_users existir.
    const usersRes = await supabase
      .from('fo_users')
      .select('id', { count: 'exact', head: true });
    const hasUsers = !usersRes.error && (usersRes.count ?? 0) > 0;

    const isComplete = steps.some((s) => s.step === 'app_credentials_saved');

    return jsonOk(res, {
      configured: true,
      steps,
      has_users: hasUsers,
      is_complete: isComplete,
    });
  } catch (e) {
    return jsonError(
      res,
      500,
      'status_failed',
      e instanceof Error ? e.message : String(e),
    );
  }
}
