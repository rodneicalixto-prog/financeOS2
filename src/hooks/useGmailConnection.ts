import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import type { GmailConnection } from '@/types'

export function useGmailConnection() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['gmail-connections', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fo_gmail_connections')
        .select('*')
        .eq('user_id', user!.id)
        .order('connected_at', { ascending: true })

      if (error) throw error
      return (data || []) as GmailConnection[]
    },
    enabled: !!user,
  })
}
