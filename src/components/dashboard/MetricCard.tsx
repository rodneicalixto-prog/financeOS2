import type { ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatBRL, formatPercent } from '@/lib/format'

interface MetricCardProps {
  title: string
  value: number
  icon: ReactNode
  comparison?: number | null
  loading?: boolean
  variant?: 'default' | 'income' | 'expense' | 'balance'
  formatAsCurrency?: boolean
}

const variantColors = {
  default: 'text-white',
  income: 'text-accent-green',
  expense: 'text-accent-red',
  balance: 'text-white',
}

function getValueColor(variant: MetricCardProps['variant'], value: number): string {
  if (variant === 'balance') {
    if (value > 0) return 'text-accent-green'
    if (value < 0) return 'text-accent-red'
    return 'text-white'
  }
  return variantColors[variant || 'default']
}

export function MetricCard({ title, value, icon, comparison, loading, variant = 'default', formatAsCurrency = true }: MetricCardProps) {
  if (loading) {
    return (
      <Card>
        <Skeleton className="h-4 w-24 mb-3" />
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-3 w-16" />
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex items-start justify-between mb-4">
        <p className="text-label-upper">{title}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[rgba(59,130,246,0.1)] text-accent-blue-light ring-1 ring-[rgba(59,130,246,0.2)]">
          {icon}
        </div>
      </div>
      <p className={`metric-value ${getValueColor(variant, value)}`}>
        {formatAsCurrency ? formatBRL(value) : value}
      </p>
      {comparison != null && (
        <div className="mt-3 flex items-center gap-1.5">
          {comparison >= 0 ? (
            <TrendingUp className="h-3.5 w-3.5 text-accent-red" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-accent-green" />
          )}
          <span className={`text-xs font-medium ${comparison >= 0 ? 'text-accent-red' : 'text-accent-green'}`}>
            {formatPercent(comparison)} vs mês anterior
          </span>
        </div>
      )}
    </Card>
  )
}
