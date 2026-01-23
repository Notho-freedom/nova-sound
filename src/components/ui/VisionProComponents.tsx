"use client";

import { forwardRef, memo, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════════
// APPLE VISION PRO DESIGN SYSTEM - Core Components
// Spatial computing aesthetic with deep glassmorphism and fluid animations
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SpatialPanel - Floating glass container with depth
 * The fundamental container for Vision Pro UI
 */
interface SpatialPanelProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  variant?: "default" | "subtle" | "elevated" | "floating";
  glow?: boolean;
  noPadding?: boolean;
}

export const SpatialPanel = memo(forwardRef<HTMLDivElement, SpatialPanelProps>(
  ({ children, className, variant = "default", glow = false, noPadding = false, ...props }, ref) => {
    const variants = {
      default: "bg-white/[0.04] border-white/[0.08]",
      subtle: "bg-white/[0.02] border-white/[0.05]",
      elevated: "bg-white/[0.06] border-white/[0.12] shadow-xl shadow-black/20",
      floating: "bg-white/[0.08] border-white/[0.15] shadow-2xl shadow-black/30",
    };

    return (
      <motion.div
        ref={ref}
        className={cn(
          "relative rounded-2xl backdrop-blur-xl",
          "border transition-all duration-300",
          variants[variant],
          glow && "shadow-[0_0_40px_hsl(var(--primary)/0.15)]",
          !noPadding && "p-6",
          className
        )}
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        {...props}
      >
        {/* Inner highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-2xl" />
        {children}
      </motion.div>
    );
  }
));
SpatialPanel.displayName = "SpatialPanel";

/**
 * GlassButton - Primary interactive element
 */
interface GlassButtonProps extends HTMLMotionProps<"button"> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "glow";
  size?: "sm" | "md" | "lg" | "icon";
  active?: boolean;
}

export const GlassButton = memo(forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ children, className, variant = "primary", size = "md", active = false, ...props }, ref) => {
    const variants = {
      primary: cn(
        "bg-white text-black",
        "hover:bg-white/95 hover:shadow-lg hover:shadow-white/20",
        active && "shadow-lg shadow-white/30"
      ),
      secondary: cn(
        "bg-white/[0.08] text-foreground border border-white/[0.12]",
        "hover:bg-white/[0.12] hover:border-white/[0.18]",
        active && "bg-white/[0.15] border-white/[0.25]"
      ),
      ghost: cn(
        "text-muted-foreground",
        "hover:bg-white/[0.06] hover:text-foreground",
        active && "bg-white/[0.08] text-foreground"
      ),
      glow: cn(
        "bg-primary/15 text-primary border border-primary/30",
        "hover:bg-primary/25 hover:border-primary/50",
        "hover:shadow-[0_0_30px_hsl(var(--primary)/0.4)]",
        active && "bg-primary/30 shadow-[0_0_40px_hsl(var(--primary)/0.5)]"
      ),
    };

    const sizes = {
      sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
      md: "h-10 px-4 text-sm rounded-xl gap-2",
      lg: "h-12 px-6 text-base rounded-xl gap-2.5",
      icon: "w-10 h-10 rounded-full",
    };

    return (
      <motion.button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-medium",
          "transition-all duration-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
          "disabled:opacity-40 disabled:pointer-events-none",
          variants[variant],
          sizes[size],
          className
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.15 }}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
));
GlassButton.displayName = "GlassButton";

/**
 * FloatingHeader - Section headers with glass effect
 */
interface FloatingHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export const FloatingHeader = memo(({ title, subtitle, icon, action, className }: FloatingHeaderProps) => (
  <motion.div
    className={cn("flex items-center justify-between mb-6", className)}
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
  >
    <div className="flex items-center gap-3">
      {icon && (
        <div className="w-10 h-10 rounded-xl bg-white/[0.06] backdrop-blur-xl border border-white/[0.1] flex items-center justify-center text-primary">
          {icon}
        </div>
      )}
      <div>
        <h2 className="text-xl font-semibold text-foreground tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
    {action}
  </motion.div>
));
FloatingHeader.displayName = "FloatingHeader";

/**
 * GlowingBadge - Indicator with soft glow
 */
interface GlowingBadgeProps {
  children: ReactNode;
  variant?: "default" | "primary" | "success" | "warning" | "danger";
  size?: "sm" | "md";
  pulse?: boolean;
  className?: string;
}

export const GlowingBadge = memo(({ children, variant = "default", size = "md", pulse = false, className }: GlowingBadgeProps) => {
  const variants = {
    default: "bg-white/[0.1] text-foreground border-white/[0.15]",
    primary: "bg-primary/20 text-primary border-primary/30 shadow-[0_0_15px_hsl(var(--primary)/0.3)]",
    success: "bg-green/20 text-green border-green/30 shadow-[0_0_15px_hsl(var(--color-green)/0.3)]",
    warning: "bg-orange/20 text-orange border-orange/30 shadow-[0_0_15px_hsl(var(--color-orange)/0.3)]",
    danger: "bg-red/20 text-red border-red/30 shadow-[0_0_15px_hsl(var(--color-red)/0.3)]",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium border backdrop-blur-sm",
        variants[variant],
        sizes[size],
        pulse && "animate-pulse-soft",
        className
      )}
    >
      {children}
    </span>
  );
});
GlowingBadge.displayName = "GlowingBadge";

/**
 * SpatialDivider - Subtle visual separator
 */
export const SpatialDivider = memo(({ className }: { className?: string }) => (
  <div className={cn("relative h-px w-full my-6", className)}>
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
  </div>
));
SpatialDivider.displayName = "SpatialDivider";

/**
 * IconCircle - Circular icon container with glass effect
 */
interface IconCircleProps {
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "primary" | "accent";
  className?: string;
}

export const IconCircle = memo(({ children, size = "md", variant = "default", className }: IconCircleProps) => {
  const sizes = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-14 h-14",
  };

  const variants = {
    default: "bg-white/[0.06] border-white/[0.1] text-foreground",
    primary: "bg-primary/15 border-primary/30 text-primary shadow-[0_0_20px_hsl(var(--primary)/0.2)]",
    accent: "bg-accent/15 border-accent/30 text-accent shadow-[0_0_20px_hsl(var(--accent)/0.2)]",
  };

  return (
    <div
      className={cn(
        "rounded-full backdrop-blur-xl border flex items-center justify-center",
        sizes[size],
        variants[variant],
        className
      )}
    >
      {children}
    </div>
  );
});
IconCircle.displayName = "IconCircle";

/**
 * ContentGrid - Responsive grid with staggered animation
 */
interface ContentGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 5 | 6;
  gap?: "sm" | "md" | "lg";
  className?: string;
}

export const ContentGrid = memo(({ children, columns = 4, gap = "md", className }: ContentGridProps) => {
  const columnClasses = {
    2: "grid-cols-2",
    3: "grid-cols-2 md:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
    5: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
    6: "grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
  };

  const gapClasses = {
    sm: "gap-3",
    md: "gap-4",
    lg: "gap-6",
  };

  return (
    <motion.div
      className={cn("grid", columnClasses[columns], gapClasses[gap], className)}
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: 0.05,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
});
ContentGrid.displayName = "ContentGrid";

/**
 * GridItem - Animated grid child
 */
export const GridItem = memo(({ children, className }: { children: ReactNode; className?: string }) => (
  <motion.div
    className={className}
    variants={{
      hidden: { opacity: 0, y: 15, scale: 0.97 },
      visible: { opacity: 1, y: 0, scale: 1 },
    }}
    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
  >
    {children}
  </motion.div>
));
GridItem.displayName = "GridItem";

/**
 * AmbientGlow - Background glow effect
 */
interface AmbientGlowProps {
  color?: string;
  intensity?: "subtle" | "medium" | "strong";
  position?: "center" | "top" | "bottom";
  className?: string;
}

export const AmbientGlow = memo(({ 
  color = "var(--primary)", 
  intensity = "medium", 
  position = "center",
  className 
}: AmbientGlowProps) => {
  const intensities = {
    subtle: "0.08",
    medium: "0.15",
    strong: "0.25",
  };

  const positions = {
    center: "50% 50%",
    top: "50% 20%",
    bottom: "50% 80%",
  };

  return (
    <div
      className={cn("absolute inset-0 pointer-events-none", className)}
      style={{
        background: `radial-gradient(ellipse 80% 50% at ${positions[position]}, hsl(${color} / ${intensities[intensity]}) 0%, transparent 70%)`,
      }}
    />
  );
});
AmbientGlow.displayName = "AmbientGlow";

/**
 * DepthContainer - Container with depth effect on hover
 */
interface DepthContainerProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  depth?: "shallow" | "medium" | "deep";
}

export const DepthContainer = memo(forwardRef<HTMLDivElement, DepthContainerProps>(
  ({ children, className, depth = "medium", ...props }, ref) => {
    const depthValues = {
      shallow: { y: -2, shadow: "0 8px 20px" },
      medium: { y: -4, shadow: "0 12px 30px" },
      deep: { y: -6, shadow: "0 16px 40px" },
    };

    return (
      <motion.div
        ref={ref}
        className={cn("transition-shadow duration-300", className)}
        whileHover={{
          y: depthValues[depth].y,
          boxShadow: `${depthValues[depth].shadow} hsl(0 0% 0% / 0.25)`,
        }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
));
DepthContainer.displayName = "DepthContainer";

// Export all components
export const VisionPro = {
  Panel: SpatialPanel,
  Button: GlassButton,
  Header: FloatingHeader,
  Badge: GlowingBadge,
  Divider: SpatialDivider,
  Icon: IconCircle,
  Grid: ContentGrid,
  GridItem,
  Glow: AmbientGlow,
  Depth: DepthContainer,
};
