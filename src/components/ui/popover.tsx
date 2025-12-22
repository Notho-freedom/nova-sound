import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverClose = PopoverPrimitive.Close;

interface PopoverContentProps extends React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> {
  variant?: "default" | "glass";
}

const PopoverContent = React.memo(
  React.forwardRef<React.ElementRef<typeof PopoverPrimitive.Content>, PopoverContentProps>(
    ({ className, align = "center", sideOffset = 4, variant = "default", ...props }, ref) => {
      const variantStyles = {
        default: "border bg-popover text-popover-foreground shadow-md",
        glass: "border border-white/10 bg-popover/80 backdrop-blur-xl text-popover-foreground shadow-xl",
      };

      return (
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            ref={ref}
            align={align}
            sideOffset={sideOffset}
            className={cn(
              "z-[9999] w-72 rounded-md p-4 outline-none",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
              "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
              variantStyles[variant],
              className,
            )}
            {...props}
          />
        </PopoverPrimitive.Portal>
      );
    },
  ),
);
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor, PopoverClose };
