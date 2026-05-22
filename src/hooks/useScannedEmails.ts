import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

export type ScannedEmailKind = 'parsed' | 'declined' | 'error' | 'ignored' | 'manually_created'

export interface ScannedEmail {
  id: string
  user_id: string
  gmail_connection_id: string | null
  message_id: string
  subject: string | null
  from_address: string | null
  snippet: string | null
  received_at: string | null
  kind: ScannedEmailKind
  error_message: string | null
  transaction_id: string | null
  created_at: string
  updated_at: string
}

export interface ScannedEmailsFilters {
  kind?: ScannedEmailKind | 'all'
}

export function useScannedEmails(filters: ScannedEmailsFilters = {}) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['scanned-emails', user?.id, filters],
    enabled: !!user?.id,
    queryFn: async () => {
      let query = supabase
        .from('fo_scanned_emails')
        .select('*')
        .eq('user_id', user!.id)
        .order('received_at', { ascending: false, nullsFirst: false })

      if (filters.kind && filters.kind !== 'all') {
        query = query.eq('kind', filters.kind)
      }

      const { data, error } = await query
      if (error) throw error
      return (data || []) as ScannedEmail[]
    },
  })
}

export function useScannedEmailCounts() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['scanned-emails-counts', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fo_scanned_emails')
        .select('kind')
        .eq('user_id', user!.id)
      if (error) throw error
      const counts: Record<ScannedEmailKind | 'all', number> = {
        all: 0,
        parsed: 0,
        declined: 0,
        error: 0,
        ignored: 0,
        manually_created: 0,
      }
      for (const row of data || []) {
        counts.all++
        counts[row.kind as ScannedEmailKind]++
      }
      return counts
    },
  })
}

export function useUpdateScannedEmail() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (params: {
      id: string
      kind?: ScannedEmailKind
      transaction_id?: string | null
    }) => {
      const payload: Record<string, unknown> = {}
      if (params.kind) payload.kind = params.kind
      if ('transaction_id' in params) payload.transaction_id = params.transaction_id

      const { error } = await supabase
        .from('fo_scanned_emails')
        .update(payload)
        .eq('id', params.id)
        .eq('user_id', user!.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scanned-emails'] })
      queryClient.invalidateQueries({ queryKey: ['scanned-emails-counts'] })
    },
  })
}
