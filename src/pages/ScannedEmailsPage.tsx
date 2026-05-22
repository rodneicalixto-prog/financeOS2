import { useState } from 'react'
import { Mail, Check, AlertCircle, EyeOff, Inbox, Plus, Zap } from 'lucide-react'
import clsx from 'clsx'
import {
  useScannedEmails,
  useScannedEmailCounts,
  useUpdateScannedEmail,
  type ScannedEmail,
  type ScannedEmailKind,
} from '@/hooks/useScannedEmails'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { ConvertToTransactionModal } from '@/components/scanned-emails/ConvertToTransactionModal'
import { CreateRuleModal } from '@/components/scanned-emails/CreateRuleModal'
import { EmailRulesList } from '@/components/scanned-emails/EmailRulesList'

type TabKey = 'declined' | 'parsed' | 'error' | 'ignored' | 'all'
type View = 'emails' | 'rules'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'declined', label: 'Não classificados' },
  { key: 'parsed', label: 'Despesas extraídas' },
  { key: 'error', label: 'Erros' },
  { key: 'ignored', label: 'Ignorados' },
  { key: 'all', label: 'Todos' },
]

const KIND_LABEL: Record<ScannedEmailKind, { label: string; color: string }> = {
  parsed: { label: 'Extraído', color: 'bg-accent-green/15 text-accent-green' },
  manually_created: { label: 'Manual', color: 'bg-accent-blue/15 text-accent-blue' },
  declined: { label: 'Não é transação', color: 'bg-slate-500/15 text-slate-400' },
  error: { label: 'Erro', color: 'bg-accent-red/15 text-accent-red' },
  ignored: { label: 'Ignorado', color: 'bg-slate-700/30 text-slate-500' },
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function trimFrom(from: string | null): string {
  if (!from) return '—'
  const m = from.match(/^(.*?)\s*<.+>$/)
  return (m?.[1] || from).replace(/^"|"$/g, '').trim() || from
}

export function ScannedEmailsPage() {
  const [view, setView] = useState<View>('emails')
  const [tab, setTab] = useState<TabKey>('declined')
  const [convertTarget, setConvertTarget] = useState<ScannedEmail | null>(null)
  const [ruleTarget, setRuleTarget] = useState<ScannedEmail | null>(null)

  const { data: counts } = useScannedEmailCounts()
  const filterKind = tab === 'all' ? 'all' : tab
  const { data: emails, isLoading } = useScannedEmails({ kind: filterKind })
  const updateScanned = useUpdateScannedEmail()

  function handleIgnore(email: ScannedEmail) {
    updateScanned.mutate({ id: email.id, kind: 'ignored' })
  }

  function handleRestore(email: ScannedEmail) {
    updateScanned.mutate({ id: email.id, kind: 'declined' })
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-label-upper mb-1">Caixa de IA</p>
        <h1 className="text-3xl font-bold tracking-tight text-white">Emails analisados</h1>
        <p className="mt-1 text-sm text-slate-400">
          Revise emails que a IA olhou, marque manualmente os que são despesas e crie regras pra automatizar.
        </p>
      </div>

      {/* View switch */}
      <div className="flex gap-1 rounded-2xl border border-[rgba(59,130,246,0.15)] bg-[rgba(15,18,35,0.4)] p-1.5 backdrop-blur-xl w-fit">
        <button
          onClick={() => setView('emails')}
          className={clsx(
            'rounded-xl px-4 py-2 text-sm font-semibold transition-all',
            view === 'emails'
              ? 'bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] text-white shadow-[0_0_20px_rgba(59,130,246,0.25)]'
              : 'text-slate-400 hover:text-white'
          )}
        >
          Emails
        </button>
        <button
          onClick={() => setView('rules')}
          className={clsx(
            'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all',
            view === 'rules'
              ? 'bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] text-white shadow-[0_0_20px_rgba(59,130,246,0.25)]'
              : 'text-slate-400 hover:text-white'
          )}
        >
          <Zap className="h-4 w-4" />
          Regras
        </button>
      </div>

      {view === 'rules' ? (
        <EmailRulesList />
      ) : (
        <>
          {/* Kind filter tabs */}
          <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
            {TABS.map((t) => {
              const count = counts ? counts[t.key === 'all' ? 'all' : (t.key as ScannedEmailKind)] : 0
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={clsx(
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    tab === t.key
                      ? 'bg-accent-blue/15 text-accent-blue-light border border-accent-blue/30'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
                  )}
                >
                  {t.label}
                  {counts && (
                    <span className={clsx('ml-2 text-xs', tab === t.key ? 'text-accent-blue-light/70' : 'text-slate-500')}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* List */}
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : !emails || emails.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-12 w-12" />}
              title="Nenhum email nesta aba"
              description={
                tab === 'declined'
                  ? 'A IA não declinou nenhum email ainda. Quando isso acontecer, aparecerão aqui pra revisão manual.'
                  : 'Nenhum email com esse status.'
              }
            />
          ) : (
            <div className="space-y-2">
              {emails.map((email) => {
                const meta = KIND_LABEL[email.kind]
                const isDeclined = email.kind === 'declined'
                const isIgnored = email.kind === 'ignored'
                const isError = email.kind === 'error'

                return (
                  <div
                    key={email.id}
                    className="glass-card flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:gap-4"
                  >
                    <div className="flex-shrink-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5">
                        {email.kind === 'parsed' || email.kind === 'manually_created' ? (
                          <Check className="h-5 w-5 text-accent-green" />
                        ) : isError ? (
                          <AlertCircle className="h-5 w-5 text-accent-red" />
                        ) : isIgnored ? (
                          <EyeOff className="h-5 w-5 text-slate-500" />
                        ) : (
                          <Mail className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-medium text-white">
                          {email.subject || '(sem assunto)'}
                        </h3>
                        <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', meta.color)}>
                          {meta.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {trimFrom(email.from_address)} · {formatDate(email.received_at)}
                      </p>
                      {email.snippet && (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{email.snippet}</p>
                      )}
                      {isError && email.error_message && (
                        <p className="mt-1 text-xs text-accent-red">{email.error_message}</p>
                      )}
                    </div>

                    <div className="flex flex-shrink-0 flex-wrap gap-2 sm:flex-col sm:items-end">
                      {(isDeclined || isError) && (
                        <Button size="sm" onClick={() => setConvertTarget(email)}>
                          <Plus className="h-3.5 w-3.5" />
                          É uma despesa
                        </Button>
                      )}
                      {(isDeclined || isError) && (
                        <Button size="sm" variant="secondary" onClick={() => setRuleTarget(email)}>
                          <Zap className="h-3.5 w-3.5" />
                          Criar regra
                        </Button>
                      )}
                      {isDeclined && (
                        <Button size="sm" variant="ghost" onClick={() => handleIgnore(email)}>
                          Ignorar
                        </Button>
                      )}
                      {isIgnored && (
                        <Button size="sm" variant="ghost" onClick={() => handleRestore(email)}>
                          Restaurar
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      <ConvertToTransactionModal
        scannedEmail={convertTarget}
        open={!!convertTarget}
        onClose={() => setConvertTarget(null)}
      />

      <CreateRuleModal
        open={!!ruleTarget}
        onClose={() => setRuleTarget(null)}
        initialFromAddress={ruleTarget?.from_address}
        initialSubject={ruleTarget?.subject}
        initialAction="ignore"
      />
    </div>
  )
}
