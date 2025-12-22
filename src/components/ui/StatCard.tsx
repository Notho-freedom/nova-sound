"use client"

import { TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string
  icon: React.ReactNode
  subtitle?: string
  trend?: "up" | "down" | "neutral"
  color?: "primary" | "secondary" | "accent" | "rose" | "amber" | "emerald"
  className?: string
}

export const StatCard = ({
  label,
  value,
  icon,
  subtitle,
  trend,
  color = "primary",
  className,
}: StatCardProps) => {
  const colorClasses = {
    primary: "from-primary/20 to-primary/5 text-primary border-primary/20",
    secondary: "from-secondary/20 to-secondary/5 text-secondary border-secondary/20",
    accent: "from-accent/20 to-accent/5 text-accent border-accent/20",
    rose: "from-rose-500/20 to-rose-500/5 text-rose-400 border-rose-500/20",
    amber: "from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/20",
    emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/20",
  }

  return (
    <div
      className={cn(
        "relative group p-5 rounded-2xl overflow-hidden",
        "bg-gradient-to-br border backdrop-blur-sm",
        "transition-all duration-300 ease-out",
        "hover:scale-[1.02] hover:shadow-lg",
        colorClasses[color],
        className,
      )}
    >
      {/* Background glow */}
      <div
        className={cn(
          "absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-30",
          color === "primary" && "bg-primary",
          color === "secondary" && "bg-secondary",
          color === "accent" && "bg-accent",
          color === "rose" && "bg-rose-500",
          color === "amber" && "bg-amber-500",
          color === "emerald" && "bg-emerald-500",
        )}
      />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium">{label}</p>
          <p className="text-2xl font-display font-bold mt-1">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground/60 mt-1">{subtitle}</p>}
        </div>
        <div
          className={cn(
            "p-2.5 rounded-xl bg-white/5 transition-all duration-300",
            "group-hover:scale-110 group-hover:bg-white/10",
          )}
        >
          {icon}
        </div>
      </div>

      {trend && (
        <div className="absolute bottom-3 right-3">
          {trend === "up" && <TrendingUp className="w-4 h-4 text-emerald-400" />}
          {trend === "down" && <TrendingUp className="w-4 h-4 text-rose-400 rotate-180" />}
        </div>
      )}
    </div>
  )
}
