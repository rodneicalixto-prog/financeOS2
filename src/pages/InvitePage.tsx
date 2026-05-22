import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DollarSign, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'
import { useValidateInvite } from '@/hooks/useSignupStatus'

export function InvitePage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const { data: invite, isLoading } = useValidateInvite(token)
  const { signUp, user } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  if (!token) {
    return (
      <InviteShell>
        <InviteError
          title="Link inválido"
          description="Este endereço não tem um token de convite. Solicite um novo convite ao owner."
        />
      </InviteShell>
    )
  }

  if (isLoading) {
    return (
      <InviteShell>
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-blue border-t-transparent" />
        </div>
      </InviteShell>
    )
  }

  if (!invite || !invite.valid) {
    return (
      <InviteShell>
        <InviteError
          title="Convite indisponível"
          description="Este convite não foi encontrado, já foi usado, foi revogado ou expirou. Peça um novo convite ao owner."
        />
      </InviteShell>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!invite || !token) return
    setError('')
    setSubmitting(true)
    try {
      const fallbackName = invite.email.split('@')[0] ?? invite.email
      await signUp(invite.email, password, name.trim() || fallbackName, token)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <InviteShell>
      <div className="mb-6 rounded-xl border border-[rgba(59,130,246,0.2)] bg-[rgba(59,130,246,0.06)] p-4 text-sm">
        <p className="text-white">
          Você foi convidado para acessar esta instância como <strong>{invite.role}</strong>.
        </p>
        <p className="mt-1 text-slate-400">Email do convite: {invite.email}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nome"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Como prefere ser chamado?"
        />
        <Input label="Email" type="email" value={invite.email} disabled />
        <Input
          label="Senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 8 caracteres"
          required
          minLength={8}
        />

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}

        <Button type="submit" loading={submitting} className="w-full" size="lg">
          Criar conta
        </Button>
      </form>
    </InviteShell>
  )
}

function InviteShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div className="pointer-events-none absolute inset-0 bg-glow" />
      <Card className="relative w-full max-w-md" padding="lg">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1E3A8A] to-[#3B82F6] shadow-[0_0_30px_rgba(59,130,246,0.5)]">
            <DollarSign className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">FinanceOS</h1>
          <p className="mt-1 text-label-upper">Convite</p>
        </div>
        {children}
      </Card>
    </div>
  )
}

function InviteError({ title, description }: { title: string; description: string }) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
        <AlertTriangle className="h-6 w-6 text-red-400" />
      </div>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-slate-400">{description}</p>
      <Button onClick={() => navigate('/login')} className="mt-6" variant="secondary">
        Voltar para o login
      </Button>
    </div>
  )
}
