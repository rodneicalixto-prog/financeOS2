import { useState } from 'react'
import { Plus, Trash2, Power, Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  useEmailRules,
  useDeleteEmailRule,
  useUpdateEmailRule,
  type EmailRule,
} from '@/hooks/useEmailRules'
import { useCategories } from '@/hooks/useCategories'
import { CreateRuleModal } from './CreateRuleModal'

const ACTION_LABEL: Record<EmailRule['action'], { label: string; color: string }> = {
  ignore: { label: 'Ignorar', color: 'bg-slate-500/15 text-slate-400' },
  force_expense: { label: 'Forçar Despesa', color: 'bg-accent-red/15 text-accent-red' },
  force_income: { label: 'Forçar Receita', color: 'bg-accent-green/15 text-accent-green' },
}

function formatDate(iso: string | null): string {
  if (!iso) return 'nunca'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 'nunca'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function EmailRulesList() {
  const { data: rules, isLoading } = useEmailRules()
  const { data: categories } = useCategories()
  const deleteRule = useDeleteEmailRule()
  const updateRule = useUpdateEmailRule()
  const [createOpen, setCreateOpen] = useState(false)

  function categoryName(id: string | null) {
    if (!id) return null
    return categories?.find((c) => c.id === id)?.name
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Regras de sync</h2>
          <p className="text-sm text-slate-400">
            Aplicadas antes do parse da IA. Casam por remetente e/ou assunto (substring, case-insensitive).
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nova regra
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !rules || rules.length === 0 ? (
        <EmptyState
          icon={<Zap className="h-10 w-10" />}
          title="Nenhuma regra criada"
          description='Crie regras a partir dos botões "Criar regra" nos emails analisados ou clique em "Nova regra".'
          action={{ label: 'Criar primeira regra', onClick: () => setCreateOpen(true) }}
        />
      ) : (
        <div className="space-y-2">
          {rules.map((r) => {
            const meta = ACTION_LABEL[r.action]
            const cat = categoryName(r.category_id)
            return (
              <div key={r.id} className="glass-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${meta.color}`}>
                      {meta.label}
                    </span>
                    {!r.enabled && (
                      <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-yellow-400">
                        Desativada
                      </span>
                    )}
                    {cat && (
                      <span className="text-xs text-slate-400">→ {cat}</span>
                    )}
                  </div>
                  {r.name && <p className="mt-1 text-sm font-medium text-white">{r.name}</p>}
                  <div className="mt-1 space-y-0.5 text-xs text-slate-400">
                    {r.sender_pattern && (
                      <p>
                        <span className="text-slate-500">remetente contém:</span>{' '}
                        <span className="font-mono text-slate-300">{r.sender_pattern}</span>
                      </p>
                    )}
                    {r.subject_pattern && (
                      <p>
                        <span className="text-slate-500">assunto contém:</span>{' '}
                        <span className="font-mono text-slate-300">{r.subject_pattern}</span>
                      </p>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {r.match_count} match{r.match_count === 1 ? '' : 'es'} · último: {formatDate(r.last_matched_at)}
                  </p>
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => updateRule.mutate({ id: r.id, enabled: !r.enabled })}
                    title={r.enabled ? 'Desativar' : 'Ativar'}
                  >
                    <Power className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm('Excluir esta regra?')) deleteRule.mutate(r.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-accent-red" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <CreateRuleModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
