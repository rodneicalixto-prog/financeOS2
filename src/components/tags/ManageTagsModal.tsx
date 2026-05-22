import { useState, type KeyboardEvent } from 'react'
import { Search, Pencil, Trash2, Plus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/hooks/useAuth'
import { useTagsWithUsage } from '@/hooks/useTags'
import { supabase } from '@/lib/supabase'

interface ManageTagsModalProps {
  open: boolean
  onClose: () => void
}

function formatUsage(n: number): string {
  if (n === 0) return 'Não está em uso'
  if (n === 1) return '1 transação'
  return `${n} transações`
}

export function ManageTagsModal({ open, onClose }: ManageTagsModalProps) {
  const { user } = useAuth()
  const { data: tags } = useTagsWithUsage()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filtered = (tags || []).filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  async function invalidateAll() {
    await queryClient.invalidateQueries({ queryKey: ['tags'] })
    await queryClient.invalidateQueries({ queryKey: ['tags-usage'] })
    await queryClient.invalidateQueries({ queryKey: ['transactions'] })
    await queryClient.invalidateQueries({ queryKey: ['transactions-all'] })
    await queryClient.invalidateQueries({ queryKey: ['transaction-tags'] })
  }

  async function handleCreate() {
    if (!user || !newName.trim()) return
    setCreating(true)
    await supabase.from('fo_tags').insert({ name: newName.trim(), user_id: user.id })
    await invalidateAll()
    setNewName('')
    setAddingNew(false)
    setCreating(false)
  }

  function startEdit(id: string, currentName: string) {
    setEditingId(id)
    setEditName(currentName)
    setConfirmDeleteId(null)
  }

  async function handleRename(id: string) {
    if (!editName.trim()) return
    setSaving(true)
    await supabase.from('fo_tags').update({ name: editName.trim() }).eq('id', id)
    await invalidateAll()
    setEditingId(null)
    setEditName('')
    setSaving(false)
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    await supabase.from('fo_transaction_tags').delete().eq('tag_id', id)
    await supabase.from('fo_tags').delete().eq('id', id)
    await invalidateAll()
    setConfirmDeleteId(null)
    setDeleting(false)
  }

  function handleClose() {
    setAddingNew(false)
    setNewName('')
    setEditingId(null)
    setEditName('')
    setConfirmDeleteId(null)
    setSearch('')
    onClose()
  }

  function handleNewKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleCreate()
    if (e.key === 'Escape') {
      setAddingNew(false)
      setNewName('')
    }
  }

  function handleEditKeyDown(e: KeyboardEvent<HTMLInputElement>, id: string) {
    if (e.key === 'Enter') handleRename(id)
    if (e.key === 'Escape') {
      setEditingId(null)
      setEditName('')
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Gerenciar tags" className="max-w-2xl">
      <div className="space-y-4">
        {/* Header: busca + adicionar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar tags"
              className="glass-input w-full py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <Button
            onClick={() => {
              setAddingNew(true)
              setEditingId(null)
              setConfirmDeleteId(null)
            }}
            disabled={addingNew}
          >
            <Plus className="h-4 w-4" />
            Adicionar nova
          </Button>
        </div>

        {/* Tabela */}
        <div className="overflow-hidden rounded-lg border border-white/5">
          {/* Cabeçalho */}
          <div className="grid grid-cols-[1fr_1fr] gap-4 bg-surface-light px-4 py-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Nome
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Uso
            </span>
          </div>

          {/* Linha de adicionar nova */}
          {addingNew && (
            <div className="grid grid-cols-[1fr_1fr] items-center gap-4 border-t border-white/5 px-4 py-3">
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleNewKeyDown}
                placeholder="Nome da tag"
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setAddingNew(false)
                    setNewName('')
                  }}
                >
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleCreate} loading={creating}>
                  Criar tag
                </Button>
              </div>
            </div>
          )}

          {/* Lista */}
          <div className="max-h-[400px] overflow-y-auto">
            {filtered.length === 0 && !addingNew ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                {search ? 'Nenhuma tag encontrada' : 'Nenhuma tag cadastrada'}
              </div>
            ) : (
              filtered.map((tag) => {
                const isEditing = editingId === tag.id
                const isConfirmingDelete = confirmDeleteId === tag.id

                return (
                  <div
                    key={tag.id}
                    className="group grid grid-cols-[1fr_1fr] items-center gap-4 border-t border-white/5 px-4 py-3 transition-colors hover:bg-white/5"
                  >
                    {/* Coluna Nome */}
                    {isEditing ? (
                      <Input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, tag.id)}
                      />
                    ) : isConfirmingDelete ? (
                      <span className="text-sm text-red-400">Excluir esta tag?</span>
                    ) : (
                      <span className="text-sm text-slate-200">{tag.name}</span>
                    )}

                    {/* Coluna Uso / Ações */}
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setEditingId(null)
                            setEditName('')
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleRename(tag.id)}
                          loading={saving}
                        >
                          Salvar alterações
                        </Button>
                      </div>
                    ) : isConfirmingDelete ? (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Não
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(tag.id)}
                          loading={deleting}
                        >
                          Sim, excluir
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">
                          {formatUsage(tag.usage)}
                        </span>
                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => startEdit(tag.id, tag.name)}
                            className="rounded-md bg-surface-light p-1.5 text-slate-400 hover:text-white transition-colors"
                            aria-label="Editar tag"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setConfirmDeleteId(tag.id)
                              setEditingId(null)
                            }}
                            className="rounded-md bg-red-500/10 p-1.5 text-red-400 hover:bg-red-500/20 transition-colors"
                            aria-label="Excluir tag"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
