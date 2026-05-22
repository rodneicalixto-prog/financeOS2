import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getSupabaseAdmin, getSupabaseUser } from '../_shared/supabase-admin.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUser = getSupabaseUser(authHeader)
    const { data: { user } } = await supabaseUser.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { filters } = await req.json()
    const supabaseAdmin = getSupabaseAdmin()

    // Query transações com filtros
    let query = supabaseAdmin
      .from('fo_transactions')
      .select('*, categories:fo_categories(name), bank_accounts:fo_bank_accounts(account_label)')
      .eq('user_id', user.id)
      .order('date', { ascending: false })

    if (filters?.dateFrom) {
      query = query.gte('date', filters.dateFrom)
    }
    if (filters?.dateTo) {
      query = query.lte('date', filters.dateTo)
    }
    if (filters?.categoryId) {
      query = query.eq('category_id', filters.categoryId)
    }
    if (filters?.bankAccountId) {
      query = query.eq('bank_account_id', filters.bankAccountId)
    }

    const { data: transactions, error } = await query

    if (error) throw error

    // Gerar CSV
    const headers = ['Data', 'Descrição', 'Tipo', 'Valor', 'Categoria', 'Banco', 'Status']
    const rows = (transactions || []).map((t) => {
      const type = t.type === 'income' ? 'Entrada' : t.type === 'expense' ? 'Saída' : 'Transferência'
      const category = (t as Record<string, unknown>).categories
        ? ((t as Record<string, unknown>).categories as { name: string }).name
        : ''
      const bank = (t as Record<string, unknown>).bank_accounts
        ? ((t as Record<string, unknown>).bank_accounts as { account_label: string }).account_label
        : ''
      const status = t.status === 'confirmed' ? 'Confirmada' : 'Pendente'

      return [
        t.date,
        `"${(t.description as string).replace(/"/g, '""')}"`,
        type,
        Number(t.amount).toFixed(2).replace('.', ','),
        category,
        bank,
        status,
      ].join(';')
    })

    const csv = [headers.join(';'), ...rows].join('\n')

    return new Response(csv, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="financeos-export.csv"`,
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
