import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Check, Eye, EyeOff, Loader2, X } from 'lucide-react'

export type ValidationFn = (value: string) => Promise<{ ok: boolean; message?: string }>
type ValidationStatus = 'idle' | 'pending' | 'ok' | 'error'

interface CredentialInputProps {
  label: string
  value: string
  onChange: (v: string) => void
  validate: ValidationFn
  placeholder?: string
  helpText?: string
  docsUrl?: string
  inputType?: 'text' | 'password' | 'url' | 'email'
  onValidation?: (status: ValidationStatus) => void
  debounceMs?: number
  autoComplete?: string
}

export function CredentialInput({
  label,
  value,
  onChange,
  validate,
  placeholder,
  helpText,
  docsUrl,
  inputType = 'text',
  onValidation,
  debounceMs = 800,
  autoComplete = 'off',
}: CredentialInputProps) {
  const [status, setStatus] = useState<ValidationStatus>(value ? 'pending' : 'idle')
  const [message, setMessage] = useState<string>('')
  const [reveal, setReveal] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const validateRef = useRef(validate)
  validateRef.current = validate
  const onValidationRef = useRef(onValidation)
  onValidationRef.current = onValidation

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!value) {
      setStatus('idle')
      setMessage('')
      onValidationRef.current?.('idle')
      return
    }
    setStatus('pending')
    onValidationRef.current?.('pending')
    timer.current = setTimeout(async () => {
      try {
        const result = await validateRef.current(value)
        setStatus(result.ok ? 'ok' : 'error')
        setMessage(result.message ?? '')
        onValidationRef.current?.(result.ok ? 'ok' : 'error')
      } catch (e) {
        setStatus('error')
        setMessage(e instanceof Error ? e.message : 'Erro ao validar')
        onValidationRef.current?.('error')
      }
    }, debounceMs)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [value, debounceMs])

  const effectiveType = inputType === 'password' && !reveal ? 'password' : inputType === 'url' ? 'url' : inputType === 'email' ? 'email' : 'text'

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label className="wizard-field-label !mb-0">{label}</label>
        {docsUrl && (
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-[#60A5FA] hover:underline"
          >
            onde gerar?
          </a>
        )}
      </div>
      <div className="relative">
        <input
          type={effectiveType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          className={clsx(
            'wizard-input',
            'pr-20',
            status === 'ok' && 'wizard-input--ok',
            status === 'error' && 'wizard-input--error',
          )}
        />
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-1.5">
          {inputType === 'password' && (
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              className="pointer-events-auto rounded p-1 text-slate-400 hover:text-white"
              aria-label={reveal ? 'Ocultar' : 'Mostrar'}
              tabIndex={-1}
            >
              {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
          {status === 'pending' && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          {status === 'ok' && <Check className="h-4 w-4 text-[#10B981]" aria-label="válido" />}
          {status === 'error' && <X className="h-4 w-4 text-[#EF4444]" aria-label="inválido" />}
        </div>
      </div>
      {helpText && status !== 'error' && (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{helpText}</p>
      )}
      {status === 'error' && message && (
        <p className="mt-1.5 text-xs text-[#EF4444]">{message}</p>
      )}
    </div>
  )
}
