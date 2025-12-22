import * as React from "react";

import { cn } from "@/lib/utils";

const Card = React.memo(
  React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm transition-all duration-200",
        className,
      )}
      {...props}
    />
  )),
);
Card.displayName = "Card";

const CardHeader = React.memo(
  React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.memo(
  React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  )),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.memo(
  React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => (
      <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
    ),
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.memo(
  React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )),
);
CardContent.displayName = "CardContent";

const CardFooter = React.memo(
  React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  )),
);
CardFooter.displayName = "CardFooter";

// New interactive card variant
interface InteractiveCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  pressable?: boolean;
}

const InteractiveCard = React.memo(
  React.forwardRef<HTMLDivElement, InteractiveCardProps>(
    ({ className, hoverable = true, pressable = true, ...props }, ref) => (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border bg-card text-card-foreground shadow-sm transition-all duration-200",
          hoverable && "hover:shadow-lg hover:border-primary/20",
          pressable && "active:scale-[0.98] cursor-pointer",
          className,
        )}
        {...props}
      />
    ),
  ),
);
InteractiveCard.displayName = "InteractiveCard";

// Glass card variant
const GlassCard = React.memo(
  React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border border-white/10 bg-white/5 backdrop-blur-md text-foreground shadow-xl transition-all duration-200",
        className,
      )}
      {...props}
    />
  )),
);
GlassCard.displayName = "GlassCard";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, InteractiveCard, GlassCard };
