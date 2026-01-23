import * as React from "react";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════════
// VISION PRO INPUT COMPONENTS
// Glassmorphic inputs with subtle depth and elegant focus states
// ═══════════════════════════════════════════════════════════════════════════════

export interface InputProps extends React.ComponentProps<"input"> {
  error?: boolean;
  icon?: React.ReactNode;
}

const Input = React.memo(
  React.forwardRef<HTMLInputElement, InputProps>(({ className, type, error, icon, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            {icon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            // Base styles
            "flex h-11 w-full rounded-xl px-4 py-2",
            "text-sm text-foreground",
            "placeholder:text-muted-foreground/60",
            
            // Background & border - glass effect
            "bg-secondary/50 backdrop-blur-sm",
            "border border-white/[0.08]",
            
            // File inputs
            "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
            
            // Transitions
            "transition-all duration-200 ease-out-expo",
            
            // Focus states - Vision Pro blue glow
            "focus:outline-none",
            "focus:bg-secondary/70",
            "focus:border-primary/50",
            "focus:ring-2 focus:ring-primary/20",
            
            // Disabled state
            "disabled:cursor-not-allowed disabled:opacity-40",
            
            // Icon padding
            icon && "pl-11",
            
            // Error state
            error && "border-destructive/50 focus:border-destructive focus:ring-destructive/20",
            
            className,
          )}
          ref={ref}
          aria-invalid={error}
          {...props}
        />
      </div>
    );
  }),
);
Input.displayName = "Input";

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH INPUT
// Optimized for search with subtle glass background
// ═══════════════════════════════════════════════════════════════════════════════

const SearchInput = React.memo(
  React.forwardRef<HTMLInputElement, Omit<InputProps, "type">>(({ className, ...props }, ref) => (
    <Input
      ref={ref}
      type="search"
      className={cn(
        "bg-white/[0.05] border-transparent",
        "placeholder:text-muted-foreground/50",
        "focus:bg-white/[0.08] focus:border-white/[0.15]",
        // Hide native search cancel button for custom styling
        "[&::-webkit-search-cancel-button]:hidden",
        className,
      )}
      {...props}
    />
  )),
);
SearchInput.displayName = "SearchInput";

// ═══════════════════════════════════════════════════════════════════════════════
// GLASS INPUT
// Maximum glassmorphism for floating/modal contexts
// ═══════════════════════════════════════════════════════════════════════════════

const GlassInput = React.memo(
  React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
    <Input
      ref={ref}
      className={cn(
        "bg-white/[0.06] backdrop-blur-xl",
        "border-white/[0.1]",
        "focus:bg-white/[0.1] focus:border-white/[0.2]",
        className,
      )}
      {...props}
    />
  )),
);
GlassInput.displayName = "GlassInput";

export { Input, SearchInput, GlassInput };
