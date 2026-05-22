import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { EmojiPicker } from '@/components/ui/EmojiPicker'
import { useCategories } from '@/hooks/useCategories'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'

export function CategoriesSettings() {
  const { user } = useAuth()
  const { data: categories } = useCategories()
  const queryClient = useQueryClient()

  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('')
  const [loading, setLoading] = useState(false)

  const defaultCategories = (categories || []).filter((c) => c.is_default)
  const customCategories = (categories || []).filter((c) => !c.is_default)

  async function handleAdd() {
    if (!user || !newName) return
    setLoading(true)
    await supabase.from('fo_categories').insert({
      name: newName,
      icon: newIcon || '📌',
      is_default: false,
      user_id: user.id,
    })
    await queryClient.invalidateQueries({ queryKey: ['categories'] })
    setNewName('')
    setNewIcon('')
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta categoria? Transações associadas ficarão sem categoria.')) return
    await supabase.from('fo_categories').delete().eq('id', id)
    await queryClient.invalidateQueries({ queryKey: ['categories'] })
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Categorias</h3>

      <Card>
        <h4 className="mb-3 text-sm font-medium text-slate-400">Categorias Padrão</h4>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {defaultCategories.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-lg bg-surface-light px-3 py-2">
              <span className="text-lg">{c.icon}</span>
              <span className="text-sm text-slate-300">{c.name}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h4 className="mb-3 text-sm font-medium text-slate-400">Minhas Categorias</h4>
        {customCategories.length > 0 && (
          <div className="mb-4 space-y-2">
            {customCategories.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/5">
                <span className="text-lg">{c.icon}</span>
                <span className="flex-1 text-sm text-slate-200">{c.name}</span>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="text-slate-500 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <EmojiPicker value={newIcon} onChange={setNewIcon} />
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome da categoria"
            className="flex-1"
          />
          <Button onClick={handleAdd} loading={loading} size="sm" className="h-[42px]">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  )
}
