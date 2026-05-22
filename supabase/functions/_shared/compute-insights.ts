import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

interface ForecastPayload {
  days_elapsed: number
  days_remaining: number
  total_spent_so_far: number
  total_income_so_far: number
  daily_rate: number
  projected_total: number
  total_budget_limit: number | null
  will_exceed_budget: boolean
  per_category: Array<{
    category_name: string
    category_icon: string
    spent_so_far: number
    projected: number
    budget_limit: number | null
    will_exceed: boolean
  }>
}

interface AnomalyItem {
  transaction_id: string
  description: string
  amount: number
  date: string
  category_name: string
  category_avg_monthly: number
  deviation_factor: number
  reason: string
}

interface AnomaliesPayload {
  anomalies: AnomalyItem[]
  alerts_created: number
}

// =============================================
// Previsão de Gastos
// =============================================
export async function computeForecast(
  supabaseAdmin: SupabaseClient,
  userId: string,
  month?: string
): Promise<ForecastPayload> {
  const now = new Date()
  const targetMonth = month ? new Date(month) : new Date(now.getFullYear(), now.getMonth(), 1)
  const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1)
  const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0)

  const monthStartStr = monthStart.toISOString().split('T')[0]
  const monthEndStr = monthEnd.toISOString().split('T')[0]

  // Buscar transações do mês
  const { data: txns } = await supabaseAdmin
    .from('fo_transactions')
    .select('amount, type, category_id, date')
    .eq('user_id', userId)
    .gte('date', monthStartStr)
    .lte('date', monthEndStr)

  const transactions = txns || []

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)

  // Dias decorridos e restantes
  const today = now.getDate()
  const daysInMonth = monthEnd.getDate()
  const daysElapsed = Math.min(today, daysInMonth)
  const daysRemaining = Math.max(daysInMonth - daysElapsed, 0)

  const dailyRate = daysElapsed > 0 ? totalExpense / daysElapsed : 0
  const projectedTotal = totalExpense + dailyRate * daysRemaining

  // Buscar budgets do mês
  const { data: budgets } = await supabaseAdmin
    .from('fo_budgets')
    .select('category_id, amount_limit')
    .eq('user_id', userId)
    .eq('month', monthStartStr)

  const budgetMap = new Map<string, number>()
  let totalBudgetLimit: number | null = null
  if (budgets && budgets.length > 0) {
    totalBudgetLimit = 0
    for (const b of budgets) {
      budgetMap.set(b.category_id, Number(b.amount_limit))
      totalBudgetLimit += Number(b.amount_limit)
    }
  }

  // Buscar categorias
  const { data: categories } = await supabaseAdmin
    .from('fo_categories')
    .select('id, name, icon')

  const catMap = new Map<string, { name: string; icon: string }>()
  for (const c of categories || []) {
    catMap.set(c.id, { name: c.name as string, icon: c.icon as string })
  }

  // Gastos por categoria
  const categorySpend = new Map<string, number>()
  for (const t of transactions.filter((t) => t.type === 'expense')) {
    const catId = t.category_id || 'uncategorized'
    categorySpend.set(catId, (categorySpend.get(catId) || 0) + Math.abs(Number(t.amount)))
  }

  const perCategory = Array.from(categorySpend.entries()).map(([catId, spent]) => {
    const cat = catMap.get(catId)
    const budgetLimit = budgetMap.get(catId) || null
    const catDailyRate = daysElapsed > 0 ? spent / daysElapsed : 0
    const projected = spent + catDailyRate * daysRemaining
    return {
      category_name: cat?.name || 'Outros',
      category_icon: cat?.icon || '📦',
      spent_so_far: spent,
      projected,
      budget_limit: budgetLimit,
      will_exceed: budgetLimit ? projected > budgetLimit : false,
    }
  }).sort((a, b) => b.spent_so_far - a.spent_so_far)

  const payload: ForecastPayload = {
    days_elapsed: daysElapsed,
    days_remaining: daysRemaining,
    total_spent_so_far: totalExpense,
    total_income_so_far: totalIncome,
    daily_rate: Math.round(dailyRate * 100) / 100,
    projected_total: Math.round(projectedTotal * 100) / 100,
    total_budget_limit: totalBudgetLimit,
    will_exceed_budget: totalBudgetLimit ? projectedTotal > totalBudgetLimit : false,
    per_category: perCategory,
  }

  // Salvar no cache
  await supabaseAdmin
    .from('fo_ai_insights')
    .upsert(
      {
        user_id: userId,
        insight_type: 'forecast',
        reference_month: monthStartStr,
        payload,
        generated_at: new Date().toISOString(),
        is_stale: false,
      },
      { onConflict: 'user_id,insight_type,reference_month' }
    )

  return payload
}

// =============================================
// Detecção de Anomalias
// =============================================
export async function computeAnomalies(
  supabaseAdmin: SupabaseClient,
  userId: string,
  month?: string
): Promise<AnomaliesPayload> {
  const now = new Date()
  const targetMonth = month ? new Date(month) : new Date(now.getFullYear(), now.getMonth(), 1)
  const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1)
  const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0)

  // 3 meses anteriores para calcular média/desvio
  const threeMonthsAgo = new Date(targetMonth.getFullYear(), targetMonth.getMonth() - 3, 1)
  const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0]
  const prevMonthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 0)
  const prevMonthEndStr = prevMonthEnd.toISOString().split('T')[0]

  const monthStartStr = monthStart.toISOString().split('T')[0]
  const monthEndStr = monthEnd.toISOString().split('T')[0]

  // Buscar categorias
  const { data: categories } = await supabaseAdmin
    .from('fo_categories')
    .select('id, name, icon')

  const catMap = new Map<string, { name: string; icon: string }>()
  for (const c of categories || []) {
    catMap.set(c.id, { name: c.name as string, icon: c.icon as string })
  }

  // Buscar transações históricas (3 meses anteriores)
  const { data: historicalTxns } = await supabaseAdmin
    .from('fo_transactions')
    .select('amount, type, category_id, date')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('date', threeMonthsAgoStr)
    .lte('date', prevMonthEndStr)

  // Agrupar historial por categoria por mês
  const categoryMonthly = new Map<string, number[]>()
  for (const t of historicalTxns || []) {
    const catId = t.category_id || 'uncategorized'
    const monthKey = (t.date as string).substring(0, 7) // YYYY-MM
    const key = `${catId}::${monthKey}`
    if (!categoryMonthly.has(catId)) categoryMonthly.set(catId, [])

    // Precisamos agrupar por mês antes de agregar
    const existing = categoryMonthly.get(catId)!
    // Buscar ou criar entry para o mês
    const monthIdx = getMonthIndex(t.date as string, threeMonthsAgo)
    while (existing.length <= monthIdx) existing.push(0)
    existing[monthIdx] += Math.abs(Number(t.amount))
  }

  // Calcular média e desvio padrão por categoria
  const categoryStats = new Map<string, { mean: number; stddev: number }>()
  for (const [catId, months] of categoryMonthly) {
    // Preencher meses sem dados com 0
    while (months.length < 3) months.push(0)
    const mean = months.reduce((s, v) => s + v, 0) / months.length
    const variance = months.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / months.length
    const stddev = Math.sqrt(variance)
    categoryStats.set(catId, { mean, stddev })
  }

  // Buscar transações do mês atual
  const { data: currentTxns } = await supabaseAdmin
    .from('fo_transactions')
    .select('id, amount, type, category_id, description, date')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('date', monthStartStr)
    .lte('date', monthEndStr)

  // Valor absoluto mínimo para flaggar como anomalia quando não há histórico
  const ABSOLUTE_THRESHOLD = 500

  const anomalies: AnomalyItem[] = []

  for (const t of currentTxns || []) {
    const catId = t.category_id || 'uncategorized'
    const stats = categoryStats.get(catId)
    const amount = Math.abs(Number(t.amount))
    const cat = catMap.get(catId)

    if (stats && stats.mean > 0) {
      // COM histórico: transação individual > 50% da média mensal da categoria
      if (amount > stats.mean * 0.5) {
        const factor = Math.round((amount / stats.mean) * 10) / 10
        anomalies.push({
          transaction_id: t.id as string,
          description: t.description as string,
          amount,
          date: t.date as string,
          category_name: cat?.name || 'Outros',
          category_avg_monthly: Math.round(stats.mean * 100) / 100,
          deviation_factor: factor,
          reason: `Gasto de R$${amount.toFixed(2)} representa ${(factor * 100).toFixed(0)}% da média mensal de ${cat?.name || 'Outros'} (R$${stats.mean.toFixed(2)})`,
        })
      }
    } else if (amount >= ABSOLUTE_THRESHOLD) {
      // SEM histórico: flaggar transações acima do threshold absoluto
      anomalies.push({
        transaction_id: t.id as string,
        description: t.description as string,
        amount,
        date: t.date as string,
        category_name: cat?.name || 'Outros',
        category_avg_monthly: 0,
        deviation_factor: 0,
        reason: `Gasto de R$${amount.toFixed(2)} em ${cat?.name || 'Outros'} — sem histórico anterior para comparação`,
      })
    }
  }

  // Criar alertas para anomalias encontradas
  let alertsCreated = 0
  for (const anomaly of anomalies) {
    // Verificar se alerta já existe para esta transação
    const { data: existing } = await supabaseAdmin
      .from('fo_alerts')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'anomaly_detected')
      .contains('metadata', { transaction_id: anomaly.transaction_id })
      .maybeSingle()

    if (!existing) {
      await supabaseAdmin.from('fo_alerts').insert({
        user_id: userId,
        type: 'anomaly_detected',
        message: anomaly.reason,
        is_read: false,
        metadata: {
          transaction_id: anomaly.transaction_id,
          amount: anomaly.amount,
          category_name: anomaly.category_name,
          deviation_factor: anomaly.deviation_factor,
        },
      })
      alertsCreated++
    }
  }

  const payload: AnomaliesPayload = { anomalies, alerts_created: alertsCreated }

  // Salvar no cache
  await supabaseAdmin
    .from('fo_ai_insights')
    .upsert(
      {
        user_id: userId,
        insight_type: 'anomalies',
        reference_month: monthStartStr,
        payload,
        generated_at: new Date().toISOString(),
        is_stale: false,
      },
      { onConflict: 'user_id,insight_type,reference_month' }
    )

  return payload
}

// =============================================
// Utility
// =============================================
function getMonthIndex(dateStr: string, startDate: Date): number {
  const d = new Date(dateStr)
  return (d.getFullYear() - startDate.getFullYear()) * 12 + (d.getMonth() - startDate.getMonth())
}

// =============================================
// Compute all math insights
// =============================================
export async function computeAllMathInsights(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<void> {
  await Promise.all([
    computeForecast(supabaseAdmin, userId),
    computeAnomalies(supabaseAdmin, userId),
  ])
}
