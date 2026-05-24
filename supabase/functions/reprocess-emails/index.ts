// =============================================================================
// reprocess-emails — re-roda o parser de IA (já endurecido) nas transações
// PENDENTES geradas pela IA e REMOVE os falsos-positivos (ex.: newsletters que
// só citam valores). Usa o raw_email_data salvo, sem re-buscar no Gmail.
//
// Seguro: só toca em transações status='pending' com ai_parsed_data != null
// (auto-extraídas). Conversões manuais (status='confirmed', ai_parsed_data=null)
// e transações já confirmadas ficam intactas.
// =============================================================================
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getSupabaseAdmin, getSupabaseUser } from '../_shared/supabase-admin.ts'
import { parseEmailWithAI, type AICredential } from '../_shared/ai-parser.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Teto por chamada pra não estourar o tempo da function (N chamadas de IA).
const MAX_REEVAL = 200

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json(401, { error: 'Não autorizado' })

    const userClient = getSupabaseUser(authHeader)
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) return json(401, { error: 'Usuário não autenticado' })

    const admin = getSupabaseAdmin()

    // Credencial de IA (per-user → fallback pro app_settings dentro de parseEmailWithAI).
    const { data: aiConfig } = await admin
      .from('fo_ai_configs')
      .select('provider, api_key')
      .eq('user_id', user.id)
      .maybeSingle()
    const aiCredential: AICredential | undefined = aiConfig
      ? { provider: aiConfig.provider as 'openai' | 'gemini', apiKey: aiConfig.api_key as string }
      : undefined

    // Transações pendentes auto-extraídas (ai_parsed_data != null) com conteúdo do email.
    const { data: txs, error: txErr } = await admin
      .from('fo_transactions')
      .select('id, source_email_id, raw_email_data')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .not('ai_parsed_data', 'is', null)
      .not('raw_email_data', 'is', null)
      .limit(MAX_REEVAL)
    if (txErr) return json(500, { error: txErr.message })

    let checked = 0
    let removed = 0
    let errors = 0

    for (const tx of txs || []) {
      const raw = tx.raw_email_data as
        | { subject?: string; from?: string; body?: string; date?: string }
        | null
      if (!raw || !raw.body) continue
      checked++
      try {
        const parsed = await parseEmailWithAI(
          `Assunto: ${raw.subject || ''}\nDe: ${raw.from || ''}\nData: ${raw.date || ''}\n\n${raw.body}`,
          aiCredential,
        )
        if ('error' in parsed) {
          // Falso-positivo segundo o parser atual → remove e marca o email como declined.
          await admin.from('fo_transactions').delete().eq('id', tx.id).eq('user_id', user.id)
          if (tx.source_email_id) {
            await admin
              .from('fo_scanned_emails')
              .update({ kind: 'declined', transaction_id: null })
              .eq('user_id', user.id)
              .eq('message_id', tx.source_email_id)
          }
          removed++
        }
      } catch (_e) {
        errors++
      }
    }

    return json(200, { checked, removed, errors })
  } catch (e) {
    return json(500, { error: (e as Error).message })
  }
})
