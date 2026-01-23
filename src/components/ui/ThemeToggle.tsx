"use client";

import { memo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Monitor, Palette, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme, type Theme, type ThemeDefinition } from "@/hooks/useTheme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ThemeToggleProps {
  variant?: "icon" | "full" | "minimal" | "compact";
  className?: string;
  showLabel?: boolean;
}

// Icon mapping for themes
const getThemeIcon = (themeId: string, className = "w-4 h-4") => {
  switch (themeId) {
    case "light":
      return <Sun className={className} />;
    case "dark":
      return <Moon className={className} />;
    case "system":
      return <Monitor className={className} />;
    default:
      return <Palette className={className} />;
  }
};

// Theme preview badge component
const ThemePreviewBadge = memo(({ theme, isActive }: { theme: ThemeDefinition; isActive: boolean }) => (
  <div className={cn(
    "w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center shrink-0",
    "shadow-sm transition-all duration-200",
    theme.accentColor,
    isActive && "ring-2 ring-primary ring-offset-2 ring-offset-background"
  )}>
    {getThemeIcon(theme.id, "w-4 h-4 text-white drop-shadow-sm")}
  </div>
));
ThemePreviewBadge.displayName = "ThemePreviewBadge";

// Quick toggle between light and dark with animation
const QuickThemeToggle = memo(({ className }: { className?: string }) => {
  const { resolvedTheme, toggleLightDark, isDark } = useTheme();
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={toggleLightDark}
          className={cn(
            "relative w-10 h-10 rounded-full flex items-center justify-center",
            "glass-button",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            className
          )}
          aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={isDark ? "dark" : "light"}
              initial={{ scale: 0, rotate: -90, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0, rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {isDark ? (
                <Moon className="w-5 h-5 text-foreground" />
              ) : (
                <Sun className="w-5 h-5 text-foreground" />
              )}
            </motion.div>
          </AnimatePresence>
          
          {/* Subtle glow on hover */}
          <motion.div 
            className={cn(
              "absolute inset-0 rounded-full pointer-events-none",
              isDark ? "bg-primary/10" : "bg-amber-400/15"
            )}
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="glass-subtle">
        {isDark ? "Mode clair" : "Mode sombre"}
      </TooltipContent>
    </Tooltip>
  );
});
QuickThemeToggle.displayName = "QuickThemeToggle";

// Full theme selector dropdown with all themes
const FullThemeToggle = memo(({ className, showLabel = false }: { className?: string; showLabel?: boolean }) => {
  const { theme, resolvedTheme, setTheme, baseThemes, musicThemes, isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  
  const currentTheme = [...baseThemes, ...musicThemes].find(t => t.id === theme);
  
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={showLabel ? "default" : "icon"}
          className={cn(
            "relative rounded-full gap-2",
            "glass-button",
            !showLabel && "w-10 h-10",
            className
          )}
          aria-label="Changer de thème"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={resolvedTheme}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2"
            >
              {getThemeIcon(resolvedTheme, "w-5 h-5")}
              {showLabel && currentTheme && (
                <span className="text-sm font-medium">{currentTheme.name}</span>
              )}
            </motion.div>
          </AnimatePresence>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className={cn(
          "w-64 p-2",
          "glass-panel",
          "border border-white/[0.08] dark:border-white/[0.08]"
        )}
      >
        <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground px-2 py-1.5">
          <Sun className="w-3.5 h-3.5" />
          Apparence
        </DropdownMenuLabel>
        
        {/* Base themes */}
        <div className="space-y-0.5">
          {baseThemes.map((t) => (
            <DropdownMenuItem
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer",
                "transition-all duration-200",
                theme === t.id && "bg-primary/10"
              )}
            >
              <ThemePreviewBadge theme={t} isActive={theme === t.id} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{t.name}</div>
                <div className="text-xs text-muted-foreground truncate">{t.description}</div>
              </div>
              {theme === t.id && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0"
                >
                  <Check className="w-3 h-3 text-primary-foreground" />
                </motion.div>
              )}
            </DropdownMenuItem>
          ))}
        </div>
        
        <DropdownMenuSeparator className="my-2 bg-border/50" />
        
        <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground px-2 py-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          Thèmes musicaux
        </DropdownMenuLabel>
        
        {/* Music themes */}
        <div className="space-y-0.5 max-h-[240px] overflow-y-auto scrollbar-thin pr-1">
          {musicThemes.map((t) => (
            <DropdownMenuItem
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer",
                "transition-all duration-200",
                theme === t.id && "bg-primary/10"
              )}
            >
              <ThemePreviewBadge theme={t} isActive={theme === t.id} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{t.name}</div>
                <div className="text-xs text-muted-foreground truncate">{t.description}</div>
              </div>
              {theme === t.id && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0"
                >
                  <Check className="w-3 h-3 text-primary-foreground" />
                </motion.div>
              )}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
FullThemeToggle.displayName = "FullThemeToggle";

// Minimal inline toggle (light/dark/system only)
const MinimalThemeToggle = memo(({ className }: { className?: string }) => {
  const { theme, setTheme, baseThemes } = useTheme();
  
  return (
    <div className={cn(
      "inline-flex items-center gap-1 p-1 rounded-full",
      "glass-subtle",
      className
    )}>
      {baseThemes.map((t) => (
        <Tooltip key={t.id}>
          <TooltipTrigger asChild>
            <button
              onClick={() => setTheme(t.id)}
              className={cn(
                "relative w-8 h-8 rounded-full flex items-center justify-center",
                "transition-all duration-200",
                theme === t.id 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
              )}
              aria-label={t.name}
            >
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                {getThemeIcon(t.id)}
              </motion.div>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="glass-subtle text-xs">
            {t.name}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
});
MinimalThemeToggle.displayName = "MinimalThemeToggle";

// Compact toggle for tight spaces (current theme icon only, opens full menu)
const CompactThemeToggle = memo(({ className }: { className?: string }) => {
  const { theme, resolvedTheme, setTheme, themes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            "glass-button text-sm",
            className
          )}
          aria-label="Thème"
        >
          {getThemeIcon(resolvedTheme, "w-4 h-4")}
        </button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="glass-panel p-1 w-40">
        {themes.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm cursor-pointer",
              theme === t.id && "bg-primary/10"
            )}
          >
            {getThemeIcon(t.id, "w-4 h-4")}
            <span>{t.name}</span>
            {theme === t.id && <Check className="w-3 h-3 ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
CompactThemeToggle.displayName = "CompactThemeToggle";

// Main export with variant selection
export const ThemeToggle = memo(({ variant = "icon", className, showLabel }: ThemeToggleProps) => {
  switch (variant) {
    case "full":
      return <FullThemeToggle className={className} showLabel={showLabel} />;
    case "minimal":
      return <MinimalThemeToggle className={className} />;
    case "compact":
      return <CompactThemeToggle className={className} />;
    case "icon":
    default:
      return <QuickThemeToggle className={className} />;
  }
});
ThemeToggle.displayName = "ThemeToggle";

// Export individual variants for direct use
export { QuickThemeToggle, FullThemeToggle, MinimalThemeToggle, CompactThemeToggle };
