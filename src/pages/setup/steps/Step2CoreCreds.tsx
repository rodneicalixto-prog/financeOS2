import { useMemo, useState } from 'react'
import { CredentialInput, type ValidationFn } from '../components/CredentialInput'
import { WizardLayout } from '../components/WizardLayout'
import type { CoreCreds, WizardState } from '../hooks/useWizardState'

const URL_REGEX = /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/i

const validateSupabaseUrl: ValidationFn = async (value) =>
  URL_REGEX.test(value)
    ? { ok: true }
    : { ok: false, message: 'Formato esperado: https://abc1234.supabase.co' }

function makeSupabaseKeyValidator(getUrl: () => string, role: 'anon' | 'service'): ValidationFn {
  return async (value) => {
    if (value.length < 30) {
      return { ok: false, message: 'Chave muito curta — deve ser um JWT longo.' }
    }
    const url = getUrl()
    if (!URL_REGEX.test(url)) return { ok: true }
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/`, {
        headers: { apikey: value, Authorization: `Bearer ${value}` },
      })
      if (res.status === 401 || res.status === 403) {
        return { ok: false, message: `Chave ${role} rejeitada pelo Supabase (${res.status}).` }
      }
      return { ok: true }
    } catch {
      return { ok: true }
    }
  }
}

const validateSupabasePAT: ValidationFn = async (value) => {
  if (!value.startsWith('sbp_')) return { ok: false, message: 'PAT do Supabase começa com "sbp_".' }
  if (value.length < 30) return { ok: false, message: 'PAT muito curto.' }
  return { ok: true }
}

const validateVercelToken: ValidationFn = async (value) => {
  if (value.length < 20) return { ok: false, message: 'Token Vercel parece curto demais.' }
  return { ok: true }
}

const validateOwnerEmail: ValidationFn = async (value) =>
  /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)
    ? { ok: true }
    : { ok: false, message: 'Email inválido.' }

const validateOwnerPassword: ValidationFn = async (value) =>
  value.length >= 8
    ? { ok: true }
    : { ok: false, message: 'Senha precisa ter pelo menos 8 caracteres.' }

const validateOwnerName: ValidationFn = async (value) =>
  value.trim().length >= 2
    ? { ok: true }
    : { ok: false, message: 'Nome muito curto.' }

interface Step2Props {
  core: CoreCreds
  owner: WizardState['owner']
  onCoreChange: (patch: Partial<CoreCreds>) => void
  onOwnerChange: (patch: Partial<WizardState['owner']>) => void
  onNext: () => void
  onBack: () => void
}

type FieldKey =
  | keyof CoreCreds
  | 'owner_name'
  | 'owner_email'
  | 'owner_password'

export function Step2CoreCreds({ core, owner, onCoreChange, onOwnerChange, onNext, onBack }: Step2Props) {
  const [statuses, setStatuses] = useState<Record<FieldKey, 'idle' | 'pending' | 'ok' | 'error'>>({
    supabase_url: 'idle',
    supabase_anon_key: 'idle',
    supabase_service_role_key: 'idle',
    supabase_pat: 'idle',
    vercel_token: 'idle',
    owner_name: 'idle',
    owner_email: 'idle',
    owner_password: 'idle',
  })

  const setStatus = (k: FieldKey) => (s: 'idle' | 'pending' | 'ok' | 'error') =>
    setStatuses((prev) => ({ ...prev, [k]: s }))

  const allOk = useMemo(
    () => Object.values(statuses).every((s) => s === 'ok'),
    [statuses],
  )

  const anonValidator = useMemo(
    () => makeSupabaseKeyValidator(() => core.supabase_url, 'anon'),
    [core.supabase_url],
  )
  const serviceValidator = useMemo(
    () => makeSupabaseKeyValidator(() => core.supabase_url, 'service'),
    [core.supabase_url],
  )

  return (
    <WizardLayout
      step={2}
      title="Credenciais"
      subtitle="Cole as 5 credenciais do Supabase + Vercel e configure sua conta de owner. A validação acontece automaticamente em ~1s após você terminar de digitar."
      footer={
        <>
          <button type="button" className="wizard-secondary" onClick={onBack}>← Voltar</button>
          <button type="button" className="wizard-cta" disabled={!allOk} onClick={onNext}>
            Iniciar bootstrap
          </button>
        </>
      }
    >
      <div className="mb-3 mt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
        Supabase + Vercel
      </div>
      <div className="space-y-4">
        <CredentialInput
          label="SUPABASE_URL"
          value={core.supabase_url}
          onChange={(v) => onCoreChange({ supabase_url: v })}
          validate={validateSupabaseUrl}
          placeholder="https://abc1234.supabase.co"
          helpText="Supabase Dashboard → Project Settings → API → Project URL"
          docsUrl="https://supabase.com/dashboard/project/_/settings/api"
          inputType="url"
          onValidation={setStatus('supabase_url')}
        />
        <CredentialInput
          label="SUPABASE_ANON_KEY"
          value={core.supabase_anon_key}
          onChange={(v) => onCoreChange({ supabase_anon_key: v })}
          validate={anonValidator}
          placeholder="eyJhbGc..."
          helpText="Project Settings → API → Project API keys → anon public"
          docsUrl="https://supabase.com/dashboard/project/_/settings/api"
          inputType="password"
          onValidation={setStatus('supabase_anon_key')}
        />
        <CredentialInput
          label="SUPABASE_SERVICE_ROLE_KEY"
          value={core.supabase_service_role_key}
          onChange={(v) => onCoreChange({ supabase_service_role_key: v })}
          validate={serviceValidator}
          placeholder="eyJhbGc..."
          helpText="Project Settings → API → Project API keys → service_role secret. Se vazar, rotacione no painel."
          docsUrl="https://supabase.com/dashboard/project/_/settings/api"
          inputType="password"
          onValidation={setStatus('supabase_service_role_key')}
        />
        <CredentialInput
          label="SUPABASE_PERSONAL_ACCESS_TOKEN"
          value={core.supabase_pat}
          onChange={(v) => onCoreChange({ supabase_pat: v })}
          validate={validateSupabasePAT}
          placeholder="sbp_..."
          helpText="Usado apenas durante o bootstrap, descartado depois."
          docsUrl="https://supabase.com/dashboard/account/tokens"
          inputType="password"
          onValidation={setStatus('supabase_pat')}
        />
        <CredentialInput
          label="VERCEL_TOKEN"
          value={core.vercel_token}
          onChange={(v) => onCoreChange({ vercel_token: v })}
          validate={validateVercelToken}
          placeholder="vXXXXXXXXXXX..."
          helpText="Usado para setar envs e disparar redeploy. Descartado após o bootstrap."
          docsUrl="https://vercel.com/account/tokens"
          inputType="password"
          onValidation={setStatus('vercel_token')}
        />
      </div>

      <div className="mb-3 mt-8 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
        Conta de owner
      </div>
      <div className="space-y-4">
        <CredentialInput
          label="Seu nome"
          value={owner.name}
          onChange={(v) => onOwnerChange({ name: v })}
          validate={validateOwnerName}
          placeholder="Davi Ribeiro"
          inputType="text"
          autoComplete="name"
          onValidation={setStatus('owner_name')}
        />
        <CredentialInput
          label="Email"
          value={owner.email}
          onChange={(v) => onOwnerChange({ email: v })}
          validate={validateOwnerEmail}
          placeholder="voce@dominio.com"
          inputType="email"
          autoComplete="email"
          onValidation={setStatus('owner_email')}
        />
        <CredentialInput
          label="Senha (mínimo 8 caracteres)"
          value={owner.password}
          onChange={(v) => onOwnerChange({ password: v })}
          validate={validateOwnerPassword}
          placeholder="••••••••"
          inputType="password"
          autoComplete="new-password"
          onValidation={setStatus('owner_password')}
        />
      </div>
    </WizardLayout>
  )
}
