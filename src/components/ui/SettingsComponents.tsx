"use client";

import { memo, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface SettingsSectionProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  badge?: string;
  accentColor?: string;
  children: ReactNode;
  className?: string;
}

export const SettingsSection = memo(({
  title,
  description,
  icon,
  badge,
  accentColor = "from-primary/20 to-secondary/10",
  children,
  className,
}: SettingsSectionProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={cn(
      "relative overflow-hidden rounded-2xl",
      "border border-border/30 bg-card/30 backdrop-blur-sm",
      "shadow-lg hover:shadow-xl transition-shadow duration-300",
      className
    )}
  >
    {/* Ambient glow */}
    <div
      className={cn(
        "absolute -top-20 -right-20 w-40 h-40 rounded-full bg-gradient-to-br opacity-20 blur-3xl pointer-events-none",
        accentColor
      )}
    />

    <div className="relative p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        {icon && (
          <div
            className={cn(
              "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg",
              accentColor
            )}
          >
            {icon}
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-semibold">{title}</h3>
            {badge && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/20 text-primary">
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-1 divide-y divide-border/30">
        {children}
      </div>
    </div>
  </motion.div>
));

SettingsSection.displayName = "SettingsSection";

interface SettingsRowProps {
  label: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const SettingsRow = memo(({
  label,
  description,
  icon,
  children,
  className,
}: SettingsRowProps) => (
  <div
    className={cn(
      "flex items-center justify-between py-4 group",
      "hover:bg-muted/20 -mx-4 px-4 rounded-lg transition-colors",
      className
    )}
  >
    <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
      {icon && (
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/10 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-1">
            {description}
          </p>
        )}
      </div>
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
));

SettingsRow.displayName = "SettingsRow";

interface SettingsGroupProps {
  children: ReactNode;
  className?: string;
}

export const SettingsGroup = memo(({ children, className }: SettingsGroupProps) => (
  <div className={cn("grid gap-6 md:grid-cols-2", className)}>
    {children}
  </div>
));

SettingsGroup.displayName = "SettingsGroup";

interface InfoCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export const InfoCard = memo(({
  title,
  value,
  subtitle,
  icon,
  trend,
  className,
}: InfoCardProps) => (
  <div
    className={cn(
      "relative p-4 rounded-xl",
      "bg-muted/30 border border-border/30",
      className
    )}
  >
    <div className="flex items-start justify-between mb-2">
      <p className="text-sm text-muted-foreground">{title}</p>
      {icon && (
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          {icon}
        </div>
      )}
    </div>
    <p className="text-2xl font-display font-bold">
      {typeof value === "number" ? value.toLocaleString() : value}
    </p>
    {subtitle && (
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    )}
    {trend && (
      <div
        className={cn(
          "absolute top-4 right-4 text-xs font-medium",
          trend === "up" && "text-emerald-500",
          trend === "down" && "text-red-500",
          trend === "neutral" && "text-muted-foreground"
        )}
      >
        {trend === "up" && "↑"}
        {trend === "down" && "↓"}
      </div>
    )}
  </div>
));

InfoCard.displayName = "InfoCard";

interface ActionCardProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action: ReactNode;
  variant?: "default" | "warning" | "success" | "danger";
  className?: string;
}

export const ActionCard = memo(({
  title,
  description,
  icon,
  action,
  variant = "default",
  className,
}: ActionCardProps) => {
  const variantClasses = {
    default: "bg-muted/30 border-border/30",
    warning: "bg-yellow-500/10 border-yellow-500/30",
    success: "bg-emerald-500/10 border-emerald-500/30",
    danger: "bg-red-500/10 border-red-500/30",
  };

  return (
    <div
      className={cn(
        "p-4 rounded-xl border",
        variantClasses[variant],
        className
      )}
    >
      <div className="flex items-start gap-3">
        {icon && (
          <div className="w-10 h-10 rounded-lg bg-background/50 flex items-center justify-center flex-shrink-0">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <div className="flex-shrink-0">{action}</div>
      </div>
    </div>
  );
});

ActionCard.displayName = "ActionCard";

interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
}

interface SettingsTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export const SettingsTabs = memo(({
  tabs,
  activeTab,
  onTabChange,
  className,
}: SettingsTabsProps) => (
  <div
    className={cn(
      "flex items-center gap-1 p-1 rounded-xl bg-muted/30 border border-border/30",
      className
    )}
  >
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => onTabChange(tab.id)}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
          activeTab === tab.id
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-background/50"
        )}
      >
        {tab.icon}
        <span>{tab.label}</span>
        {tab.badge !== undefined && (
          <span
            className={cn(
              "px-1.5 py-0.5 rounded-full text-[10px] font-medium",
              activeTab === tab.id
                ? "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            {tab.badge}
          </span>
        )}
      </button>
    ))}
  </div>
));

SettingsTabs.displayName = "SettingsTabs";
