import type { HTMLAttributes } from 'react'
import clsx from 'clsx'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'sm' | 'md' | 'lg'
  hover?: boolean
}

const paddingStyles = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export function Card({
  padding = 'md',
  hover = true,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={clsx(
        'glass-card relative overflow-hidden',
        paddingStyles[padding],
        !hover && 'pointer-events-auto',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
