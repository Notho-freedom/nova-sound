import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  variant?: "default" | "neon" | "gradient" | "striped";
  size?: "sm" | "default" | "lg";
  showValue?: boolean;
}

const Progress = React.memo(
  React.forwardRef<React.ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>(
    ({ className, value, variant = "default", size = "default", showValue = false, ...props }, ref) => {
      const sizeStyles = {
        sm: "h-1.5",
        default: "h-2.5",
        lg: "h-4",
      };

      const indicatorStyles = {
        default: "bg-primary",
        neon: "bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.5)]",
        gradient: "bg-gradient-to-r from-primary to-secondary",
        striped:
          "bg-primary bg-[length:1rem_1rem] bg-[linear-gradient(45deg,rgba(255,255,255,.15)25%,transparent_25%,transparent_50%,rgba(255,255,255,.15)50%,rgba(255,255,255,.15)75%,transparent_75%,transparent)] animate-[progress-stripe_1s_linear_infinite]",
      };

      return (
        <div className="relative w-full">
          <ProgressPrimitive.Root
            ref={ref}
            className={cn("relative w-full overflow-hidden rounded-full bg-secondary", sizeStyles[size], className)}
            {...props}
          >
            <ProgressPrimitive.Indicator
              className={cn(
                "h-full w-full flex-1 transition-all duration-300 ease-out rounded-full",
                indicatorStyles[variant],
              )}
              style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
            />
          </ProgressPrimitive.Root>
          {showValue && (
            <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[calc(100%+8px)] text-xs text-muted-foreground tabular-nums">
              {Math.round(value || 0)}%
            </span>
          )}
        </div>
      );
    },
  ),
);
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
