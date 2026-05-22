import { useRef, useEffect, type RefObject } from 'react'
import { Select } from '@/components/ui/Select'
import { useCategories } from '@/hooks/useCategories'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { TagMultiSelect } from './TagMultiSelect'
import type { TransactionFilters } from '@/hooks/useTransactions'

interface FilterPopoverProps {
  filters: TransactionFilters
  onChange: (filters: TransactionFilters) => void
  onClose: () => void
  anchorRef: RefObject<HTMLButtonElement | null>
  onManageTags: () => void
}

export function FilterPopover({
  filters,
  onChange,
  onClose,
  anchorRef,
  onManageTags,
}: FilterPopoverProps) {
  const { data: categories } = useCategories()
  const { data: bankAccounts } = useBankAccounts()
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [anchorRef, onClose])

  function clearAll() {
    onChange({ search: filters.search })
  }

  return (
    <div
      ref={popoverRef}
      className="glass-card absolute right-0 top-full z-40 mt-2 w-80 p-4 space-y-3"
    >
      <Select
        label="Tipo"
        value={filters.type || ''}
        onChange={(e) =>
          onChange({
            ...filters,
            type: (e.target.value as TransactionFilters['type']) || undefined,
          })
        }
        placeholder="Todos"
        options={[
          { value: 'income', label: 'Entrada' },
          { value: 'expense', label: 'Saída' },
          { value: 'transfer', label: 'Transferência' },
        ]}
      />

      <Select
        label="Categoria"
        value={filters.categoryId || ''}
        onChange={(e) => {
          const id = e.target.value || undefined
          const cat = categories?.find((c) => c.id === id)
          const isOutros = cat?.name === 'Outros'
          onChange({
            ...filters,
            categoryId: id,
            includeUncategorized: isOutros ? true : undefined,
          })
        }}
        placeholder="Todas"
        options={
          (categories || []).map((c) => ({
            value: c.id,
            label: `${c.icon} ${c.name}`,
          }))
        }
      />

      {bankAccounts && bankAccounts.length > 0 && (
        <Select
          label="Banco"
          value={filters.bankAccountId || ''}
          onChange={(e) =>
            onChange({ ...filters, bankAccountId: e.target.value || undefined })
          }
          placeholder="Todos"
          options={
            bankAccounts.map((a) => ({
              value: a.id,
              label: a.account_label,
            }))
          }
        />
      )}

      <TagMultiSelect
        value={filters.tagIds || []}
        onChange={(ids) => onChange({ ...filters, tagIds: ids.length > 0 ? ids : undefined })}
        onManageClick={onManageTags}
      />

      <div className="flex items-center justify-between border-t border-white/5 pt-3">
        <button
          type="button"
          onClick={clearAll}
          className="text-sm text-slate-400 hover:text-white transition-colors"
        >
          Limpar filtros
        </button>
      </div>
    </div>
  )
}
