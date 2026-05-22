import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import type { Transaction } from '@/types'

export function useRecurringTransactions() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['recurring', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fo_transactions')
        .select('*, categories:fo_categories(name, icon)')
        .eq('user_id', user!.id)
        .eq('is_recurring', true)
        .order('date', { ascending: false })

      if (error) throw error

      // Agrupa por descrição para evitar duplicatas
      const map = new Map<string, { description: string; avgAmount: number; count: number; icon: string }>()

      for (const t of (data || []) as (Transaction & { categories: { name: string; icon: string } | null })[]) {
        const key = t.description.toLowerCase().trim()
        const existing = map.get(key)
        if (existing) {
          existing.avgAmount = (existing.avgAmount * existing.count + Number(t.amount)) / (existing.count + 1)
          existing.count++
        } else {
          map.set(key, {
            description: t.description,
            avgAmount: Number(t.amount),
            count: 1,
            icon: t.categories?.icon || '🔄',
          })
        }
      }

      return Array.from(map.values())
    },
    enabled: !!user,
  })
}
