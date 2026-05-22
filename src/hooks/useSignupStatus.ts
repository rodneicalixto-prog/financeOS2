import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface SignupStatus {
  first_user_pending: boolean
}

export function useSignupStatus() {
  return useQuery({
    queryKey: ['fo-signup-status'],
    queryFn: async (): Promise<SignupStatus> => {
      const { data, error } = await supabase.rpc('get_signup_status')
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      return { first_user_pending: !!row?.first_user_pending }
    },
    staleTime: 30_000,
  })
}

export interface InviteValidation {
  email: string
  role: 'owner' | 'member'
  valid: boolean
}

export function useValidateInvite(token: string | null) {
  return useQuery({
    queryKey: ['fo-validate-invite', token],
    enabled: !!token,
    queryFn: async (): Promise<InviteValidation | null> => {
      if (!token) return null
      const { data, error } = await supabase.rpc('validate_invite_token', { p_token: token })
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      if (!row) return null
      return {
        email: row.email,
        role: row.role,
        valid: !!row.valid,
      }
    },
  })
}
