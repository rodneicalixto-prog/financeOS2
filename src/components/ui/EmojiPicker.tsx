import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Smile } from 'lucide-react'
import clsx from 'clsx'

const EMOJI_GROUPS: { name: string; emojis: string[] }[] = [
  {
    name: 'Comida & Bebida',
    emojis: ['🍔','🍕','🌭','🥪','🥙','🌮','🌯','🥗','🍝','🍜','🍱','🍣','🍤','🍪','🍩','🍰','🎂','🍫','🍿','🥐','🥖','🍞','☕','🍵','🥤','🧃','🍷','🍺','🍶','🛒'],
  },
  {
    name: 'Transporte',
    emojis: ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🛵','🏍️','🚲','🛴','✈️','🛫','🚉','🚆','🚇','🚊','⛴️','🚢','🚀','⛽','🅿️','🛞','🛟'],
  },
  {
    name: 'Casa & Moradia',
    emojis: ['🏠','🏡','🏢','🏬','🛏️','🛋️','🚪','🪑','💡','🔌','🔧','🧹','🧽','🧺','🛁','🚿','🧻','🪒','🧴','🪥','🚽','🪴','🌱','🪟','📦','🔑','🔒','🪞','🧯','🧰'],
  },
  {
    name: 'Saúde',
    emojis: ['🏥','💊','🩺','💉','🩹','🩻','🧬','🦷','🧠','❤️‍🩹','⚕️','😷','🦠','🧴','🩼','🏋️','🧘','🤸','🚴','🏃','🏊','🥊','⛹️','🤾','🧖','💪','🦾','🦿','👁️','👂'],
  },
  {
    name: 'Trabalho & Negócios',
    emojis: ['💼','💻','🖥️','⌨️','🖱️','🖨️','📊','📈','📉','📋','📅','📆','📞','☎️','📠','📧','✉️','📝','📌','📎','🗂️','🗃️','📁','📂','📇','📒','🗓️','🪪','🪟','💼'],
  },
  {
    name: 'Dinheiro',
    emojis: ['💰','💵','💴','💶','💷','💸','💳','🪙','🏦','💎','🤑','🏧','💲','📥','📤','🧾','📜','💹','💱','💵','🪪','🪜','📓','🪝','🛍️','🪪','🛒','⚖️','🪙','🏷️'],
  },
  {
    name: 'Lazer & Entretenimento',
    emojis: ['🎮','🕹️','🎬','📺','🎵','🎶','🎤','🎧','🎸','🎹','🎺','🎻','🥁','🎨','🎭','🎲','🧩','🎯','🏀','⚽','🏈','🎾','🏐','🏓','🎱','🏆','🎁','🎉','🎊','🎟️'],
  },
  {
    name: 'Educação',
    emojis: ['📚','📖','📕','📗','📘','📙','📔','📓','📒','✏️','✒️','🖊️','🖋️','📝','🎓','🏫','🔬','🔭','🧮','📐','📏','🧪','🪧','🪪','📌','📎','🗒️','📃','📜','🎒'],
  },
  {
    name: 'Tecnologia',
    emojis: ['💻','🖥️','📱','⌚','🖱️','⌨️','💾','💿','📀','🔋','🔌','📡','🛰️','📺','📷','📹','🎥','🔍','🤖','🎛️','🎚️','📻','☎️','📞','📠','🔦','🕹️','📲','💽','💡'],
  },
  {
    name: 'Vida Pessoal',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','💕','💖','✨','⭐','🌟','💯','🔥','⚡','🎯','📌','📍','🏷️','✅','❌','⚠️','🚨','🎁','🎀','🌈','☀️'],
  },
  {
    name: 'Animais & Natureza',
    emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦆','🦉','🦋','🐝','🌿','🍀','🌳','🌴','🌵','🌷','🌹','🌻'],
  },
  {
    name: 'Outros',
    emojis: ['📦','📫','📬','🗑️','🪣','🛍️','🧳','👜','🎒','🛒','🏷️','📛','🔖','🏆','🏅','🥇','🥈','🥉','🎖️','🎗️','🎫','🎟️','🎪','🎭','🩴','👕','👔','👗','👠','👟'],
  },
]

interface EmojiPickerProps {
  value: string
  onChange: (emoji: string) => void
  className?: string
}

const PANEL_WIDTH = 320
const PANEL_MAX_HEIGHT = 320
const GAP = 8

export function EmojiPicker({ value, onChange, className }: EmojiPickerProps) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  function computePosition() {
    const btn = buttonRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const spaceBelow = vh - rect.bottom
    const spaceAbove = rect.top
    const openUp = spaceBelow < PANEL_MAX_HEIGHT + GAP && spaceAbove > spaceBelow
    const top = openUp
      ? Math.max(8, rect.top - PANEL_MAX_HEIGHT - GAP)
      : rect.bottom + GAP
    let left = rect.left
    if (left + PANEL_WIDTH > vw - 8) left = vw - PANEL_WIDTH - 8
    if (left < 8) left = 8
    setCoords({ top, left })
  }

  useLayoutEffect(() => {
    if (!open) return
    computePosition()
  }, [open])

  useEffect(() => {
    if (!open) return
    function onScrollOrResize() {
      computePosition()
    }
    function onDown(e: MouseEvent) {
      const target = e.target as Node
      if (panelRef.current?.contains(target)) return
      if (buttonRef.current?.contains(target)) return
      setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onEsc)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'glass-input flex h-[42px] w-16 items-center justify-center px-2 text-2xl',
          className
        )}
        title="Escolher emoji"
        aria-label="Escolher emoji"
      >
        {value ? <span>{value}</span> : <Smile className="h-5 w-5 text-slate-400" />}
      </button>

      {open && coords && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            width: PANEL_WIDTH,
            maxHeight: PANEL_MAX_HEIGHT,
            zIndex: 100,
          }}
          className="rounded-xl border border-[rgba(59,130,246,0.25)] bg-[rgba(15,18,35,0.98)] p-3 shadow-2xl backdrop-blur-xl"
        >
          <div className="space-y-3 overflow-y-auto pr-1" style={{ maxHeight: PANEL_MAX_HEIGHT - 24 }}>
            {EMOJI_GROUPS.map((group) => (
              <div key={group.name}>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {group.name}
                </p>
                <div className="grid grid-cols-8 gap-1">
                  {group.emojis.map((emoji, i) => (
                    <button
                      key={`${group.name}-${i}`}
                      type="button"
                      onClick={() => {
                        onChange(emoji)
                        setOpen(false)
                      }}
                      className={clsx(
                        'flex h-8 w-8 items-center justify-center rounded-md text-lg transition-colors hover:bg-white/10',
                        value === emoji && 'bg-accent-blue/20 ring-1 ring-accent-blue/40'
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
