import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CATEGORY_COLORS } from '@/lib/constants'
import type { Transaction } from '@/types'

type TransactionWithCategory = Transaction & {
  categories: { name: string; icon: string } | null
}

export interface CategoryChartItem {
  name: string
  value: number
  icon: string
  color: string
}

export interface IncomeExpenseItem {
  name: string
  value: number
  color: string
}

export interface PeriodBarItem {
  period: string
  income: number
  expense: number
}

export interface CategoryBarItem {
  name: string
  value: number
  color: string
}

export function useChartData(transactions: TransactionWithCategory[]) {
  const expensesByCategory = useMemo((): CategoryChartItem[] => {
    const map = new Map<string, { value: number; icon: string }>()

    transactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const catName = t.categories?.name || 'Outros'
        const catIcon = t.categories?.icon || '📦'
        const existing = map.get(catName) || { value: 0, icon: catIcon }
        existing.value += Number(t.amount)
        map.set(catName, existing)
      })

    return Array.from(map.entries())
      .map(([name, { value, icon }]) => ({
        name,
        value,
        icon,
        color: CATEGORY_COLORS[name] || '#64748b',
      }))
      .sort((a, b) => b.value - a.value)
  }, [transactions])

  const incomeVsExpense = useMemo((): IncomeExpenseItem[] => {
    const income = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const expense = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0)

    return [
      { name: 'Receita', value: income, color: '#22c55e' },
      { name: 'Despesa', value: expense, color: '#ef4444' },
    ]
  }, [transactions])

  const revenueExpenseByPeriod = useMemo((): PeriodBarItem[] => {
    const map = new Map<string, { income: number; expense: number }>()

    transactions.forEach((t) => {
      if (t.type === 'transfer') return
      const period = format(parseISO(t.date), 'MMM/yy', { locale: ptBR })
      const existing = map.get(period) || { income: 0, expense: 0 }
      if (t.type === 'income') existing.income += Number(t.amount)
      if (t.type === 'expense') existing.expense += Number(t.amount)
      map.set(period, existing)
    })

    return Array.from(map.entries()).map(([period, data]) => ({
      period,
      ...data,
    }))
  }, [transactions])

  const expensesByCategoryBar = useMemo((): CategoryBarItem[] => {
    return expensesByCategory.map(({ name, value, color }) => ({
      name,
      value,
      color,
    }))
  }, [expensesByCategory])

  return {
    expensesByCategory,
    incomeVsExpense,
    revenueExpenseByPeriod,
    expensesByCategoryBar,
  }
}
