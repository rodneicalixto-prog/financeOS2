import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { BrandingSettings } from '@/types'

export const DEFAULT_BRANDING: BrandingSettings = {
  id: true,
  app_name: 'FinanceOS',
  logo_url: null,
  favicon_url: null,
  primary_color: '#3B82F6',
  theme_mode: 'dark',
  updated_by: null,
  updated_at: '',
}

export function useBranding() {
  return useQuery({
    queryKey: ['branding-settings'],
    queryFn: async (): Promise<BrandingSettings> => {
      const { data, error } = await supabase
        .from('fo_branding_settings')
        .select('*')
        .eq('id', true)
        .maybeSingle()
      if (error) throw error
      return (data as BrandingSettings) || DEFAULT_BRANDING
    },
    staleTime: 1000 * 60 * 5,
  })
}

export function useUpdateBranding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<Omit<BrandingSettings, 'id' | 'updated_by' | 'updated_at'>>) => {
      const { data: userData } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('fo_branding_settings')
        .update({ ...patch, updated_by: userData.user?.id, updated_at: new Date().toISOString() })
        .eq('id', true)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branding-settings'] })
    },
  })
}
