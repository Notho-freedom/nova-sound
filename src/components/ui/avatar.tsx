import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";

interface AvatarProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

const sizeStyles = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
};

const Avatar = React.memo(
  React.forwardRef<React.ElementRef<typeof AvatarPrimitive.Root>, AvatarProps>(
    ({ className, size = "md", ...props }, ref) => (
      <AvatarPrimitive.Root
        ref={ref}
        className={cn("relative flex shrink-0 overflow-hidden rounded-full", sizeStyles[size], className)}
        {...props}
      />
    ),
  ),
);
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.memo(
  React.forwardRef<
    React.ElementRef<typeof AvatarPrimitive.Image>,
    React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
  >(({ className, ...props }, ref) => (
    <AvatarPrimitive.Image
      ref={ref}
      className={cn("aspect-square h-full w-full object-cover", className)}
      loading="lazy"
      {...props}
    />
  )),
);
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.memo(
  React.forwardRef<
    React.ElementRef<typeof AvatarPrimitive.Fallback>,
    React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
  >(({ className, ...props }, ref) => (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-muted text-muted-foreground font-medium",
        className,
      )}
      {...props}
    />
  )),
);
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

// Avatar group for stacked avatars
interface AvatarGroupProps {
  children: React.ReactNode;
  max?: number;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const AvatarGroup = React.memo(({ children, max = 4, size = "md", className }: AvatarGroupProps) => {
  const childArray = React.Children.toArray(children);
  const visibleAvatars = childArray.slice(0, max);
  const remainingCount = childArray.length - max;

  return (
    <div className={cn("flex -space-x-2", className)}>
      {visibleAvatars.map((child, index) => (
        <div key={index} className="ring-2 ring-background rounded-full">
          {child}
        </div>
      ))}
      {remainingCount > 0 && (
        <Avatar size={size} className="ring-2 ring-background">
          <AvatarFallback className="bg-muted text-xs">+{remainingCount}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
});
AvatarGroup.displayName = "AvatarGroup";

export { Avatar, AvatarImage, AvatarFallback, AvatarGroup };
