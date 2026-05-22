import { useState, useEffect, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useCategories } from '@/hooks/useCategories'
import { useCreateEmailRule, type EmailRuleAction } from '@/hooks/useEmailRules'

interface Props {
  open: boolean
  onClose: () => void
  initialFromAddress?: string | null
  initialSubject?: string | null
  initialAction?: EmailRuleAction
  initialCategoryId?: string | null
  initialName?: string | null
  showRetroactive?: boolean
}

function extractEmail(from: string | null | undefined): string {
  if (!from) return ''
  const m = from.match(/<([^>]+)>/)
  return (m?.[1] || from).trim()
}

function extractDomain(email: string): string {
  const idx = email.lastIndexOf('@')
  return idx >= 0 ? email.substring(idx + 1) : email
}

export function CreateRuleModal({
  open,
  onClose,
  initialFromAddress,
  initialSubject,
  initialAction = 'ignore',
  initialCategoryId,
  initialName,
  showRetroactive = true,
}: Props) {
  const { data: categories } = useCategories()
  const createRule = useCreateEmailRule()

  const [name, setName] = useState('')
  const [senderPattern, setSenderPattern] = useState('')
  const [subjectPattern, setSubjectPattern] = useState('')
  const [action, setAction] = useState<EmailRuleAction>(initialAction)
  const [categoryId, setCategoryId] = useState('')
  const [applyRetroactive, setApplyRetroactive] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const email = extractEmail(initialFromAddress)
    setSenderPattern(email || extractDomain(email))
    setSubjectPattern('')
    setName(initialName || '')
    setAction(initialAction)
    setCategoryId(initialCategoryId || '')
    setApplyRetroactive(true)
    setError('')
  }, [open, initialFromAddress, initialSubject, initialAction, initialCategoryId, initialName])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!senderPattern && !subjectPattern) {
      setError('Defina pelo menos um padrão (remetente ou assunto)')
      return
    }
    if ((action === 'force_expense' || action === 'force_income') && !categoryId) {
      setError('Selecione uma categoria para forçar')
      return
    }
    setError('')
    try {
      await createRule.mutateAsync({
        name: name || null,
        sender_pattern: senderPattern || null,
        subject_pattern: subjectPattern || null,
        action,
        category_id: action === 'ignore' ? null : categoryId,
        enabled: true,
        applyRetroactive: showRetroactive && applyRetroactive,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar regra')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Criar regra de sync" className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-400">
          Regras se aplicam a futuras sincronizações. Defina por remetente, assunto ou os dois (precisam casar ambos).
        </p>

        <Input
          label="Nome (opcional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Ignorar newsletters Shopee"
        />

        <Input
          label="Remetente contém"
          value={senderPattern}
          onChange={(e) => setSenderPattern(e.target.value)}
          placeholder="ex: googleplay-noreply@google.com ou @newsletter.shopee.com.br"
        />

        <Input
          label="Assunto contém (opcional)"
          value={subjectPattern}
          onChange={(e) => setSubjectPattern(e.target.value)}
          placeholder="ex: fatura"
        />

        <div>
          <p className="text-label-upper mb-2">Ação</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {(
              [
                { value: 'ignore', label: 'Ignorar', desc: 'Pula completamente' },
                { value: 'force_expense', label: 'Forçar Despesa', desc: 'IA extrai valor, força categoria' },
                { value: 'force_income', label: 'Forçar Receita', desc: 'IA extrai valor, força categoria' },
              ] as const
            ).map((opt) => (
              <button
                type="button"
                key={opt.value}
                onClick={() => setAction(opt.value as EmailRuleAction)}
                className={`flex-1 rounded-lg border p-3 text-left text-xs transition-colors ${
                  action === opt.value
                    ? 'border-accent-blue/50 bg-accent-blue/10 text-white'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                }`}
              >
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="mt-0.5 text-[10px] text-slate-500">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {action !== 'ignore' && (
          <Select
            label="Categoria"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            placeholder="Selecione uma categoria"
            options={(categories || []).map((c) => ({
              value: c.id,
              label: `${c.icon} ${c.name}`,
            }))}
            required
          />
        )}

        {showRetroactive && action === 'ignore' && (
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={applyRetroactive}
              onChange={(e) => setApplyRetroactive(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Aplicar retroativamente aos emails já existentes que casarem com este padrão (marca como ignorados).
            </span>
          </label>
        )}

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}

        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" loading={createRule.isPending} className="flex-1">
            Criar regra
          </Button>
        </div>
      </form>
    </Modal>
  )
}
