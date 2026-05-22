import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { startOfMonth, format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import type { AIInsight, InsightType } from '@/types'

function useInsight(type: InsightType, month?: string) {
  const { user } = useAuth()
  const currentMonth = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const targetMonth = month || currentMonth

  return useQuery({
    queryKey: ['ai-insights', user?.id, type, targetMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fo_ai_insights')
        .select('*')
        .eq('user_id', user!.id)
        .eq('insight_type', type)
        .eq('reference_month', targetMonth)
        .maybeSingle()
      if (error) throw error
      return data as AIInsight | null
    },
    enabled: !!user,
  })
}

export function useGenerateInsight() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      functionName: 'ai-insights' | 'compute-insights'
      action: string
      month?: string
      force?: boolean
    }) => {
      const resp = await supabase.functions.invoke(params.functionName, {
        body: { action: params.action, month: params.month, force: params.force },
      })
      if (resp.error) throw resp.error
      return resp.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-insights'] })
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })
}

export function useMonthlySummary(month?: string) {
  return useInsight('monthly_summary', month)
}

export function useSpendingForecast(month?: string) {
  return useInsight('forecast', month)
}

export function useAnomalies(month?: string) {
  return useInsight('anomalies', month)
}

export function useBudgetSuggestions(month?: string) {
  return useInsight('budget_suggestions', month)
}
