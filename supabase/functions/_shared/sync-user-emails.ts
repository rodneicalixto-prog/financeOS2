import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'
import { ensureValidToken, searchEmails, getEmailContent } from './gmail-client.ts'
import { parseEmailWithAI, type AICredential } from './ai-parser.ts'
import { lookupCNPJ } from './cnpj-lookup.ts'
import { computeAllMathInsights } from './compute-insights.ts'

interface SyncResult {
  user_id: string
  emails_found: number
  emails_processed: number
  errors: number
  status: 'success' | 'partial' | 'failed'
}

function parseEmailDateSafe(d: string): string | null {
  if (!d) return null
  const date = new Date(d)
  return isNaN(date.getTime()) ? null : date.toISOString()
}

function makeSnippet(body: string): string {
  return (body || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 300)
}

interface EmailRule {
  id: string
  sender_pattern: string | null
  subject_pattern: string | null
  action: 'ignore' | 'force_expense' | 'force_income'
  category_id: string | null
  match_count: number
}

function matchRule(rules: EmailRule[], from: string, subject: string): EmailRule | null {
  const f = (from || '').toLowerCase()
  const s = (subject || '').toLowerCase()
  for (const r of rules) {
    const hasSender = !!r.sender_pattern
    const hasSubject = !!r.subject_pattern
    if (!hasSender && !hasSubject) continue
    const senderOk = !hasSender || f.includes(r.sender_pattern!.toLowerCase())
    const subjectOk = !hasSubject || s.includes(r.subject_pattern!.toLowerCase())
    if (senderOk && subjectOk) return r
  }
  return null
}

export async function syncUserEmails(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<SyncResult> {
  const syncLogId = crypto.randomUUID()

  // Iniciar sync log
  await supabaseAdmin.from('fo_sync_logs').insert({
    id: syncLogId,
    user_id: userId,
    status: 'success',
    emails_found: 0,
    emails_processed: 0,
    started_at: new Date().toISOString(),
  })

  // Buscar TODAS as conexões Gmail do usuário
  const { data: gmailConnections } = await supabaseAdmin
    .from('fo_gmail_connections')
    .select('*')
    .eq('user_id', userId)

  if (!gmailConnections || gmailConnections.length === 0) {
    await updateSyncLog(supabaseAdmin, syncLogId, 'failed', 0, 0, [{ error: 'Gmail não conectado' }])
    return { user_id: userId, emails_found: 0, emails_processed: 0, errors: 0, status: 'failed' }
  }

  // Buscar config de IA do usuário (fallback para env var se não houver)
  const { data: aiConfig } = await supabaseAdmin
    .from('fo_ai_configs')
    .select('provider, api_key')
    .eq('user_id', userId)
    .maybeSingle()

  const aiCredential: AICredential | undefined = aiConfig
    ? {
        provider: aiConfig.provider as 'openai' | 'gemini',
        apiKey: aiConfig.api_key as string,
      }
    : undefined

  // Buscar bancos do usuário
  const { data: bankAccounts } = await supabaseAdmin
    .from('fo_bank_accounts')
    .select('*')
    .eq('user_id', userId)

  if (!bankAccounts || bankAccounts.length === 0) {
    await updateSyncLog(supabaseAdmin, syncLogId, 'success', 0, 0, null)
    return { user_id: userId, emails_found: 0, emails_processed: 0, errors: 0, status: 'success' }
  }

  // Carregar regras de sync (Nível 2)
  const { data: rulesData } = await supabaseAdmin
    .from('fo_email_rules')
    .select('id, sender_pattern, subject_pattern, action, category_id, match_count')
    .eq('user_id', userId)
    .eq('enabled', true)
  const rules: EmailRule[] = (rulesData || []) as EmailRule[]

  // Montar query de busca — sempre busca 30d mínimo (dedup via source_email_id)
  const afterDate = 'newer_than:30d'

  const keywords = [
    // Bancos
    'banco', 'nubank', 'itau', 'itaú', 'inter', 'bradesco', 'santander', 'c6bank', 'btg', 'caixa', 'bb',
    // Transações bancárias
    'transação', 'transferência', 'pix', 'débito', 'crédito', 'ted', 'doc',
    // Recibos, faturas e cobranças
    'receipt', 'recibo', 'invoice', 'fatura', 'nota fiscal', 'cobrança', 'pagamento', 'payment',
    // Assinaturas e serviços
    'assinatura', 'subscription', 'renovação', 'mensalidade',
    // Plataformas de pagamento
    'stripe', 'paypal', 'mercadopago', 'pagseguro', 'iugu', 'hotmart',
  ]
  const searchQuery = `${afterDate} (${keywords.join(' OR ')})`

  let totalEmailsFound = 0
  let totalEmailsProcessed = 0
  const allErrors: Array<Record<string, unknown>> = []

  // Iterar cada conexão Gmail
  for (const gmailConn of gmailConnections) {
    try {
      // Garantir token válido
      const { accessToken, refreshed, newExpiresAt } = await ensureValidToken({
        access_token: gmailConn.access_token as string,
        refresh_token: gmailConn.refresh_token as string,
        token_expires_at: gmailConn.token_expires_at as string,
      })

      if (refreshed && newExpiresAt) {
        await supabaseAdmin
          .from('fo_gmail_connections')
          .update({ access_token: accessToken, token_expires_at: newExpiresAt })
          .eq('id', gmailConn.id)
      }

      // Buscar emails desta conexão
      const messages = await searchEmails(accessToken, searchQuery, 50)
      totalEmailsFound += messages.length

      // Processar cada email
      for (const message of messages) {
        // Skip se já registrado em fo_scanned_emails (parsed / declined / ignored / manual / erro)
        const { data: alreadyScanned } = await supabaseAdmin
          .from('fo_scanned_emails')
          .select('id')
          .eq('user_id', userId)
          .eq('message_id', message.id)
          .maybeSingle()

        if (alreadyScanned) continue

        let emailContent: { subject: string; from: string; body: string; date: string } | null = null
        let receivedAt: string | null = null
        let snippet: string | null = null

        try {
          emailContent = await getEmailContent(accessToken, message.id)
          receivedAt = parseEmailDateSafe(emailContent.date)
          snippet = makeSnippet(emailContent.body)

          // Dedup com fo_transactions antigas (dados pré-existentes)
          const { data: existingTx } = await supabaseAdmin
            .from('fo_transactions')
            .select('id')
            .eq('source_email_id', message.id)
            .eq('user_id', userId)
            .maybeSingle()

          if (existingTx) {
            await supabaseAdmin.from('fo_scanned_emails').insert({
              user_id: userId,
              gmail_connection_id: gmailConn.id,
              message_id: message.id,
              subject: emailContent.subject,
              from_address: emailContent.from,
              snippet,
              received_at: receivedAt,
              kind: 'parsed',
              transaction_id: existingTx.id,
            })
            continue
          }

          // Match contra regras (Nível 2)
          const matchedRule = matchRule(rules, emailContent.from, emailContent.subject)

          if (matchedRule?.action === 'ignore') {
            await supabaseAdmin.from('fo_scanned_emails').insert({
              user_id: userId,
              gmail_connection_id: gmailConn.id,
              message_id: message.id,
              subject: emailContent.subject,
              from_address: emailContent.from,
              snippet,
              received_at: receivedAt,
              kind: 'ignored',
            })
            await supabaseAdmin
              .from('fo_email_rules')
              .update({
                match_count: matchedRule.match_count + 1,
                last_matched_at: new Date().toISOString(),
              })
              .eq('id', matchedRule.id)
            matchedRule.match_count++
            continue
          }

          // Parsear com AI
          const parsed = await parseEmailWithAI(
            `Assunto: ${emailContent.subject}\nDe: ${emailContent.from}\nData: ${emailContent.date}\n\n${emailContent.body}`,
            aiCredential
          )

          if ('error' in parsed) {
            await supabaseAdmin.from('fo_scanned_emails').insert({
              user_id: userId,
              gmail_connection_id: gmailConn.id,
              message_id: message.id,
              subject: emailContent.subject,
              from_address: emailContent.from,
              snippet,
              received_at: receivedAt,
              kind: 'declined',
            })
            allErrors.push({ messageId: message.id, email: gmailConn.email_address, error: 'AI unable to parse', kind: 'ai_declined' })
            continue
          }

          // Lookup CNPJ se presente
          let categoryId: string | null = null
          if (parsed.cnpj) {
            const cnpjData = await lookupCNPJ(parsed.cnpj, supabaseAdmin)
            if (cnpjData) {
              const { data: category } = await supabaseAdmin
                .from('fo_categories')
                .select('id')
                .eq('name', cnpjData.category_suggestion)
                .eq('is_default', true)
                .single()
              categoryId = (category?.id as string) || null
            }
          }

          // Fallback por keywords na descrição/contraparte
          if (!categoryId) {
            const textForCategory = `${parsed.description} ${parsed.counterpart_name}`.toLowerCase()
            const categoryKeywords: Record<string, string[]> = {
              'Assinaturas': ['assinatura', 'subscription', 'renovação', 'mensalidade', 'recorrente', 'plano mensal', 'google one', 'netflix', 'spotify', 'amazon prime', 'disney', 'hbo', 'apple', 'icloud', 'chatgpt', 'openai', 'github', 'stripe'],
              'Alimentação': ['ifood', 'rappi', 'uber eats', 'restaurante', 'lanchonete', 'padaria', 'supermercado'],
              'Transporte': ['uber', '99', 'cabify', 'combustível', 'posto', 'estacionamento', 'pedágio'],
            }
            for (const [catName, keywords] of Object.entries(categoryKeywords)) {
              if (keywords.some((kw) => textForCategory.includes(kw))) {
                const { data: cat } = await supabaseAdmin
                  .from('fo_categories')
                  .select('id')
                  .eq('name', catName)
                  .eq('is_default', true)
                  .single()
                if (cat?.id) {
                  categoryId = cat.id as string
                  break
                }
              }
            }
          }

          // Fallback final: categoria "Outros"
          if (!categoryId) {
            const { data: outrosCategory } = await supabaseAdmin
              .from('fo_categories')
              .select('id')
              .eq('name', 'Outros')
              .eq('is_default', true)
              .single()
            categoryId = (outrosCategory?.id as string) || null
          }

          // Verificar se categoria é "Assinaturas" → marcar recorrente
          let isRecurring = false
          if (categoryId) {
            const { data: catData } = await supabaseAdmin
              .from('fo_categories')
              .select('name')
              .eq('id', categoryId)
              .single()
            if (catData?.name === 'Assinaturas') {
              isRecurring = true
            }
          }

          // Detectar transferência
          let transactionType: 'income' | 'expense' | 'transfer' = detectTransfer(parsed.description, parsed.counterpart_name)
            ? 'transfer'
            : parsed.type

          // Aplicar overrides da regra (Nível 2)
          if (matchedRule?.action === 'force_expense') {
            transactionType = 'expense'
            if (matchedRule.category_id) categoryId = matchedRule.category_id
          } else if (matchedRule?.action === 'force_income') {
            transactionType = 'income'
            if (matchedRule.category_id) categoryId = matchedRule.category_id
          }

          if (matchedRule) {
            await supabaseAdmin
              .from('fo_email_rules')
              .update({
                match_count: matchedRule.match_count + 1,
                last_matched_at: new Date().toISOString(),
              })
              .eq('id', matchedRule.id)
            matchedRule.match_count++
          }

          const bankAccountId = (bankAccounts[0]?.id as string) || null

          // Inserir transação
          const { data: insertedTx } = await supabaseAdmin
            .from('fo_transactions')
            .insert({
              user_id: userId,
              bank_account_id: bankAccountId,
              type: transactionType,
              amount: Math.abs(parsed.amount),
              description: parsed.description,
              date: parsed.date,
              category_id: categoryId,
              cnpj: parsed.cnpj,
              status: 'pending',
              is_recurring: isRecurring,
              source_email_id: message.id,
              raw_email_data: emailContent,
              ai_parsed_data: parsed,
            })
            .select('id')
            .single()

          // Registrar em fo_scanned_emails (parsed + transaction_id)
          await supabaseAdmin.from('fo_scanned_emails').insert({
            user_id: userId,
            gmail_connection_id: gmailConn.id,
            message_id: message.id,
            subject: emailContent.subject,
            from_address: emailContent.from,
            snippet,
            received_at: receivedAt,
            kind: 'parsed',
            transaction_id: insertedTx?.id || null,
          })

          totalEmailsProcessed++
        } catch (err) {
          // Best-effort: registra erro em fo_scanned_emails (só se já temos o conteúdo do email)
          if (emailContent) {
            await supabaseAdmin
              .from('fo_scanned_emails')
              .insert({
                user_id: userId,
                gmail_connection_id: gmailConn.id,
                message_id: message.id,
                subject: emailContent.subject,
                from_address: emailContent.from,
                snippet,
                received_at: receivedAt,
                kind: 'error',
                error_message: (err as Error).message,
              })
              .then(() => null, () => null)
          }
          allErrors.push({ messageId: message.id, email: gmailConn.email_address, error: (err as Error).message })
        }
      }

      // Atualizar last_sync_at desta conexão
      await supabaseAdmin
        .from('fo_gmail_connections')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', gmailConn.id)
    } catch (err) {
      allErrors.push({ email: gmailConn.email_address, error: (err as Error).message })
    }
  }

  // Debug: salvar query e conexões usadas no log
  const debugInfo: Record<string, unknown> = {
    query: searchQuery,
    connections: gmailConnections.map((c: Record<string, unknown>) => c.email_address),
    totalEmailsFound,
    totalEmailsProcessed,
  }

  // Atualizar sync log
  // - success: zero declínios da IA + zero erros reais
  // - partial: tem declínios pra revisar (em /emails-analisados) OU erros reais mas processou >=1
  // - failed:  erros reais e processou 0
  const aiDeclines = allErrors.filter((e) => e.kind === 'ai_declined').length
  const realErrors = allErrors.filter((e) => e.kind !== 'ai_declined').length
  const logErrors = allErrors.length > 0 ? allErrors : [debugInfo]
  let status: 'success' | 'partial' | 'failed'
  if (realErrors > 0 && totalEmailsProcessed === 0) {
    status = 'failed'
  } else if (aiDeclines > 0 || realErrors > 0) {
    status = 'partial'
  } else {
    status = 'success'
  }
  await updateSyncLog(supabaseAdmin, syncLogId, status, totalEmailsFound, totalEmailsProcessed, logErrors)

  // Computar insights matemáticos (previsão + anomalias) — non-blocking
  try {
    await computeAllMathInsights(supabaseAdmin, userId)
  } catch (err) {
    console.error('Failed to compute insights:', (err as Error).message)
  }

  return { user_id: userId, emails_found: totalEmailsFound, emails_processed: totalEmailsProcessed, errors: allErrors.length, status }
}

function detectTransfer(description: string, counterpartName: string): boolean {
  const transferKeywords = [
    'transferência entre contas',
    'transf entre contas',
    'resgate',
    'aplicação',
    'movimentação interna',
  ]
  const text = `${description} ${counterpartName}`.toLowerCase()
  return transferKeywords.some((kw) => text.includes(kw))
}

async function updateSyncLog(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  id: string,
  status: string,
  emailsFound: number,
  emailsProcessed: number,
  errors: Array<Record<string, unknown>> | null
) {
  await supabase
    .from('fo_sync_logs')
    .update({
      status,
      emails_found: emailsFound,
      emails_processed: emailsProcessed,
      errors,
      finished_at: new Date().toISOString(),
    })
    .eq('id', id)
}
