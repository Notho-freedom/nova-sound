import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  size?: "sm" | "default" | "lg";
}

const sizeStyles = {
  sm: {
    root: "h-5 w-9",
    thumb: "h-4 w-4 data-[state=checked]:translate-x-4",
  },
  default: {
    root: "h-6 w-11",
    thumb: "h-5 w-5 data-[state=checked]:translate-x-5",
  },
  lg: {
    root: "h-7 w-14",
    thumb: "h-6 w-6 data-[state=checked]:translate-x-7",
  },
};

const Switch = React.memo(
  React.forwardRef<React.ElementRef<typeof SwitchPrimitives.Root>, SwitchProps>(
    ({ className, size = "default", ...props }, ref) => (
      <SwitchPrimitives.Root
        className={cn(
          "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-all duration-200",
          "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "hover:data-[state=unchecked]:bg-input/80",
          sizeStyles[size].root,
          className,
        )}
        {...props}
        ref={ref}
      >
        <SwitchPrimitives.Thumb
          className={cn(
            "pointer-events-none block rounded-full bg-background shadow-lg ring-0",
            "transition-transform duration-200 ease-out",
            "data-[state=unchecked]:translate-x-0",
            sizeStyles[size].thumb,
          )}
        />
      </SwitchPrimitives.Root>
    ),
  ),
);
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
