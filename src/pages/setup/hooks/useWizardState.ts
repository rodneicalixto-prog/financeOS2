import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'agentise.setup.state'

export interface CoreCreds {
  supabase_url: string
  supabase_anon_key: string
  supabase_service_role_key: string
  supabase_pat: string
  vercel_token: string
}

export interface WizardState {
  currentStep: 1 | 2 | 3 | 4
  core: CoreCreds
  appCreds: Record<string, string>
  owner: { email: string; password: string; name: string }
}

const DEFAULT_STATE: WizardState = {
  currentStep: 1,
  core: {
    supabase_url: '',
    supabase_anon_key: '',
    supabase_service_role_key: '',
    supabase_pat: '',
    vercel_token: '',
  },
  appCreds: {},
  owner: { email: '', password: '', name: '' },
}

function load(): WizardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw) as Partial<WizardState>
    return {
      currentStep: parsed.currentStep ?? 1,
      core: { ...DEFAULT_STATE.core, ...(parsed.core ?? {}) },
      appCreds: parsed.appCreds ?? {},
      owner: { ...DEFAULT_STATE.owner, ...(parsed.owner ?? {}) },
    }
  } catch {
    return DEFAULT_STATE
  }
}

export function useWizardState() {
  const [state, setState] = useState<WizardState>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // localStorage cheio / private mode — ignora
    }
  }, [state])

  const setCore = useCallback((patch: Partial<CoreCreds>) => {
    setState((prev) => ({ ...prev, core: { ...prev.core, ...patch } }))
  }, [])

  const setAppCred = useCallback((key: string, value: string) => {
    setState((prev) => ({ ...prev, appCreds: { ...prev.appCreds, [key]: value } }))
  }, [])

  const setOwner = useCallback((patch: Partial<WizardState['owner']>) => {
    setState((prev) => ({ ...prev, owner: { ...prev.owner, ...patch } }))
  }, [])

  const goToStep = useCallback((step: WizardState['currentStep']) => {
    setState((prev) => ({ ...prev, currentStep: step }))
  }, [])

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    setState(DEFAULT_STATE)
  }, [])

  return { state, setCore, setAppCred, setOwner, goToStep, reset }
}
