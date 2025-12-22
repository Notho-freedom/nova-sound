"use client"

import { cn } from "@/lib/utils"

interface SectionHeaderProps {
  title: string
  icon?: React.ReactNode
  action?: React.ReactNode
  count?: number
  subtitle?: string
  className?: string
}

export const SectionHeader = ({
  title,
  icon,
  action,
  count,
  subtitle,
  className,
}: SectionHeaderProps) => {
  return (
    <div className={cn("flex items-center justify-between mb-5", className)}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        )}
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
            {title}
            {count !== undefined && <span className="ml-2 text-sm text-muted-foreground font-normal">({count})</span>}
          </h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
