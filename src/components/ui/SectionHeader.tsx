"use client";

import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  count?: number;
  subtitle?: string;
  className?: string;
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
    <div className={cn("flex items-center justify-between mb-4", className)}>
      <div className="flex items-center gap-2">
        {icon && (
          <div className="text-primary">{icon}</div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg tracking-wider uppercase">
              {title}
            </h2>
            {count !== undefined && count > 0 && (
              <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted/50">
                {count}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};
