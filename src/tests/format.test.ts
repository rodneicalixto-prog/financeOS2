import { describe, it, expect } from 'vitest'
import { format } from 'date-fns'
import { formatBRL, formatDate, formatDateRelative, formatMonth, formatPercent } from '@/lib/format'

describe('formatBRL', () => {
  it('formata valores positivos', () => {
    expect(formatBRL(1234.56)).toBe('R$\u00a01.234,56')
  })

  it('formata zero', () => {
    expect(formatBRL(0)).toBe('R$\u00a00,00')
  })

  it('formata valores negativos', () => {
    expect(formatBRL(-500)).toBe('-R$\u00a0500,00')
  })

  it('formata valores grandes', () => {
    expect(formatBRL(1000000)).toBe('R$\u00a01.000.000,00')
  })
})

describe('formatDate', () => {
  it('formata data no padrão brasileiro', () => {
    expect(formatDate('2026-04-09')).toBe('09/04/2026')
  })

  it('formata data com ISO string', () => {
    expect(formatDate('2026-01-15')).toBe('15/01/2026')
  })
})

describe('formatDateRelative', () => {
  it('retorna "Hoje" para data de hoje', () => {
    // Usa data local (não toISOString, que retorna UTC e pode diferir do dia local)
    const today = format(new Date(), 'yyyy-MM-dd')
    expect(formatDateRelative(today)).toBe('Hoje')
  })

  it('retorna data formatada para datas antigas', () => {
    expect(formatDateRelative('2025-01-01')).toBe('01/01/2025')
  })
})

describe('formatMonth', () => {
  it('formata mês em português', () => {
    const result = formatMonth('2026-04-01')
    expect(result).toBe('abril de 2026')
  })
})

describe('formatPercent', () => {
  it('formata percentual positivo com sinal', () => {
    expect(formatPercent(20.5)).toBe('+20.5%')
  })

  it('formata percentual negativo', () => {
    expect(formatPercent(-15.3)).toBe('-15.3%')
  })

  it('formata zero com sinal positivo', () => {
    expect(formatPercent(0)).toBe('+0.0%')
  })
})
