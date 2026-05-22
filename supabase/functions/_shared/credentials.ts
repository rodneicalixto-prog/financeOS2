// =============================================================================
// _shared/credentials.ts — Deno equivalent do helper Node.
// -----------------------------------------------------------------------------
// As Edge Functions também lêem credenciais de aplicação (OpenAI key, Gmail
// secret) a partir de public.app_settings — não mais de Deno.env. Isso permite
// que o wizard /setup configure tudo via UI sem o aluno tocar em secrets do
// Supabase Dashboard.
//
// CRYPTO_KEY, SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY continuam vindo de
// Deno.env (auto-injetadas + setadas pelo bootstrap via Management API).
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const ALGORITHM = 'AES-GCM'
const IV_LENGTH = 12

let _keyPromise: Promise<CryptoKey> | null = null

function getKey(): Promise<CryptoKey> {
  if (_keyPromise) return _keyPromise
  const hex = Deno.env.get('CRYPTO_KEY')
  if (!hex || hex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      'CRYPTO_KEY ausente ou inválida nos secrets desta Edge Function. ' +
        'O wizard /setup configura via Supabase Management API; se foi removida ' +
        'manualmente, todas as credenciais em app_settings ficam ilegíveis.',
    )
  }
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  _keyPromise = crypto.subtle.importKey('raw', bytes, ALGORITHM, false, ['decrypt', 'encrypt'])
  return _keyPromise
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16)
  return out
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const enc = new TextEncoder()
  const cipherBuf = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, enc.encode(plaintext))
  // WebCrypto's GCM concatena ciphertext + tag de 16 bytes. Separamos para
  // espelhar o formato do helper Node (iv:tag:ciphertext).
  const cipherBytes = new Uint8Array(cipherBuf)
  const tag = cipherBytes.slice(cipherBytes.length - 16)
  const ciphertext = cipherBytes.slice(0, cipherBytes.length - 16)
  return `${bytesToHex(iv)}:${bytesToHex(tag)}:${bytesToHex(ciphertext)}`
}

export async function decrypt(payload: string): Promise<string> {
  const [ivHex, tagHex, cipherHex] = payload.split(':')
  if (!ivHex || !tagHex || !cipherHex) {
    throw new Error('Payload de criptografia malformado.')
  }
  const key = await getKey()
  const iv = hexToBytes(ivHex)
  const tag = hexToBytes(tagHex)
  const ciphertext = hexToBytes(cipherHex)
  const combined = new Uint8Array(ciphertext.length + tag.length)
  combined.set(ciphertext, 0)
  combined.set(tag, ciphertext.length)
  const plainBuf = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, combined)
  return new TextDecoder().decode(plainBuf)
}

// Cache simples em memória do warm container (Supabase reaproveita por ~5min).
const cache = new Map<string, { value: string; expires: number }>()
const CACHE_TTL_MS = 30_000

function getAdmin() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function getCredential(key: string): Promise<string | null> {
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && hit.expires > now) return hit.value

  const supabase = getAdmin()
  const { data, error } = await supabase
    .from('app_settings')
    .select('value_encrypted')
    .eq('key', key)
    .maybeSingle()
  if (error) throw error
  if (!data) {
    cache.delete(key)
    return null
  }
  const value = await decrypt(data.value_encrypted as string)
  cache.set(key, { value, expires: now + CACHE_TTL_MS })
  return value
}

export async function requireCredential(key: string, friendlyName?: string): Promise<string> {
  const value = await getCredential(key)
  if (!value) {
    throw new Error(
      `Credencial "${friendlyName ?? key}" não está configurada. ` +
        'Acesse /configuracoes (owner) ou refaça o wizard /setup.',
    )
  }
  return value
}
