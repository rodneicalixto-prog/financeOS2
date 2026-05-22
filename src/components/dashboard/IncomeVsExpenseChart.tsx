import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { ChartContainer } from './ChartContainer'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatBRL } from '@/lib/format'
import type { IncomeExpenseItem } from '@/hooks/useChartData'

interface Props {
  data: IncomeExpenseItem[]
  loading?: boolean
}

export function IncomeVsExpenseChart({ data, loading }: Props) {
  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <ChartContainer title="Receita vs Despesa" loading={loading}>
      {total === 0 ? (
        <EmptyState
          title="Sem dados"
          description="Nenhuma transação no período selecionado."
        />
      ) : (
        <div className="flex flex-col items-center gap-4 lg:flex-row">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                dataKey="value"
                paddingAngle={2}
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => formatBRL(value)}
                contentStyle={{
                  background: 'rgba(17, 25, 40, 0.95)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                }}
                itemStyle={{ color: '#f1f5f9' }}
                labelStyle={{ color: '#94a3b8' }}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="flex flex-col gap-3">
            {data.map((item) => (
              <div key={item.name} className="flex items-center gap-3">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <div>
                  <p className="text-sm text-slate-300">{item.name}</p>
                  <p className="text-lg font-semibold" style={{ color: item.color }}>
                    {formatBRL(item.value)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartContainer>
  )
}
