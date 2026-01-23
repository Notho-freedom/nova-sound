"use client";

import React, { memo, ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export const PageContainer = memo(({ children, className }: PageContainerProps) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    className={cn("h-full min-h-0 w-full overflow-x-hidden", className)}
  >
    {children}
  </motion.div>
));

PageContainer.displayName = "PageContainer";

interface PageHeroProps {
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  gradient?: string;
  badge?: string;
  children?: ReactNode;
  compact?: boolean;
  className?: string;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: ReactNode;
}

export const PageHero = memo(({
  title,
  subtitle,
  description,
  imageUrl,
  gradient = "from-primary/20 via-accent/10 to-secondary/15",
  badge,
  children,
  compact = false,
  className,
}: PageHeroProps) => (
  <div
    className={cn(
      "relative overflow-hidden rounded-3xl mb-8",
      "bg-gradient-to-br from-white/[0.03] to-white/[0.01]",
      "backdrop-blur-xl",
      "border border-white/[0.08]",
      "shadow-[0_8px_32px_rgba(0,0,0,0.3)]",
      compact ? "p-6" : "p-8 md:p-12",
      className
    )}
  >
    {/* Background */}
    {imageUrl ? (
      <>
        <div
          className="absolute inset-0 bg-cover bg-center scale-110 blur-sm"
          style={{ backgroundImage: `url(${imageUrl})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-transparent to-transparent" />
      </>
    ) : (
      <div className={cn("absolute inset-0 bg-gradient-to-br", gradient)} />
    )}

    {/* Glow effect */}
    <div
      className={cn(
        "absolute -bottom-20 -left-20 w-80 h-80 rounded-full blur-[100px] opacity-30",
        "bg-gradient-to-r from-primary to-secondary"
      )}
    />

    {/* Content */}
    <div className="relative z-10">
      {badge && (
        <motion.span
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary border border-primary/30 mb-3"
        >
          {badge}
        </motion.span>
      )}

      {subtitle && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-sm text-muted-foreground uppercase tracking-wider mb-1"
        >
          {subtitle}
        </motion.p>
      )}

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className={cn(
          "font-display font-bold tracking-tight",
          compact ? "text-2xl md:text-3xl" : "text-3xl md:text-4xl lg:text-5xl"
        )}
      >
        {title}
      </motion.h1>

      {description && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-muted-foreground mt-2 max-w-2xl"
        >
          {description}
        </motion.p>
      )}

      {children && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-6"
        >
          {children}
        </motion.div>
      )}
    </div>
  </div>
));

PageHero.displayName = "PageHero";

interface SectionContainerProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export const SectionContainer = memo(({
  children,
  delay = 0,
  className,
}: SectionContainerProps) => (
  <motion.section
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    className={className}
  >
    {children}
  </motion.section>
));

SectionContainer.displayName = "SectionContainer";

interface GridContainerProps {
  children: ReactNode;
  cols?: 2 | 3 | 4 | 5 | 6;
  gap?: number;
  className?: string;
}

export const GridContainer = memo(({
  children,
  cols = 4,
  gap = 4,
  className,
}: GridContainerProps) => {
  const colClasses = {
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
    5: "grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
    6: "grid-cols-2 md:grid-cols-4 lg:grid-cols-6",
  };

  return (
    <div className={cn("grid", colClasses[cols], `gap-${gap}`, className)}>
      {children}
    </div>
  );
});

GridContainer.displayName = "GridContainer";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export const EmptyState = memo(({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ type: "spring", stiffness: 300, damping: 25 }}
    className={cn(
      "flex flex-col items-center justify-center py-20 text-center",
      className
    )}
  >
    {/* Glowing icon container */}
    <div className="relative mb-6">
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/30 to-accent/20 blur-2xl scale-150" />
      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-xl border border-white/[0.1] flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        {icon}
      </div>
    </div>
    <h3 className="text-xl font-display font-semibold mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">{title}</h3>
    {description && (
      <p className="text-muted-foreground text-sm max-w-md mb-6 leading-relaxed">{description}</p>
    )}
    {action}
  </motion.div>
));

EmptyState.displayName = "EmptyState";

interface GlassCardProps {
  children: ReactNode;
  hover?: boolean;
  className?: string;
  onClick?: () => void;
  variant?: "default" | "elevated" | "floating";
}

export const GlassCard = memo(({
  children,
  hover = true,
  className,
  onClick,
  variant = "default",
}: GlassCardProps) => {
  const variantStyles = {
    default: "bg-white/[0.03] backdrop-blur-xl border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.2)]",
    elevated: "bg-white/[0.05] backdrop-blur-2xl border-white/[0.1] shadow-[0_8px_32px_rgba(0,0,0,0.3)]",
    floating: "bg-white/[0.07] backdrop-blur-3xl border-white/[0.12] shadow-[0_16px_48px_rgba(0,0,0,0.4)]",
  };

  return (
    <motion.div
      whileHover={hover ? { y: -4, scale: 1.01 } : undefined}
      whileTap={hover ? { scale: 0.98 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-2xl",
        variantStyles[variant],
        hover && "cursor-pointer",
        "transition-all duration-300",
        hover && "hover:bg-white/[0.06] hover:border-white/[0.15] hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)]",
        className
      )}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-transparent pointer-events-none" />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
});

GlassCard.displayName = "GlassCard";

interface ActionBarProps {
  children: ReactNode;
  className?: string;
}

export const ActionBar = memo(({ children, className }: ActionBarProps) => (
  <div
    className={cn(
      "flex items-center gap-3 flex-wrap",
      className
    )}
  >
    {children}
  </div>
));

ActionBar.displayName = "ActionBar";

interface StatsRowProps {
  items: Array<{ label: string; value: string | number; icon?: ReactNode }>;
  className?: string;
}

export const StatsRow = memo(({ items, className }: StatsRowProps) => (
  <div className={cn("flex items-center gap-6 text-sm text-muted-foreground", className)}>
    {items.map((item, i) => (
      <span key={i} className="flex items-center gap-2">
        {item.icon && <span className="text-primary/70">{item.icon}</span>}
        <span className="font-semibold text-foreground">{item.value}</span>
        <span className="opacity-70">{item.label}</span>
      </span>
    ))}
  </div>
));

StatsRow.displayName = "StatsRow";

/* ═══════════════════════════════════════════════════════════════════════════════
   VISION PRO SPATIAL COMPONENTS
   Advanced glassmorphism and spatial depth
   ═══════════════════════════════════════════════════════════════════════════════ */

interface SpatialPanelProps {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
  footer?: ReactNode;
}

export const SpatialPanel = memo(({
  children,
  className,
  header,
  footer,
}: SpatialPanelProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ type: "spring", stiffness: 300, damping: 30 }}
    className={cn(
      "relative overflow-hidden rounded-3xl",
      "bg-gradient-to-b from-white/[0.06] to-white/[0.02]",
      "backdrop-blur-2xl",
      "border border-white/[0.1]",
      "shadow-[0_8px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.1)]",
      className
    )}
  >
    {/* Top highlight */}
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    
    {header && (
      <div className="px-6 py-4 border-b border-white/[0.08]">
        {header}
      </div>
    )}
    
    <div className="relative">
      {children}
    </div>
    
    {footer && (
      <div className="px-6 py-4 border-t border-white/[0.08] bg-white/[0.02]">
        {footer}
      </div>
    )}
  </motion.div>
));

SpatialPanel.displayName = "SpatialPanel";

interface GlowingBadgeProps {
  children: ReactNode;
  variant?: "primary" | "success" | "warning" | "danger" | "info";
  className?: string;
}

export const GlowingBadge = memo(({
  children,
  variant = "primary",
  className,
}: GlowingBadgeProps) => {
  const variantStyles = {
    primary: "bg-primary/20 text-primary border-primary/30 shadow-[0_0_12px_rgba(59,130,246,0.3)]",
    success: "bg-green-500/20 text-green-400 border-green-500/30 shadow-[0_0_12px_rgba(34,197,94,0.3)]",
    warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 shadow-[0_0_12px_rgba(234,179,8,0.3)]",
    danger: "bg-red-500/20 text-red-400 border-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.3)]",
    info: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.3)]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
});

GlowingBadge.displayName = "GlowingBadge";

interface FloatingHeaderProps {
  children: ReactNode;
  className?: string;
}

export const FloatingHeader = memo(({
  children,
  className,
}: FloatingHeaderProps) => (
  <div
    className={cn(
      "sticky top-0 z-20",
      "bg-background/60 backdrop-blur-2xl",
      "border-b border-white/[0.05]",
      "shadow-[0_4px_16px_rgba(0,0,0,0.2)]",
      className
    )}
  >
    {children}
  </div>
));

FloatingHeader.displayName = "FloatingHeader";
