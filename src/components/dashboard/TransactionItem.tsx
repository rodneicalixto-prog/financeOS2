import clsx from 'clsx'
import { formatBRL, formatDate } from '@/lib/format'
import type { Transaction } from '@/types'

interface TransactionItemProps {
  transaction: Transaction & {
    categories: { name: string; icon: string } | null
    tags?: { tag: { id: string; name: string } }[]
  }
  onClick?: () => void
}

export function TransactionItem({ transaction, onClick }: TransactionItemProps) {
  const isIncome = transaction.type === 'income'
  const isTransfer = transaction.type === 'transfer'

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-white/5"
    >
      {/* Category Icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-light text-lg">
        {transaction.categories?.icon || '📦'}
      </div>

      {/* Description */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-200">
          {transaction.description}
        </p>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>{formatDate(transaction.date)}</span>
          {transaction.categories && (
            <>
              <span>·</span>
              <span>{transaction.categories.name}</span>
            </>
          )}
          {transaction.is_recurring && (
            <>
              <span>·</span>
              <span className="text-accent-cyan">Recorrente</span>
            </>
          )}
        </div>
        {transaction.tags && transaction.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {transaction.tags.map(({ tag }) => (
              <span
                key={tag.id}
                className="rounded-full bg-accent-blue/10 px-2 py-0.5 text-[10px] font-medium text-accent-blue"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Amount */}
      <div className="text-right">
        <p
          className={clsx(
            'text-sm font-semibold',
            isIncome && 'text-accent-green',
            !isIncome && !isTransfer && 'text-accent-red',
            isTransfer && 'text-slate-400'
          )}
        >
          {isIncome ? '+' : isTransfer ? '' : '-'}{formatBRL(Number(transaction.amount))}
        </p>
        <span
          className={clsx(
            'text-xs',
            transaction.status === 'confirmed' ? 'text-accent-green' : 'text-accent-yellow'
          )}
        >
          {transaction.status === 'confirmed' ? 'Confirmada' : 'Pendente'}
        </span>
      </div>
    </button>
  )
}
