"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  subtitle?: string;
  className?: string;
  variant?: "default" | "compact" | "large";
}

export const StatCard = ({
  label,
  value,
  icon,
  trend,
  trendValue,
  subtitle,
  className,
  variant = "default",
}: StatCardProps) => {
  const trendColors = {
    up: "text-green-500",
    down: "text-red-500",
    neutral: "text-muted-foreground",
  };

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  const sizeClasses = {
    compact: {
      container: "p-3",
      value: "text-xl",
      label: "text-xs",
      icon: "w-4 h-4",
    },
    default: {
      container: "p-4",
      value: "text-2xl",
      label: "text-sm",
      icon: "w-5 h-5",
    },
    large: {
      container: "p-6",
      value: "text-4xl",
      label: "text-base",
      icon: "w-6 h-6",
    },
  };

  const sizes = sizeClasses[variant];

  return (
    <div
      className={cn(
        "rounded-xl bg-card/30 backdrop-blur-sm border border-border/30",
        "transition-all duration-200 hover:bg-card/50 hover:border-border/50",
        sizes.container,
        className
      )}
    >
      {/* Header with icon and trend */}
      <div className="flex items-center justify-between mb-2">
        {icon && (
          <div className="text-muted-foreground">{icon}</div>
        )}
        {trend && (
          <div className={cn("flex items-center gap-1", trendColors[trend])}>
            <TrendIcon className="w-3 h-3" />
            {trendValue && <span className="text-xs">{trendValue}</span>}
          </div>
        )}
      </div>

      {/* Value */}
      <div className={cn("font-bold font-mono", sizes.value)}>
        {value}
      </div>

      {/* Label */}
      <div className={cn("text-muted-foreground", sizes.label)}>
        {label}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <div className="text-xs text-muted-foreground/70 mt-1">
          {subtitle}
        </div>
      )}
    </div>
  );
};
