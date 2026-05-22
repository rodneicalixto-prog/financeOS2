import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'
import { syncUserEmails } from '../_shared/sync-user-emails.ts'

serve(async (req) => {
  try {
    // Verificar autenticação via CRON_SECRET ou service_role key
    const authHeader = req.headers.get('Authorization')
    const cronSecret = Deno.env.get('CRON_SECRET')

    const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`
    const isServiceRole = authHeader === `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`

    if (!isCronAuth && !isServiceRole) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Buscar todos os usuários com Gmail conectado
    const { data: connections, error } = await supabaseAdmin
      .from('fo_gmail_connections')
      .select('user_id')

    if (error) throw error
    if (!connections || connections.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhum usuário com Gmail conectado', synced: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log(`[cron-sync-all] Sincronizando ${connections.length} usuário(s)...`)

    const results = []

    // Processar cada usuário sequencialmente (evita sobrecarga)
    for (const conn of connections) {
      try {
        console.log(`[cron-sync-all] Sync usuário ${conn.user_id}...`)
        const result = await syncUserEmails(supabaseAdmin, conn.user_id as string)
        results.push(result)
        console.log(`[cron-sync-all] Usuário ${conn.user_id}: ${result.emails_processed} emails processados`)
      } catch (err) {
        console.error(`[cron-sync-all] Erro no usuário ${conn.user_id}:`, (err as Error).message)
        results.push({
          user_id: conn.user_id,
          emails_found: 0,
          emails_processed: 0,
          errors: 1,
          status: 'failed',
          error: (err as Error).message,
        })
      }
    }

    const totalProcessed = results.reduce((sum, r) => sum + r.emails_processed, 0)

    return new Response(
      JSON.stringify({
        synced: connections.length,
        total_emails_processed: totalProcessed,
        results,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[cron-sync-all] Erro geral:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
