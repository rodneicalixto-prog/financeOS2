import { useState } from 'react'
import { TrendingUp, AlertTriangle, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useSpendingForecast, useGenerateInsight } from '@/hooks/useAIInsights'
import { formatBRL } from '@/lib/format'

interface CategoryForecast {
  category_name: string
  category_icon: string
  spent_so_far: number
  projected: number
  budget_limit: number | null
  will_exceed: boolean
}

export function ForecastCard() {
  const { data: insight, isLoading } = useSpendingForecast()
  const generate = useGenerateInsight()
  const [showCategories, setShowCategories] = useState(false)

  const payload = insight?.payload as {
    days_elapsed: number
    days_remaining: number
    total_spent_so_far: number
    total_income_so_far: number
    daily_rate: number
    projected_total: number
    total_budget_limit: number | null
    will_exceed_budget: boolean
    per_category: CategoryForecast[]
  } | undefined

  function handleRefresh() {
    generate.mutate({ functionName: 'compute-insights', action: 'forecast' })
  }

  if (isLoading) {
    return (
      <Card>
        <div className="space-y-3">
          <div className="skeleton h-5 w-40" />
          <div className="skeleton h-8 w-48" />
          <div className="skeleton h-3 w-full rounded-full" />
          <div className="skeleton h-4 w-32" />
        </div>
      </Card>
    )
  }

  if (!payload) {
    return (
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-accent-blue" />
            <h3 className="text-sm font-semibold text-white">Previsão de Gastos</h3>
          </div>
          <Button size="sm" variant="secondary" onClick={handleRefresh} loading={generate.isPending}>
            <RefreshCw className="h-3.5 w-3.5" />
            Calcular
          </Button>
        </div>
        <p className="mt-3 text-sm text-slate-400">
          Sincronize seus emails para gerar a previsão de gastos do mês.
        </p>
      </Card>
    )
  }

  const progressPercent = payload.total_budget_limit
    ? Math.min((payload.total_spent_so_far / payload.total_budget_limit) * 100, 100)
    : payload.projected_total > 0
      ? Math.min((payload.total_spent_so_far / payload.projected_total) * 100, 100)
      : 0

  const fewDays = payload.days_elapsed < 5

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-accent-blue" />
          <h3 className="text-sm font-semibold text-white">Previsão de Gastos</h3>
        </div>
        <Button size="sm" variant="secondary" onClick={handleRefresh} loading={generate.isPending}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {/* Projeção principal */}
        <div>
          <p className="text-2xl font-bold text-white">
            {formatBRL(payload.projected_total)}
            {payload.will_exceed_budget && (
              <AlertTriangle className="ml-2 inline h-5 w-5 text-accent-red" />
            )}
          </p>
          <p className="text-xs text-slate-400">
            Projeção para o mês ({payload.days_elapsed} dias corridos, {payload.days_remaining} restantes)
          </p>
        </div>

        {/* Barra de progresso */}
        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-400">
            <span>Gasto atual: {formatBRL(payload.total_spent_so_far)}</span>
            {payload.total_budget_limit && (
              <span>Orçamento: {formatBRL(payload.total_budget_limit)}</span>
            )}
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-light">
            <div
              className={`h-full rounded-full transition-all ${
                payload.will_exceed_budget ? 'bg-accent-red' : 'bg-accent-blue'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Métricas resumidas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-surface-light/50 p-2">
            <p className="text-xs text-slate-500">Taxa diária</p>
            <p className="text-sm font-semibold text-white">{formatBRL(payload.daily_rate)}/dia</p>
          </div>
          <div className="rounded-lg bg-surface-light/50 p-2">
            <p className="text-xs text-slate-500">Receita no mês</p>
            <p className="text-sm font-semibold text-accent-green">{formatBRL(payload.total_income_so_far)}</p>
          </div>
        </div>

        {fewDays && (
          <p className="text-xs text-accent-yellow">
            Poucos dias para projeção precisa. A estimativa ficará mais confiável ao longo do mês.
          </p>
        )}

        {/* Breakdown por categoria */}
        {payload.per_category.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowCategories(!showCategories)}
              className="flex items-center gap-1 text-xs font-medium text-slate-400 transition-colors hover:text-white"
            >
              {showCategories ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Por categoria ({payload.per_category.length})
            </button>

            {showCategories && (
              <div className="mt-2 space-y-1.5">
                {payload.per_category.map((cat) => (
                  <div key={cat.category_name} className="flex items-center gap-2 text-sm">
                    <span className="text-base">{cat.category_icon}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-300">{cat.category_name}</span>
                    <span className="shrink-0 text-white">{formatBRL(cat.spent_so_far)}</span>
                    {cat.will_exceed && (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-accent-red" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
