import type { ReactNode } from 'react'
import { StepIndicator } from './StepIndicator'

interface WizardLayoutProps {
  step: number
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}

export function WizardLayout({ step, title, subtitle, children, footer }: WizardLayoutProps) {
  return (
    <div className="flex min-h-screen items-start justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-2xl">
        <header className="mb-8 sm:mb-10">
          <div className="mb-8 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#1E3A8A] to-[#3B82F6] shadow-[0_0_18px_rgba(59,130,246,0.35)]" />
              <span className="text-sm font-semibold tracking-wide text-white">FinanceOS</span>
              <span className="text-sm font-medium text-slate-400">· Setup</span>
            </div>
          </div>
          <StepIndicator current={step} />
        </header>

        <main className="wizard-card-outer">
          <h1 className="wizard-h1">{title}</h1>
          {subtitle && <p className="wizard-subtitle">{subtitle}</p>}
          {children}
        </main>

        {footer && (
          <div className="mt-6 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
            {footer}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-slate-500">
          Suas credenciais nunca saem da sua infra. Tudo fica criptografado no seu Supabase.
        </p>
      </div>
    </div>
  )
}
