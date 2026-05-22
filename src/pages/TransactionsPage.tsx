import { useState, useRef } from 'react'
import { Plus, Search, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { TransactionFeed } from '@/components/dashboard/TransactionFeed'
import { TransactionForm } from '@/components/transactions/TransactionForm'
import { TransactionEditModal } from '@/components/transactions/TransactionEditModal'
import { FilterPopover } from '@/components/transactions/FilterPopover'
import { ManageTagsModal } from '@/components/tags/ManageTagsModal'
import type { TransactionFilters } from '@/hooks/useTransactions'
import type { Transaction } from '@/types'

export function TransactionsPage() {
  const [showForm, setShowForm] = useState(false)
  const [editTransaction, setEditTransaction] = useState<
    (Transaction & { categories: { name: string; icon: string } | null }) | null
  >(null)

  const [filters, setFilters] = useState<TransactionFilters>({})
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [manageTagsOpen, setManageTagsOpen] = useState(false)
  const filterBtnRef = useRef<HTMLButtonElement>(null)

  function handleSearch(value: string) {
    setSearch(value)
    setFilters((f) => ({ ...f, search: value || undefined }))
  }

  // Conta filtros ativos (exclui busca)
  const activeFilterCount =
    (filters.type ? 1 : 0) +
    (filters.categoryId ? 1 : 0) +
    (filters.bankAccountId ? 1 : 0) +
    (filters.tagIds && filters.tagIds.length > 0 ? 1 : 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-label-upper mb-1">Transações</p>
          <h1 className="text-3xl font-bold tracking-tight text-white">Movimentações</h1>
          <p className="mt-1 text-sm text-slate-400">Registre, edite e filtre suas transações financeiras</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" />
          Nova Transação
        </Button>
      </div>

      {/* Search + botão de filtro */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar transações..."
            className="glass-input w-full py-2 pl-9 pr-3 text-sm"
          />
        </div>

        <div className="relative">
          <button
            ref={filterBtnRef}
            onClick={() => setFiltersOpen((v) => !v)}
            className="glass-card relative flex items-center justify-center p-2.5 hover:border-white/20"
            aria-label="Filtros"
          >
            <SlidersHorizontal className="h-4 w-4 text-slate-300" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-blue px-1 text-[10px] font-semibold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          {filtersOpen && (
            <FilterPopover
              filters={filters}
              onChange={setFilters}
              onClose={() => setFiltersOpen(false)}
              anchorRef={filterBtnRef}
              onManageTags={() => {
                setFiltersOpen(false)
                setManageTagsOpen(true)
              }}
            />
          )}
        </div>
      </div>

      {/* Feed */}
      <TransactionFeed
        filters={filters}
        onEdit={(t) => setEditTransaction(t as Transaction & { categories: { name: string; icon: string } | null })}
      />

      {/* Modal Nova Transação */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nova Transação">
        <TransactionForm onSuccess={() => setShowForm(false)} />
      </Modal>

      {/* Modal Editar Transação */}
      <TransactionEditModal
        transaction={editTransaction}
        open={!!editTransaction}
        onClose={() => setEditTransaction(null)}
      />

      {/* Modal Gerenciar Tags */}
      <ManageTagsModal open={manageTagsOpen} onClose={() => setManageTagsOpen(false)} />
    </div>
  )
}
