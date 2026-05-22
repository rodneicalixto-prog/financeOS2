import { useMemo, useState } from 'react'
import { Wallet, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react'
import { startOfMonth, endOfMonth, format, subMonths } from 'date-fns'
import { useAllTransactions } from '@/hooks/useTransactions'
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'
import { useChartData } from '@/hooks/useChartData'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { PeriodFilter } from '@/components/dashboard/PeriodFilter'
import { BankAccountCards } from '@/components/dashboard/BankAccountCards'
import { ExpensesByCategoryChart } from '@/components/dashboard/ExpensesByCategoryChart'
import { IncomeVsExpenseChart } from '@/components/dashboard/IncomeVsExpenseChart'
import { RevenueExpenseBarChart } from '@/components/dashboard/RevenueExpenseBarChart'
import { ExpensesCategoryBarChart } from '@/components/dashboard/ExpensesCategoryBarChart'
import { TransactionFeed } from '@/components/dashboard/TransactionFeed'
import { RecurringSection } from '@/components/dashboard/RecurringSection'
import { AIConfigBanner } from '@/components/dashboard/AIConfigBanner'
import { GmailConnectionBanner } from '@/components/dashboard/GmailConnectionBanner'
import { AISummaryCard } from '@/components/dashboard/AISummaryCard'
import { ForecastCard } from '@/components/dashboard/ForecastCard'
import { Select } from '@/components/ui/Select'

function formatISO(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function DashboardPage() {
  const now = new Date()
  const [dateFrom, setDateFrom] = useState(formatISO(startOfMonth(now)))
  const [dateTo, setDateTo] = useState(formatISO(endOfMonth(now)))
  const [selectedBankId, setSelectedBankId] = useState('')

  const prevMonth = subMonths(now, 1)
  const prevFrom = formatISO(startOfMonth(prevMonth))
  const prevTo = formatISO(endOfMonth(prevMonth))

  const { data: allTransactions, isLoading } = useAllTransactions({ dateFrom, dateTo })
  const { data: allPrevTransactions } = useAllTransactions({ dateFrom: prevFrom, dateTo: prevTo })
  const { data: bankAccounts } = useBankAccounts()

  // Filtrar transações por conta bancária selecionada
  const transactions = useMemo(() => {
    if (!allTransactions) return []
    if (!selectedBankId) return allTransactions
    return allTransactions.filter((t) => t.bank_account_id === selectedBankId)
  }, [allTransactions, selectedBankId])

  const prevTransactions = useMemo(() => {
    if (!allPrevTransactions) return []
    if (!selectedBankId) return allPrevTransactions
    return allPrevTransactions.filter((t) => t.bank_account_id === selectedBankId)
  }, [allPrevTransactions, selectedBankId])

  const initialBalances = useMemo(() => {
    if (!bankAccounts) return 0
    if (selectedBankId) {
      const account = bankAccounts.find((a) => a.id === selectedBankId)
      return account ? Number(account.initial_balance) : 0
    }
    return bankAccounts.reduce((sum, acc) => sum + Number(acc.initial_balance), 0)
  }, [bankAccounts, selectedBankId])

  const metrics = useDashboardMetrics(transactions, prevTransactions, initialBalances)
  const chartData = useChartData(transactions)

  function handlePeriodChange(from: string, to: string) {
    setDateFrom(from)
    setDateTo(to)
  }

  return (
    <div className="space-y-6">
      <GmailConnectionBanner />
      <AIConfigBanner />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-label-upper mb-1">Dashboard</p>
          <h1 className="text-3xl font-bold tracking-tight text-white">Visão geral</h1>
          <p className="mt-1 text-sm text-slate-400">Acompanhe o fluxo das suas finanças em tempo real</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {bankAccounts && bankAccounts.length > 0 && (
            <Select
              value={selectedBankId}
              onChange={(e) => setSelectedBankId(e.target.value)}
              placeholder="Todas as contas"
              options={bankAccounts.map((a) => ({
                value: a.id,
                label: a.account_label,
              }))}
            />
          )}
          <PeriodFilter onChange={handlePeriodChange} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Saldo Atual"
          value={metrics.balance}
          icon={<Wallet className="h-5 w-5" />}
          variant="balance"
          loading={isLoading}
        />
        <MetricCard
          title="Receita do Período"
          value={metrics.income}
          icon={<TrendingUp className="h-5 w-5" />}
          variant="income"
          loading={isLoading}
        />
        <MetricCard
          title="Despesa do Período"
          value={metrics.expense}
          icon={<TrendingDown className="h-5 w-5" />}
          variant="expense"
          comparison={metrics.comparisonPercent}
          loading={isLoading}
        />
        <MetricCard
          title="Transações"
          value={transactions.length}
          icon={<BarChart3 className="h-5 w-5" />}
          loading={isLoading}
          formatAsCurrency={false}
        />
      </div>

      {/* Insights da IA */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AISummaryCard />
        <ForecastCard />
      </div>

      {/* Saldo por Conta */}
      {!selectedBankId && (
        <BankAccountCards
          bankAccounts={bankAccounts || []}
          transactions={allTransactions || []}
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ExpensesByCategoryChart
          data={chartData.expensesByCategory}
          loading={isLoading}
        />
        <IncomeVsExpenseChart
          data={chartData.incomeVsExpense}
          loading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RevenueExpenseBarChart
          data={chartData.revenueExpenseByPeriod}
          loading={isLoading}
        />
        <ExpensesCategoryBarChart
          data={chartData.expensesByCategoryBar}
          loading={isLoading}
        />
      </div>

      {/* Feed + Recorrências */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TransactionFeed filters={{ dateFrom, dateTo, bankAccountId: selectedBankId || undefined }} />
        </div>
        <RecurringSection />
      </div>
    </div>
  )
}
