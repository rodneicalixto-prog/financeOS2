import { useState } from 'react'
import clsx from 'clsx'
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfYear, endOfYear,
  format,
} from 'date-fns'

type PeriodOption = 'today' | 'week' | 'month' | 'year' | 'custom'

interface PeriodFilterProps {
  onChange: (dateFrom: string, dateTo: string) => void
}

const periods: { key: PeriodOption; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
  { key: 'year', label: 'Ano' },
  { key: 'custom', label: 'Custom' },
]

function formatISO(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function PeriodFilter({ onChange }: PeriodFilterProps) {
  const [active, setActive] = useState<PeriodOption>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  function handleSelect(period: PeriodOption) {
    setActive(period)
    const now = new Date()

    switch (period) {
      case 'today':
        onChange(formatISO(startOfDay(now)), formatISO(endOfDay(now)))
        break
      case 'week':
        onChange(formatISO(startOfWeek(now, { weekStartsOn: 1 })), formatISO(endOfWeek(now, { weekStartsOn: 1 })))
        break
      case 'month':
        onChange(formatISO(startOfMonth(now)), formatISO(endOfMonth(now)))
        break
      case 'year':
        onChange(formatISO(startOfYear(now)), formatISO(endOfYear(now)))
        break
      case 'custom':
        break
    }
  }

  function handleCustomApply() {
    if (customFrom && customTo) {
      onChange(customFrom, customTo)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {periods.map((p) => (
        <button
          key={p.key}
          onClick={() => handleSelect(p.key)}
          className={clsx(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            active === p.key
              ? 'bg-accent-blue/20 text-accent-blue'
              : 'text-slate-400 hover:bg-white/5 hover:text-white'
          )}
        >
          {p.label}
        </button>
      ))}

      {active === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="glass-input px-2 py-1 text-sm"
          />
          <span className="text-slate-500">—</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="glass-input px-2 py-1 text-sm"
          />
          <button
            onClick={handleCustomApply}
            className="rounded-lg bg-accent-blue/20 px-3 py-1.5 text-sm text-accent-blue hover:bg-accent-blue/30"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  )
}
