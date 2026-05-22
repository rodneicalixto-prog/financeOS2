import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getSupabaseAdmin, getSupabaseUser } from '../_shared/supabase-admin.ts'
import { computeForecast, computeAnomalies, computeAllMathInsights } from '../_shared/compute-insights.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUser = getSupabaseUser(authHeader)
    const { data: { user } } = await supabaseUser.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const action = body.action || 'all'
    const month = body.month || undefined

    const supabaseAdmin = getSupabaseAdmin()
    let result: unknown

    switch (action) {
      case 'forecast':
        result = await computeForecast(supabaseAdmin, user.id, month)
        break
      case 'anomalies':
        result = await computeAnomalies(supabaseAdmin, user.id, month)
        break
      case 'all':
      default:
        await computeAllMathInsights(supabaseAdmin, user.id)
        result = { status: 'ok', actions: ['forecast', 'anomalies'] }
        break
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Compute insights error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
