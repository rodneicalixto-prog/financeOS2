import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { ChartContainer } from './ChartContainer'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatBRL } from '@/lib/format'
import type { PeriodBarItem } from '@/hooks/useChartData'

interface Props {
  data: PeriodBarItem[]
  loading?: boolean
}

export function RevenueExpenseBarChart({ data, loading }: Props) {
  return (
    <ChartContainer title="Receita vs Despesa por Período" loading={loading}>
      {data.length === 0 ? (
        <EmptyState
          title="Sem dados"
          description="Nenhuma transação no período selecionado."
        />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="period"
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                formatBRL(value),
                name === 'income' ? 'Receita' : 'Despesa',
              ]}
              contentStyle={{
                background: 'rgba(17, 25, 40, 0.95)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
              }}
              itemStyle={{ color: '#f1f5f9' }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Legend
              formatter={(value: string) => (value === 'income' ? 'Receita' : 'Despesa')}
            />
            <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartContainer>
  )
}
