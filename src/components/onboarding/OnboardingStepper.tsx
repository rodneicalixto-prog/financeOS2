import clsx from 'clsx'
import type { OnboardingStep } from '@/hooks/useOnboarding'

interface OnboardingStepperProps {
  currentStep: OnboardingStep
}

const steps = [
  { number: 1, label: 'Gmail' },
  { number: 2, label: 'Bancos' },
  { number: 3, label: 'Importar' },
  { number: 4, label: 'Pronto' },
]

export function OnboardingStepper({ currentStep }: OnboardingStepperProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((s, i) => (
        <div key={s.number} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <div
              className={clsx(
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
                s.number < currentStep && 'bg-accent-green text-white',
                s.number === currentStep && 'bg-accent-blue text-white',
                s.number > currentStep && 'bg-surface-lighter text-slate-500'
              )}
            >
              {s.number < currentStep ? '✓' : s.number}
            </div>
            <span
              className={clsx(
                'text-xs',
                s.number <= currentStep ? 'text-slate-200' : 'text-slate-500'
              )}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={clsx(
                'mb-4 h-0.5 w-12',
                s.number < currentStep ? 'bg-accent-green' : 'bg-surface-lighter'
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}
