import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'
import { corsHeaders } from '../_shared/cors.ts'
import { getCredential } from '../_shared/credentials.ts'

interface CreateInviteRequest {
  email: string
  role?: 'member'
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // 1. Valida sessão e role do caller
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return jsonResponse({ error: 'Sessão inválida' }, 401)
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseService)

    const { data: caller, error: callerErr } = await supabaseAdmin
      .from('fo_users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (callerErr || !caller || caller.role !== 'owner') {
      return jsonResponse({ error: 'Apenas o owner pode criar convites' }, 403)
    }

    // 2. Valida payload
    const body = (await req.json()) as CreateInviteRequest
    const email = (body.email ?? '').trim().toLowerCase()
    const role = body.role ?? 'member'

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: 'Email inválido' }, 400)
    }
    if (role !== 'member') {
      return jsonResponse({ error: 'Apenas convites com role "member" são permitidos' }, 400)
    }

    // 3. Verifica se email já está cadastrado em fo_users
    const { data: existingUser } = await supabaseAdmin
      .from('fo_users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingUser) {
      return jsonResponse({ error: 'Já existe um usuário com esse email' }, 409)
    }

    // 4. Convida via Supabase Auth (cria user, gera link e dispara email pelo SMTP)
    const storedAppUrl = await getCredential('app_url')
    const appUrl = (storedAppUrl ?? Deno.env.get('APP_URL') ?? 'http://localhost:5173').replace(/\/$/, '')
    const redirectTo = `${appUrl}/aceitar-convite`
    const fallbackName = email.split('@')[0] ?? email

    const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo,
        data: { name: fallbackName, role },
      },
    )

    if (inviteError || !invited?.user) {
      console.error('[create-invite] auth invite error', inviteError)
      return jsonResponse(
        { error: inviteError?.message ?? 'Falha ao enviar convite via Supabase Auth' },
        500,
      )
    }

    return jsonResponse({
      ok: true,
      user_id: invited.user.id,
      email,
      email_sent: true,
    })
  } catch (err) {
    console.error('[create-invite] unexpected error', err)
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
