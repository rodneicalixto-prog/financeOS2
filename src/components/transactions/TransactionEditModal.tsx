import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { useCategories } from '@/hooks/useCategories'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { useTags, useTransactionTags } from '@/hooks/useTags'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { formatBRL, formatDate } from '@/lib/format'
import type { Transaction } from '@/types'

interface TransactionEditModalProps {
  transaction: (Transaction & { categories: { name: string; icon: string } | null }) | null
  open: boolean
  onClose: () => void
}

export function TransactionEditModal({ transaction, open, onClose }: TransactionEditModalProps) {
  const { data: categories } = useCategories()
  const { data: bankAccounts } = useBankAccounts()
  const { data: tags } = useTags()
  const { data: existingTagIds } = useTransactionTags(transaction?.id)
  const queryClient = useQueryClient()

  const [categoryId, setCategoryId] = useState(transaction?.category_id || '')
  const [bankAccountId, setBankAccountId] = useState(transaction?.bank_account_id || '')
  const [status, setStatus] = useState(transaction?.status || 'pending')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (existingTagIds) setSelectedTagIds(existingTagIds)
  }, [existingTagIds])

  async function handleSave() {
    if (!transaction) return
    setLoading(true)

    try {
      // Se categoria "Assinaturas" → marcar como recorrente automaticamente
      const selectedCategory = categories?.find((c) => c.id === categoryId)
      const isSubscription = selectedCategory?.name === 'Assinaturas'

      await supabase
        .from('fo_transactions')
        .update({
          category_id: categoryId || null,
          bank_account_id: bankAccountId || null,
          status,
          is_recurring: isSubscription,
        })
        .eq('id', transaction.id)

      // Atualizar tags: remover antigas e inserir novas
      await supabase
        .from('fo_transaction_tags')
        .delete()
        .eq('transaction_id', transaction.id)

      if (selectedTagIds.length > 0) {
        await supabase.from('fo_transaction_tags').insert(
          selectedTagIds.map((tagId) => ({
            transaction_id: transaction.id,
            tag_id: tagId,
          }))
        )
      }

      await queryClient.invalidateQueries({ queryKey: ['transactions'] })
      await queryClient.invalidateQueries({ queryKey: ['transactions-all'] })
      await queryClient.invalidateQueries({ queryKey: ['recurring'] })
      await queryClient.invalidateQueries({ queryKey: ['transaction-tags'] })
      onClose()
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!transaction) return
    setDeleting(true)

    try {
      await supabase
        .from('fo_transactions')
        .delete()
        .eq('id', transaction.id)

      await queryClient.invalidateQueries({ queryKey: ['transactions'] })
      await queryClient.invalidateQueries({ queryKey: ['transactions-all'] })
      await queryClient.invalidateQueries({ queryKey: ['recurring'] })
      onClose()
    } catch {
      // silently fail
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  if (!transaction) return null

  return (
    <Modal open={open} onClose={onClose} title="Editar Transação">
      <div className="space-y-4">
        {/* Info */}
        <div className="rounded-lg bg-surface-light p-3 space-y-1">
          <p className="text-sm font-medium text-white">{transaction.description}</p>
          <p className="text-sm text-slate-400">{formatDate(transaction.date)}</p>
          <p className="text-lg font-bold text-white">{formatBRL(Number(transaction.amount))}</p>
        </div>

        {/* Category */}
        <Select
          label="Categoria"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          placeholder="Selecione"
          options={
            (categories || []).map((c) => ({
              value: c.id,
              label: `${c.icon} ${c.name}`,
            }))
          }
        />

        {/* Conta Bancária */}
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

        {/* Status */}
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as 'pending' | 'confirmed')}
          options={[
            { value: 'pending', label: 'Pendente' },
            { value: 'confirmed', label: 'Confirmada' },
          ]}
        />

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

        {/* Deletar */}
        {confirmDelete ? (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 space-y-3">
            <p className="text-sm text-red-400">Tem certeza que deseja excluir esta transação?</p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setConfirmDelete(false)} className="flex-1">
                Não
              </Button>
              <Button variant="danger" onClick={handleDelete} loading={deleting} className="flex-1">
                Sim, excluir
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="w-full text-sm text-red-400 hover:text-red-300 transition-colors py-1"
          >
            Excluir transação
          </button>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSave} loading={loading} className="flex-1">
            Salvar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
