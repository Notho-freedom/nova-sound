import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════════
// VISION PRO TOOLTIP
// Minimal glass tooltip with elegant animations
// ═══════════════════════════════════════════════════════════════════════════════

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.memo(
  React.forwardRef<
    React.ElementRef<typeof TooltipPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
  >(({ className, sideOffset = 6, ...props }, ref) => {
    return (
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          ref={ref}
          sideOffset={sideOffset}
          className={cn(
            "z-[9999] overflow-hidden",
            // Glass styling
            "rounded-lg px-3 py-2",
            "bg-popover/95 backdrop-blur-xl",
            "border border-white/[0.1]",
            "text-sm text-popover-foreground",
            "shadow-lg shadow-black/20",
            // Animations
            "animate-in fade-in-0 zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "data-[side=bottom]:slide-in-from-top-2",
            "data-[side=left]:slide-in-from-right-2",
            "data-[side=right]:slide-in-from-left-2",
            "data-[side=top]:slide-in-from-bottom-2",
            className,
          )}
          {...props}
        />
      </TooltipPrimitive.Portal>
    );
  }),
);
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

// ═══════════════════════════════════════════════════════════════════════════════
// SIMPLE TOOLTIP WRAPPER
// Convenient wrapper for common tooltip use cases
// ═══════════════════════════════════════════════════════════════════════════════

interface SimpleTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  delayDuration?: number;
  className?: string;
}

const SimpleTooltip = React.memo(
  ({ content, children, side = "top", delayDuration = 400, className }: SimpleTooltipProps) => (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className={className}>
        {content}
      </TooltipContent>
    </Tooltip>
  ),
);
SimpleTooltip.displayName = "SimpleTooltip";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, SimpleTooltip };
