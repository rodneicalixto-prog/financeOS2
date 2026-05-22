import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getSupabaseAdmin, getSupabaseUser } from '../_shared/supabase-admin.ts'
import { callWithRetry, MONTHLY_SUMMARY_PROMPT, BUDGET_SUGGESTIONS_PROMPT, type AICredential } from '../_shared/ai-parser.ts'
import { requireCredential } from '../_shared/credentials.ts'

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
    const action = body.action || 'monthly_summary'
    const month = body.month || undefined

    const supabaseAdmin = getSupabaseAdmin()

    // OpenAI key vive em app_settings (app-wide, configurada pelo owner).
    const openaiKey = await requireCredential('openai_api_key', 'OpenAI API Key')
    const credential: AICredential = { provider: 'openai', apiKey: openaiKey }

    let result: unknown

    switch (action) {
      case 'monthly_summary':
        result = await generateMonthlySummary(supabaseAdmin, user.id, credential, month)
        break
      case 'budget_suggestions':
        result = await generateBudgetSuggestions(supabaseAdmin, user.id, credential, month)
        break
      default:
        return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('AI insights error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// =============================================
// Resumo Mensal
// =============================================
async function generateMonthlySummary(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  credential: AICredential,
  month?: string
) {
  const now = new Date()
  const targetMonth = month ? new Date(month) : new Date(now.getFullYear(), now.getMonth(), 1)
  const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1)
  const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0)
  const monthStartStr = monthStart.toISOString().split('T')[0]
  const monthEndStr = monthEnd.toISOString().split('T')[0]

  // Mês anterior
  const prevMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() - 1, 1)
  const prevMonthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 0)
  const prevStartStr = prevMonth.toISOString().split('T')[0]
  const prevEndStr = prevMonthEnd.toISOString().split('T')[0]

  // Buscar transações do mês atual
  const { data: currentTxns } = await supabaseAdmin
    .from('fo_transactions')
    .select('amount, type, category_id, description, date')
    .eq('user_id', userId)
    .gte('date', monthStartStr)
    .lte('date', monthEndStr)

  // Buscar transações do mês anterior
  const { data: prevTxns } = await supabaseAdmin
    .from('fo_transactions')
    .select('amount, type, category_id')
    .eq('user_id', userId)
    .gte('date', prevStartStr)
    .lte('date', prevEndStr)

  // Buscar categorias
  const { data: categories } = await supabaseAdmin
    .from('fo_categories')
    .select('id, name')

  const catMap = new Map<string, string>()
  for (const c of categories || []) {
    catMap.set(c.id as string, c.name as string)
  }

  // Agregar dados
  const txns = currentTxns || []
  const totalIncome = txns.filter((t) => t.type === 'income').reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
  const totalExpense = txns.filter((t) => t.type === 'expense').reduce((s, t) => s + Math.abs(Number(t.amount)), 0)

  const prevExpense = (prevTxns || []).filter((t) => t.type === 'expense').reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
  const prevIncome = (prevTxns || []).filter((t) => t.type === 'income').reduce((s, t) => s + Math.abs(Number(t.amount)), 0)

  // Gastos por categoria — mês atual
  const catSpend = new Map<string, number>()
  for (const t of txns.filter((t) => t.type === 'expense')) {
    const name = catMap.get(t.category_id as string) || 'Sem categoria'
    catSpend.set(name, (catSpend.get(name) || 0) + Math.abs(Number(t.amount)))
  }
  const topCategories = Array.from(catSpend.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))

  // Gastos por categoria — mês anterior (para comparação)
  const prevCatSpend = new Map<string, number>()
  for (const t of (prevTxns || []).filter((t) => t.type === 'expense')) {
    const name = catMap.get(t.category_id as string) || 'Sem categoria'
    prevCatSpend.set(name, (prevCatSpend.get(name) || 0) + Math.abs(Number(t.amount)))
  }

  // Comparação por categoria
  const allCatNames = new Set([...catSpend.keys(), ...prevCatSpend.keys()])
  const comparacaoCategorias = Array.from(allCatNames).map((name) => {
    const atual = catSpend.get(name) || 0
    const anterior = prevCatSpend.get(name) || 0
    const variacao = anterior > 0 ? Math.round(((atual - anterior) / anterior) * 10000) / 100 : null
    return { categoria: name, atual: Math.round(atual * 100) / 100, mes_anterior: Math.round(anterior * 100) / 100, variacao_percent: variacao }
  }).filter((c) => c.atual > 0 || c.mes_anterior > 0)

  // Receitas por tipo/descrição
  const incomeDetails = txns
    .filter((t) => t.type === 'income')
    .map((t) => ({ descricao: t.description as string, valor: Math.abs(Number(t.amount)) }))

  // Maior transação
  const biggestTxn = txns
    .filter((t) => t.type === 'expense')
    .sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)))[0]

  // Top 10 transações para contexto
  const topTransacoes = txns
    .sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)))
    .slice(0, 10)
    .map((t) => ({
      descricao: t.description as string,
      valor: Math.abs(Number(t.amount)),
      tipo: t.type as string,
      categoria: catMap.get(t.category_id as string) || 'Sem categoria',
    }))

  // Montar dados para a IA
  const dataForAI = JSON.stringify({
    mes_atual: monthStartStr,
    total_receita: Math.round(totalIncome * 100) / 100,
    total_despesa: Math.round(totalExpense * 100) / 100,
    receita_mes_anterior: Math.round(prevIncome * 100) / 100,
    despesa_mes_anterior: Math.round(prevExpense * 100) / 100,
    variacao_despesa_percent: prevExpense > 0 ? Math.round(((totalExpense - prevExpense) / prevExpense) * 10000) / 100 : null,
    top_categorias: topCategories,
    comparacao_categorias: comparacaoCategorias,
    receitas: incomeDetails,
    top_transacoes: topTransacoes,
    maior_transacao: biggestTxn ? { descricao: biggestTxn.description, valor: Math.abs(Number(biggestTxn.amount)) } : null,
    total_transacoes: txns.length,
  })

  const raw = await callWithRetry(credential, MONTHLY_SUMMARY_PROMPT, dataForAI)
  const parsed = JSON.parse(raw)

  const payload = {
    summary: parsed.summary || '',
    insights: parsed.insights || [],
    highlights: {
      total_income: Math.round(totalIncome * 100) / 100,
      total_expense: Math.round(totalExpense * 100) / 100,
      top_category: topCategories[0] || null,
      vs_previous_month: prevExpense > 0 ? Math.round(((totalExpense - prevExpense) / prevExpense) * 10000) / 100 : null,
      biggest_transaction: biggestTxn ? { description: biggestTxn.description as string, amount: Math.abs(Number(biggestTxn.amount)) } : null,
    },
  }

  // Salvar no cache
  await supabaseAdmin
    .from('fo_ai_insights')
    .upsert(
      {
        user_id: userId,
        insight_type: 'monthly_summary',
        reference_month: monthStartStr,
        payload,
        generated_at: new Date().toISOString(),
        is_stale: false,
      },
      { onConflict: 'user_id,insight_type,reference_month' }
    )

  return { insight_type: 'monthly_summary', month: monthStartStr, payload, generated_at: new Date().toISOString() }
}

// =============================================
// Sugestões de Orçamento
// =============================================
async function generateBudgetSuggestions(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  credential: AICredential,
  month?: string
) {
  const now = new Date()
  const targetMonth = month ? new Date(month) : new Date(now.getFullYear(), now.getMonth(), 1)
  const monthStartStr = targetMonth.toISOString().split('T')[0]

  // 3 meses anteriores
  const threeMonthsAgo = new Date(targetMonth.getFullYear(), targetMonth.getMonth() - 3, 1)
  const prevMonthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 0)

  const { data: txns } = await supabaseAdmin
    .from('fo_transactions')
    .select('amount, type, category_id, date')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('date', threeMonthsAgo.toISOString().split('T')[0])
    .lte('date', prevMonthEnd.toISOString().split('T')[0])

  const { data: categories } = await supabaseAdmin
    .from('fo_categories')
    .select('id, name, icon')

  const catMap = new Map<string, { name: string; icon: string }>()
  for (const c of categories || []) {
    catMap.set(c.id as string, { name: c.name as string, icon: c.icon as string })
  }

  // Agrupar por categoria → média mensal
  const catTotals = new Map<string, number>()
  for (const t of txns || []) {
    const catId = t.category_id || 'uncategorized'
    catTotals.set(catId, (catTotals.get(catId) || 0) + Math.abs(Number(t.amount)))
  }

  const categoryAverages = Array.from(catTotals.entries())
    .map(([catId, total]) => {
      const cat = catMap.get(catId)
      return {
        category_id: catId,
        category_name: cat?.name || 'Outros',
        category_icon: cat?.icon || '📦',
        avg_3_months: Math.round((total / 3) * 100) / 100,
      }
    })
    .filter((c) => c.avg_3_months > 0)
    .sort((a, b) => b.avg_3_months - a.avg_3_months)

  const dataForAI = JSON.stringify({
    periodo: '3 meses',
    categorias: categoryAverages.map((c) => ({
      categoria: c.category_name,
      media_mensal: c.avg_3_months,
    })),
  })

  const raw = await callWithRetry(credential, BUDGET_SUGGESTIONS_PROMPT, dataForAI)
  const parsed = JSON.parse(raw)

  // Enriquecer com category_id e icon
  const suggestions = (parsed.suggestions || []).map((s: { category_name: string; suggested_limit: number; reasoning: string }) => {
    const match = categoryAverages.find((c) => c.category_name === s.category_name)
    return {
      category_id: match?.category_id || null,
      category_name: s.category_name,
      category_icon: match?.category_icon || '📦',
      avg_3_months: match?.avg_3_months || 0,
      suggested_limit: s.suggested_limit,
      reasoning: s.reasoning,
    }
  })

  const payload = { suggestions }

  await supabaseAdmin
    .from('fo_ai_insights')
    .upsert(
      {
        user_id: userId,
        insight_type: 'budget_suggestions',
        reference_month: monthStartStr,
        payload,
        generated_at: new Date().toISOString(),
        is_stale: false,
      },
      { onConflict: 'user_id,insight_type,reference_month' }
    )

  return { insight_type: 'budget_suggestions', month: monthStartStr, payload, generated_at: new Date().toISOString() }
}
