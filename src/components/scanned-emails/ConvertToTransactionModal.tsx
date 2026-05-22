import { useState, useEffect, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useAuth } from '@/hooks/useAuth'
import { useCategories } from '@/hooks/useCategories'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import type { ScannedEmail } from '@/hooks/useScannedEmails'
import { CreateRuleModal } from './CreateRuleModal'

interface Props {
  scannedEmail: ScannedEmail | null
  open: boolean
  onClose: () => void
}

function parseAmount(value: string): number {
  return parseFloat(value.replace(',', '.')) || 0
}

function dateOnly(iso: string | null): string {
  if (!iso) return new Date().toISOString().split('T')[0]!
  const d = new Date(iso)
  if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0]!
  return d.toISOString().split('T')[0]!
}

export function ConvertToTransactionModal({ scannedEmail, open, onClose }: Props) {
  const { user } = useAuth()
  const { data: categories } = useCategories()
  const { data: bankAccounts } = useBankAccounts()
  const queryClient = useQueryClient()

  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [categoryId, setCategoryId] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedSnapshot, setSavedSnapshot] = useState<{
    type: 'income' | 'expense'
    categoryId: string | null
  } | null>(null)
  const [ruleModalOpen, setRuleModalOpen] = useState(false)

  useEffect(() => {
    if (!scannedEmail) return
    setAmount('')
    setDescription(scannedEmail.subject || '')
    setDate(dateOnly(scannedEmail.received_at))
    setType('expense')
    setCategoryId('')
    setBankAccountId(bankAccounts?.[0]?.id || '')
    setError('')
    setSavedSnapshot(null)
    setRuleModalOpen(false)
  }, [scannedEmail, bankAccounts])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user || !scannedEmail) return

    const parsedAmount = parseAmount(amount)
    if (parsedAmount <= 0) {
      setError('Informe um valor válido')
      return
    }

    setLoading(true)
    setError('')

    try {
      const selectedCategory = categories?.find((c) => c.id === categoryId)
      const isSubscription = selectedCategory?.name === 'Assinaturas'

      const { data: inserted, error: insertError } = await supabase
        .from('fo_transactions')
        .insert({
          user_id: user.id,
          bank_account_id: bankAccountId || null,
          type,
          amount: parsedAmount,
          description,
          date,
          category_id: categoryId || null,
          status: 'confirmed',
          is_recurring: isSubscription,
          cnpj: null,
          source_email_id: scannedEmail.message_id,
          raw_email_data: null,
          ai_parsed_data: null,
        })
        .select('id')
        .single()

      if (insertError) throw insertError

      // Update scanned_email
      const { error: updateError } = await supabase
        .from('fo_scanned_emails')
        .update({
          kind: 'manually_created',
          transaction_id: inserted.id,
        })
        .eq('id', scannedEmail.id)
        .eq('user_id', user.id)

      if (updateError) throw updateError

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions-all'] }),
        queryClient.invalidateQueries({ queryKey: ['scanned-emails'] }),
        queryClient.invalidateQueries({ queryKey: ['scanned-emails-counts'] }),
      ])

      // Mostrar prompt de regra ao invés de fechar imediatamente
      setSavedSnapshot({ type, categoryId: categoryId || null })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar transação')
    } finally {
      setLoading(false)
    }
  }

  function handleOpenRuleModal() {
    setRuleModalOpen(true)
  }

  function handleSkipRule() {
    onClose()
  }

  function handleRuleClose() {
    setRuleModalOpen(false)
    onClose()
  }

  if (!scannedEmail) return null

  // Phase 2: prompt to save rule
  if (savedSnapshot && !ruleModalOpen) {
    const categoryName = categories?.find((c) => c.id === savedSnapshot.categoryId)?.name
    return (
      <Modal open={open} onClose={handleSkipRule} title="Transação criada!" className="max-w-lg">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Quer criar uma regra para que emails parecidos sejam automaticamente classificados como{' '}
            <span className="font-semibold text-white">
              {savedSnapshot.type === 'expense' ? 'Despesa' : 'Receita'}
              {categoryName ? ` · ${categoryName}` : ''}
            </span>
            ?
          </p>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-slate-300 space-y-1">
            <p><span className="text-slate-500">Remetente:</span> {scannedEmail.from_address || '—'}</p>
            <p><span className="text-slate-500">Assunto:</span> {scannedEmail.subject || '—'}</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={handleSkipRule} className="flex-1">
              Não, obrigado
            </Button>
            <Button type="button" onClick={handleOpenRuleModal} className="flex-1">
              Criar regra
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  if (ruleModalOpen && savedSnapshot) {
    return (
      <CreateRuleModal
        open
        onClose={handleRuleClose}
        initialFromAddress={scannedEmail.from_address}
        initialAction={savedSnapshot.type === 'expense' ? 'force_expense' : 'force_income'}
        initialCategoryId={savedSnapshot.categoryId}
        showRetroactive={false}
      />
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Criar transação do email" className="max-w-lg">
      <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-slate-300 space-y-1">
        <p><span className="text-slate-500">Assunto:</span> {scannedEmail.subject || '—'}</p>
        <p><span className="text-slate-500">De:</span> {scannedEmail.from_address || '—'}</p>
        {scannedEmail.snippet && (
          <p className="text-slate-400 line-clamp-3">{scannedEmail.snippet}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex rounded-lg bg-surface-light p-1">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              type === 'expense'
                ? 'bg-accent-red/20 text-accent-red'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Saída
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              type === 'income'
                ? 'bg-accent-green/20 text-accent-green'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Entrada
          </button>
        </div>

        <Input
          label="Valor (R$)"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d,]/g, ''))}
          placeholder="0,00"
          required
          autoFocus
        />

        <Input
          label="Descrição"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />

        <Input
          label="Data"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />

        <Select
          label="Categoria"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          placeholder="Selecione uma categoria"
          options={(categories || []).map((c) => ({
            value: c.id,
            label: `${c.icon} ${c.name}`,
          }))}
        />

        {bankAccounts && bankAccounts.length > 0 && (
          <Select
            label="Conta Bancária"
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
            placeholder="Selecione (opcional)"
            options={bankAccounts.map((a) => ({
              value: a.id,
              label: a.account_label,
            }))}
          />
        )}

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" loading={loading} className="flex-1">
            Criar transação
          </Button>
        </div>
      </form>
    </Modal>
  )
}
