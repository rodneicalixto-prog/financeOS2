import { useState, useEffect, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { DollarSign, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

export function AcceptInvitePage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Pré-preenche nome do metadata (passado pelo create-invite via inviteUserByEmail.data.name)
  useEffect(() => {
    if (!user) return
    const meta = (user.user_metadata ?? {}) as { name?: string }
    if (meta.name && !name) setName(meta.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Senha precisa ter ao menos 8 caracteres')
      return
    }
    if (password !== confirm) {
      setError('As senhas não conferem')
      return
    }

    setSubmitting(true)
    try {
      const trimmedName = name.trim() || (user?.email?.split('@')[0] ?? '')

      const { error: updErr } = await supabase.auth.updateUser({
        password,
        data: { name: trimmedName },
      })
      if (updErr) throw updErr

      if (user) {
        await supabase
          .from('fo_users')
          .update({ name: trimmedName })
          .eq('id', user.id)
      }

      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao definir senha')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <AcceptShell>
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-blue border-t-transparent" />
        </div>
      </AcceptShell>
    )
  }

  if (!user) {
    return (
      <AcceptShell>
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="h-6 w-6 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Convite inválido ou expirado</h2>
          <p className="mt-2 max-w-sm text-sm text-slate-400">
            O link que você abriu não tem uma sessão válida. Pode ter expirado ou já sido usado.
            Solicite um novo convite ao owner da instância.
          </p>
          <Button onClick={() => navigate('/login')} className="mt-6" variant="secondary">
            Ir para login
          </Button>
        </div>
      </AcceptShell>
    )
  }

  return (
    <AcceptShell>
      <div className="mb-6 rounded-xl border border-[rgba(59,130,246,0.2)] bg-[rgba(59,130,246,0.06)] p-4 text-sm">
        <p className="text-white">Você foi convidado para o FinanceOS!</p>
        <p className="mt-1 text-slate-400">Defina uma senha para entrar como <strong>{user.email}</strong></p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Seu nome"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Como prefere ser chamado?"
        />
        <Input label="Email" type="email" value={user.email ?? ''} disabled />
        <Input
          label="Senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 8 caracteres"
          required
          minLength={8}
        />
        <Input
          label="Confirme a senha"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
        />

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}

        <Button type="submit" loading={submitting} className="w-full" size="lg">
          Definir senha e entrar
        </Button>
      </form>
    </AcceptShell>
  )
}

function AcceptShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div className="pointer-events-none absolute inset-0 bg-glow" />
      <Card className="relative w-full max-w-md" padding="lg">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1E3A8A] to-[#3B82F6] shadow-[0_0_30px_rgba(59,130,246,0.5)]">
            <DollarSign className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">FinanceOS</h1>
          <p className="mt-1 text-label-upper">Aceitar convite</p>
        </div>
        {children}
      </Card>
    </div>
  )
}
