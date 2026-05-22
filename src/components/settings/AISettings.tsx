import { useEffect, useState } from 'react'
import { Eye, EyeOff, Mail, Tag as TagIcon, Repeat, CheckCircle2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { useAIConfig, useUpdateAIConfig } from '@/hooks/useAIConfig'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

function validateKey(key: string): string | null {
  if (!key.trim()) return 'A chave de API é obrigatória'
  if (!key.startsWith('sk-')) return 'A chave da OpenAI deve começar com "sk-"'
  if (key.length < 20) return 'A chave parece curta demais'
  return null
}

export function AISettings() {
  const { user } = useAuth()
  const { data: existingConfig, isLoading } = useAIConfig()
  const updateMutation = useUpdateAIConfig()

  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isOwner, setIsOwner] = useState<boolean | null>(null)

  // Checa role do user atual — apenas owner pode editar a chave app-wide.
  useEffect(() => {
    let cancelled = false
    if (!user) {
      setIsOwner(false)
      return
    }
    supabase
      .from('fo_users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsOwner((data as { role?: string } | null)?.role === 'owner')
      })
    return () => {
      cancelled = true
    }
  }, [user])

  async function handleSave() {
    setError('')
    setSuccess('')
    const validationError = validateKey(apiKey)
    if (validationError) {
      setError(validationError)
      return
    }
    try {
      await updateMutation.mutateAsync({ provider: 'openai', api_key: apiKey })
      setSuccess('Chave salva com sucesso. Vale para toda a instância.')
      setApiKey('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    }
  }

  if (isOwner === false) {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 shrink-0 text-accent-yellow" />
          <div>
            <h3 className="text-sm font-semibold text-white">Apenas o owner pode configurar a IA</h3>
            <p className="mt-1 text-xs text-slate-400">
              A OpenAI Key é app-wide nesta instância: vale para todos os usuários e só pode ser
              editada pelo owner. Se você for o owner mas vê esta mensagem, faça login com a conta
              de owner.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white">IA (app-wide)</h3>
        <p className="mt-1 text-sm text-slate-400">
          Configure a chave OpenAI para ativar a inteligência do FinanceOS. A chave é compartilhada
          entre todos os usuários desta instância e fica criptografada (AES-256-GCM) no seu Supabase.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card padding="sm">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-accent-blue/10 p-2">
              <Mail className="h-5 w-5 text-accent-blue" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Lê emails bancários</h4>
              <p className="mt-1 text-xs text-slate-400">
                A IA abre as notificações do Gmail e transforma em transações com valor, data e destinatário.
              </p>
            </div>
          </div>
        </Card>

        <Card padding="sm">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-accent-green/10 p-2">
              <TagIcon className="h-5 w-5 text-accent-green" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Categoriza por CNPJ</h4>
              <p className="mt-1 text-xs text-slate-400">
                Quando identifica um CNPJ, busca a empresa e sugere a categoria correta.
              </p>
            </div>
          </div>
        </Card>

        <Card padding="sm">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-accent-yellow/10 p-2">
              <Repeat className="h-5 w-5 text-accent-yellow" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Encontra assinaturas</h4>
              <p className="mt-1 text-xs text-slate-400">
                Analisa o histórico e identifica pagamentos que se repetem todo mês.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-slate-400">Carregando configuração...</p>
          ) : existingConfig ? (
            <div className="flex items-center gap-2 rounded-lg border border-accent-green/20 bg-accent-green/10 px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-accent-green" />
              <p className="text-sm text-slate-200">
                OpenAI configurada e ativa para toda a instância.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-accent-yellow/20 bg-accent-yellow/10 px-3 py-2">
              <p className="text-sm text-slate-200">
                Nenhuma chave configurada. Os recursos de IA ficam desativados até uma chave ser salva.
              </p>
            </div>
          )}

          <div className="rounded-lg border border-white/10 bg-surface-light/50 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              Como obter sua chave OpenAI
            </p>
            <ol className="list-inside list-decimal space-y-1 text-sm text-slate-300">
              <li>
                Acesse{' '}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-blue hover:underline"
                >
                  platform.openai.com/api-keys
                </a>
                .
              </li>
              <li>
                Clique em <span className="font-medium text-white">Create new secret key</span>, dê o nome "FinanceOS".
              </li>
              <li>
                Copie a chave (começa com <code className="rounded bg-surface px-1">sk-…</code>) e cole abaixo.
              </li>
              <li>
                Garanta crédito em{' '}
                <a
                  href="https://platform.openai.com/billing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-blue hover:underline"
                >
                  platform.openai.com/billing
                </a>
                .
              </li>
            </ol>
          </div>

          <div className="relative">
            <Input
              label="Chave de API OpenAI"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-3 top-[34px] text-slate-400 hover:text-white"
              aria-label={showKey ? 'Ocultar chave' : 'Mostrar chave'}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
          )}
          {success && (
            <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">{success}</p>
          )}

          <div className="flex items-center gap-2">
            <Button
              onClick={handleSave}
              loading={updateMutation.isPending}
              disabled={!apiKey.trim()}
            >
              Salvar
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
