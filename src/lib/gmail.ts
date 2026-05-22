// =============================================================================
// src/lib/gmail.ts
// -----------------------------------------------------------------------------
// O CLIENT_ID e REDIRECT_URI do Gmail OAuth vivem em app_settings (configurados
// pelo wizard /setup). O frontend lê via /api/public-config — endpoint que
// retorna apenas valores semi-públicos, nunca o CLIENT_SECRET.
// =============================================================================

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

interface PublicConfig {
  gmail_client_id: string | null
  gmail_redirect_uri: string | null
  app_url: string | null
}

let cached: { value: PublicConfig; expires: number } | null = null
const TTL_MS = 60_000

async function fetchPublicConfig(): Promise<PublicConfig> {
  const now = Date.now()
  if (cached && cached.expires > now) return cached.value
  const res = await fetch('/api/public-config')
  if (!res.ok) {
    throw new Error(`/api/public-config respondeu ${res.status}`)
  }
  const json = (await res.json()) as { success: boolean; config: PublicConfig }
  if (!json.success || !json.config) {
    throw new Error('Resposta inválida de /api/public-config')
  }
  cached = { value: json.config, expires: now + TTL_MS }
  return json.config
}

export async function getGmailAuthUrl(): Promise<string> {
  const config = await fetchPublicConfig()
  if (!config.gmail_client_id || !config.gmail_redirect_uri) {
    throw new Error(
      'Credenciais Gmail não configuradas. O owner precisa configurar em /configuracoes.',
    )
  }
  const params = new URLSearchParams({
    client_id: config.gmail_client_id,
    redirect_uri: config.gmail_redirect_uri,
    response_type: 'code',
    scope: GMAIL_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export function extractCodeFromUrl(url: string): string | null {
  const params = new URLSearchParams(new URL(url).search)
  return params.get('code')
}
