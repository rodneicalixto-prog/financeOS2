import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import type { Transaction } from '@/types'
import { ITEMS_PER_PAGE } from '@/lib/constants'

export interface TransactionFilters {
  dateFrom?: string
  dateTo?: string
  bankAccountId?: string
  categoryId?: string
  /** Quando true (categoria "Outros"), inclui também transações sem categoria */
  includeUncategorized?: boolean
  type?: 'income' | 'expense' | 'transfer'
  search?: string
  tagIds?: string[]
}

export function useTransactions(filters: TransactionFilters = {}, page = 0) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['transactions', user?.id, filters, page],
    queryFn: async () => {
      // Filtro por tags: buscar IDs primeiro, aplicar na query principal
      let tagMatchedIds: string[] | null = null
      if (filters.tagIds && filters.tagIds.length > 0) {
        const { data: matched } = await supabase
          .from('fo_transaction_tags')
          .select('transaction_id')
          .in('tag_id', filters.tagIds)
        tagMatchedIds = Array.from(new Set((matched || []).map((r) => r.transaction_id)))
        if (tagMatchedIds.length === 0) {
          return { transactions: [], totalCount: 0, totalPages: 0 }
        }
      }

      let query = supabase
        .from('fo_transactions')
        .select('*, categories:fo_categories(name, icon), tags:fo_transaction_tags(tag:fo_tags(id, name))', { count: 'exact' })
        .eq('user_id', user!.id)
        .order('date', { ascending: false })
        .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1)

      if (tagMatchedIds) {
        query = query.in('id', tagMatchedIds)
      }

      if (filters.dateFrom) {
        query = query.gte('date', filters.dateFrom)
      }
      if (filters.dateTo) {
        query = query.lte('date', filters.dateTo)
      }
      if (filters.bankAccountId) {
        query = query.eq('bank_account_id', filters.bankAccountId)
      }
      if (filters.categoryId) {
        if (filters.includeUncategorized) {
          query = query.or(`category_id.eq.${filters.categoryId},category_id.is.null`)
        } else {
          query = query.eq('category_id', filters.categoryId)
        }
      }
      if (filters.type) {
        query = query.eq('type', filters.type)
      }
      if (filters.search) {
        query = query.ilike('description', `%${filters.search}%`)
      }

      const { data, error, count } = await query

      if (error) throw error

      return {
        transactions: (data || []) as (Transaction & {
          categories: { name: string; icon: string } | null
          tags: { tag: { id: string; name: string } }[]
        })[],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE),
      }
    },
    enabled: !!user,
  })
}

export function useAllTransactions(filters: TransactionFilters = {}) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['transactions-all', user?.id, filters],
    queryFn: async () => {
      let tagMatchedIds: string[] | null = null
      if (filters.tagIds && filters.tagIds.length > 0) {
        const { data: matched } = await supabase
          .from('fo_transaction_tags')
          .select('transaction_id')
          .in('tag_id', filters.tagIds)
        tagMatchedIds = Array.from(new Set((matched || []).map((r) => r.transaction_id)))
        if (tagMatchedIds.length === 0) {
          return [] as (Transaction & {
            categories: { name: string; icon: string } | null
            tags: { tag: { id: string; name: string } }[]
          })[]
        }
      }

      let query = supabase
        .from('fo_transactions')
        .select('*, categories:fo_categories(name, icon), tags:fo_transaction_tags(tag:fo_tags(id, name))')
        .eq('user_id', user!.id)
        .order('date', { ascending: false })

      if (tagMatchedIds) {
        query = query.in('id', tagMatchedIds)
      }

      if (filters.dateFrom) {
        query = query.gte('date', filters.dateFrom)
      }
      if (filters.dateTo) {
        query = query.lte('date', filters.dateTo)
      }
      if (filters.bankAccountId) {
        query = query.eq('bank_account_id', filters.bankAccountId)
      }
      if (filters.categoryId) {
        if (filters.includeUncategorized) {
          query = query.or(`category_id.eq.${filters.categoryId},category_id.is.null`)
        } else {
          query = query.eq('category_id', filters.categoryId)
        }
      }
      if (filters.type) {
        query = query.eq('type', filters.type)
      }

      const { data, error } = await query
      if (error) throw error

      return (data || []) as (Transaction & {
        categories: { name: string; icon: string } | null
        tags: { tag: { id: string; name: string } }[]
      })[]
    },
    enabled: !!user,
  })
}
