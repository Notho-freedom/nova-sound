import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.ComponentProps<"input"> {
  error?: boolean;
  icon?: React.ReactNode;
}

const Input = React.memo(
  React.forwardRef<HTMLInputElement, InputProps>(({ className, type, error, icon, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            {icon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background",
            "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
            "placeholder:text-muted-foreground",
            "transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "md:text-sm",
            icon && "pl-10",
            error && "border-destructive focus-visible:ring-destructive",
            className,
          )}
          ref={ref}
          aria-invalid={error}
          {...props}
        />
      </div>
    );
  }),
);
Input.displayName = "Input";

// Search input with built-in styling
const SearchInput = React.memo(
  React.forwardRef<HTMLInputElement, Omit<InputProps, "type">>(({ className, ...props }, ref) => (
    <Input
      ref={ref}
      type="search"
      className={cn(
        "bg-muted/50 border-transparent focus-visible:bg-background focus-visible:border-input",
        className,
      )}
      {...props}
    />
  )),
);
SearchInput.displayName = "SearchInput";

export { Input, SearchInput };
