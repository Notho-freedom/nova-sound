import * as React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { buttonHoverVariants } from "@/hooks/useMicroAnimations";

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATED BUTTON
// Enhanced button with micro-animations and ripple effects
// ═══════════════════════════════════════════════════════════════════════════════

interface AnimatedButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: "default" | "glass" | "glow" | "ghost" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  ripple?: boolean;
  children: React.ReactNode;
}

const variantStyles = {
  default: [
    "bg-primary text-primary-foreground",
    "shadow-lg shadow-primary/25",
    "hover:shadow-xl hover:shadow-primary/35",
  ].join(" "),
  glass: [
    "bg-white/[0.08] backdrop-blur-xl",
    "border border-white/[0.12]",
    "text-foreground",
    "hover:bg-white/[0.12] hover:border-white/[0.18]",
  ].join(" "),
  glow: [
    "bg-primary/15 text-primary",
    "border border-primary/30",
    "hover:bg-primary/25 hover:border-primary/50",
  ].join(" "),
  ghost: [
    "hover:bg-secondary/50",
    "text-muted-foreground hover:text-foreground",
  ].join(" "),
  outline: [
    "border border-border bg-transparent",
    "hover:bg-secondary hover:border-border/80",
  ].join(" "),
};

const sizeStyles = {
  sm: "h-8 px-3 text-xs rounded-lg",
  md: "h-10 px-5 py-2 text-sm rounded-xl",
  lg: "h-12 px-8 text-base rounded-xl",
  icon: "h-10 w-10 rounded-xl",
};

export const AnimatedButton = React.forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  ({ className, variant = "default", size = "md", ripple = true, children, onClick, ...props }, ref) => {
    const [ripples, setRipples] = React.useState<Array<{ x: number; y: number; id: number }>>([]);

    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (ripple) {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const id = Date.now();
          
          setRipples((prev) => [...prev, { x, y, id }]);
          setTimeout(() => {
            setRipples((prev) => prev.filter((r) => r.id !== id));
          }, 600);
        }
        onClick?.(e);
      },
      [ripple, onClick]
    );

    return (
      <motion.button
        ref={ref}
        className={cn(
          "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium",
          "overflow-hidden",
          "transition-colors duration-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          "disabled:pointer-events-none disabled:opacity-40",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        onClick={handleClick}
        {...props}
      >
        {/* Ripple effects */}
        {ripples.map(({ x, y, id }) => (
          <span
            key={id}
            className="absolute rounded-full bg-white/30 pointer-events-none animate-[ripple-expand_0.6s_ease-out_forwards]"
            style={{
              left: x - 50,
              top: y - 50,
              width: 100,
              height: 100,
            }}
          />
        ))}
        
        {/* Button content */}
        <span className="relative z-10 flex items-center gap-2">{children}</span>
        
        {/* Glow overlay for glow variant */}
        {variant === "glow" && (
          <motion.span
            className="absolute inset-0 rounded-inherit opacity-0"
            whileHover={{ 
              opacity: 1,
              boxShadow: "0 0 30px hsl(var(--primary) / 0.4)",
            }}
            transition={{ duration: 0.3 }}
          />
        )}
      </motion.button>
    );
  }
);
AnimatedButton.displayName = "AnimatedButton";

// ═══════════════════════════════════════════════════════════════════════════════
// ICON BUTTON WITH ANIMATIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface AnimatedIconButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: "default" | "glass" | "ghost";
  size?: "sm" | "md" | "lg";
  rotateOnHover?: boolean;
  bounceOnHover?: boolean;
  children: React.ReactNode;
}

export const AnimatedIconButton = React.forwardRef<HTMLButtonElement, AnimatedIconButtonProps>(
  ({ 
    className, 
    variant = "ghost", 
    size = "md", 
    rotateOnHover = false,
    bounceOnHover = false,
    children, 
    ...props 
  }, ref) => {
    const iconSizes = {
      sm: "h-8 w-8 [&_svg]:size-4",
      md: "h-10 w-10 [&_svg]:size-5",
      lg: "h-12 w-12 [&_svg]:size-6",
    };

    return (
      <motion.button
        ref={ref}
        className={cn(
          "relative inline-flex items-center justify-center rounded-xl",
          "transition-colors duration-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          "disabled:pointer-events-none disabled:opacity-40",
          variantStyles[variant],
          iconSizes[size],
          className
        )}
        whileHover={{ 
          scale: 1.1,
          rotate: rotateOnHover ? 15 : 0,
        }}
        whileTap={{ 
          scale: 0.9,
          rotate: rotateOnHover ? -10 : 0,
        }}
        transition={{ 
          type: bounceOnHover ? "spring" : "tween",
          stiffness: 400,
          damping: 17,
          duration: 0.2,
        }}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);
AnimatedIconButton.displayName = "AnimatedIconButton";

export default AnimatedButton;
