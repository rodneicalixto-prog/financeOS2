import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { ChartContainer } from './ChartContainer'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatBRL } from '@/lib/format'
import type { CategoryBarItem } from '@/hooks/useChartData'

interface Props {
  data: CategoryBarItem[]
  loading?: boolean
}

export function ExpensesCategoryBarChart({ data, loading }: Props) {
  return (
    <ChartContainer title="Gastos por Categoria" loading={loading}>
      {data.length === 0 ? (
        <EmptyState
          title="Sem dados"
          description="Nenhuma despesa no período selecionado."
        />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} layout="vertical" barSize={20}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
            <XAxis
              type="number"
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              width={100}
            />
            <Tooltip
              formatter={(value: number) => [formatBRL(value), 'Total']}
              contentStyle={{
                background: 'rgba(17, 25, 40, 0.95)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
              }}
              itemStyle={{ color: '#f1f5f9' }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartContainer>
  )
}
