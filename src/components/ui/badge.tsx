import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════════
// VISION PRO BADGE
// Subtle glass badges with soft colors
// ═══════════════════════════════════════════════════════════════════════════════

const badgeVariants = cva(
  [
    "inline-flex items-center justify-center",
    "rounded-full border",
    "text-xs font-medium",
    "transition-all duration-200",
    "focus:outline-none",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/90 text-primary-foreground",
        secondary: "border-white/[0.08] bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive/90 text-destructive-foreground",
        outline: "border-border text-foreground bg-transparent",
        // Soft color variants
        success: "border-transparent bg-green/20 text-green",
        warning: "border-transparent bg-orange/20 text-orange",
        info: "border-transparent bg-blue/20 text-blue",
        // Glass variant
        glass: "border-white/[0.1] bg-white/[0.06] backdrop-blur-sm text-foreground",
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
