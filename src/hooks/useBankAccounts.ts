import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import type { BankAccount } from '@/types'

export function useBankAccounts() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['bank-accounts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fo_bank_accounts')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at')

      if (error) throw error
      return (data || []) as BankAccount[]
    },
    enabled: !!user,
  })
}
