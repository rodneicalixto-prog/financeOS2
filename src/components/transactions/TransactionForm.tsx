import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useAuth } from '@/hooks/useAuth'
import { useCategories } from '@/hooks/useCategories'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { useTags } from '@/hooks/useTags'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'

interface TransactionFormProps {
  onSuccess?: () => void
}

export function TransactionForm({ onSuccess }: TransactionFormProps) {
  const { user } = useAuth()
  const { data: categories } = useCategories()
  const { data: bankAccounts } = useBankAccounts()
  const { data: tags } = useTags()
  const queryClient = useQueryClient()

  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]!)
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [categoryId, setCategoryId] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleAmountChange(value: string) {
    // Permite apenas números e vírgula
    const clean = value.replace(/[^\d,]/g, '')
    setAmount(clean)
  }

  function parseAmount(value: string): number {
    return parseFloat(value.replace(',', '.')) || 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return

    const parsedAmount = parseAmount(amount)
    if (parsedAmount <= 0) {
      setError('Informe um valor válido')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Se categoria "Assinaturas" → marcar como recorrente automaticamente
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
          source_email_id: null,
          raw_email_data: null,
          ai_parsed_data: null,
        })
        .select('id')
        .single()

      if (insertError) throw insertError

      // Inserir tags
      if (inserted && selectedTagIds.length > 0) {
        await supabase.from('fo_transaction_tags').insert(
          selectedTagIds.map((tagId) => ({
            transaction_id: inserted.id,
            tag_id: tagId,
          }))
        )
      }

      // Limpar form
      setAmount('')
      setDescription('')
      setCategoryId('')
      setBankAccountId('')
      setSelectedTagIds([])

      // Invalidar cache
      await queryClient.invalidateQueries({ queryKey: ['transactions'] })
      await queryClient.invalidateQueries({ queryKey: ['transactions-all'] })
      if (isSubscription) {
        await queryClient.invalidateQueries({ queryKey: ['recurring'] })
      }

      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar transação')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Tipo */}
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
        onChange={(e) => handleAmountChange(e.target.value)}
        placeholder="0,00"
        required
      />

      <Input
        label="Descrição"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descrição da transação"
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
        options={
          (categories || []).map((c) => ({
            value: c.id,
            label: `${c.icon} ${c.name}`,
          }))
        }
      />

      {bankAccounts && bankAccounts.length > 0 && (
        <Select
          label="Conta Bancária"
          value={bankAccountId}
          onChange={(e) => setBankAccountId(e.target.value)}
          placeholder="Selecione (opcional)"
          options={
            bankAccounts.map((a) => ({
              value: a.id,
              label: a.account_label,
            }))
          }
        />
      )}

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-300">Tags</label>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const selected = selectedTagIds.includes(tag.id)
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() =>
                    setSelectedTagIds((prev) =>
                      selected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                    )
                  }
                  className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    selected
                      ? 'bg-accent-blue/20 text-accent-blue'
                      : 'bg-surface-light text-slate-400 hover:text-white'
                  }`}
                >
                  {tag.name}
                  {selected && <X className="h-3 w-3" />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <Button type="submit" loading={loading} className="w-full">
        Adicionar Transação
      </Button>
    </form>
  )
}
