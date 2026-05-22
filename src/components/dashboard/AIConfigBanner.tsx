import { Sparkles, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAIConfig } from '@/hooks/useAIConfig'

export function AIConfigBanner() {
  const { data: aiConfig, isLoading } = useAIConfig()

  if (isLoading || aiConfig) return null

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-accent-yellow/30 bg-accent-yellow/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-accent-yellow" />
        <div>
          <p className="text-sm font-medium text-white">
            Configure sua IA para aproveitar o máximo do FinanceOS
          </p>
          <p className="mt-0.5 text-xs text-slate-300">
            Sem uma chave de IA, o sistema não consegue ler seus emails bancários automaticamente nem detectar assinaturas recorrentes.
          </p>
        </div>
      </div>
      <Link
        to="/configuracoes?tab=ia"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent-yellow px-3 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-yellow-400"
      >
        Configurar IA
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
