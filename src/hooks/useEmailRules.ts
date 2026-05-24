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

/**
 * Reavalia emails já escaneados: re-aplica as regras de direção (force_income/
 * force_expense) às transações PENDENTES geradas por email, corrigindo
 * receita/despesa (e categoria, se a regra definir) in-place. Não toca em
 * transações confirmadas, não apaga nada e não re-roda a IA. Casa contra
 * remetente + assunto + snippet guardados em fo_scanned_emails.
 */
export function useReevaluateScannedEmails() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (): Promise<{ updated: number; checked: number }> => {
      if (!user) throw new Error('Não autenticado')

      const { data: rulesData, error: rulesErr } = await supabase
        .from('fo_email_rules')
        .select('sender_pattern, subject_pattern, action, category_id')
        .eq('user_id', user.id)
        .eq('enabled', true)
        .in('action', ['force_income', 'force_expense'])
        .order('created_at', { ascending: true })
      if (rulesErr) throw rulesErr
      const rules = rulesData || []
      if (rules.length === 0) return { updated: 0, checked: 0 }

      const { data: scanned, error: scanErr } = await supabase
        .from('fo_scanned_emails')
        .select('transaction_id, from_address, subject, snippet')
        .eq('user_id', user.id)
        .eq('kind', 'parsed')
        .not('transaction_id', 'is', null)
      if (scanErr) throw scanErr

      const incomeIds: string[] = []
      const expenseIds: string[] = []
      const byCategory = new Map<string, string[]>()

      for (const s of scanned || []) {
        const from = (s.from_address || '').toLowerCase()
        const text = `${s.subject || ''}\n${s.snippet || ''}`.toLowerCase()
        const rule = rules.find((r) => {
          const hasSender = !!r.sender_pattern
          const hasSubject = !!r.subject_pattern
          if (!hasSender && !hasSubject) return false
          const senderOk = !hasSender || from.includes((r.sender_pattern as string).toLowerCase())
          const subjectOk = !hasSubject || text.includes((r.subject_pattern as string).toLowerCase())
          return senderOk && subjectOk
        })
        const txId = s.transaction_id as string | null
        if (!rule || !txId) continue
        if (rule.action === 'force_income') incomeIds.push(txId)
        else expenseIds.push(txId)
        if (rule.category_id) {
          const arr = byCategory.get(rule.category_id as string) || []
          arr.push(txId)
          byCategory.set(rule.category_id as string, arr)
        }
      }

      const updatedSet = new Set<string>()
      // Só mexe em transações pendentes (não revisadas pelo usuário).
      const applyType = async (ids: string[], type: 'income' | 'expense') => {
        if (ids.length === 0) return
        const { data } = await supabase
          .from('fo_transactions')
          .update({ type })
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .in('id', Array.from(new Set(ids)))
          .select('id')
        for (const r of data || []) updatedSet.add(r.id as string)
      }
      await applyType(incomeIds, 'income')
      await applyType(expenseIds, 'expense')
      for (const [categoryId, ids] of byCategory) {
        await supabase
          .from('fo_transactions')
          .update({ category_id: categoryId })
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .in('id', Array.from(new Set(ids)))
      }

      return { updated: updatedSet.size, checked: (scanned || []).length }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['scanned-emails'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
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
