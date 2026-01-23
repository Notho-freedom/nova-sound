import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════════
// VISION PRO TABS
// Glass pill tabs with smooth transitions
// ═══════════════════════════════════════════════════════════════════════════════

const Tabs = TabsPrimitive.Root;

const TabsList = React.memo(
  React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.List>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
  >(({ className, ...props }, ref) => (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1",
        "rounded-xl p-1",
        "bg-white/[0.05] backdrop-blur-sm",
        "border border-white/[0.08]",
        className,
      )}
      {...props}
    />
  )),
);
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.memo(
  React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
  >(({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap",
        "rounded-lg px-4 py-2 text-sm font-medium",
        "text-muted-foreground",
        "transition-all duration-200 ease-out-expo",
        // Active state
        "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
        "data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20",
        // Hover
        "hover:text-foreground",
        // Focus
        "focus:outline-none",
        "disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...props}
    />
  )),
);
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.memo(
  React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
  >(({ className, ...props }, ref) => (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        "mt-4",
        "focus:outline-none",
        "data-[state=active]:animate-fade-in-up",
        className,
      )}
      {...props}
    />
  )),
);
TabsContent.displayName = TabsPrimitive.Content.displayName;

// Underline tabs variant
const TabsListUnderline = React.memo(
  React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.List>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
  >(({ className, ...props }, ref) => (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "inline-flex items-center justify-start gap-6",
        "border-b border-white/[0.08]",
        className,
      )}
      {...props}
    />
  )),
);
TabsListUnderline.displayName = "TabsListUnderline";

const TabsTriggerUnderline = React.memo(
  React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
  >(({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "relative inline-flex items-center justify-center whitespace-nowrap",
        "pb-3 pt-2 text-sm font-medium",
        "text-muted-foreground",
        "transition-all duration-200",
        "data-[state=active]:text-foreground",
        // Underline animation
        "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5",
        "after:bg-primary after:scale-x-0 after:transition-transform after:duration-300 after:ease-out-expo",
        "data-[state=active]:after:scale-x-100",
        "focus:outline-none",
        "hover:text-foreground/80",
        className,
      )}
      {...props}
    />
  )),
);
TabsTriggerUnderline.displayName = "TabsTriggerUnderline";

export { Tabs, TabsList, TabsTrigger, TabsContent, TabsListUnderline, TabsTriggerUnderline };
