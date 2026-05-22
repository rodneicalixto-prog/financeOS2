import { Sparkles, RefreshCw, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useMonthlySummary, useGenerateInsight } from '@/hooks/useAIInsights'
import { useAIConfig } from '@/hooks/useAIConfig'
import { formatBRL, formatDateRelative } from '@/lib/format'

interface InsightItem {
  emoji: string
  text: string
}

export function AISummaryCard() {
  const { data: aiConfig } = useAIConfig()
  const { data: insight, isLoading } = useMonthlySummary()
  const generate = useGenerateInsight()

  const payload = insight?.payload as {
    summary: string
    insights?: InsightItem[]
    highlights: {
      total_income: number
      total_expense: number
      top_category: { name: string; amount: number } | null
      vs_previous_month: number | null
      biggest_transaction: { description: string; amount: number } | null
    }
  } | undefined

  function handleGenerate() {
    generate.mutate({ functionName: 'ai-insights', action: 'monthly_summary', force: true })
  }

  if (isLoading) {
    return (
      <Card>
        <div className="space-y-3">
          <div className="skeleton h-5 w-48" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-3/4" />
          <div className="skeleton h-4 w-1/2" />
        </div>
      </Card>
    )
  }

  // Sem chave de IA configurada
  if (!aiConfig) {
    return (
      <Card>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent-purple" />
          <h3 className="text-sm font-semibold text-white">Resumo do Mês</h3>
        </div>
        <p className="mt-3 text-sm text-slate-400">
          Configure sua chave de IA em <strong className="text-slate-300">Configurações → IA</strong> para
          gerar resumos inteligentes das suas finanças.
        </p>
      </Card>
    )
  }

  // Sem insight gerado ainda
  if (!payload) {
    return (
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent-purple" />
            <h3 className="text-sm font-semibold text-white">Resumo do Mês</h3>
          </div>
          <Button size="sm" variant="secondary" onClick={handleGenerate} loading={generate.isPending}>
            <Sparkles className="h-3.5 w-3.5" />
            Gerar resumo
          </Button>
        </div>
        <p className="mt-3 text-sm text-slate-400">
          Clique em "Gerar resumo" para a IA analisar suas finanças do mês.
        </p>
      </Card>
    )
  }

  const insights = payload.insights || []

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent-purple" />
          <h3 className="text-sm font-semibold text-white">Resumo do Mês</h3>
        </div>
        <Button size="sm" variant="secondary" onClick={handleGenerate} loading={generate.isPending}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Resumo em linguagem natural */}
      <p className="mt-3 text-sm leading-relaxed text-slate-300">
        {payload.summary}
      </p>

      {/* Highlights */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-surface-light/50 p-2">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <ArrowDownLeft className="h-3 w-3 text-accent-green" />
            Receita
          </div>
          <p className="text-sm font-semibold text-accent-green">
            {formatBRL(payload.highlights.total_income)}
          </p>
        </div>
        <div className="rounded-lg bg-surface-light/50 p-2">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <ArrowUpRight className="h-3 w-3 text-accent-red" />
            Despesa
          </div>
          <p className="text-sm font-semibold text-accent-red">
            {formatBRL(payload.highlights.total_expense)}
          </p>
        </div>
      </div>

      {payload.highlights.vs_previous_month !== null && (
        <p className="mt-2 text-xs text-slate-500">
          {payload.highlights.vs_previous_month > 0
            ? `↑ ${payload.highlights.vs_previous_month.toFixed(1)}% vs mês anterior`
            : `↓ ${Math.abs(payload.highlights.vs_previous_month).toFixed(1)}% vs mês anterior`}
        </p>
      )}

      {/* Insights da IA */}
      {insights.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-white/5 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Insights</p>
          {insights.map((item, i) => (
            <div key={i} className="flex gap-2 rounded-lg bg-surface-light/30 px-3 py-2">
              <span className="shrink-0 text-base">{item.emoji}</span>
              <p className="text-sm text-slate-300">{item.text}</p>
            </div>
          ))}
        </div>
      )}

      {insight?.generated_at && (
        <p className="mt-3 text-xs text-slate-600">
          Gerado em {formatDateRelative(insight.generated_at)}
        </p>
      )}
    </Card>
  )
}
