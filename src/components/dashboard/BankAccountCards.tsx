import { Landmark } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { formatBRL } from '@/lib/format'
import type { BankAccount, Transaction } from '@/types'

interface Props {
  bankAccounts: BankAccount[]
  transactions: Transaction[]
}

export function BankAccountCards({ bankAccounts, transactions }: Props) {
  if (bankAccounts.length === 0) return null

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-slate-400">Saldo por Conta</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {bankAccounts.map((account) => {
          const accountTxs = transactions.filter(
            (t) => t.bank_account_id === account.id
          )
          const income = accountTxs
            .filter((t) => t.type === 'income')
            .reduce((sum, t) => sum + Number(t.amount), 0)
          const expense = accountTxs
            .filter((t) => t.type === 'expense')
            .reduce((sum, t) => sum + Number(t.amount), 0)
          const balance = Number(account.initial_balance) + income - expense

          return (
            <Card key={account.id} padding="sm">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-blue/10">
                  <Landmark className="h-4 w-4 text-accent-blue" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {account.account_label}
                  </p>
                  <p className="text-xs text-slate-500">{account.bank_name}</p>
                </div>
                <p className={`text-sm font-bold ${balance >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                  {formatBRL(balance)}
                </p>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
