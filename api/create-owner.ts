// =============================================================================
// /api/create-owner — Step 5 do wizard: criar a primeira conta (role=owner).
// -----------------------------------------------------------------------------
// Body: { email, password, name }
//
// Gate: só funciona se fo_users estiver vazio. O trigger handle_new_user_financeos
// (migration 00012) detecta zero users e atribui role='owner' automaticamente.
//
// Como o Supabase Auth tem signup disabled após o primeiro user, este endpoint
// usa supabase.auth.admin.createUser (service_role) — funciona mesmo com
// signup desabilitado.
// =============================================================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { handlePreflight, jsonError, jsonOk } from './_lib/http.js';
import { markBootstrapStep } from './_lib/credentials.js';

interface CreateOwnerBody {
  email: string;
  password: string;
  name?: string;
  // Opcionais: o wizard envia as creds Supabase no body porque, na first-run, as
  // envs setadas no Vercel pelo bootstrap só ficam vivas no próximo deploy — ler
  // de process.env aqui daria 503. Mesmo modelo de confiança do /api/bootstrap.
  supabase_url?: string;
  supabase_service_role_key?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') {
    return jsonError(res, 405, 'method_not_allowed', 'Use POST.');
  }

  let body: CreateOwnerBody;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return jsonError(res, 400, 'invalid_json', 'Body precisa ser JSON válido.');
  }

  if (!body?.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) {
    return jsonError(res, 400, 'invalid_email', 'Email inválido.');
  }
  if (!body?.password || body.password.length < 8) {
    return jsonError(res, 400, 'weak_password', 'Senha precisa ter pelo menos 8 caracteres.');
  }

  const url =
    body.supabase_url?.trim() || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRole =
    body.supabase_service_role_key?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    return jsonError(
      res,
      503,
      'not_initialized',
      'Envs Supabase ainda não estão configuradas. Complete os steps anteriores do wizard.',
    );
  }

  try {
    const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

    // Gate: já existe owner?
    const check = await admin
      .from('fo_users')
      .select('id', { count: 'exact', head: true });
    if (!check.error && (check.count ?? 0) > 0) {
      return jsonError(
        res,
        409,
        'owner_already_exists',
        'Já existe pelo menos um usuário. O wizard não pode mais criar owner.',
      );
    }

    const { data, error } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { name: body.name ?? body.email.split('@')[0] },
    });
    if (error) {
      return jsonError(res, 500, 'supabase_auth_error', error.message);
    }

    await markBootstrapStep('owner_created', {
      user_id: data.user?.id,
      email: data.user?.email,
    });

    return jsonOk(res, {
      user: { id: data.user?.id, email: data.user?.email },
    });
  } catch (e) {
    return jsonError(
      res,
      500,
      'unexpected_error',
      e instanceof Error ? e.message : String(e),
    );
  }
}
