export interface AIParsedTransaction {
  amount: number
  date: string
  description: string
  type: 'income' | 'expense'
  cnpj: string | null
  counterpart_name: string
}

export interface AIParseError {
  error: 'unable_to_parse'
}

export type AIParseResult = AIParsedTransaction | AIParseError

export interface RecurringDetection {
  transaction_ids: string[]
  service_name: string
  avg_amount: number
  frequency: 'monthly'
}
