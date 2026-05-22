import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

export type EmailRuleAction = 'ignore' | 'force_expense' | 'force_income'

export interface EmailRule {
  id: string
  user_id: string
  name: string | null
  sender_pattern: string | null
  subject_pattern: string | null
  action: EmailRuleAction
  category_id: string | null
  enabled: boolean
  match_count: number
  last_matched_at: string | null
  created_at: string
  updated_at: string
}

export interface EmailRuleInput {
  name?: string | null
  sender_pattern?: string | null
  subject_pattern?: string | null
  action: EmailRuleAction
  category_id?: string | null
  enabled?: boolean
}

export function useEmailRules() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['email-rules', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fo_email_rules')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as EmailRule[]
    },
  })
}

export function useCreateEmailRule() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (params: EmailRuleInput & { applyRetroactive?: boolean }) => {
      if (!user) throw new Error('Não autenticado')
      const { applyRetroactive, ...input } = params

      const { data: rule, error } = await supabase
        .from('fo_email_rules')
        .insert({
          user_id: user.id,
          name: input.name || null,
          sender_pattern: input.sender_pattern || null,
          subject_pattern: input.subject_pattern || null,
          action: input.action,
          category_id: input.action === 'ignore' ? null : input.category_id || null,
          enabled: input.enabled ?? true,
        })
        .select()
        .single()
      if (error) throw error

      // Retroativo: para regras 'ignore', marcar emails declined/error que casam
      if (applyRetroactive && input.action === 'ignore') {
        // Busca todos os emails declined/error e filtra no client
        const { data: candidates } = await supabase
          .from('fo_scanned_emails')
          .select('id, from_address, subject')
          .eq('user_id', user.id)
          .in('kind', ['declined', 'error'])

        const senderP = (input.sender_pattern || '').toLowerCase()
        const subjectP = (input.subject_pattern || '').toLowerCase()
        const toUpdate = (candidates || []).filter((c) => {
          const f = (c.from_address || '').toLowerCase()
          const s = (c.subject || '').toLowerCase()
          const senderOk = !senderP || f.includes(senderP)
          const subjectOk = !subjectP || s.includes(subjectP)
          return (senderP || subjectP) && senderOk && subjectOk
        })

        if (toUpdate.length > 0) {
          await supabase
            .from('fo_scanned_emails')
            .update({ kind: 'ignored' })
            .in('id', toUpdate.map((u) => u.id))
        }
      }

      return rule as EmailRule
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-rules'] })
      queryClient.invalidateQueries({ queryKey: ['scanned-emails'] })
      queryClient.invalidateQueries({ queryKey: ['scanned-emails-counts'] })
    },
  })
}

export function useUpdateEmailRule() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (params: { id: string } & Partial<EmailRuleInput>) => {
      const { id, ...patch } = params
      const { error } = await supabase
        .from('fo_email_rules')
        .update(patch)
        .eq('id', id)
        .eq('user_id', user!.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-rules'] })
    },
  })
}

export function useDeleteEmailRule() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fo_email_rules')
        .delete()
        .eq('id', id)
        .eq('user_id', user!.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-rules'] })
    },
  })
}
