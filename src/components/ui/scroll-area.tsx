import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════════
// VISION PRO SCROLL AREA
// Minimal scrollbars with smooth fade and elegant styling
// Theme-aware colors that adapt to light/dark/custom themes
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
        "transition-all duration-300 ease-out",
        // Fade in/out on hover - Vision Pro style
        "opacity-0 hover:opacity-100 group-hover:opacity-100",
        "[&:has(+_*)]:opacity-100", // Show when scrolling
        orientation === "vertical" && [
          "h-full w-2 hover:w-2.5",
          "border-l border-l-transparent",
          "p-[2px]",
        ],
        orientation === "horizontal" && [
          "h-2 hover:h-2.5 flex-col",
          "border-t border-t-transparent",
          "p-[2px]",
        ],
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        className={cn(
          "relative flex-1 rounded-full",
          // Theme-aware glass thumb using semantic tokens
          "bg-muted-foreground/20 hover:bg-muted-foreground/40",
          // Subtle glow on hover
          "hover:shadow-[0_0_8px_hsl(var(--primary)/0.2)]",
          "transition-all duration-200",
        )}
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )),
);
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };
