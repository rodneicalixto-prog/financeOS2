import clsx from 'clsx'
import { Check, Loader2, AlertCircle } from 'lucide-react'

export type TimelineStatus = 'pending' | 'running' | 'done' | 'failed'

interface TimelineStep {
  key: string
  label: string
  detail?: string
  status: TimelineStatus
}

export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((s) => (
        <li
          key={s.key}
          className={clsx(
            'flex items-start gap-3 rounded-xl border px-4 py-3 transition-all',
            s.status === 'done' && 'border-accent-green/30 bg-accent-green/5',
            s.status === 'running' && 'border-accent-blue/40 bg-accent-blue/8 shadow-[0_0_18px_rgba(59,130,246,0.18)]',
            s.status === 'pending' && 'border-white/8 bg-surface-light/30',
            s.status === 'failed' && 'border-accent-red/40 bg-accent-red/5',
          )}
        >
          <div className="mt-0.5">
            {s.status === 'done' && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-green/20">
                <Check className="h-3 w-3 text-accent-green" />
              </span>
            )}
            {s.status === 'running' && <Loader2 className="h-5 w-5 animate-spin text-accent-blue-light" />}
            {s.status === 'failed' && <AlertCircle className="h-5 w-5 text-accent-red" />}
            {s.status === 'pending' && (
              <span className="block h-5 w-5 rounded-full border border-white/15 bg-surface-light/50" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={clsx(
                'text-sm font-medium',
                s.status === 'done' ? 'text-accent-green' :
                s.status === 'running' ? 'text-white' :
                s.status === 'failed' ? 'text-accent-red' : 'text-slate-400',
              )}
            >
              {s.label}
            </p>
            {s.detail && (
              <p className="mt-0.5 truncate text-xs text-slate-500">{s.detail}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
