import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  rightContent?: ReactNode;
  className?: string;
}

export const PageHeader = ({
  title,
  subtitle,
  rightContent,
  className,
}: PageHeaderProps) => {
  return (
    <div className={cn("sticky top-0 z-20 pb-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold mb-1">{title}</h1>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        </div>
        {rightContent}
      </div>
    </div>
  );
};

