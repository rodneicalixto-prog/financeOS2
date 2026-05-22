import { useMemo, useState } from 'react'
import { setupConfig } from '../../../../setup.config'
import { CredentialInput } from '../components/CredentialInput'
import { OriginSuffixField } from '../components/OriginSuffixField'
import { WizardLayout } from '../components/WizardLayout'

type FieldStatus = 'idle' | 'pending' | 'ok' | 'error'

interface Step4Props {
  appCreds: Record<string, string>
  onChange: (key: string, value: string) => void
  onNext: () => void
  onBack: () => void
}

export function Step4AppCreds({ appCreds, onChange, onNext, onBack }: Step4Props) {
  const fields = setupConfig.appCredentials
  const [statuses, setStatuses] = useState<Record<string, FieldStatus>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, 'idle' as FieldStatus])),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setStatus = (key: string) => (s: FieldStatus) =>
    setStatuses((prev) => ({ ...prev, [key]: s }))

  const allOk = useMemo(
    () => fields.every((f) => f.optional || statuses[f.key] === 'ok'),
    [fields, statuses],
  )

  async function handleSubmit() {
    setSaving(true)
    setError(null)
    try {
      const body = Object.fromEntries(
        Object.entries(appCreds).filter(([, v]) => typeof v === 'string' && v.length > 0),
      )
      const res = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as { success?: boolean; message?: string }
      if (!res.ok || !json.success) {
        setError(json.message ?? `HTTP ${res.status}`)
        setSaving(false)
        return
      }
      onNext()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <WizardLayout
      step={4}
      title="APIs da aplicação"
      subtitle="Estas chaves ficam criptografadas no seu Supabase (AES-256-GCM) e são lidas server-side pelas Edge Functions e API Routes."
      footer={
        <>
          <button type="button" className="wizard-secondary" onClick={onBack} disabled={saving}>← Voltar</button>
          <button type="button" className="wizard-cta" disabled={!allOk || saving} onClick={handleSubmit}>
            {saving ? 'Salvando...' : 'Salvar e finalizar setup'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {fields.map((field) =>
          field.originSuffix ? (
            <OriginSuffixField
              key={field.key}
              label={field.label}
              suffix={field.originSuffix}
              value={appCreds[field.key] ?? ''}
              onChange={(v) => onChange(field.key, v)}
              validate={field.validate}
              placeholder={field.placeholder}
              helpText={field.helpText}
              docsUrl={field.docsUrl}
              onValidation={setStatus(field.key)}
            />
          ) : (
            <CredentialInput
              key={field.key}
              label={field.label}
              value={appCreds[field.key] ?? ''}
              onChange={(v) => onChange(field.key, v)}
              validate={field.validate}
              placeholder={field.placeholder}
              helpText={field.helpText}
              docsUrl={field.docsUrl}
              inputType={field.inputType ?? 'text'}
              onValidation={setStatus(field.key)}
            />
          ),
        )}
        {error && (
          <div className="rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/5 p-4">
            <p className="text-sm text-[#EF4444]">{error}</p>
          </div>
        )}
      </div>
    </WizardLayout>
  )
}
