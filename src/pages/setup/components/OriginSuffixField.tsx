import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Check, Copy, Loader2, X } from 'lucide-react'

type ValidationStatus = 'idle' | 'pending' | 'ok' | 'error'

interface OriginSuffixFieldProps {
  label: string
  /** Path fixo acrescentado à base (ex.: "/auth/gmail/callback"). */
  suffix: string
  /** Valor salvo na credencial = URL completa (base + suffix). */
  value: string
  onChange: (full: string) => void
  validate: (value: string) => Promise<{ ok: boolean; message?: string }>
  onValidation?: (status: ValidationStatus) => void
  docsUrl?: string
  helpText?: string
  placeholder?: string
}

/** Remove o suffixo (se colado) e barras finais, deixando só a base. */
function toBase(value: string, suffix: string): string {
  const t = value.trim()
  const noSuffix = t.endsWith(suffix) ? t.slice(0, -suffix.length) : t
  return noSuffix.replace(/\/+$/, '')
}

export function OriginSuffixField({
  label,
  suffix,
  value,
  onChange,
  validate,
  onValidation,
  docsUrl,
  helpText,
  placeholder,
}: OriginSuffixFieldProps) {
  const [base, setBase] = useState<string>(() => {
    if (value) return toBase(value, suffix)
    return typeof window !== 'undefined' ? window.location.origin : ''
  })
  const [status, setStatus] = useState<ValidationStatus>('idle')
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const validateRef = useRef(validate)
  validateRef.current = validate
  const onValidationRef = useRef(onValidation)
  onValidationRef.current = onValidation

  const cleanBase = base.trim().replace(/\/+$/, '')
  const full = cleanBase ? `${cleanBase}${suffix}` : ''

  // Sincroniza a credencial (URL completa) e valida sempre que a base muda.
  useEffect(() => {
    onChangeRef.current(full)
    if (!full) {
      setStatus('idle')
      setMessage('')
      onValidationRef.current?.('idle')
      return
    }
    let cancelled = false
    setStatus('pending')
    onValidationRef.current?.('pending')
    validateRef.current(full)
      .then((r) => {
        if (cancelled) return
        setStatus(r.ok ? 'ok' : 'error')
        setMessage(r.message ?? '')
        onValidationRef.current?.(r.ok ? 'ok' : 'error')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
        onValidationRef.current?.('error')
      })
    return () => {
      cancelled = true
    }
  }, [full])

  async function copyFull() {
    try {
      await navigator.clipboard.writeText(full)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard bloqueado — usuário copia manualmente */
    }
  }

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

      <div className="flex items-stretch">
        <input
          type="url"
          value={base}
          onChange={(e) => setBase(toBase(e.target.value, suffix))}
          placeholder={placeholder ?? 'https://seu-dominio.vercel.app'}
          autoComplete="off"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          className={clsx(
            'wizard-input min-w-0 flex-1 !rounded-r-none',
            status === 'ok' && 'wizard-input--ok',
            status === 'error' && 'wizard-input--error',
          )}
        />
        <span className="flex items-center whitespace-nowrap rounded-r-xl border border-l-0 border-white/10 bg-white/5 px-3 font-mono text-xs text-slate-400">
          {suffix}
          {status === 'pending' && <Loader2 className="ml-2 h-3.5 w-3.5 animate-spin" />}
          {status === 'ok' && <Check className="ml-2 h-3.5 w-3.5 text-[#10B981]" />}
          {status === 'error' && <X className="ml-2 h-3.5 w-3.5 text-[#EF4444]" />}
        </span>
      </div>

      {full && (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
          <span className="shrink-0 text-[11px] uppercase tracking-wide text-slate-500">Cole no Google Cloud:</span>
          <code className="min-w-0 flex-1 truncate text-xs text-slate-300">{full}</code>
          <button
            type="button"
            onClick={copyFull}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-xs text-white transition hover:bg-white/20"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-[#10B981]" /> Copiado
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Copiar
              </>
            )}
          </button>
        </div>
      )}

      {helpText && status !== 'error' && (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{helpText}</p>
      )}
      {status === 'error' && message && <p className="mt-1.5 text-xs text-[#EF4444]">{message}</p>}
    </div>
  )
}
