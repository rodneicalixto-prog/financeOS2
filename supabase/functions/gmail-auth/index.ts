import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'
import { getCredential } from '../_shared/credentials.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[gmail-auth] request received')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Cria cliente Supabase com token do usuário
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('[gmail-auth] auth error', authError)
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    console.log('[gmail-auth] user authenticated:', user.id)

    const { code } = await req.json()
    if (!code) {
      return new Response(JSON.stringify({ error: 'Código de autorização ausente' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    console.log('[gmail-auth] code length:', code.length)

    // Credenciais Gmail vivem em app_settings (configuradas pelo wizard /setup).
    const clientId = await getCredential('gmail_client_id')
    const clientSecret = await getCredential('gmail_client_secret')
    const redirectUri = await getCredential('gmail_redirect_uri')
    if (!clientId || !clientSecret || !redirectUri) {
      const missing = [
        !clientId && 'gmail_client_id',
        !clientSecret && 'gmail_client_secret',
        !redirectUri && 'gmail_redirect_uri',
      ].filter(Boolean).join(', ')
      return new Response(
        JSON.stringify({
          error: `Credenciais Gmail ausentes em app_settings: ${missing}.`,
          instrucao: 'Owner: vá em Configurações → IA e Gmail e preencha; ou rode /setup?reset=1.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Troca code por tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenResponse.json()
    console.log('[gmail-auth] google response status:', tokenResponse.status, 'keys:', Object.keys(tokens))

    if (tokens.error) {
      console.error('[gmail-auth] google error:', tokens)
      return new Response(JSON.stringify({ error: `Erro Google: ${tokens.error_description || tokens.error}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!tokens.access_token) {
      console.error('[gmail-auth] no access_token in response:', tokens)
      return new Response(JSON.stringify({ error: 'Google não retornou access_token' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Buscar email do usuário via Google userinfo
    const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const userinfo = await userinfoRes.json()
    const emailAddress: string | null = userinfo.email || null
    console.log('[gmail-auth] google email:', emailAddress)

    // Salva tokens no banco (usando service_role para bypass de RLS se necessário)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Verificar se já existe conexão para este (user_id, email_address)
    let existingQuery = supabaseAdmin
      .from('fo_gmail_connections')
      .select('id')
      .eq('user_id', user.id)

    if (emailAddress) {
      existingQuery = existingQuery.eq('email_address', emailAddress)
    } else {
      existingQuery = existingQuery.is('email_address', null)
    }

    const { data: existingConn } = await existingQuery.maybeSingle()

    let saveError: { message: string } | null = null

    if (existingConn) {
      // UPDATE tokens da conexão existente
      const updatePayload: Record<string, unknown> = {
        access_token: tokens.access_token,
        token_expires_at: expiresAt,
      }
      if (tokens.refresh_token) {
        updatePayload.refresh_token = tokens.refresh_token
      }
      const { error } = await supabaseAdmin
        .from('fo_gmail_connections')
        .update(updatePayload)
        .eq('id', existingConn.id)
      saveError = error
    } else {
      // INSERT nova conexão
      const insertPayload: Record<string, unknown> = {
        user_id: user.id,
        email_address: emailAddress,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || '',
        token_expires_at: expiresAt,
        last_sync_at: null,
      }
      const { error } = await supabaseAdmin
        .from('fo_gmail_connections')
        .insert(insertPayload)
      saveError = error
    }

    if (saveError) {
      console.error('[gmail-auth] save error:', saveError)
      return new Response(JSON.stringify({ error: `Erro ao salvar conexão: ${saveError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('[gmail-auth] success for user', user.id, 'email:', emailAddress)
    return new Response(JSON.stringify({ success: true, email_address: emailAddress }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[gmail-auth] unexpected error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
