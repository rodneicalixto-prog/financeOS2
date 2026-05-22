import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'
import { corsHeaders } from '../_shared/cors.ts'

interface RevokeInviteRequest {
  invite_id: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Não autorizado' }, 401)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return jsonResponse({ error: 'Sessão inválida' }, 401)
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: caller, error: callerErr } = await supabaseAdmin
      .from('fo_users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (callerErr || !caller || caller.role !== 'owner') {
      return jsonResponse({ error: 'Apenas o owner pode revogar convites' }, 403)
    }

    const body = (await req.json()) as RevokeInviteRequest
    const inviteId = body.invite_id
    if (!inviteId) {
      return jsonResponse({ error: 'invite_id obrigatório' }, 400)
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('fo_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', inviteId)
      .is('used_at', null)
      .is('revoked_at', null)
      .select()
      .maybeSingle()

    if (updateErr) {
      console.error('[revoke-invite] update error', updateErr)
      return jsonResponse({ error: updateErr.message }, 500)
    }

    if (!updated) {
      return jsonResponse({ error: 'Convite não encontrado, já usado ou já revogado' }, 404)
    }

    return jsonResponse({ ok: true, invite_id: updated.id, revoked_at: updated.revoked_at })
  } catch (err) {
    console.error('[revoke-invite] unexpected error', err)
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
