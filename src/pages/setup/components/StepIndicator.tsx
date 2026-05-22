import clsx from 'clsx'

const STEPS = [
  { num: 1, label: 'PREPARAR' },
  { num: 2, label: 'CREDENCIAIS' },
  { num: 3, label: 'BOOTSTRAP' },
  { num: 4, label: 'APIS' },
] as const

export function StepIndicator({ current }: { current: number }) {
  return (
    <div className="wizard-step-row" role="list" aria-label="Progresso do setup">
      {STEPS.map((s, idx) => {
        const isActive = s.num === current
        const isDone = s.num < current
        return (
          <div key={s.num} className="contents">
            <div className="wizard-step-item" role="listitem" aria-current={isActive ? 'step' : undefined}>
              <div
                className={clsx(
                  'wizard-step-circle',
                  isActive && 'wizard-step-circle--active',
                  isDone && 'wizard-step-circle--done',
                  !isActive && !isDone && 'wizard-step-circle--future',
                )}
              >
                {isDone ? '✓' : s.num}
              </div>
              <span
                className={clsx(
                  'wizard-step-label',
                  isActive && 'wizard-step-label--active',
                )}
              >
                {s.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && <div className="wizard-step-connector" aria-hidden="true" />}
          </div>
        )
      })}
    </div>
  )
}
