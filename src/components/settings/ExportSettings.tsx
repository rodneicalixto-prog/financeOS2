import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { MultiSelect } from '@/components/ui/MultiSelect'
import { useAuth } from '@/hooks/useAuth'
import { useCategories } from '@/hooks/useCategories'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { useTags } from '@/hooks/useTags'
import { supabase } from '@/lib/supabase'

interface ExportRow {
  date: string
  description: string
  type: 'income' | 'expense' | 'transfer'
  amount: number
  status: 'pending' | 'confirmed'
  categories: { name: string } | null
  bank_accounts: { account_label: string } | null
  tags: { tag: { name: string } }[]
}

function escapeCsv(value: string): string {
  if (/[";\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function buildCsv(rows: ExportRow[]): string {
  const headers = ['Data', 'Descrição', 'Tipo', 'Valor', 'Categoria', 'Banco', 'Tags', 'Status']
  const lines = rows.map((t) => {
    const type = t.type === 'income' ? 'Entrada' : t.type === 'expense' ? 'Saída' : 'Transferência'
    const category = t.categories?.name ?? ''
    const bank = t.bank_accounts?.account_label ?? ''
    const tags = (t.tags || []).map((x) => x.tag?.name).filter(Boolean).join(', ')
    const status = t.status === 'confirmed' ? 'Confirmada' : 'Pendente'
    return [
      t.date,
      escapeCsv(t.description),
      type,
      Number(t.amount).toFixed(2).replace('.', ','),
      escapeCsv(category),
      escapeCsv(bank),
      escapeCsv(tags),
      status,
    ].join(';')
  })
  // BOM UTF-8 para Excel abrir acentos corretamente
  return '\uFEFF' + [headers.join(';'), ...lines].join('\n')
}

export function ExportSettings() {
  const { user } = useAuth()
  const { data: categories } = useCategories()
  const { data: bankAccounts } = useBankAccounts()
  const { data: tags } = useTags()

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [bankAccountIds, setBankAccountIds] = useState<string[]>([])
  const [tagIds, setTagIds] = useState<string[]>([])
  const [format, setFormat] = useState<'csv'>('csv')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleExport() {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      // Filtro por tags: buscar IDs das transações primeiro
      let tagMatchedIds: string[] | null = null
      if (tagIds.length > 0) {
        const { data: matched } = await supabase
          .from('fo_transaction_tags')
          .select('transaction_id')
          .in('tag_id', tagIds)
        tagMatchedIds = Array.from(new Set((matched || []).map((r) => r.transaction_id)))
        if (tagMatchedIds.length === 0) {
          setError('Nenhuma transação encontrada para os filtros selecionados')
          return
        }
      }

      let query = supabase
        .from('fo_transactions')
        .select(
          'date, description, type, amount, status, categories:fo_categories(name), bank_accounts:fo_bank_accounts(account_label), tags:fo_transaction_tags(tag:fo_tags(name))'
        )
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      if (tagMatchedIds) query = query.in('id', tagMatchedIds)
      if (dateFrom) query = query.gte('date', dateFrom)
      if (dateTo) query = query.lte('date', dateTo)

      if (categoryIds.length > 0) {
        const hasOutros = categoryIds.some(
          (id) => categories?.find((c) => c.id === id)?.name === 'Outros'
        )
        if (hasOutros) {
          // "Outros" também inclui transações sem categoria
          query = query.or(
            `category_id.in.(${categoryIds.join(',')}),category_id.is.null`
          )
        } else {
          query = query.in('category_id', categoryIds)
        }
      }

      if (bankAccountIds.length > 0) {
        query = query.in('bank_account_id', bankAccountIds)
      }

      const { data, error: queryError } = await query
      if (queryError) throw queryError

      const rows = (data || []) as unknown as ExportRow[]
      if (rows.length === 0) {
        setError('Nenhuma transação encontrada para os filtros selecionados')
        return
      }

      const csv = buildCsv(rows)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `financeos-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao exportar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white">Exportação</h3>
        <p className="mt-1 text-sm text-slate-400">
          Exporte suas transações para um arquivo CSV compatível com Excel, Google Sheets e outras planilhas.
          Use os filtros abaixo para escolher exatamente quais lançamentos deseja exportar — por período,
          categorias, contas bancárias ou tags. Deixar um filtro vazio inclui tudo.
        </p>
      </div>

      <Card>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Data Inicial"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <Input
              label="Data Final"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          <MultiSelect
            label="Categorias"
            value={categoryIds}
            onChange={setCategoryIds}
            options={(categories || []).map((c) => ({
              value: c.id,
              label: `${c.icon} ${c.name}`,
            }))}
            placeholder="Todas as categorias"
          />

          {bankAccounts && bankAccounts.length > 0 && (
            <MultiSelect
              label="Contas bancárias"
              value={bankAccountIds}
              onChange={setBankAccountIds}
              options={bankAccounts.map((a) => ({
                value: a.id,
                label: a.account_label,
              }))}
              placeholder="Todas as contas"
            />
          )}

          {tags && tags.length > 0 && (
            <MultiSelect
              label="Tags"
              value={tagIds}
              onChange={setTagIds}
              options={tags.map((t) => ({ value: t.id, label: t.name }))}
              placeholder="Todas as tags"
            />
          )}

          <Select
            label="Formato"
            value={format}
            onChange={(e) => setFormat(e.target.value as 'csv')}
            options={[{ value: 'csv', label: 'CSV' }]}
          />

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
          )}

          <Button onClick={handleExport} loading={loading} className="w-full">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      </Card>
    </div>
  )
}
