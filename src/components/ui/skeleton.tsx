import * as React from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "circular" | "text" | "rectangular";
  animation?: "pulse" | "shimmer" | "none";
}

const Skeleton = React.memo(
  React.forwardRef<HTMLDivElement, SkeletonProps>(
    ({ className, variant = "default", animation = "pulse", ...props }, ref) => {
      const variantStyles = {
        default: "rounded-md",
        circular: "rounded-full",
        text: "rounded h-4 w-full",
        rectangular: "rounded-none",
      };

      const animationStyles = {
        pulse: "animate-pulse",
        shimmer:
          "relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
        none: "",
      };

      return (
        <div
          ref={ref}
          className={cn("bg-muted", variantStyles[variant], animationStyles[animation], className)}
          aria-hidden="true"
          {...props}
        />
      );
    },
  ),
);
Skeleton.displayName = "Skeleton";

// Skeleton text block
const SkeletonText = React.memo(
  ({ lines = 3, className }: { lines?: number; className?: string }) => (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={cn("h-4", i === lines - 1 && "w-3/4")}
        />
      ))}
    </div>
  ),
);
SkeletonText.displayName = "SkeletonText";

// Skeleton avatar
const SkeletonAvatar = React.memo(
  ({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) => {
    const sizeStyles = {
      sm: "h-8 w-8",
      md: "h-10 w-10",
      lg: "h-12 w-12",
    };
    return <Skeleton variant="circular" className={cn(sizeStyles[size], className)} />;
  },
);
SkeletonAvatar.displayName = "SkeletonAvatar";

export { Skeleton, SkeletonText, SkeletonAvatar };
