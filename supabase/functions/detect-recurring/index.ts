import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getSupabaseAdmin, getSupabaseUser } from '../_shared/supabase-admin.ts'
import { detectRecurring } from '../_shared/ai-parser.ts'

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

    const supabaseAdmin = getSupabaseAdmin()

    // Buscar transações dos últimos 3 meses
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

    const { data: transactions } = await supabaseAdmin
      .from('fo_transactions')
      .select('id, description, amount, date, type')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .gte('date', threeMonthsAgo.toISOString().split('T')[0])
      .order('date', { ascending: false })

    if (!transactions || transactions.length < 3) {
      return new Response(JSON.stringify({ recurring_found: 0, message: 'Poucas transações para análise' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ai-parser resolve a credencial automaticamente a partir de app_settings.
    const recurrences = await detectRecurring(
      transactions.map((t) => ({
        id: t.id as string,
        description: t.description as string,
        amount: Number(t.amount),
        date: t.date as string,
      })),
    )

    let updated = 0

    for (const recurrence of recurrences) {
      if (!Array.isArray(recurrence.transaction_ids)) continue

      // Marcar transações como recorrentes
      await supabaseAdmin
        .from('fo_transactions')
        .update({ is_recurring: true })
        .in('id', recurrence.transaction_ids)

      updated += recurrence.transaction_ids.length

      // Criar alerta
      await supabaseAdmin.from('fo_alerts').insert({
        user_id: user.id,
        type: 'recurring_detected',
        message: `Assinatura detectada: ${recurrence.service_name} (~R$ ${recurrence.avg_amount.toFixed(2)}/mês)`,
        is_read: false,
        metadata: {
          service_name: recurrence.service_name,
          avg_amount: recurrence.avg_amount,
          transaction_ids: recurrence.transaction_ids,
        },
      })
    }

    return new Response(
      JSON.stringify({ recurring_found: recurrences.length, transactions_updated: updated }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
