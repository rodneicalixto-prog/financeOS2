import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { FoUser } from './useCurrentUser'

async function unwrapFunctionsError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json()
      const msg = (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string')
        ? body.error
        : error.message
      return new Error(msg)
    } catch {
      return new Error(error.message)
    }
  }
  return error instanceof Error ? error : new Error(String(error))
}

export interface CreateInviteResponse {
  ok: boolean
  user_id: string
  email: string
  email_sent: boolean
}

export function useInstanceUsers() {
  return useQuery({
    queryKey: ['fo-users', 'all'],
    queryFn: async (): Promise<FoUser[]> => {
      const { data, error } = await supabase
        .from('fo_users')
        .select('id, email, name, role, created_at')
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as FoUser[]
    },
  })
}

export function useCreateInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (email: string): Promise<CreateInviteResponse> => {
      const { data, error } = await supabase.functions.invoke<CreateInviteResponse>(
        'create-invite',
        {
          body: { email, role: 'member' },
        },
      )
      if (error) throw await unwrapFunctionsError(error)
      if (!data || !data.ok) throw new Error('Resposta inválida da Edge Function')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fo-users'] })
    },
  })
}
