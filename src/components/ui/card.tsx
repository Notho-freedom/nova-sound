import * as React from "react";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════════
// VISION PRO CARD COMPONENTS
// Spatial glass cards with depth, blur, and elegant animations
// ═══════════════════════════════════════════════════════════════════════════════

const Card = React.memo(
  React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl",
        "bg-card/80 backdrop-blur-xl",
        "border border-white/[0.08]",
        "text-card-foreground",
        "shadow-lg shadow-black/10",
        "transition-all duration-300 ease-out-expo",
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
    <h3 
      ref={ref} 
      className={cn(
        "text-xl font-semibold leading-none tracking-tight",
        "text-foreground",
        className
      )} 
      {...props} 
    />
  )),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.memo(
  React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => (
      <p ref={ref} className={cn("text-sm text-muted-foreground leading-relaxed", className)} {...props} />
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

// ═══════════════════════════════════════════════════════════════════════════════
// INTERACTIVE CARD
// Hoverable and pressable with spatial depth and micro-animations
// ═══════════════════════════════════════════════════════════════════════════════

interface InteractiveCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  pressable?: boolean;
  glowOnHover?: boolean;
}

const InteractiveCard = React.memo(
  React.forwardRef<HTMLDivElement, InteractiveCardProps>(
    ({ className, hoverable = true, pressable = true, glowOnHover = false, ...props }, ref) => (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl",
          "bg-card/80 backdrop-blur-xl",
          "border border-white/[0.08]",
          "text-card-foreground",
          "shadow-lg shadow-black/10",
          "transition-all duration-300 ease-out-expo",
          hoverable && [
            "hover:bg-card/90",
            "hover:border-white/[0.15]",
            "hover:shadow-xl hover:shadow-black/15",
            "hover:-translate-y-1",
          ],
          pressable && "active:scale-[0.98] cursor-pointer",
          glowOnHover && "hover-border-glow",
          className,
        )}
        {...props}
      />
    ),
  ),
);
InteractiveCard.displayName = "InteractiveCard";

// ═══════════════════════════════════════════════════════════════════════════════
// GLASS CARD
// Pure glassmorphism with maximum blur and transparency
// ═══════════════════════════════════════════════════════════════════════════════

const GlassCard = React.memo(
  React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl",
        "bg-white/[0.05] backdrop-blur-2xl",
        "border border-white/[0.1]",
        "text-foreground",
        "shadow-xl shadow-black/20",
        "transition-all duration-300 ease-out-expo",
        className,
      )}
      {...props}
    />
  )),
);
GlassCard.displayName = "GlassCard";

// ═══════════════════════════════════════════════════════════════════════════════
// FLOATING CARD
// Elevated card with strong shadow for modals/popovers
// ═══════════════════════════════════════════════════════════════════════════════

const FloatingCard = React.memo(
  React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-3xl",
        "bg-popover/95 backdrop-blur-3xl",
        "border border-white/[0.12]",
        "text-popover-foreground",
        "shadow-2xl shadow-black/30",
        "transition-all duration-300 ease-out-expo",
        className,
      )}
      {...props}
    />
  )),
);
FloatingCard.displayName = "FloatingCard";

// ═══════════════════════════════════════════════════════════════════════════════
// GLOW CARD
// Card with primary color glow effect
// ═══════════════════════════════════════════════════════════════════════════════

const GlowCard = React.memo(
  React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl",
        "bg-card/80 backdrop-blur-xl",
        "border border-primary/20",
        "text-card-foreground",
        "shadow-lg shadow-primary/10",
        "transition-all duration-300 ease-out-expo",
        "hover:border-primary/40",
        "hover:shadow-xl hover:shadow-primary/20",
        className,
      )}
      {...props}
    />
  )),
);
GlowCard.displayName = "GlowCard";

export { 
  Card, 
  CardHeader, 
  CardFooter, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  InteractiveCard, 
  GlassCard,
  FloatingCard,
  GlowCard,
};
