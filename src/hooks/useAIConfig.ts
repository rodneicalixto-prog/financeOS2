// =============================================================================
// src/hooks/useAIConfig.ts
// -----------------------------------------------------------------------------
// Após o refactor do wizard /setup, a OpenAI key vive em public.app_settings
// (app-wide, gerenciada pelo owner) em vez de fo_ai_configs (per-user).
// Este hook continua expondo a mesma interface dos consumidores — mas
// internamente consulta /api/app-settings-status e mostra apenas booleanos.
//
// O valor da chave nunca chega ao client. Para atualizar, use o endpoint
// owner-only /api/credentials via `useUpdateAIConfig`.
// =============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import type { AIConfig, AIProvider } from '@/types'

interface AppSettingsStatus {
  status: Record<string, boolean>
  has_openai: boolean
  has_gmail: boolean
}

export function useAIConfig() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['app-settings-status'],
    queryFn: async (): Promise<AIConfig | null> => {
      const res = await fetch('/api/app-settings-status')
      if (!res.ok) throw new Error(`status falhou (${res.status})`)
      const json = (await res.json()) as { success: boolean } & AppSettingsStatus
      if (!json.success) throw new Error('status falhou')
      if (!json.has_openai) return null
      // Stub mínimo pra manter contrato com consumidores existentes.
      return {
        id: 'app-wide',
        user_id: session?.user.id ?? 'app-wide',
        provider: 'openai',
        api_key: '••••••••',
        updated_at: new Date().toISOString(),
      } as AIConfig
    },
    staleTime: 30_000,
  })
}

interface UpdateAIConfigInput {
  provider: AIProvider
  api_key: string
}

async function getAuthHeader(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? `Bearer ${token}` : null
}

export function useUpdateAIConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateAIConfigInput) => {
      if (input.provider !== 'openai') {
        throw new Error(
          'A configuração app-wide aceita apenas OpenAI. Gemini ficou no fluxo per-user antigo (deprecado).',
        )
      }
      const authHeader = await getAuthHeader()
      const res = await fetch('/api/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({ openai_api_key: input.api_key }),
      })
      const json = (await res.json()) as { success?: boolean; message?: string }
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? `HTTP ${res.status}`)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings-status'] })
    },
  })
}

export function useDeleteAIConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      throw new Error(
        'Remover a chave global desativa o app inteiro. Para trocar, salve uma nova chave em vez de remover.',
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings-status'] })
    },
  })
}
