// === Enums ===

export type TransactionType = 'income' | 'expense' | 'transfer'
export type TransactionStatus = 'pending' | 'confirmed'
export type SyncStatus = 'success' | 'partial' | 'failed'
export type AlertType =
  | 'budget_exceeded'
  | 'low_balance'
  | 'large_transaction'
  | 'recurring_detected'
  | 'anomaly_detected'
export type InsightType = 'monthly_summary' | 'anomalies' | 'forecast' | 'budget_suggestions'
export type AIProvider = 'openai' | 'gemini'

// === Tabelas ===

export interface User {
  id: string
  email: string
  name: string
  created_at: string
}

export interface BankAccount {
  id: string
  user_id: string
  bank_name: string
  account_label: string
  initial_balance: number
  created_at: string
}

export interface GmailConnection {
  id: string
  user_id: string
  email_address: string | null
  access_token: string
  refresh_token: string
  token_expires_at: string
  connected_at: string
  last_sync_at: string | null
}

export interface Transaction {
  id: string
  user_id: string
  bank_account_id: string | null
  type: TransactionType
  amount: number
  description: string
  date: string
  category_id: string | null
  cnpj: string | null
  status: TransactionStatus
  is_recurring: boolean
  source_email_id: string | null
  raw_email_data: Record<string, unknown> | null
  ai_parsed_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  icon: string
  is_default: boolean
  user_id: string | null
}

export interface Tag {
  id: string
  name: string
  user_id: string
}

export interface TransactionTag {
  transaction_id: string
  tag_id: string
}

export interface Budget {
  id: string
  user_id: string
  category_id: string
  month: string
  amount_limit: number
}

export interface CnpjCache {
  cnpj: string
  company_name: string
  main_activity: string
  category_suggestion: string
  raw_data: Record<string, unknown>
  fetched_at: string
}

export interface SyncLog {
  id: string
  user_id: string
  started_at: string
  finished_at: string | null
  status: SyncStatus
  emails_found: number
  emails_processed: number
  errors: Record<string, unknown>[] | null
}

export interface BrandingSettings {
  id: true
  app_name: string
  logo_url: string | null
  favicon_url: string | null
  primary_color: string
  theme_mode: 'dark' | 'light'
  updated_by: string | null
  updated_at: string
}

export interface Alert {
  id: string
  user_id: string
  type: AlertType
  message: string
  is_read: boolean
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface AIConfig {
  id: string
  user_id: string
  provider: AIProvider
  api_key: string
  updated_at: string
}

export interface AIInsight {
  id: string
  user_id: string
  insight_type: InsightType
  reference_month: string
  payload: Record<string, unknown>
  generated_at: string
  is_stale: boolean
}

// === Insert/Update types ===

export type UserInsert = Omit<User, 'created_at'>
export type BankAccountInsert = Omit<BankAccount, 'id' | 'created_at'>
export type GmailConnectionInsert = Omit<GmailConnection, 'id' | 'connected_at'>
export type TransactionInsert = Omit<Transaction, 'id' | 'created_at' | 'updated_at'>
export type CategoryInsert = Omit<Category, 'id'>
export type TagInsert = Omit<Tag, 'id'>
export type BudgetInsert = Omit<Budget, 'id'>
export type AlertInsert = Omit<Alert, 'id' | 'created_at'>
export type SyncLogInsert = Omit<SyncLog, 'id'>
export type AIConfigInsert = Omit<AIConfig, 'id' | 'updated_at'>
