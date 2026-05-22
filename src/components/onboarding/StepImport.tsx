import { useState } from 'react'
import { Download, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'

interface StepImportProps {
  onNext: () => void
  onBack: () => void
}

export function StepImport({ onNext, onBack }: StepImportProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleImport() {
    setStatus('loading')
    setMessage('Buscando emails bancários...')

    try {
      const { data, error } = await supabase.functions.invoke('sync-emails')

      if (error) throw error

      const result = data as { emails_processed?: number }
      setStatus('success')
      setMessage(
        result?.emails_processed
          ? `${result.emails_processed} transações importadas!`
          : 'Nenhuma transação encontrada nos seus emails recentes.'
      )
    } catch (err) {
      setStatus('error')
      setMessage(
        err instanceof Error
          ? err.message
          : 'Erro ao importar. Você pode tentar novamente depois.'
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-white">Importação Inicial</h2>
        <p className="mt-2 text-sm text-slate-400">
          Vamos importar suas transações recentes a partir dos emails bancários.
        </p>
      </div>

      <Card className="flex flex-col items-center gap-4 text-center">
        {status === 'idle' && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-light">
              <Download className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-sm text-slate-400">
              A importação busca emails de notificação dos bancos selecionados.
            </p>
            <Button onClick={handleImport}>
              <Download className="h-4 w-4" />
              Importar Agora
            </Button>
          </>
        )}

        {status === 'loading' && (
          <>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-blue border-t-transparent" />
            <p className="text-sm text-slate-400">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="h-12 w-12 text-accent-green" />
            <p className="font-medium text-white">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="h-12 w-12 text-accent-orange" />
            <p className="text-sm text-slate-400">{message}</p>
            <Button variant="secondary" onClick={handleImport} size="sm">
              Tentar novamente
            </Button>
          </>
        )}
      </Card>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onBack} className="flex-1">
          Voltar
        </Button>
        <Button onClick={onNext} className="flex-1">
          {status === 'success' ? 'Continuar' : 'Pular'}
        </Button>
      </div>
    </div>
  )
}
