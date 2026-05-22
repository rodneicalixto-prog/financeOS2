import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { ChartContainer } from './ChartContainer'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatBRL } from '@/lib/format'
import type { CategoryChartItem } from '@/hooks/useChartData'

interface Props {
  data: CategoryChartItem[]
  loading?: boolean
}

export function ExpensesByCategoryChart({ data, loading }: Props) {
  return (
    <ChartContainer title="Gastos por Categoria" loading={loading}>
      {data.length === 0 ? (
        <EmptyState
          title="Sem dados"
          description="Nenhuma despesa no período selecionado."
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

          <div className="flex flex-col gap-2">
            {data.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-sm">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-slate-300">
                  {item.icon} {item.name}
                </span>
                <span className="ml-auto text-slate-400">
                  {formatBRL(item.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartContainer>
  )
}
