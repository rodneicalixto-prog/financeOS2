import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import type { Alert } from '@/types'

export function useAlerts() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['alerts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fo_alerts')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      return (data || []) as Alert[]
    },
    enabled: !!user,
  })

  const unreadCount = (query.data || []).filter((a) => !a.is_read).length

  const markAsRead = useMutation({
    mutationFn: async (alertId: string) => {
      await supabase
        .from('fo_alerts')
        .update({ is_read: true })
        .eq('id', alertId)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      await supabase
        .from('fo_alerts')
        .update({ is_read: true })
        .eq('user_id', user!.id)
        .eq('is_read', false)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })

  return { ...query, unreadCount, markAsRead, markAllAsRead }
}
