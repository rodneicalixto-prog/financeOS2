import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X, Settings } from 'lucide-react'
import { useTags } from '@/hooks/useTags'

interface TagMultiSelectProps {
  value: string[]
  onChange: (ids: string[]) => void
  onManageClick: () => void
  label?: string
}

export function TagMultiSelect({ value, onChange, onManageClick, label = 'Tags' }: TagMultiSelectProps) {
  const { data: tags } = useTags()
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

  const selectedTags = (tags || []).filter((t) => value.includes(t.id))

  function toggleTag(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id))
    } else {
      onChange([...value, id])
    }
  }

  function removeTag(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    onChange(value.filter((v) => v !== id))
  }

  return (
    <div className="flex flex-col gap-1.5" ref={rootRef}>
      <label className="text-sm font-medium text-slate-300">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="glass-input flex min-h-[38px] w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {selectedTags.length === 0 ? (
              <span className="text-slate-500">Filtrar por tags</span>
            ) : (
              selectedTags.map((tag) => (
                <span
                  key={tag.id}
                  className="flex items-center gap-1 rounded-full bg-accent-blue/20 px-2 py-0.5 text-xs text-accent-blue"
                >
                  {tag.name}
                  <button
                    type="button"
                    onClick={(e) => removeTag(tag.id, e)}
                    className="hover:text-white"
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
            {tags && tags.length > 0 ? (
              <>
                {tags.map((tag) => {
                  const selected = value.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        selected
                          ? 'bg-accent-blue/20 text-accent-blue'
                          : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      {tag.name}
                      {selected && <X className="h-3 w-3" />}
                    </button>
                  )
                })}
                <div className="my-1 border-t border-white/5" />
              </>
            ) : (
              <div className="px-3 py-2 text-xs text-slate-500">Nenhuma tag cadastrada</div>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onManageClick()
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-accent-red hover:bg-red-500/10"
            >
              <Settings className="h-3.5 w-3.5" />
              Gerenciar tags
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
