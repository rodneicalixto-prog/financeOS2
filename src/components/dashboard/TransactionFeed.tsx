import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonRow } from '@/components/ui/Skeleton'
import { TransactionItem } from './TransactionItem'
import { useTransactions, type TransactionFilters } from '@/hooks/useTransactions'
import { formatDateRelative } from '@/lib/format'
import type { Transaction } from '@/types'

interface TransactionFeedProps {
  filters?: TransactionFilters
  onEdit?: (transaction: Transaction) => void
}

export function TransactionFeed({ filters, onEdit }: TransactionFeedProps) {
  const [page, setPage] = useState(0)
  const { data, isLoading } = useTransactions(filters, page)

  const transactions = data?.transactions || []
  const totalPages = data?.totalPages || 0

  // Agrupar por data
  const grouped = groupByDate(transactions)

  if (isLoading) {
    return (
      <Card>
        <h3 className="mb-4 text-sm font-medium text-slate-400">Transações</h3>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </Card>
    )
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <EmptyState
          title="Nenhuma transação"
          description="Conecte seu Gmail ou adicione transações manualmente para começar."
        />
      </Card>
    )
  }

  return (
    <Card padding="sm">
      <div className="px-3 py-2">
        <h3 className="text-sm font-medium text-slate-400">
          Transações ({data?.totalCount || 0})
        </h3>
      </div>

      <div className="max-h-[480px] overflow-y-auto divide-y divide-white/5">
        {grouped.map(({ dateLabel, items }) => (
          <div key={dateLabel}>
            <div className="px-3 py-2">
              <p className="text-xs font-medium text-slate-500">{dateLabel}</p>
            </div>
            {items.map((t) => (
              <TransactionItem
                key={t.id}
                transaction={t}
                onClick={() => onEdit?.(t)}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-white/5 px-3 py-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-1 text-sm text-slate-400 hover:text-white disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </button>
          <span className="text-xs text-slate-500">
            {page + 1} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="flex items-center gap-1 text-sm text-slate-400 hover:text-white disabled:opacity-30"
          >
            Próxima
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </Card>
  )
}

type TransactionWithCategory = Transaction & {
  categories: { name: string; icon: string } | null
  tags?: { tag: { id: string; name: string } }[]
}

function groupByDate(transactions: TransactionWithCategory[]) {
  const map = new Map<string, TransactionWithCategory[]>()

  for (const t of transactions) {
    const label = formatDateRelative(t.date)
    const group = map.get(label) || []
    group.push(t)
    map.set(label, group)
  }

  return Array.from(map.entries()).map(([dateLabel, items]) => ({
    dateLabel,
    items,
  }))
}
