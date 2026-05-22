import { useState } from 'react'
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/ui/EmptyState'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { SUPPORTED_BANKS } from '@/lib/constants'
import { formatBRL } from '@/lib/format'
import { useQueryClient } from '@tanstack/react-query'

export function BankAccountsSettings() {
  const { user } = useAuth()
  const { data: accounts, isLoading } = useBankAccounts()
  const queryClient = useQueryClient()

  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [newBank, setNewBank] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newBalance, setNewBalance] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleAdd() {
    if (!user || !newBank) return
    setLoading(true)
    const bank = SUPPORTED_BANKS.find((b) => b.id === newBank)
    await supabase.from('fo_bank_accounts').insert({
      user_id: user.id,
      bank_name: bank?.name || newBank,
      account_label: newLabel || bank?.name || newBank,
      initial_balance: parseFloat(newBalance.replace(',', '.')) || 0,
    })
    await queryClient.invalidateQueries({ queryKey: ['bank-accounts'] })
    setShowAdd(false)
    setNewBank('')
    setNewLabel('')
    setNewBalance('')
    setLoading(false)
  }

  async function handleSaveLabel(id: string) {
    await supabase.from('fo_bank_accounts').update({ account_label: editLabel }).eq('id', id)
    await queryClient.invalidateQueries({ queryKey: ['bank-accounts'] })
    setEditingId(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza? Transações vinculadas a esta conta não serão excluídas.')) return
    await supabase.from('fo_bank_accounts').delete().eq('id', id)
    await queryClient.invalidateQueries({ queryKey: ['bank-accounts'] })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Contas Bancárias</h3>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>

      {isLoading ? (
        <Card><p className="text-slate-400">Carregando...</p></Card>
      ) : !accounts || accounts.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhuma conta"
            description="Adicione suas contas bancárias para começar."
            action={{ label: 'Adicionar conta', onClick: () => setShowAdd(true) }}
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {accounts.map((acc) => (
            <Card key={acc.id} padding="sm" className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-light text-sm font-bold">
                {acc.bank_name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                {editingId === acc.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="glass-input px-2 py-1 text-sm flex-1"
                      autoFocus
                    />
                    <button onClick={() => handleSaveLabel(acc.id)} className="text-accent-green"><Check className="h-4 w-4" /></button>
                    <button onClick={() => setEditingId(null)} className="text-slate-400"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium text-white">{acc.account_label}</p>
                    <p className="text-xs text-slate-500">{acc.bank_name} · Saldo inicial: {formatBRL(Number(acc.initial_balance))}</p>
                  </>
                )}
              </div>
              {editingId !== acc.id && (
                <div className="flex gap-1">
                  <button
                    onClick={() => { setEditingId(acc.id); setEditLabel(acc.account_label) }}
                    className="rounded p-1.5 text-slate-400 hover:text-white hover:bg-white/5"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(acc.id)}
                    className="rounded p-1.5 text-slate-400 hover:text-red-400 hover:bg-white/5"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Adicionar Conta">
        <div className="space-y-4">
          <Select
            label="Banco"
            value={newBank}
            onChange={(e) => setNewBank(e.target.value)}
            placeholder="Selecione o banco"
            options={SUPPORTED_BANKS.map((b) => ({ value: b.id, label: b.name }))}
          />
          <Input
            label="Apelido (opcional)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Ex: Conta principal"
          />
          <Input
            label="Saldo inicial (R$)"
            value={newBalance}
            onChange={(e) => setNewBalance(e.target.value)}
            placeholder="0,00"
          />
          <Button onClick={handleAdd} loading={loading} className="w-full">
            Adicionar
          </Button>
        </div>
      </Modal>
    </div>
  )
}
