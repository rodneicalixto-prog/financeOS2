import { requireCredential } from './credentials.ts'

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

interface GmailTokens {
  access_token: string
  refresh_token: string
  token_expires_at: string
}

interface GmailMessage {
  id: string
  threadId: string
}

interface GmailMessageFull {
  id: string
  payload: {
    headers: Array<{ name: string; value: string }>
    body?: { data?: string }
    parts?: Array<{
      mimeType: string
      body?: { data?: string }
      parts?: Array<{ mimeType: string; body?: { data?: string } }>
    }>
  }
}

export async function refreshGmailToken(refreshToken: string): Promise<{
  access_token: string
  expires_in: number
}> {
  const clientId = await requireCredential('gmail_client_id', 'Gmail Client ID')
  const clientSecret = await requireCredential('gmail_client_secret', 'Gmail Client Secret')
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })
  return response.json()
}

export async function ensureValidToken(tokens: GmailTokens): Promise<{
  accessToken: string
  refreshed: boolean
  newExpiresAt?: string
}> {
  const expiresAt = new Date(tokens.token_expires_at)
  const now = new Date()

  // Refresh se expira em menos de 5 minutos
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    const refreshed = await refreshGmailToken(tokens.refresh_token)
    return {
      accessToken: refreshed.access_token,
      refreshed: true,
      newExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    }
  }

  return { accessToken: tokens.access_token, refreshed: false }
}

export async function searchEmails(
  accessToken: string,
  query: string,
  maxResults = 50
): Promise<GmailMessage[]> {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
  })

  console.log('[gmail-search] query:', query)

  const response = await fetch(`${GMAIL_API_BASE}/messages?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    const errorBody = await response.text()
    console.error('[gmail-search] API error:', response.status, errorBody)
    throw new Error(`Gmail API error ${response.status}: ${errorBody}`)
  }

  const data = await response.json()
  console.log('[gmail-search] found', data.messages?.length || 0, 'messages')
  return data.messages || []
}

export async function getEmailContent(
  accessToken: string,
  messageId: string
): Promise<{ subject: string; from: string; body: string; date: string }> {
  const response = await fetch(`${GMAIL_API_BASE}/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  const message: GmailMessageFull = await response.json()
  const headers = message.payload.headers

  const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value || ''
  const from = headers.find((h) => h.name.toLowerCase() === 'from')?.value || ''
  const date = headers.find((h) => h.name.toLowerCase() === 'date')?.value || ''

  const body = extractBody(message)

  return { subject, from, body, date }
}

function extractBody(message: GmailMessageFull): string {
  // Tenta extrair texto plano ou HTML do corpo
  if (message.payload.body?.data) {
    return decodeBase64Url(message.payload.body.data)
  }

  if (message.payload.parts) {
    // Prefere text/plain, fallback para text/html
    for (const mimeType of ['text/plain', 'text/html']) {
      const part = findPart(message.payload.parts, mimeType)
      if (part?.body?.data) {
        return decodeBase64Url(part.body.data)
      }
    }
  }

  return ''
}

function findPart(
  parts: GmailMessageFull['payload']['parts'],
  mimeType: string
): GmailMessageFull['payload']['parts'] extends Array<infer T> ? T | undefined : undefined {
  if (!parts) return undefined as never
  for (const part of parts) {
    if (part.mimeType === mimeType) return part as never
    if (part.parts) {
      const nested = findPart(part.parts as typeof parts, mimeType)
      if (nested) return nested as never
    }
  }
  return undefined as never
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  return atob(base64)
}
