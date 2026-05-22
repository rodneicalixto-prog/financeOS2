// =============================================================================
// src/lib/credentials.ts — SERVER-SIDE ONLY
// -----------------------------------------------------------------------------
// Encrypt/decrypt + persistência de credenciais em public.app_settings.
//
// ⚠️ NUNCA importar em código que vai pro bundle do cliente. Este arquivo lê
// process.env.CRYPTO_KEY e process.env.SUPABASE_SERVICE_ROLE_KEY — segredos
// que jamais podem chegar ao browser. Importado apenas pelas API Routes em
// `api/**`, que rodam em Node serverless na Vercel.
// =============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

// Resolve a chave AES. Aceita uma chave explícita (usada pelo bootstrap, que
// gera/reusa a CRYPTO_KEY antes dela existir em process.env do runtime atual);
// senão cai em process.env.CRYPTO_KEY (caminho normal das API Routes pós-setup).
function resolveKey(keyHex?: string): Buffer {
  const hex = keyHex ?? process.env.CRYPTO_KEY;
  if (!hex || hex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      'CRYPTO_KEY ausente ou inválida. Esperado: 64 caracteres hex (32 bytes). ' +
        'Em produção, o wizard /setup gera e seta automaticamente. Se essa env foi ' +
        'removida do Vercel, todas as entradas em app_settings ficam ilegíveis.',
    );
  }
  return Buffer.from(hex, 'hex');
}

let _client: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias no ambiente serverless.',
    );
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

export function encrypt(plaintext: string, keyHex?: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, resolveKey(keyHex), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(payload: string, keyHex?: string): string {
  const [ivHex, tagHex, cipherHex] = payload.split(':');
  if (!ivHex || !tagHex || !cipherHex) {
    throw new Error('Payload de criptografia malformado.');
  }
  const decipher = createDecipheriv(ALGORITHM, resolveKey(keyHex), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

// Cache em memória do warm-start da serverless function. TTL curto para
// permitir invalidação rápida quando o owner trocar uma chave.
const cache = new Map<string, { value: string; expires: number }>();
const CACHE_TTL_MS = 30_000;

export async function getCredential(key: string): Promise<string | null> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) return hit.value;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('app_settings')
    .select('value_encrypted')
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    cache.delete(key);
    return null;
  }
  const value = decrypt(data.value_encrypted as string);
  cache.set(key, { value, expires: now + CACHE_TTL_MS });
  return value;
}

export async function setCredential(key: string, plaintext: string): Promise<void> {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error(`Valor vazio para credencial "${key}".`);
  }
  const supabase = getSupabaseAdmin();
  const value_encrypted = encrypt(plaintext);
  const { error } = await supabase.from('app_settings').upsert(
    { key, value_encrypted, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  );
  if (error) throw error;
  cache.delete(key);
}

export async function markBootstrapStep(
  step: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('_bootstrap_state').upsert(
    { step, completed_at: new Date().toISOString(), metadata },
    { onConflict: 'step' },
  );
  if (error) throw error;
}

export async function hasBootstrapStep(step: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('_bootstrap_state')
    .select('step')
    .eq('step', step)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export function generateCryptoKey(): string {
  return randomBytes(32).toString('hex');
}

export function generateCronSecret(): string {
  return randomBytes(32).toString('hex');
}
