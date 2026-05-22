import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useTags } from '@/hooks/useTags'
import { ManageTagsModal } from '@/components/tags/ManageTagsModal'

export function TagsSettings() {
  const { data: tags } = useTags()
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Tags</h3>

      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-300">
              {tags?.length ?? 0} {tags?.length === 1 ? 'tag cadastrada' : 'tags cadastradas'}
            </p>
            <p className="text-xs text-slate-500">Use tags para organizar suas transações</p>
          </div>
          <Button onClick={() => setOpen(true)}>Gerenciar tags</Button>
        </div>

        {tags && tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="rounded-full bg-surface-light px-3 py-1 text-xs text-slate-300"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </Card>

      <ManageTagsModal open={open} onClose={() => setOpen(false)} />
    </div>
  )
}
