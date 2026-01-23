"use client"

import { memo } from "react"
import { TrendingUp, TrendingDown } from "lucide-react"
import { motion } from "framer-motion"
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

export const StatCard = memo(({
  label,
  value,
  icon,
  subtitle,
  trend,
  color = "primary",
  className,
}: StatCardProps) => {
  const colorClasses = {
    primary: {
      glow: "hsl(var(--primary) / 0.3)",
      iconBg: "bg-primary/15",
      iconText: "text-primary",
    },
    secondary: {
      glow: "hsl(var(--secondary) / 0.3)",
      iconBg: "bg-secondary/15",
      iconText: "text-secondary",
    },
    accent: {
      glow: "hsl(var(--accent) / 0.3)",
      iconBg: "bg-accent/15",
      iconText: "text-accent",
    },
    rose: {
      glow: "hsl(var(--color-pink) / 0.3)",
      iconBg: "bg-pink/15",
      iconText: "text-pink",
    },
    amber: {
      glow: "hsl(var(--color-orange) / 0.3)",
      iconBg: "bg-orange/15",
      iconText: "text-orange",
    },
    emerald: {
      glow: "hsl(var(--color-green) / 0.3)",
      iconBg: "bg-green/15",
      iconText: "text-green",
    },
  }

  const colorConfig = colorClasses[color]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4, scale: 1.02 }}
      className={cn(
        // Pure Vision Pro spatial stat card
        "relative group p-5 rounded-2xl overflow-hidden",
        "bg-white/[0.04] backdrop-blur-2xl",
        "border border-white/[0.08]",
        "transition-all duration-300 ease-out",
        "hover:bg-white/[0.06]",
        "hover:border-white/[0.12]",
        "hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)]",
        className,
      )}
    >
      {/* Top highlight line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      
      {/* Ambient corner glow */}
      <div
        className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-60 transition-opacity duration-500"
        style={{ backgroundColor: colorConfig.glow }}
      />

      <div className="relative flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-medium">
            {label}
          </p>
          <p className="text-3xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground/70 mt-1.5">{subtitle}</p>
          )}
        </div>
        
        <div
          className={cn(
            "relative p-3 rounded-xl backdrop-blur-xl",
            "border border-white/[0.1]",
            "transition-all duration-300",
            "group-hover:scale-110",
            colorConfig.iconBg,
            colorConfig.iconText,
          )}
        >
          {icon}
          {/* Icon glow */}
          <div 
            className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ boxShadow: `0 0 20px ${colorConfig.glow}` }}
          />
        </div>
      </div>

      {/* Trend indicator */}
      {trend && trend !== "neutral" && (
        <div className="absolute bottom-4 right-4">
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
              "backdrop-blur-xl border",
              trend === "up" && "bg-green/15 border-green/30 text-green",
              trend === "down" && "bg-red/15 border-red/30 text-red",
            )}
          >
            {trend === "up" ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
})

StatCard.displayName = "StatCard"
