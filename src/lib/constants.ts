export const DEFAULT_CATEGORIES = [
  { name: 'Alimentação', icon: '🍔' },
  { name: 'Transporte', icon: '🚗' },
  { name: 'Saúde', icon: '🏥' },
  { name: 'Moradia', icon: '🏠' },
  { name: 'Lazer', icon: '🎮' },
  { name: 'Educação', icon: '📚' },
  { name: 'Assinaturas', icon: '🔄' },
  { name: 'Outros', icon: '📦' },
] as const

export const CATEGORY_COLORS: Record<string, string> = {
  'Alimentação': '#f97316',
  'Transporte': '#3b82f6',
  'Saúde': '#22c55e',
  'Moradia': '#a855f7',
  'Lazer': '#ec4899',
  'Educação': '#eab308',
  'Assinaturas': '#06b6d4',
  'Outros': '#64748b',
}

export const SUPPORTED_BANKS = [
  { id: 'nubank', name: 'Nubank', color: '#8B5CF6', emailFrom: ['todomundo@nubank.com.br'] },
  { id: 'itau', name: 'Itaú', color: '#F97316', emailFrom: ['itau@itau-unibanco.com.br'] },
  { id: 'inter', name: 'Inter', color: '#F97316', emailFrom: ['email@bancointer.com.br'] },
  { id: 'bradesco', name: 'Bradesco', color: '#EF4444', emailFrom: ['bradesco@bradesco.com.br'] },
  { id: 'bb', name: 'Banco do Brasil', color: '#EAB308', emailFrom: ['bb@bb.com.br'] },
  { id: 'santander', name: 'Santander', color: '#EF4444', emailFrom: ['santander@santander.com.br'] },
  { id: 'c6', name: 'C6 Bank', color: '#1F2937', emailFrom: ['noreply@c6bank.com.br'] },
  { id: 'btg', name: 'BTG Pactual', color: '#1E3A5F', emailFrom: ['btg@btgpactual.com'] },
] as const

export const ITEMS_PER_PAGE = 20
export const SYNC_INTERVAL_MS = 5 * 60 * 1000
export const AI_MAX_RETRIES = 3
