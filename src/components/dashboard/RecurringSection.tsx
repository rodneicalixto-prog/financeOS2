import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useRecurringTransactions } from '@/hooks/useRecurring'
import { formatBRL } from '@/lib/format'

export function RecurringSection() {
  const { data: recurring, isLoading } = useRecurringTransactions()

  const totalMonthly = (recurring || []).reduce((sum, r) => sum + r.avgAmount, 0)

  if (isLoading) {
    return (
      <Card>
        <h3 className="mb-4 text-sm font-medium text-slate-400">Assinaturas Recorrentes</h3>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    )
  }

  if (!recurring || recurring.length === 0) {
    return (
      <Card>
        <h3 className="mb-4 text-sm font-medium text-slate-400">Assinaturas Recorrentes</h3>
        <EmptyState
          title="Nenhuma assinatura detectada"
          description="Assinaturas recorrentes serão identificadas automaticamente."
        />
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-400">Assinaturas Recorrentes</h3>
        <p className="text-sm font-semibold text-accent-red">
          {formatBRL(totalMonthly)}/mês
        </p>
      </div>

      <div className="space-y-2">
        {recurring.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/5 transition-colors"
          >
            <span className="text-lg">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-slate-200">
                {item.description}
              </p>
              <p className="text-xs text-slate-500">
                {item.count} ocorrência{item.count !== 1 ? 's' : ''}
              </p>
            </div>
            <p className="text-sm font-medium text-slate-300">
              {formatBRL(item.avgAmount)}
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}
