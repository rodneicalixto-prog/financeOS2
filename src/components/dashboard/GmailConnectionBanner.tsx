import { Mail, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useGmailConnection } from '@/hooks/useGmailConnection'

export function GmailConnectionBanner() {
  const { data: connections, isLoading } = useGmailConnection()

  if (isLoading || (connections && connections.length > 0)) return null

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-accent-yellow/30 bg-accent-yellow/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Mail className="mt-0.5 h-5 w-5 shrink-0 text-accent-yellow" />
        <div>
          <p className="text-sm font-medium text-white">
            Conecte seu Gmail para importar transações automaticamente
          </p>
          <p className="mt-0.5 text-xs text-slate-300">
            Sem o Gmail conectado, o FinanceOS não consegue ler as notificações do seu banco e criar transações sozinho.
          </p>
        </div>
      </div>
      <Link
        to="/configuracoes?tab=gmail"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent-yellow px-3 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-yellow-400"
      >
        Conectar Gmail
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
