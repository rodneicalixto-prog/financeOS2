import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Mail, RefreshCw, CheckCircle, Sparkles, Wallet, Link2, ArrowRight, HelpCircle, Unlink, Plus, Trash2, ChevronDown, ChevronRight, ArrowUpRight, ArrowDownLeft, Repeat, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/hooks/useAuth'
import { useAIConfig } from '@/hooks/useAIConfig'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { useScannedEmailCounts } from '@/hooks/useScannedEmails'
import { supabase } from '@/lib/supabase'
import { getGmailAuthUrl } from '@/lib/gmail'
import { formatDate, formatBRL } from '@/lib/format'
import type { GmailConnection, SyncLog, Transaction } from '@/types'

export function GmailSettings() {
  const { user } = useAuth()
  const [, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [connections, setConnections] = useState<GmailConnection[]>([])
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])
  const [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [helpOpen, setHelpOpen] = useState(false)
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
  const [confirmDisconnectId, setConfirmDisconnectId] = useState<string | null>(null)
  const [importedEmails, setImportedEmails] = useState<Transaction[]>([])

  const { data: aiConfig } = useAIConfig()
  const { data: bankAccounts } = useBankAccounts()
  const { data: scannedCounts } = useScannedEmailCounts()
  const navigate = useNavigate()
  const needsReview = (scannedCounts?.declined ?? 0) + (scannedCounts?.error ?? 0)

  const hasGmail = connections.length > 0
  const hasAI = !!aiConfig
  const hasBanks = !!bankAccounts && bankAccounts.length > 0
  const isReady = hasGmail && hasAI && hasBanks

  async function loadConnections() {
    if (!user) return
    const { data: conns } = await supabase
      .from('fo_gmail_connections')
      .select('*')
      .eq('user_id', user.id)
      .order('connected_at', { ascending: true })
    setConnections((conns || []) as GmailConnection[])

    const { data: logs } = await supabase
      .from('fo_sync_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(5)
    setSyncLogs((logs || []) as SyncLog[])

    const { data: emailTxns } = await supabase
      .from('fo_transactions')
      .select('id, description, amount, type, date, status, source_email_id, raw_email_data, ai_parsed_data, cnpj')
      .eq('user_id', user.id)
      .not('source_email_id', 'is', null)
      .order('date', { ascending: false })
      .limit(20)
    setImportedEmails((emailTxns || []) as Transaction[])

    setLoading(false)
  }

  useEffect(() => {
    loadConnections()
  }, [user])

  // Escuta mensagem do popup OAuth para atualizar estado + cache
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'gmail-oauth-success') {
        loadConnections()
        queryClient.invalidateQueries({ queryKey: ['gmail-connections'] })
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [user, queryClient])

  async function handleSync() {
    setSyncing(true)
    try {
      await supabase.functions.invoke('sync-emails')
      await loadConnections()
    } catch {
      // handled silently
    } finally {
      setSyncing(false)
    }
  }

  async function handleAddEmail() {
    try {
      const url = await getGmailAuthUrl()
      window.open(url, 'gmail-oauth', 'width=600,height=700')
    } catch (err) {
      alert((err as Error).message)
    }
  }

  async function handleDisconnect(connId: string) {
    if (!user) return
    setDisconnectingId(connId)
    try {
      await supabase.from('fo_gmail_connections').delete().eq('id', connId)
      setConnections((prev) => prev.filter((c) => c.id !== connId))
      setConfirmDisconnectId(null)
      await queryClient.invalidateQueries({ queryKey: ['gmail-connections'] })
    } finally {
      setDisconnectingId(null)
    }
  }

  if (loading) {
    return <Card><p className="text-slate-400">Carregando...</p></Card>
  }

  const disconnectTarget = connections.find((c) => c.id === confirmDisconnectId)

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-white">Gmail</h3>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            title="Como funciona a sincronização"
            aria-label="Como funciona a sincronização"
            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-white/5 hover:text-accent-blue"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Conecte suas contas Gmail para importar transações bancárias automaticamente. Você pode
          adicionar múltiplos emails e o FinanceOS sincroniza todos de uma vez.
        </p>
      </div>

      {/* Checklist de pré-requisitos */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-white">Checklist para sincronizar</h4>
          {isReady && (
            <span className="flex items-center gap-1 text-xs font-medium text-accent-green">
              <CheckCircle className="h-3.5 w-3.5" />
              Pronto para sincronizar
            </span>
          )}
        </div>
        <div className="space-y-2">
          <ChecklistItem
            done={hasGmail}
            icon={Link2}
            title="Gmail conectado"
            description="Autorize o acesso de leitura à sua conta Google."
            actionLabel={hasGmail ? undefined : 'Conectar Gmail'}
            onAction={handleAddEmail}
          />
          <ChecklistItem
            done={hasAI}
            icon={Sparkles}
            title="Chave de IA configurada"
            description="Cadastre sua chave da OpenAI ou Gemini para que o sistema possa parsear os emails."
            actionLabel={hasAI ? undefined : 'Configurar IA'}
            onAction={() => setSearchParams({ tab: 'ia' })}
          />
          <ChecklistItem
            done={hasBanks}
            icon={Wallet}
            title="Pelo menos uma conta bancária cadastrada"
            description="As transações importadas precisam ser associadas a uma conta. Sem contas, o sync não busca emails."
            actionLabel={hasBanks ? undefined : 'Cadastrar conta'}
            onAction={() => setSearchParams({ tab: 'contas' })}
          />
        </div>
      </Card>

      {/* Emails conectados */}
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-white">Emails conectados</h4>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate('/emails-analisados')}
              title="Revisar emails que a IA não conseguiu classificar"
            >
              <Inbox className="h-4 w-4" />
              Emails analisados
              {needsReview > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-yellow/20 px-1.5 text-[11px] font-semibold text-accent-yellow">
                  {needsReview}
                </span>
              )}
            </Button>
            {hasGmail && (
              <Button
                size="sm"
                onClick={handleSync}
                loading={syncing}
                disabled={!isReady}
                title={!isReady ? 'Complete o checklist acima antes de sincronizar' : undefined}
              >
                <RefreshCw className="h-4 w-4" />
                Sincronizar todos
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={handleAddEmail}>
              <Plus className="h-4 w-4" />
              Adicionar email
            </Button>
          </div>
        </div>

        {connections.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-light">
              <Mail className="h-6 w-6 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-300">Nenhum email conectado</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Conecte sua conta Gmail para começar a importar transações.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className="flex items-center gap-3 rounded-lg border border-white/5 bg-surface-light/30 p-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-green/10">
                  <CheckCircle className="h-4 w-4 text-accent-green" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {conn.email_address || 'Email desconhecido'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {conn.last_sync_at
                      ? `Último sync: ${formatDate(conn.last_sync_at)}`
                      : 'Nunca sincronizado'}
                  </p>
                </div>
                <button
                  onClick={() => setConfirmDisconnectId(conn.id)}
                  className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-accent-red/10 hover:text-accent-red"
                  title="Desconectar este email"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Emails importados com análise da IA */}
      {importedEmails.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">Emails Importados</h4>
            <span className="text-xs text-slate-500">{importedEmails.length} email{importedEmails.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-2">
            {importedEmails.map((txn) => (
              <EmailImportItem key={txn.id} transaction={txn} />
            ))}
          </div>
        </Card>
      )}

      {syncLogs.length > 0 && (
        <Card>
          <h4 className="mb-3 text-sm font-medium text-slate-400">Histórico de Sincronização</h4>
          <div className="space-y-2">
            {syncLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 text-sm">
                <span
                  className={`h-2 w-2 rounded-full ${
                    log.status === 'success'
                      ? 'bg-accent-green'
                      : log.status === 'partial'
                        ? 'bg-accent-yellow'
                        : 'bg-accent-red'
                  }`}
                />
                <span className="text-slate-300">{formatDate(log.started_at)}</span>
                <span className="text-slate-500">
                  {log.emails_processed}/{log.emails_found} emails
                </span>
                <span className="text-xs text-slate-500 capitalize">{log.status}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Modal: Como funciona a sincronização */}
      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Como funciona a sincronização"
        className="max-w-lg"
      >
        <ol className="space-y-3 text-sm text-slate-300">
          <li className="flex gap-2">
            <span className="font-semibold text-accent-blue">1.</span>
            <span>
              Você conecta suas contas Gmail autorizando acesso de leitura ao FinanceOS.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-accent-blue">2.</span>
            <span>
              Ao clicar em <strong className="text-white">Sincronizar todos</strong>, o sistema busca em
              todos os seus emails conectados por mensagens recentes com palavras como <em>pix, transferência,
              débito, crédito, receipt, payment, stripe, fatura</em>, etc.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-accent-blue">3.</span>
            <span>
              Cada email é enviado à IA que você configurou (OpenAI ou Gemini), que extrai
              valor, data, descrição, tipo (receita/despesa) e CNPJ do destinatário.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-accent-blue">4.</span>
            <span>
              Com o CNPJ em mãos, o sistema busca a empresa na base pública e sugere uma
              categoria automaticamente (Alimentação, Transporte, Assinaturas, etc).
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-accent-blue">5.</span>
            <span>
              A transação é criada no banco com status{' '}
              <strong className="text-white">pendente</strong> para você revisar. Emails
              duplicados são ignorados automaticamente.
            </span>
          </li>
        </ol>
        <p className="mt-4 rounded-md bg-surface-light/50 px-3 py-2 text-xs text-slate-400">
          <strong className="text-slate-300">Privacidade:</strong> o FinanceOS só tem permissão de
          leitura. Nenhum email é enviado ou alterado. Os tokens OAuth ficam criptografados no seu
          Supabase pessoal.
        </p>
      </Modal>

      {/* Modal: Confirmação de desconexão */}
      <Modal
        open={!!confirmDisconnectId}
        onClose={() => setConfirmDisconnectId(null)}
        title="Desconectar Gmail?"
      >
        <p className="text-sm text-slate-300">
          Desconectar <strong className="text-white">{disconnectTarget?.email_address || 'este email'}</strong>?
          Suas transações já importadas continuarão no sistema, mas novas sincronizações deste email
          só voltarão a funcionar após reconectar.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setConfirmDisconnectId(null)}
            disabled={!!disconnectingId}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => confirmDisconnectId && handleDisconnect(confirmDisconnectId)}
            loading={!!disconnectingId}
          >
            <Unlink className="h-4 w-4" />
            Desconectar
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function EmailImportItem({ transaction }: { transaction: Transaction }) {
  const [expanded, setExpanded] = useState(false)

  const raw = transaction.raw_email_data as Record<string, string> | null
  const ai = transaction.ai_parsed_data as Record<string, unknown> | null

  const subject = raw?.subject || transaction.description
  const from = raw?.from || '—'
  const emailDate = raw?.date || ''

  const typeConfig = {
    income: { label: 'Receita', color: 'text-accent-green bg-accent-green/10', icon: ArrowDownLeft },
    expense: { label: 'Despesa', color: 'text-accent-red bg-accent-red/10', icon: ArrowUpRight },
    transfer: { label: 'Transferência', color: 'text-accent-blue bg-accent-blue/10', icon: Repeat },
  }
  const config = typeConfig[transaction.type] || typeConfig.expense
  const TypeIcon = config.icon

  return (
    <div className="rounded-lg border border-white/5 bg-surface-light/30">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-white/5"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-blue/10">
          <Mail className="h-4 w-4 text-accent-blue" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{subject}</p>
          <p className="truncate text-xs text-slate-500">{from}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${config.color}`}>
            <TypeIcon className="h-3 w-3" />
            {config.label}
          </span>
          <span className="text-sm font-semibold text-white">{formatBRL(transaction.amount)}</span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-500" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/5 px-3 pb-3 pt-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <DetailRow label="Descrição (IA)" value={ai?.description as string} />
            <DetailRow label="Valor" value={formatBRL(transaction.amount)} />
            <DetailRow label="Data da transação" value={transaction.date ? formatDate(transaction.date) : '—'} />
            <DetailRow label="Data do email" value={emailDate} />
            <DetailRow label="CNPJ" value={transaction.cnpj || (ai?.cnpj as string) || '—'} />
            <DetailRow label="Contraparte" value={(ai?.counterpart_name as string) || '—'} />
            <DetailRow
              label="Status"
              value={transaction.status === 'confirmed' ? 'Confirmado' : 'Pendente'}
              valueClass={transaction.status === 'confirmed' ? 'text-accent-green' : 'text-accent-yellow'}
            />
            <DetailRow label="Tipo" value={config.label} />
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value, valueClass }: { label: string; value?: string | null; valueClass?: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-sm ${valueClass || 'text-slate-300'}`}>{value || '—'}</p>
    </div>
  )
}

interface ChecklistItemProps {
  done: boolean
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

function ChecklistItem({ done, icon: Icon, title, description, actionLabel, onAction }: ChecklistItemProps) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 ${
        done
          ? 'border-accent-green/20 bg-accent-green/5'
          : 'border-accent-yellow/30 bg-accent-yellow/5'
      }`}
    >
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          done ? 'bg-accent-green/10' : 'bg-accent-yellow/10'
        }`}
      >
        {done ? (
          <CheckCircle className="h-4 w-4 text-accent-green" />
        ) : (
          <Icon className="h-4 w-4 text-accent-yellow" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="mt-0.5 text-xs text-slate-400">{description}</p>
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-accent-yellow px-2.5 py-1 text-xs font-semibold text-slate-900 transition-colors hover:bg-yellow-400"
        >
          {actionLabel}
          <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
