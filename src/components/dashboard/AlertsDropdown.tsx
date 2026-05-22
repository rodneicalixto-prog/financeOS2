import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, AlertTriangle, DollarSign, TrendingUp, RefreshCw, Check, Sparkles, ArrowRight, Mail } from 'lucide-react'
import { useAlerts } from '@/hooks/useAlerts'
import { useAIConfig } from '@/hooks/useAIConfig'
import { useGmailConnection } from '@/hooks/useGmailConnection'
import { formatDateRelative } from '@/lib/format'
import type { AlertType } from '@/types'

const alertIcons: Record<AlertType, typeof AlertTriangle> = {
  budget_exceeded: AlertTriangle,
  low_balance: DollarSign,
  large_transaction: TrendingUp,
  recurring_detected: RefreshCw,
  anomaly_detected: AlertTriangle,
}

const alertColors: Record<AlertType, string> = {
  budget_exceeded: 'text-accent-red',
  low_balance: 'text-accent-yellow',
  large_transaction: 'text-accent-orange',
  recurring_detected: 'text-accent-blue',
  anomaly_detected: 'text-accent-orange',
}

export function AlertsDropdown() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { data: alerts, unreadCount, markAsRead, markAllAsRead } = useAlerts()
  const { data: aiConfig, isLoading: aiConfigLoading } = useAIConfig()
  const { data: gmailConnections, isLoading: gmailLoading } = useGmailConnection()

  const aiConfigMissing = !aiConfigLoading && !aiConfig
  const gmailMissing = !gmailLoading && (!gmailConnections || gmailConnections.length === 0)
  const virtualAlertsCount = (aiConfigMissing ? 1 : 0) + (gmailMissing ? 1 : 0)
  const effectiveUnreadCount = unreadCount + virtualAlertsCount
  const hasAnyContent = aiConfigMissing || gmailMissing || (alerts && alerts.length > 0)

  function handleConfigureAI() {
    setOpen(false)
    navigate('/configuracoes?tab=ia')
  }

  function handleConnectGmail() {
    setOpen(false)
    navigate('/configuracoes?tab=gmail')
  }

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
        title="Alertas"
      >
        <Bell className="h-5 w-5" />
        {effectiveUnreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent-red text-[10px] font-bold text-white">
            {effectiveUnreadCount > 9 ? '9+' : effectiveUnreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="glass absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto p-2 z-50">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-sm font-medium text-white">Alertas</p>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead.mutate()}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
              >
                <Check className="h-3 w-3" />
                Marcar todos
              </button>
            )}
          </div>

          {/* Alerta virtual: IA não configurada */}
          {aiConfigMissing && (
            <div className="mt-1 rounded-lg border border-accent-yellow/30 bg-accent-yellow/10 p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent-yellow" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">Configure sua IA</p>
                  <p className="mt-0.5 text-xs text-slate-300">
                    Ative a leitura automática de emails bancários e a detecção de assinaturas para obter o máximo do sistema.
                  </p>
                  <button
                    onClick={handleConfigureAI}
                    className="mt-2 inline-flex items-center gap-1 rounded-md bg-accent-yellow px-2.5 py-1 text-xs font-semibold text-slate-900 transition-colors hover:bg-yellow-400"
                  >
                    Configurar IA
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Alerta virtual: Gmail não conectado */}
          {gmailMissing && (
            <div className="mt-1 rounded-lg border border-accent-yellow/30 bg-accent-yellow/10 p-3">
              <div className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-accent-yellow" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">Conecte seu Gmail</p>
                  <p className="mt-0.5 text-xs text-slate-300">
                    Sem o Gmail conectado, o sistema não consegue ler as notificações do seu banco e criar transações automaticamente.
                  </p>
                  <button
                    onClick={handleConnectGmail}
                    className="mt-2 inline-flex items-center gap-1 rounded-md bg-accent-yellow px-2.5 py-1 text-xs font-semibold text-slate-900 transition-colors hover:bg-yellow-400"
                  >
                    Conectar Gmail
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {!hasAnyContent && (
            <p className="px-2 py-6 text-center text-sm text-slate-500">
              Nenhum alerta
            </p>
          )}

          {alerts && alerts.length > 0 && (
            <div className="mt-1 space-y-1">
              {alerts.map((alert) => {
                const Icon = alertIcons[alert.type] || Bell
                const color = alertColors[alert.type] || 'text-slate-400'

                return (
                  <button
                    key={alert.id}
                    onClick={() => {
                      if (!alert.is_read) markAsRead.mutate(alert.id)
                    }}
                    className={`flex w-full items-start gap-3 rounded-lg p-2 text-left transition-colors hover:bg-white/5 ${
                      !alert.is_read ? 'bg-white/[0.02]' : ''
                    }`}
                  >
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${!alert.is_read ? 'text-white' : 'text-slate-400'}`}>
                        {alert.message}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDateRelative(alert.created_at)}
                      </p>
                    </div>
                    {!alert.is_read && (
                      <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent-blue" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
