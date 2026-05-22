import { useMemo } from 'react'
import type { Transaction } from '@/types'

interface DashboardMetrics {
  balance: number
  income: number
  expense: number
  comparisonPercent: number | null
}

export function useDashboardMetrics(
  transactions: (Transaction & { categories: { name: string; icon: string } | null })[],
  previousTransactions: (Transaction & { categories: { name: string; icon: string } | null })[] = [],
  initialBalances = 0
): DashboardMetrics {
  return useMemo(() => {
    const income = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const expense = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const balance = initialBalances + income - expense

    // Comparativo com período anterior
    let comparisonPercent: number | null = null
    if (previousTransactions.length > 0) {
      const prevExpense = previousTransactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount), 0)

      if (prevExpense > 0) {
        comparisonPercent = ((expense - prevExpense) / prevExpense) * 100
      }
    }

    return { balance, income, expense, comparisonPercent }
  }, [transactions, previousTransactions, initialBalances])
}
