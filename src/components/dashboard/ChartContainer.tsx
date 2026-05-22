import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'

interface ChartContainerProps {
  title: string
  loading?: boolean
  children: ReactNode
}

export function ChartContainer({ title, loading, children }: ChartContainerProps) {
  return (
    <Card>
      <h3 className="mb-4 text-sm font-medium text-slate-400">{title}</h3>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        children
      )}
    </Card>
  )
}
