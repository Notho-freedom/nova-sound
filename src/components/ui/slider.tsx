import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════════
// VISION PRO SLIDER
// Elegant slider with glass track and smooth thumb animation
// ═══════════════════════════════════════════════════════════════════════════════

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  variant?: "default" | "glass" | "minimal";
}

const Slider = React.memo(
  React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, SliderProps>(
    ({ className, variant = "default", ...props }, ref) => {
      const [isHovering, setIsHovering] = React.useState(false);

      return (
        <SliderPrimitive.Root
          ref={ref}
          className={cn(
            "relative flex w-full touch-none select-none items-center group",
            className
          )}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          {...props}
        >
          <SliderPrimitive.Track
            className={cn(
              "relative w-full grow overflow-hidden rounded-full",
              "transition-all duration-300 ease-out-expo",
              // Height animation on hover
              "h-1 group-hover:h-1.5",
              // Variant styles
              variant === "default" && "bg-white/[0.08]",
              variant === "glass" && "bg-white/[0.05] backdrop-blur-sm",
              variant === "minimal" && "bg-muted/30",
            )}
          >
            <SliderPrimitive.Range
              className={cn(
                "absolute h-full rounded-full",
                "transition-all duration-300 ease-out-expo",
                // Variant range styles
                variant === "default" && "bg-primary",
                variant === "glass" && "bg-gradient-to-r from-primary/90 to-primary",
                variant === "minimal" && "bg-primary/70",
              )}
            />
          </SliderPrimitive.Track>
          
          <SliderPrimitive.Thumb
            className={cn(
              "block rounded-full",
              "ring-offset-background",
              "transition-all duration-200 ease-out-expo",
              "focus:outline-none",
              "disabled:pointer-events-none disabled:opacity-40",
              // Size and visibility
              "h-3 w-3 group-hover:h-4 group-hover:w-4",
              "opacity-0 group-hover:opacity-100",
              isHovering && "opacity-100",
              // Styling
              "bg-white",
              "shadow-md shadow-black/20",
              // Hover and active states
              "hover:scale-110",
              "cursor-grab active:cursor-grabbing active:scale-95",
              // Glow effect for default variant
              variant === "default" && "hover:shadow-lg hover:shadow-primary/30",
            )}
          />
        </SliderPrimitive.Root>
      );
    },
  ),
);
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
