import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground border-border",
        // New variants
        success: "border-transparent bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
        warning: "border-transparent bg-amber-500/20 text-amber-400 border-amber-500/30",
        info: "border-transparent bg-blue-500/20 text-blue-400 border-blue-500/30",
        neon: "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20",
        glass: "border-white/10 bg-white/5 backdrop-blur-sm text-foreground hover:bg-white/10",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0 text-[10px]",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  icon?: React.ReactNode;
}

const Badge = React.memo(
  React.forwardRef<HTMLDivElement, BadgeProps>(({ className, variant, size, icon, children, ...props }, ref) => (
    <div ref={ref} className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {icon && <span className="mr-1 -ml-0.5">{icon}</span>}
      {children}
    </div>
  )),
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
