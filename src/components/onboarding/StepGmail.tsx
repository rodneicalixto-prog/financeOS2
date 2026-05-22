import { useState, useEffect } from 'react'
import { Mail, CheckCircle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { getGmailAuthUrl } from '@/lib/gmail'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

interface StepGmailProps {
  onNext: () => void
}

export function StepGmail({ onNext }: StepGmailProps) {
  const { user } = useAuth()
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)

  // Verifica se já conectou
  useEffect(() => {
    if (!user) return
    supabase
      .from('fo_gmail_connections')
      .select('id')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setConnected(true)
      })
  }, [user])

  // Escuta retorno do OAuth (via popup ou redirect)
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'gmail-oauth-success') {
        setConnected(true)
        setLoading(false)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  async function handleConnect() {
    setLoading(true)
    try {
      const authUrl = await getGmailAuthUrl()
      const popup = window.open(authUrl, 'gmail-oauth', 'width=600,height=700')
      const interval = setInterval(() => {
        if (popup?.closed) {
          clearInterval(interval)
          setLoading(false)
        }
      }, 1000)
    } catch (err) {
      alert((err as Error).message)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-white">Conectar Gmail</h2>
        <p className="mt-2 text-sm text-slate-400">
          Conecte sua conta do Gmail para importar notificações de transações bancárias automaticamente.
        </p>
      </div>

      <Card className="flex flex-col items-center gap-4 text-center">
        {connected ? (
          <>
            <CheckCircle className="h-12 w-12 text-accent-green" />
            <div>
              <p className="font-medium text-white">Gmail conectado!</p>
              <p className="text-sm text-slate-400">
                Suas notificações bancárias serão importadas automaticamente.
              </p>
            </div>
            <Button onClick={onNext}>Continuar</Button>
          </>
        ) : (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-light">
              <Mail className="h-8 w-8 text-slate-400" />
            </div>
            <div>
              <p className="font-medium text-white">
                Permissão de leitura de emails
              </p>
              <p className="text-sm text-slate-400">
                Apenas leitura. Não enviamos nem alteramos seus emails.
              </p>
            </div>
            <Button onClick={handleConnect} loading={loading}>
              <Mail className="h-4 w-4" />
              Conectar Gmail
              <ExternalLink className="h-3 w-3" />
            </Button>
            <button
              onClick={onNext}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Pular por agora
            </button>
          </>
        )}
      </Card>
    </div>
  )
}
