import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export function GmailCallbackPage() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [message, setMessage] = useState('Conectando ao Gmail...')

  useEffect(() => {
    async function exchangeCode() {
      const code = searchParams.get('code')
      const error = searchParams.get('error')

      if (error) {
        setStatus('error')
        setMessage('Autorização negada pelo usuário.')
        return
      }

      if (!code) {
        setStatus('error')
        setMessage('Código de autorização não encontrado.')
        return
      }

      try {
        const { data, error: fnError } = await supabase.functions.invoke('gmail-auth', {
          body: { code },
        })

        if (fnError) {
          // Tenta extrair o corpo real da resposta da function
          const ctx = (fnError as { context?: Response }).context
          if (ctx && typeof ctx.text === 'function') {
            try {
              const raw = await ctx.text()
              console.error('[gmail-auth] response body:', raw)
              try {
                const parsed = JSON.parse(raw)
                throw new Error(parsed.error || raw || fnError.message)
              } catch {
                throw new Error(raw || fnError.message)
              }
            } catch (inner) {
              if (inner instanceof Error && inner.message) throw inner
            }
          }
          throw fnError
        }

        const emailAddress = data?.email_address || ''
        setStatus('success')
        setMessage(emailAddress ? `Gmail ${emailAddress} conectado com sucesso!` : 'Gmail conectado com sucesso!')

        // Notifica janela pai (se aberto como popup)
        if (window.opener) {
          window.opener.postMessage({ type: 'gmail-oauth-success', email_address: emailAddress }, '*')
          setTimeout(() => window.close(), 1500)
        }
      } catch (err) {
        console.error('[gmail-auth] error:', err)
        setStatus('error')
        setMessage(err instanceof Error ? err.message : 'Erro ao conectar Gmail.')
      }
    }

    exchangeCode()
  }, [searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="glass-card p-8 text-center">
        {status === 'processing' && (
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-blue border-t-transparent" />
            <p className="text-slate-400">{message}</p>
          </div>
        )}
        {status === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-lg font-medium text-accent-green">{message}</p>
            <p className="text-sm text-slate-400">Você pode fechar esta janela.</p>
          </div>
        )}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-lg font-medium text-accent-red">{message}</p>
            <p className="text-sm text-slate-400">Feche esta janela e tente novamente.</p>
          </div>
        )}
      </div>
    </div>
  )
}
