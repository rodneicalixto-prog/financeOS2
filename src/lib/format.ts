import { format, parseISO, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(dateString: string): string {
  return format(parseISO(dateString), 'dd/MM/yyyy', { locale: ptBR })
}

export function formatDateRelative(dateString: string): string {
  const date = parseISO(dateString)
  if (isToday(date)) return 'Hoje'
  if (isYesterday(date)) return 'Ontem'
  return format(date, 'dd/MM/yyyy', { locale: ptBR })
}

export function formatMonth(dateString: string): string {
  return format(parseISO(dateString), "MMMM 'de' yyyy", { locale: ptBR })
}

export function formatShortDate(dateString: string): string {
  return format(parseISO(dateString), 'dd/MM', { locale: ptBR })
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}
