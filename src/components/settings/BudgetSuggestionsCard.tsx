import { useState } from 'react'
import { Lightbulb, Check, RefreshCw, Sparkles } from 'lucide-react'
import { startOfMonth, format } from 'date-fns'
import { useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useBudgetSuggestions, useGenerateInsight } from '@/hooks/useAIInsights'
import { useAIConfig } from '@/hooks/useAIConfig'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/format'

interface Suggestion {
  category_id: string | null
  category_name: string
  category_icon: string
  avg_3_months: number
  suggested_limit: number
  reasoning: string
}

export function BudgetSuggestionsCard() {
  const { user } = useAuth()
  const { data: aiConfig } = useAIConfig()
  const { data: insight, isLoading } = useBudgetSuggestions()
  const generate = useGenerateInsight()
  const queryClient = useQueryClient()
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())
  const [applying, setApplying] = useState(false)

  const currentMonth = format(startOfMonth(new Date()), 'yyyy-MM-dd')

  const payload = insight?.payload as { suggestions: Suggestion[] } | undefined
  const suggestions = payload?.suggestions || []

  if (!aiConfig) return null

  function handleGenerate() {
    generate.mutate({ functionName: 'ai-insights', action: 'budget_suggestions', force: true })
  }

  async function handleApply(suggestion: Suggestion) {
    if (!user || !suggestion.category_id) return
    setApplying(true)
    try {
      await supabase.from('fo_budgets').upsert(
        {
          user_id: user.id,
          category_id: suggestion.category_id,
          month: currentMonth,
          amount_limit: suggestion.suggested_limit,
        },
        { onConflict: 'user_id,category_id,month' }
      )
      setAppliedIds((prev) => new Set(prev).add(suggestion.category_id!))
      await queryClient.invalidateQueries({ queryKey: ['budgets'] })
    } finally {
      setApplying(false)
    }
  }

  async function handleApplyAll() {
    if (!user) return
    setApplying(true)
    try {
      for (const s of suggestions) {
        if (!s.category_id || appliedIds.has(s.category_id)) continue
        await supabase.from('fo_budgets').upsert(
          {
            user_id: user.id,
            category_id: s.category_id,
            month: currentMonth,
            amount_limit: s.suggested_limit,
          },
          { onConflict: 'user_id,category_id,month' }
        )
        setAppliedIds((prev) => new Set(prev).add(s.category_id!))
      }
      await queryClient.invalidateQueries({ queryKey: ['budgets'] })
    } finally {
      setApplying(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <div className="space-y-3">
          <div className="skeleton h-5 w-48" />
          <div className="skeleton h-12 w-full" />
          <div className="skeleton h-12 w-full" />
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-accent-yellow" />
          <h4 className="text-sm font-semibold text-white">Sugestões da IA</h4>
        </div>
        <div className="flex gap-2">
          {suggestions.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleApplyAll}
              loading={applying}
              disabled={suggestions.every((s) => !s.category_id || appliedIds.has(s.category_id))}
            >
              <Check className="h-3.5 w-3.5" />
              Aplicar todas
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={handleGenerate} loading={generate.isPending}>
            {suggestions.length > 0 ? <RefreshCw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
            {suggestions.length > 0 ? '' : 'Gerar sugestões'}
          </Button>
        </div>
      </div>

      {suggestions.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">
          Clique em "Gerar sugestões" para a IA analisar seus gastos e sugerir limites por categoria.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {suggestions.map((s) => {
            const isApplied = s.category_id ? appliedIds.has(s.category_id) : false
            return (
              <div
                key={s.category_name}
                className={`flex items-center gap-3 rounded-lg border p-3 ${
                  isApplied
                    ? 'border-accent-green/20 bg-accent-green/5'
                    : 'border-white/5 bg-surface-light/30'
                }`}
              >
                <span className="text-lg">{s.category_icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-medium text-white">{s.category_name}</p>
                    <span className="text-xs text-slate-500">média: {formatBRL(s.avg_3_months)}/mês</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">{s.reasoning}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-accent-yellow">{formatBRL(s.suggested_limit)}</p>
                  {s.category_id && !isApplied && (
                    <button
                      onClick={() => handleApply(s)}
                      disabled={applying}
                      className="mt-1 text-xs font-medium text-accent-blue transition-colors hover:text-blue-300"
                    >
                      Aplicar
                    </button>
                  )}
                  {isApplied && (
                    <span className="mt-1 flex items-center gap-0.5 text-xs text-accent-green">
                      <Check className="h-3 w-3" /> Aplicado
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
