"use client";

import { memo, ReactNode } from "react";
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
    transition={{ duration: 0.3 }}
    className={cn("min-h-full", className)}
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
}

export const PageHero = memo(({
  title,
  subtitle,
  description,
  imageUrl,
  gradient = "from-primary/30 to-secondary/20",
  badge,
  children,
  compact = false,
  className,
}: PageHeroProps) => (
  <div
    className={cn(
      "relative overflow-hidden rounded-2xl mb-8",
      compact ? "p-6" : "p-8 md:p-12",
      className
    )}
  >
    {/* Background */}
    {imageUrl ? (
      <>
        <div
          className="absolute inset-0 bg-cover bg-center scale-105"
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
    className={cn(
      "flex flex-col items-center justify-center py-16 text-center",
      className
    )}
  >
    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/10 flex items-center justify-center mb-4">
      {icon}
    </div>
    <h3 className="text-lg font-display font-semibold mb-2">{title}</h3>
    {description && (
      <p className="text-muted-foreground text-sm max-w-md mb-4">{description}</p>
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
}

export const GlassCard = memo(({
  children,
  hover = true,
  className,
  onClick,
}: GlassCardProps) => (
  <motion.div
    whileHover={hover ? { y: -2 } : undefined}
    onClick={onClick}
    className={cn(
      "relative overflow-hidden rounded-2xl",
      "bg-card/30 backdrop-blur-sm",
      "border border-border/30",
      hover && "cursor-pointer hover:bg-card/50 hover:border-primary/30",
      "transition-colors duration-300",
      className
    )}
  >
    {children}
  </motion.div>
));

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
  items: Array<{ label: string; value: string | number }>;
  className?: string;
}

export const StatsRow = memo(({ items, className }: StatsRowProps) => (
  <div className={cn("flex items-center gap-4 text-sm text-muted-foreground", className)}>
    {items.map((item, i) => (
      <span key={i} className="flex items-center gap-1">
        <span className="font-medium text-foreground">{item.value}</span>
        <span>{item.label}</span>
      </span>
    ))}
  </div>
));

StatsRow.displayName = "StatsRow";
