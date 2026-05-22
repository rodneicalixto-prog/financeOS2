import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

export type OnboardingStep = 1 | 2 | 3 | 4

export function useOnboarding() {
  const { user } = useAuth()
  const [step, setStep] = useState<OnboardingStep>(1)
  const [completed, setCompleted] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    async function check() {
      // Verifica se já tem contas bancárias (indica onboarding completo)
      const { count } = await supabase
        .from('fo_bank_accounts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)

      setCompleted((count ?? 0) > 0)
      setLoading(false)
    }

    check()
  }, [user])

  const nextStep = useCallback(() => {
    setStep((s) => Math.min(s + 1, 4) as OnboardingStep)
  }, [])

  const prevStep = useCallback(() => {
    setStep((s) => Math.max(s - 1, 1) as OnboardingStep)
  }, [])

  const completeOnboarding = useCallback(() => {
    setCompleted(true)
  }, [])

  return { step, setStep, nextStep, prevStep, completed, loading, completeOnboarding }
}
