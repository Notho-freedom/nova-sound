import * as React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { cardHoverVariants, motionPresets } from "@/hooks/useMicroAnimations";

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATED CARD
// Vision Pro glass card with sophisticated micro-animations
// ═══════════════════════════════════════════════════════════════════════════════

interface AnimatedCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  variant?: "default" | "glass" | "glow" | "floating";
  hoverEffect?: "lift" | "scale" | "glow" | "tilt" | "none";
  clickable?: boolean;
  staggerIndex?: number;
  children: React.ReactNode;
}

const variantStyles = {
  default: [
    "bg-card/80 backdrop-blur-xl",
    "border border-white/[0.08]",
    "shadow-lg shadow-black/10",
  ].join(" "),
  glass: [
    "bg-white/[0.05] backdrop-blur-2xl",
    "border border-white/[0.1]",
    "shadow-xl shadow-black/20",
  ].join(" "),
  glow: [
    "bg-card/80 backdrop-blur-xl",
    "border border-primary/20",
    "shadow-lg shadow-primary/10",
  ].join(" "),
  floating: [
    "bg-popover/95 backdrop-blur-3xl",
    "border border-white/[0.12]",
    "shadow-2xl shadow-black/30",
  ].join(" "),
};

const hoverVariants = {
  lift: {
    whileHover: { 
      y: -8, 
      scale: 1.02,
      boxShadow: "0 20px 60px hsl(0 0% 0% / 0.3)",
    },
    whileTap: { scale: 0.98 },
  },
  scale: {
    whileHover: { scale: 1.03 },
    whileTap: { scale: 0.97 },
  },
  glow: {
    whileHover: { 
      boxShadow: "0 0 40px hsl(var(--primary) / 0.3)",
      borderColor: "hsl(var(--primary) / 0.4)",
    },
  },
  tilt: {
    whileHover: { 
      rotateX: 5, 
      rotateY: 5,
      scale: 1.02,
    },
  },
  none: {},
};

export const AnimatedCard = React.forwardRef<HTMLDivElement, AnimatedCardProps>(
  ({ 
    className, 
    variant = "default", 
    hoverEffect = "lift",
    clickable = false,
    staggerIndex,
    children, 
    ...props 
  }, ref) => {
    const hoverProps = hoverVariants[hoverEffect];

    return (
      <motion.div
        ref={ref}
        className={cn(
          "rounded-2xl text-card-foreground",
          variantStyles[variant],
          clickable && "cursor-pointer",
          className
        )}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ 
          duration: 0.4, 
          ease: "easeOut",
          delay: staggerIndex ? staggerIndex * 0.05 : 0,
        }}
        style={{ perspective: 1000 }}
        {...hoverProps}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
AnimatedCard.displayName = "AnimatedCard";

// ═══════════════════════════════════════════════════════════════════════════════
// TILT CARD
// 3D perspective tilt on mouse movement
// ═══════════════════════════════════════════════════════════════════════════════

interface TiltCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  maxTilt?: number;
  glareEnabled?: boolean;
  children: React.ReactNode;
}

export const TiltCard = React.forwardRef<HTMLDivElement, TiltCardProps>(
  ({ className, maxTilt = 15, glareEnabled = true, children, ...props }, ref) => {
    const [tilt, setTilt] = React.useState({ x: 0, y: 0 });
    const [glarePosition, setGlarePosition] = React.useState({ x: 50, y: 50 });

    const handleMouseMove = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      
      setTilt({
        x: (0.5 - y) * maxTilt,
        y: (x - 0.5) * maxTilt,
      });
      setGlarePosition({ x: x * 100, y: y * 100 });
    }, [maxTilt]);

    const handleMouseLeave = React.useCallback(() => {
      setTilt({ x: 0, y: 0 });
    }, []);

    return (
      <motion.div
        ref={ref}
        className={cn(
          "relative rounded-2xl overflow-hidden",
          "bg-card/80 backdrop-blur-xl",
          "border border-white/[0.08]",
          "shadow-xl shadow-black/15",
          className
        )}
        style={{ 
          perspective: 1000,
          transformStyle: "preserve-3d",
        }}
        animate={{
          rotateX: tilt.x,
          rotateY: tilt.y,
        }}
        transition={{ 
          type: "spring", 
          stiffness: 300, 
          damping: 30,
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {children}
        
        {/* Glare overlay */}
        {glareEnabled && (
          <div
            className="absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background: `radial-gradient(circle at ${glarePosition.x}% ${glarePosition.y}%, hsl(0 0% 100% / 0.15) 0%, transparent 60%)`,
              opacity: Math.abs(tilt.x) + Math.abs(tilt.y) > 0 ? 0.5 : 0,
            }}
          />
        )}
      </motion.div>
    );
  }
);
TiltCard.displayName = "TiltCard";

// ═══════════════════════════════════════════════════════════════════════════════
// MAGNETIC CARD
// Card that subtly follows cursor
// ═══════════════════════════════════════════════════════════════════════════════

interface MagneticCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  strength?: number;
  children: React.ReactNode;
}

export const MagneticCard = React.forwardRef<HTMLDivElement, MagneticCardProps>(
  ({ className, strength = 0.1, children, ...props }, ref) => {
    const [position, setPosition] = React.useState({ x: 0, y: 0 });

    const handleMouseMove = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      setPosition({ x: x * strength, y: y * strength });
    }, [strength]);

    const handleMouseLeave = React.useCallback(() => {
      setPosition({ x: 0, y: 0 });
    }, []);

    return (
      <motion.div
        ref={ref}
        className={cn(
          "rounded-2xl",
          "bg-card/80 backdrop-blur-xl",
          "border border-white/[0.08]",
          "shadow-lg shadow-black/10",
          className
        )}
        animate={{ x: position.x, y: position.y }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
MagneticCard.displayName = "MagneticCard";

// ═══════════════════════════════════════════════════════════════════════════════
// STAGGER CONTAINER
// Container for staggered children animations
// ═══════════════════════════════════════════════════════════════════════════════

interface StaggerContainerProps extends Omit<HTMLMotionProps<"div">, "children"> {
  staggerDelay?: number;
  children: React.ReactNode;
}

export const StaggerContainer = React.forwardRef<HTMLDivElement, StaggerContainerProps>(
  ({ className, staggerDelay = 0.05, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        className={className}
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: {
            transition: {
              staggerChildren: staggerDelay,
              delayChildren: 0.1,
            },
          },
        }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
StaggerContainer.displayName = "StaggerContainer";

// ═══════════════════════════════════════════════════════════════════════════════
// STAGGER ITEM
// Child item for stagger container
// ═══════════════════════════════════════════════════════════════════════════════

interface StaggerItemProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: React.ReactNode;
}

export const StaggerItem = React.forwardRef<HTMLDivElement, StaggerItemProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        className={className}
        variants={{
          hidden: { opacity: 0, y: 20 },
          visible: { 
            opacity: 1, 
            y: 0,
            transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
          },
        }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
StaggerItem.displayName = "StaggerItem";

export default AnimatedCard;
