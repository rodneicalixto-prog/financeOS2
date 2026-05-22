import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Users, Mail, Crown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useCreateInvite, useInstanceUsers } from '@/hooks/useInvites'

export function TeamPage() {
  const { user, loading: authLoading } = useAuth()
  const { data: currentUser, isLoading: loadingUser } = useCurrentUser()
  const { data: users = [], isLoading: loadingUsers } = useInstanceUsers()
  const createInvite = useCreateInvite()

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  if (authLoading || (user && (loadingUser || !currentUser))) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-blue border-t-transparent" />
      </div>
    )
  }

  if (!currentUser || currentUser.role !== 'owner') {
    return <Navigate to="/" replace />
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      await createInvite.mutateAsync(email.trim().toLowerCase())
      setSuccess(
        `Convite enviado para ${email}. A pessoa vai receber um email do Supabase com o link pra entrar.`,
      )
      setEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar convite')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Equipe</h1>
        <p className="mt-1 text-sm text-slate-400">
          Gerencie quem pode acessar esta instância. Cada usuário tem dados isolados (RLS por user).
        </p>
      </div>

      <Card padding="lg">
        <div className="mb-4 flex items-center gap-2">
          <Mail className="h-5 w-5 text-accent-blue-light" />
          <h2 className="text-lg font-semibold text-white">Convidar novo usuário</h2>
        </div>

        <p className="mb-4 text-xs text-slate-400">
          O convite é enviado pelo Supabase Auth (email com link pra definir senha).
          Após aceitar, o usuário aparece na lista abaixo com role <strong>member</strong>.
        </p>

        <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pessoa@exemplo.com"
              required
            />
          </div>
          <Button type="submit" loading={createInvite.isPending} size="lg">
            Enviar convite
          </Button>
        </form>

        {error && (
          <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}
        {success && (
          <p className="mt-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
            {success}
          </p>
        )}
      </Card>

      <Card padding="lg">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-accent-blue-light" />
          <h2 className="text-lg font-semibold text-white">Usuários da instância</h2>
        </div>

        {loadingUsers ? (
          <div className="py-8 text-center text-sm text-slate-400">Carregando…</div>
        ) : (
          <ul className="space-y-2">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between rounded-xl border border-[rgba(59,130,246,0.1)] bg-[rgba(15,18,35,0.4)] p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{u.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{u.email}</p>
                </div>
                <span
                  className={
                    u.role === 'owner'
                      ? 'inline-flex items-center gap-1 rounded-full border border-[rgba(255,184,0,0.35)] bg-[rgba(255,184,0,0.08)] px-2.5 py-1 text-xs font-medium text-yellow-300'
                      : 'inline-flex items-center gap-1 rounded-full border border-[rgba(59,130,246,0.25)] bg-[rgba(59,130,246,0.08)] px-2.5 py-1 text-xs font-medium text-accent-blue-light'
                  }
                >
                  {u.role === 'owner' && <Crown className="h-3 w-3" />}
                  {u.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
