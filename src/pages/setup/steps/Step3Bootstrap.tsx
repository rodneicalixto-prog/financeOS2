import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { setupConfig } from '../../../../setup.config'
import { Timeline, type TimelineStatus } from '../components/Timeline'
import { WizardLayout } from '../components/WizardLayout'
import type { CoreCreds, WizardState } from '../hooks/useWizardState'

type Phase = 'migrations' | 'deploy' | 'redeploy' | 'owner'

interface PhaseDef {
  key: Phase
  label: string
  detailWhenDone: (meta: Record<string, unknown>) => string
}

const PHASE_DEFS: PhaseDef[] = [
  {
    key: 'migrations',
    label: 'Rodando migrations no Supabase',
    detailWhenDone: (m) =>
      `${m.migrations_total ?? '?'} migrations · ${m.migrations_run_now ?? 0} aplicadas agora`,
  },
  {
    key: 'deploy',
    label: 'Deployando Edge Functions e setando envs',
    detailWhenDone: (m) => {
      const ef = m.edge_functions as { ok?: number; total?: number } | undefined
      const v = m.vercel_project as { name?: string } | undefined
      const c = m.sync_cron as { ok?: boolean; schedule?: string } | undefined
      const cron = c ? (c.ok ? ` · cron ${c.schedule}` : ' · cron falhou') : ''
      return `${ef?.ok ?? '?'}/${ef?.total ?? '?'} EFs · projeto ${v?.name ?? '?'}${cron}`
    },
  },
  {
    key: 'redeploy',
    label: 'Disparando redeploy do Vercel',
    detailWhenDone: (m) => {
      const d = m.deployment as { url?: string } | undefined
      return d?.url ? `Deployment: ${d.url}` : 'OK'
    },
  },
  {
    key: 'owner',
    label: 'Criando sua conta de owner',
    detailWhenDone: (m) => {
      const u = m.user as { email?: string } | undefined
      return u?.email ? `Conta ${u.email} pronta` : 'OK'
    },
  },
]

interface Step3Props {
  core: CoreCreds
  owner: WizardState['owner']
  onComplete: () => void
  onBack: () => void
}

interface PhaseState {
  status: TimelineStatus
  detail?: string
  errorMessage?: string
}

export function Step3Bootstrap({ core, owner, onComplete, onBack }: Step3Props) {
  const [phaseStates, setPhaseStates] = useState<Record<Phase, PhaseState>>({
    migrations: { status: 'pending' },
    deploy: { status: 'pending' },
    redeploy: { status: 'pending' },
    owner: { status: 'pending' },
  })
  const [running, setRunning] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const started = useRef(false)

  const updatePhase = (p: Phase, s: Partial<PhaseState>) =>
    setPhaseStates((prev) => ({ ...prev, [p]: { ...prev[p], ...s } }))

  async function runAllPhases() {
    setRunning(true)
    setGlobalError(null)

    // Re-run pós-setup: o gate do /api/bootstrap exige JWT de owner quando o
    // setup já terminou. Anexa o token da sessão se houver (na first-run o app
    // ainda está cru — supabase é um stub que lança, então só tentamos se já
    // configurado). Sem token, segue anônimo (first-run, gate permite).
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.auth.getSession()
        if (data.session?.access_token) {
          headers.Authorization = `Bearer ${data.session.access_token}`
        }
      } catch {
        /* sem sessão — segue sem Authorization */
      }
    }

    const bootstrapBody = {
      supabase_url: core.supabase_url.trim(),
      supabase_anon_key: core.supabase_anon_key.trim(),
      supabase_service_role_key: core.supabase_service_role_key.trim(),
      supabase_pat: core.supabase_pat.trim(),
      vercel_token: core.vercel_token.trim(),
      app_origin: window.location.origin,
      cron_schedule: setupConfig.cronSchedule,
    }

    // 1-3: chamadas /api/bootstrap?phase=...
    for (const def of PHASE_DEFS.slice(0, 3)) {
      updatePhase(def.key, { status: 'running' })
      try {
        const res = await fetch(`/api/bootstrap?phase=${def.key}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(bootstrapBody),
        })
        const json = (await res.json()) as Record<string, unknown> & {
          success?: boolean
          message?: string
        }
        if (!res.ok || !json.success) {
          updatePhase(def.key, { status: 'failed', errorMessage: json.message ?? `HTTP ${res.status}` })
          setGlobalError(json.message ?? `Falha no passo "${def.label}".`)
          setRunning(false)
          return
        }
        updatePhase(def.key, { status: 'done', detail: def.detailWhenDone(json) })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        updatePhase(def.key, { status: 'failed', errorMessage: msg })
        setGlobalError(msg)
        setRunning(false)
        return
      }
    }

    // 4: criar owner
    const ownerDef = PHASE_DEFS[3]
    if (ownerDef) {
      updatePhase(ownerDef.key, { status: 'running' })
      try {
        const res = await fetch('/api/create-owner', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            email: owner.email,
            password: owner.password,
            name: owner.name,
            // Envs no Vercel só valem no próximo deploy; manda as creds direto pra
            // create-owner conseguir falar com o Supabase já nesta primeira run.
            supabase_url: core.supabase_url.trim(),
            supabase_service_role_key: core.supabase_service_role_key.trim(),
          }),
        })
        const json = (await res.json()) as Record<string, unknown> & {
          success?: boolean
          message?: string
        }
        // 409 (já existe) é OK pra retry — o owner foi criado num run anterior.
        const alreadyExists = res.status === 409
        if ((!res.ok || !json.success) && !alreadyExists) {
          updatePhase(ownerDef.key, { status: 'failed', errorMessage: json.message ?? `HTTP ${res.status}` })
          setGlobalError(json.message ?? 'Falha ao criar conta de owner.')
          setRunning(false)
          return
        }
        updatePhase(ownerDef.key, {
          status: 'done',
          detail: alreadyExists ? `Owner já existia (retry idempotente)` : ownerDef.detailWhenDone(json),
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        updatePhase(ownerDef.key, { status: 'failed', errorMessage: msg })
        setGlobalError(msg)
        setRunning(false)
        return
      }
    }

    setRunning(false)
    setTimeout(onComplete, 800)
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    runAllPhases()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const timelineSteps = useMemo(
    () =>
      PHASE_DEFS.map((d) => ({
        key: d.key,
        label: d.label,
        status: phaseStates[d.key].status,
        detail: phaseStates[d.key].errorMessage ?? phaseStates[d.key].detail,
      })),
    [phaseStates],
  )

  const someFailed = (Object.keys(phaseStates) as Phase[]).some((p) => phaseStates[p].status === 'failed')

  return (
    <WizardLayout
      step={3}
      title="Bootstrap em execução"
      subtitle={
        running
          ? 'Não feche essa aba. Cada etapa leva 10–30 segundos.'
          : someFailed
            ? 'Falhou em algum passo. Confira a mensagem abaixo e tente de novo.'
            : 'Tudo certo! Avançando para o próximo passo...'
      }
      footer={
        someFailed ? (
          <>
            <button type="button" className="wizard-secondary" onClick={onBack} disabled={running}>
              ← Voltar e corrigir credenciais
            </button>
            <button type="button" className="wizard-cta" onClick={runAllPhases} disabled={running}>
              Tentar de novo
            </button>
          </>
        ) : null
      }
    >
      <Timeline steps={timelineSteps} />
      {globalError && (
        <div className="mt-5 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#EF4444]">Erro detalhado</p>
          <p className="mt-1 break-words text-sm text-slate-200">{globalError}</p>
        </div>
      )}
    </WizardLayout>
  )
}
