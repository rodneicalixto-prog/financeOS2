import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import type { Tag } from '@/types'

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fo_tags')
        .select('*')
        .order('name')

      if (error) throw error
      return (data || []) as Tag[]
    },
  })
}

export interface TagWithUsage extends Tag {
  usage: number
}

export function useTagsWithUsage() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['tags-usage', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fo_tags')
        .select('*, usage:fo_transaction_tags(count)')
        .eq('user_id', user!.id)
        .order('name')

      if (error) throw error
      return (data || []).map((t: { id: string; name: string; user_id: string; usage: { count: number }[] }) => ({
        id: t.id,
        name: t.name,
        user_id: t.user_id,
        usage: t.usage?.[0]?.count ?? 0,
      })) as TagWithUsage[]
    },
    enabled: !!user,
  })
}

export function useTransactionTags(transactionId: string | undefined) {
  return useQuery({
    queryKey: ['transaction-tags', transactionId],
    queryFn: async () => {
      if (!transactionId) return []

      const { data, error } = await supabase
        .from('fo_transaction_tags')
        .select('tag_id')
        .eq('transaction_id', transactionId)

      if (error) throw error
      return (data || []).map((r) => r.tag_id) as string[]
    },
    enabled: !!transactionId,
  })
}
