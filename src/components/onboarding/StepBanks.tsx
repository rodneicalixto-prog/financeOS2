import { useState } from 'react'
import { Check } from 'lucide-react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { SUPPORTED_BANKS } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

interface StepBanksProps {
  onNext: () => void
  onBack: () => void
}

export function StepBanks({ onNext, onBack }: StepBanksProps) {
  const { user } = useAuth()
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function toggleBank(bankId: string) {
    setSelected((prev) =>
      prev.includes(bankId)
        ? prev.filter((id) => id !== bankId)
        : [...prev, bankId]
    )
  }

  async function handleContinue() {
    if (!user || selected.length === 0) return
    setLoading(true)
    setError('')

    try {
      const accounts = selected.map((bankId) => {
        const bank = SUPPORTED_BANKS.find((b) => b.id === bankId)!
        return {
          user_id: user.id,
          bank_name: String(bank.name),
          account_label: String(bank.name),
          initial_balance: 0,
        }
      })

      const { error: insertError } = await supabase
        .from('fo_bank_accounts')
        .insert(accounts)

      if (insertError) throw insertError
      onNext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar contas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-white">Selecionar Bancos</h2>
        <p className="mt-2 text-sm text-slate-400">
          Escolha os bancos que você utiliza. Você pode adicionar mais depois.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {SUPPORTED_BANKS.map((bank) => {
          const isSelected = selected.includes(bank.id)
          return (
            <button
              key={bank.id}
              onClick={() => toggleBank(bank.id)}
              className={clsx(
                'glass-card flex items-center gap-3 p-4 text-left transition-all',
                isSelected && 'border-accent-blue/50 bg-accent-blue/10'
              )}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
                style={{ backgroundColor: bank.color + '30' }}
              >
                {bank.name.charAt(0)}
              </div>
              <span className="flex-1 text-sm font-medium text-slate-200">
                {bank.name}
              </span>
              {isSelected && <Check className="h-5 w-5 text-accent-blue" />}
            </button>
          )
        })}
      </div>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onBack} className="flex-1">
          Voltar
        </Button>
        <Button
          onClick={handleContinue}
          loading={loading}
          disabled={selected.length === 0}
          className="flex-1"
        >
          Continuar ({selected.length} selecionado{selected.length !== 1 ? 's' : ''})
        </Button>
      </div>
    </div>
  )
}
