import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

export interface FoUser {
  id: string
  email: string
  name: string
  role: 'owner' | 'member'
  created_at: string
}

export function useCurrentUser() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['fo-current-user', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<FoUser | null> => {
      if (!user?.id) return null
      const { data, error } = await supabase
        .from('fo_users')
        .select('id, email, name, role, created_at')
        .eq('id', user.id)
        .single()
      if (error) throw error
      return data as FoUser
    },
  })
}
