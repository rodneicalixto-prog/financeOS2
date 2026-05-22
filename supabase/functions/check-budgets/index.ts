import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getSupabaseAdmin, getSupabaseUser } from '../_shared/supabase-admin.ts'

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
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    // Buscar budgets do mês
    const { data: budgets } = await supabaseAdmin
      .from('fo_budgets')
      .select('*, categories:fo_categories(name)')
      .eq('user_id', user.id)
      .eq('month', monthStart)

    if (!budgets || budgets.length === 0) {
      return new Response(JSON.stringify({ alerts_created: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let alertsCreated = 0

    for (const budget of budgets) {
      // Somar despesas do mês na categoria
      const { data: transactions } = await supabaseAdmin
        .from('fo_transactions')
        .select('amount')
        .eq('user_id', user.id)
        .eq('category_id', budget.category_id)
        .eq('type', 'expense')
        .gte('date', monthStart)

      const totalSpent = (transactions || []).reduce(
        (sum: number, t: { amount: number }) => sum + Number(t.amount),
        0
      )

      if (totalSpent > Number(budget.amount_limit)) {
        // Verificar se alerta já existe este mês
        const { data: existingAlert } = await supabaseAdmin
          .from('fo_alerts')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'budget_exceeded')
          .gte('created_at', monthStart)
          .single()

        if (!existingAlert) {
          const categoryName = (budget as Record<string, unknown>).categories
            ? ((budget as Record<string, unknown>).categories as { name: string }).name
            : 'categoria'

          await supabaseAdmin.from('fo_alerts').insert({
            user_id: user.id,
            type: 'budget_exceeded',
            message: `Orçamento de ${categoryName} excedido! Gasto: R$ ${totalSpent.toFixed(2)} / Limite: R$ ${Number(budget.amount_limit).toFixed(2)}`,
            is_read: false,
            metadata: {
              category_id: budget.category_id,
              spent: totalSpent,
              limit: budget.amount_limit,
            },
          })
          alertsCreated++
        }
      }
    }

    return new Response(JSON.stringify({ alerts_created: alertsCreated }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
