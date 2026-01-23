import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════════
// VISION PRO SCROLL AREA
// Minimal scrollbars with smooth fade and elegant styling
// ═══════════════════════════════════════════════════════════════════════════════

interface ScrollAreaProps extends React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> {
  orientation?: "vertical" | "horizontal" | "both";
}

const ScrollArea = React.memo(
  React.forwardRef<React.ElementRef<typeof ScrollAreaPrimitive.Root>, ScrollAreaProps>(
    ({ className, children, orientation = "vertical", ...props }, ref) => (
      <ScrollAreaPrimitive.Root 
        ref={ref} 
        className={cn("relative overflow-hidden", className)} 
        {...props}
      >
        <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
          {children}
        </ScrollAreaPrimitive.Viewport>
        {(orientation === "vertical" || orientation === "both") && (
          <ScrollBar orientation="vertical" />
        )}
        {(orientation === "horizontal" || orientation === "both") && (
          <ScrollBar orientation="horizontal" />
        )}
        <ScrollAreaPrimitive.Corner />
      </ScrollAreaPrimitive.Root>
    ),
  ),
);
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.memo(
  React.forwardRef<
    React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
    React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
  >(({ className, orientation = "vertical", ...props }, ref) => (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      ref={ref}
      orientation={orientation}
      className={cn(
        "flex touch-none select-none",
        "transition-all duration-300 ease-out-expo",
        // Minimal styling - almost invisible until hover
        orientation === "vertical" && [
          "h-full w-1.5 hover:w-2",
          "border-l border-l-transparent",
          "p-[1px]",
        ],
        orientation === "horizontal" && [
          "h-1.5 hover:h-2 flex-col",
          "border-t border-t-transparent",
          "p-[1px]",
        ],
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        className={cn(
          "relative flex-1 rounded-full",
          // Glass-like thumb
          "bg-white/[0.15] hover:bg-white/[0.25]",
          "transition-colors duration-200",
        )}
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )),
);
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };
