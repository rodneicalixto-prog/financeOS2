import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { DollarSign, Lock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'
import { useSignupStatus } from '@/hooks/useSignupStatus'

type Tab = 'login' | 'signup'

export function LoginPage() {
  const { data: signupStatus, isLoading: loadingStatus } = useSignupStatus()
  const selfSignupOpen = signupStatus?.first_user_pending ?? false

  const [tab, setTab] = useState<Tab>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loadingStatus && !selfSignupOpen && tab === 'signup') {
      setTab('login')
    }
  }, [loadingStatus, selfSignupOpen, tab])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (tab === 'login') {
        await signIn(email, password)
      } else {
        await signUp(email, password, name)
      }
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div className="pointer-events-none absolute inset-0 bg-glow" />
      <Card className="relative w-full max-w-md" padding="lg">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1E3A8A] to-[#3B82F6] shadow-[0_0_30px_rgba(59,130,246,0.5)]">
            <DollarSign className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">FinanceOS</h1>
          <p className="mt-1 text-label-upper">Relatório financeiro pessoal</p>
        </div>

        {selfSignupOpen ? (
          <div className="mb-6 flex rounded-xl border border-[rgba(59,130,246,0.15)] bg-[rgba(15,18,35,0.5)] p-1">
            <button
              onClick={() => setTab('login')}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all duration-300 ${
                tab === 'login'
                  ? 'bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => setTab('signup')}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all duration-300 ${
                tab === 'signup'
                  ? 'bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Criar conta
            </button>
          </div>
        ) : (
          <div className="mb-6 flex items-start gap-2 rounded-xl border border-[rgba(59,130,246,0.18)] bg-[rgba(59,130,246,0.06)] p-3 text-sm">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent-blue-light" />
            <p className="text-slate-300">
              Cadastro fechado. Para entrar, peça um convite ao owner desta instância.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'signup' && selfSignupOpen && (
            <Input
              label="Nome"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              required
            />
          )}
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
          />
          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Sua senha"
            required
            minLength={6}
          />

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
          )}

          <Button type="submit" loading={loading} className="w-full" size="lg">
            {tab === 'login' ? 'Entrar' : 'Criar conta'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
