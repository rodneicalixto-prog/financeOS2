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

// Regras sugeridas: classificam por direção (a IA extrai o valor; a regra força
// receita/despesa). subject_pattern casa contra assunto + corpo do email.
// category_id null → mantém a categorização automática; só força a direção.
export const SUGGESTED_RULES: ReadonlyArray<{
  name: string
  subject_pattern: string
  action: EmailRuleAction
}> = [
  // Receitas (dinheiro entrando)
  { name: 'Pix recebido', subject_pattern: 'pix recebido', action: 'force_income' },
  { name: 'Você recebeu (Pix)', subject_pattern: 'você recebeu', action: 'force_income' },
  { name: 'Pagamento recebido', subject_pattern: 'pagamento recebido', action: 'force_income' },
  { name: 'Transferência recebida', subject_pattern: 'transferência recebida', action: 'force_income' },
  // Despesas (dinheiro saindo)
  { name: 'Pix enviado', subject_pattern: 'pix enviado', action: 'force_expense' },
  { name: 'Pagamento confirmado', subject_pattern: 'pagamento confirmado', action: 'force_expense' },
  { name: 'Confirmação de pagamento', subject_pattern: 'confirmação de pagamento', action: 'force_expense' },
  { name: 'Pagamento efetuado', subject_pattern: 'pagamento efetuado', action: 'force_expense' },
  { name: 'Pagamento realizado', subject_pattern: 'pagamento realizado', action: 'force_expense' },
  { name: 'Pagamento executado', subject_pattern: 'pagamento executado', action: 'force_expense' },
  { name: 'Compra aprovada', subject_pattern: 'compra aprovada', action: 'force_expense' },
  { name: 'Transferência enviada', subject_pattern: 'transferência enviada', action: 'force_expense' },
]

/** Insere o conjunto de regras sugeridas, pulando as que já existem (por padrão). */
export function useSeedSuggestedRules() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (): Promise<{ inserted: number; skipped: number }> => {
      if (!user) throw new Error('Não autenticado')
      const { data: existing, error: readErr } = await supabase
        .from('fo_email_rules')
        .select('subject_pattern')
        .eq('user_id', user.id)
      if (readErr) throw readErr

      const have = new Set(
        (existing || []).map((r) => (r.subject_pattern || '').trim().toLowerCase()),
      )
      const toInsert = SUGGESTED_RULES.filter(
        (r) => !have.has(r.subject_pattern.toLowerCase()),
      ).map((r) => ({
        user_id: user.id,
        name: r.name,
        sender_pattern: null,
        subject_pattern: r.subject_pattern,
        action: r.action,
        category_id: null,
        enabled: true,
      }))

      if (toInsert.length > 0) {
        const { error } = await supabase.from('fo_email_rules').insert(toInsert)
        if (error) throw error
      }
      return { inserted: toInsert.length, skipped: SUGGESTED_RULES.length - toInsert.length }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-rules'] })
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
