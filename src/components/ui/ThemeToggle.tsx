"use client";

import { memo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Monitor, Palette, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme, type Theme } from "@/hooks/useTheme";
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
  variant?: "icon" | "full" | "minimal";
  className?: string;
}

const themeIcons: Record<string, React.ReactNode> = {
  light: <Sun className="w-4 h-4" />,
  dark: <Moon className="w-4 h-4" />,
  system: <Monitor className="w-4 h-4" />,
  cyberpunk: <Palette className="w-4 h-4" />,
  minimal: <Palette className="w-4 h-4" />,
  spotify: <Palette className="w-4 h-4" />,
  "apple-music": <Palette className="w-4 h-4" />,
  "youtube-music": <Palette className="w-4 h-4" />,
  tidal: <Palette className="w-4 h-4" />,
  deezer: <Palette className="w-4 h-4" />,
};

const themeColors: Record<string, string> = {
  light: "from-amber-400 to-orange-500",
  dark: "from-indigo-500 to-purple-600",
  system: "from-gray-400 to-gray-600",
  cyberpunk: "from-yellow-400 via-pink-500 to-purple-600",
  minimal: "from-gray-700 to-gray-900",
  spotify: "from-green-500 to-green-700",
  "apple-music": "from-red-500 to-pink-600",
  "youtube-music": "from-red-600 to-red-800",
  tidal: "from-cyan-400 to-cyan-600",
  deezer: "from-cyan-400 via-pink-500 to-purple-500",
};

// Quick toggle between light and dark
const QuickThemeToggle = memo(({ className }: { className?: string }) => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  
  const toggleTheme = () => {
    if (resolvedTheme === "dark") {
      setTheme("light");
    } else {
      setTheme("dark");
    }
  };
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={toggleTheme}
          className={cn(
            "relative w-10 h-10 rounded-full flex items-center justify-center",
            "glass-button",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            className
          )}
          aria-label={resolvedTheme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={resolvedTheme}
              initial={{ scale: 0, rotate: -90, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0, rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {resolvedTheme === "dark" ? (
                <Moon className="w-5 h-5 text-foreground" />
              ) : (
                <Sun className="w-5 h-5 text-foreground" />
              )}
            </motion.div>
          </AnimatePresence>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {resolvedTheme === "dark" ? "Mode clair" : "Mode sombre"}
      </TooltipContent>
    </Tooltip>
  );
});
QuickThemeToggle.displayName = "QuickThemeToggle";

// Full theme selector dropdown
const FullThemeToggle = memo(({ className }: { className?: string }) => {
  const { theme, resolvedTheme, setTheme, themes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  
  // Group themes
  const basicThemes = themes.filter(t => ["light", "dark", "system"].includes(t.id));
  const specialThemes = themes.filter(t => !["light", "dark", "system"].includes(t.id));
  
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative w-10 h-10 rounded-full",
            "glass-button",
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
            >
              {themeIcons[resolvedTheme] || <Palette className="w-5 h-5" />}
            </motion.div>
          </AnimatePresence>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent
        align="end"
        className={cn(
          "w-56 p-2",
          "glass-panel",
          "border-white/[0.08]"
        )}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1.5">
          Apparence
        </DropdownMenuLabel>
        
        {/* Basic themes */}
        <div className="space-y-1">
          {basicThemes.map((t) => (
            <DropdownMenuItem
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                "transition-all duration-200",
                theme === t.id && "bg-primary/10"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center",
                themeColors[t.id]
              )}>
                {themeIcons[t.id]}
              </div>
              <span className="flex-1 font-medium text-sm">{t.name}</span>
              {theme === t.id && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                >
                  <Check className="w-3 h-3 text-primary-foreground" />
                </motion.div>
              )}
            </DropdownMenuItem>
          ))}
        </div>
        
        <DropdownMenuSeparator className="my-2 bg-white/[0.08]" />
        
        <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1.5">
          Thèmes musicaux
        </DropdownMenuLabel>
        
        {/* Special themes */}
        <div className="space-y-1 max-h-[200px] overflow-y-auto scrollbar-thin">
          {specialThemes.map((t) => (
            <DropdownMenuItem
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                "transition-all duration-200",
                theme === t.id && "bg-primary/10"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center",
                themeColors[t.id] || "from-primary to-accent"
              )}>
                {themeIcons[t.id]}
              </div>
              <span className="flex-1 font-medium text-sm">{t.name}</span>
              {theme === t.id && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-5 h-5 rounded-full bg-primary flex items-center justify-center"
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

// Minimal inline toggle (light/dark/system)
const MinimalThemeToggle = memo(({ className }: { className?: string }) => {
  const { theme, setTheme } = useTheme();
  
  const options: { id: Theme; icon: React.ReactNode }[] = [
    { id: "light", icon: <Sun className="w-4 h-4" /> },
    { id: "dark", icon: <Moon className="w-4 h-4" /> },
    { id: "system", icon: <Monitor className="w-4 h-4" /> },
  ];
  
  return (
    <div className={cn(
      "inline-flex items-center gap-1 p-1 rounded-full",
      "glass-subtle",
      className
    )}>
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => setTheme(opt.id)}
          className={cn(
            "relative w-8 h-8 rounded-full flex items-center justify-center",
            "transition-all duration-200",
            theme === opt.id 
              ? "bg-primary text-primary-foreground" 
              : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
          )}
          aria-label={opt.id}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
});
MinimalThemeToggle.displayName = "MinimalThemeToggle";

// Main export with variant selection
export const ThemeToggle = memo(({ variant = "icon", className }: ThemeToggleProps) => {
  switch (variant) {
    case "full":
      return <FullThemeToggle className={className} />;
    case "minimal":
      return <MinimalThemeToggle className={className} />;
    case "icon":
    default:
      return <QuickThemeToggle className={className} />;
  }
});
ThemeToggle.displayName = "ThemeToggle";

// Export individual variants for direct use
export { QuickThemeToggle, FullThemeToggle, MinimalThemeToggle };
