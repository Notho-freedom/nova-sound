import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  variant?: "default" | "neon" | "minimal";
  showTooltip?: boolean;
}

const Slider = React.memo(
  React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, SliderProps>(
    ({ className, variant = "neon", showTooltip = false, ...props }, ref) => {
      const [isHovering, setIsHovering] = React.useState(false);

      const trackStyles = {
        default: "bg-secondary",
        neon: "bg-muted",
        minimal: "bg-muted/50",
      };

      const rangeStyles = {
        default: "bg-primary",
        neon: "bg-gradient-to-r from-primary to-secondary",
        minimal: "bg-primary/80",
      };

      const thumbStyles = {
        default: "border-2 border-primary bg-background",
        neon: "border-2 border-primary bg-background shadow-[0_0_10px_hsl(var(--primary)/0.5)]",
        minimal: "border-2 border-primary/50 bg-background",
      };

      return (
        <SliderPrimitive.Root
          ref={ref}
          className={cn("relative flex w-full touch-none select-none items-center group", className)}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          {...props}
        >
          <SliderPrimitive.Track
            className={cn(
              "relative h-1.5 w-full grow overflow-hidden rounded-full transition-all duration-200",
              "group-hover:h-2",
              trackStyles[variant],
            )}
          >
            <SliderPrimitive.Range
              className={cn("absolute h-full rounded-full transition-all duration-200", rangeStyles[variant])}
            />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            className={cn(
              "block h-4 w-4 rounded-full ring-offset-background transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:pointer-events-none disabled:opacity-50",
              "hover:scale-110 cursor-grab active:cursor-grabbing active:scale-95",
              "opacity-0 group-hover:opacity-100",
              isHovering && "opacity-100",
              thumbStyles[variant],
            )}
          />
        </SliderPrimitive.Root>
      );
    },
  ),
);
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
