import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'

export interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectProps {
  label?: string
  value: string[]
  onChange: (values: string[]) => void
  options: MultiSelectOption[]
  placeholder?: string
}

export function MultiSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Selecionar',
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const selected = options.filter((o) => value.includes(o.value))

  function toggle(val: string) {
    if (value.includes(val)) {
      onChange(value.filter((v) => v !== val))
    } else {
      onChange([...value, val])
    }
  }

  function remove(val: string, e: React.MouseEvent) {
    e.stopPropagation()
    onChange(value.filter((v) => v !== val))
  }

  return (
    <div className="flex flex-col gap-1.5" ref={rootRef}>
      {label && <label className="text-sm font-medium text-slate-300">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="glass-input flex min-h-[38px] w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {selected.length === 0 ? (
              <span className="text-slate-500">{placeholder}</span>
            ) : (
              selected.map((opt) => (
                <span
                  key={opt.value}
                  className="flex items-center gap-1 rounded-full bg-accent-blue/20 px-2 py-0.5 text-xs text-accent-blue"
                >
                  {opt.label}
                  <button
                    type="button"
                    onClick={(e) => remove(opt.value, e)}
                    className="hover:text-white"
                    aria-label={`Remover ${opt.label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
        </button>

        {open && (
          <div className="glass-card absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto p-1">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-500">Nenhuma opção disponível</div>
            ) : (
              options.map((opt) => {
                const isSelected = value.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggle(opt.value)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? 'bg-accent-blue/20 text-accent-blue'
                        : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    {opt.label}
                    {isSelected && <X className="h-3 w-3" />}
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
