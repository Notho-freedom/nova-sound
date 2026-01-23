import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base styles - Vision Pro aesthetic
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "text-sm font-medium",
    "rounded-xl",
    "transition-all duration-200 ease-out-expo",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    "active:scale-[0.97]",
  ].join(" "),
  {
    variants: {
      variant: {
        // Primary - Solid blue with glow
        default: [
          "bg-primary text-primary-foreground",
          "shadow-lg shadow-primary/25",
          "hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30",
        ].join(" "),
        
        // Destructive - Soft red
        destructive: [
          "bg-destructive text-destructive-foreground",
          "shadow-lg shadow-destructive/25",
          "hover:bg-destructive/90",
        ].join(" "),
        
        // Outline - Glass border
        outline: [
          "border border-border bg-transparent",
          "hover:bg-secondary hover:border-border/80",
        ].join(" "),
        
        // Secondary - Muted background
        secondary: [
          "bg-secondary text-secondary-foreground",
          "hover:bg-secondary/80",
        ].join(" "),
        
        // Ghost - No background, subtle hover
        ghost: [
          "hover:bg-secondary/50",
          "text-muted-foreground hover:text-foreground",
        ].join(" "),
        
        // Link - Text only with underline
        link: [
          "text-primary underline-offset-4",
          "hover:underline",
        ].join(" "),
        
        // Glass - Vision Pro signature style
        glass: [
          "bg-white/[0.08] backdrop-blur-xl",
          "border border-white/[0.12]",
          "text-foreground",
          "shadow-lg shadow-black/10",
          "hover:bg-white/[0.12] hover:border-white/[0.18]",
        ].join(" "),
        
        // Glow - Primary with animated glow
        glow: [
          "bg-primary/15 text-primary",
          "border border-primary/30",
          "hover:bg-primary/25 hover:border-primary/50",
          "hover:shadow-[0_0_30px_hsl(var(--primary)/0.3)]",
        ].join(" "),
        
        // Gradient - Smooth gradient background
        gradient: [
          "bg-gradient-to-r from-primary to-accent",
          "text-white",
          "shadow-lg shadow-primary/30",
          "hover:opacity-90 hover:shadow-xl",
        ].join(" "),
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-3 text-xs rounded-lg",
        lg: "h-12 px-8 text-base rounded-xl",
        xl: "h-14 px-10 text-base font-semibold rounded-2xl",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8 [&_svg]:size-3.5",
        "icon-lg": "h-12 w-12 [&_svg]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.memo(
  React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
      const Comp = asChild ? Slot : "button";
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          disabled={disabled || loading}
          aria-busy={loading}
          {...props}
        >
          {loading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              {children}
            </>
          ) : (
            children
          )}
        </Comp>
      );
    },
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
