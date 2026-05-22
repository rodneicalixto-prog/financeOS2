import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { startOfMonth, format } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAuth } from '@/hooks/useAuth'
import { useCategories } from '@/hooks/useCategories'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/format'
import { BudgetSuggestionsCard } from './BudgetSuggestionsCard'
import type { Budget } from '@/types'

export function BudgetsSettings() {
  const { user } = useAuth()
  const { data: categories } = useCategories()
  const queryClient = useQueryClient()

  const currentMonth = format(startOfMonth(new Date()), 'yyyy-MM-dd')

  const { data: budgets } = useQuery({
    queryKey: ['budgets', user?.id, currentMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fo_budgets')
        .select('*, categories:fo_categories(name, icon)')
        .eq('user_id', user!.id)
        .eq('month', currentMonth)
      if (error) throw error
      return (data || []) as (Budget & { categories: { name: string; icon: string } })[]
    },
    enabled: !!user,
  })

  const [newCategoryId, setNewCategoryId] = useState('')
  const [newLimit, setNewLimit] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleAdd() {
    if (!user || !newCategoryId || !newLimit) return
    setLoading(true)
    await supabase.from('fo_budgets').insert({
      user_id: user.id,
      category_id: newCategoryId,
      month: currentMonth,
      amount_limit: parseFloat(newLimit.replace(',', '.')) || 0,
    })
    await queryClient.invalidateQueries({ queryKey: ['budgets'] })
    setNewCategoryId('')
    setNewLimit('')
    setLoading(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('fo_budgets').delete().eq('id', id)
    await queryClient.invalidateQueries({ queryKey: ['budgets'] })
  }

  const usedCategoryIds = new Set((budgets || []).map((b) => b.category_id))
  const availableCategories = (categories || []).filter((c) => !usedCategoryIds.has(c.id))

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Orçamentos</h3>
      <p className="text-sm text-slate-400">Defina limites mensais por categoria.</p>

      <BudgetSuggestionsCard />

      <Card>
        {!budgets || budgets.length === 0 ? (
          <EmptyState
            title="Nenhum orçamento"
            description="Defina limites para controlar seus gastos por categoria."
          />
        ) : (
          <div className="mb-4 space-y-3">
            {budgets.map((budget) => (
              <div key={budget.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/5">
                <span className="text-lg">{budget.categories?.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200">{budget.categories?.name}</p>
                  <p className="text-xs text-slate-500">Limite: {formatBRL(Number(budget.amount_limit))}</p>
                </div>
                <button
                  onClick={() => handleDelete(budget.id)}
                  className="text-slate-500 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {availableCategories.length > 0 && (
          <div className="flex gap-2">
            <Select
              value={newCategoryId}
              onChange={(e) => setNewCategoryId(e.target.value)}
              placeholder="Categoria"
              options={availableCategories.map((c) => ({
                value: c.id,
                label: `${c.icon} ${c.name}`,
              }))}
              className="flex-1"
            />
            <Input
              value={newLimit}
              onChange={(e) => setNewLimit(e.target.value)}
              placeholder="Limite (R$)"
              className="w-32"
            />
            <Button onClick={handleAdd} loading={loading} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
