"use client";

import { useState, useEffect } from "react";
import { Minus, Square, X, Settings, Bell, User, LogOut, Crown, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCloudSync } from "@/hooks/useCloudSync";

interface HeroControlsProps {
  /** Open settings callback */
  onOpenSettings?: () => void;
  /** Toggle notifications callback */
  onToggleNotifications?: () => void;
  /** Has unread notifications */
  hasNotifications?: boolean;
  /** Upload progress (0-100) */
  uploadProgress?: number;
  /** Show window controls (minimize, maximize, close) */
  showWindowControls?: boolean;
  /** Additional class names */
  className?: string;
  /** Style variant */
  variant?: "light" | "dark" | "glass";
}

/**
 * Hero controls component (TitleBar2 functionality)
 * Includes notifications, user menu, and window controls
 */
export const HeroControls = ({
  onOpenSettings,
  onToggleNotifications,
  hasNotifications = false,
  uploadProgress,
  showWindowControls = true,
  className,
  variant = "glass",
}: HeroControlsProps) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const { nexusUser, nexusAuthenticated, nexusIsPro, nexusLogout } = useCloudSync();

  useEffect(() => {
    setIsElectron(!!window.electronAPI);
  }, []);

  const handleLogout = async () => {
    await nexusLogout();
  };

  const handleMinimize = async () => {
    await window.electronAPI?.minimize();
  };

  const handleMaximize = async () => {
    await window.electronAPI?.maximize();
    setIsMaximized(!isMaximized);
  };

  const handleClose = async () => {
    await window.electronAPI?.close();
  };

  const buttonBaseClass = cn(
    "w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 ease-out active:scale-95",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    variant === "glass" && "hover:bg-white/20 focus-visible:ring-white/50 focus-visible:ring-offset-transparent",
    variant === "light" && "hover:bg-black/10 focus-visible:ring-black/50",
    variant === "dark" && "hover:bg-white/10 focus-visible:ring-white/50"
  );

  const iconClass = cn(
    "w-4 h-4 transition-all duration-200 ease-out group-hover:scale-105",
    variant === "glass" && "text-white/90 group-hover:text-white drop-shadow",
    variant === "light" && "text-foreground/80 group-hover:text-foreground",
    variant === "dark" && "text-white/80 group-hover:text-white"
  );

  return (
    <div 
      className={cn(
        "flex items-center gap-1 select-none",
        className
      )}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {/* Upload Progress Indicator */}
      {uploadProgress !== undefined && uploadProgress > 0 && uploadProgress < 100 && (
        <div className="flex items-center gap-2 mr-2 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm">
          <div className="w-16 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white/80 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <span className="text-xs text-white/80 font-medium">{Math.round(uploadProgress)}%</span>
        </div>
      )}

      {/* Notifications */}
      {onToggleNotifications && (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={onToggleNotifications}
              className={cn(buttonBaseClass, "group relative")}
              aria-label="Notifications"
            >
              <Bell className={iconClass} />
              {hasNotifications && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-400 animate-pulse shadow-lg" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>
      )}

      {/* User Avatar / Menu */}
      {nexusAuthenticated && nexusUser ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className={cn(buttonBaseClass, "group")}
              aria-label="User menu"
            >
              <Avatar className={cn(
                "w-7 h-7 border transition-transform duration-200 ease-out group-hover:scale-105",
                variant === "glass" ? "border-white/30 ring-1 ring-white/20" : "border-border"
              )}>
                <AvatarImage src={nexusUser.photoURL || undefined} alt={nexusUser.displayName || ""} />
                <AvatarFallback className={cn(
                  "text-xs",
                  variant === "glass" ? "bg-white/20 text-white" : "bg-primary/20 text-primary"
                )}>
                  {nexusUser.displayName?.charAt(0).toUpperCase() || <User className="w-3.5 h-3.5" />}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={nexusUser.photoURL || undefined} alt={nexusUser.displayName || ""} />
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {nexusUser.displayName?.charAt(0).toUpperCase() || <User className="w-4 h-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-medium truncate max-w-[160px]">{nexusUser.displayName}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[160px]">{nexusUser.email}</span>
                </div>
              </div>
              {nexusIsPro && (
                <div className="flex items-center gap-1 mt-1">
                  <Crown className="w-3 h-3 text-yellow-500" />
                  <span className="text-xs text-yellow-500 font-medium">Pro</span>
                </div>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {onOpenSettings && (
              <DropdownMenuItem onClick={onOpenSettings}>
                <Settings className="w-4 h-4 mr-2" />
                Paramètres
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button 
              className={cn(buttonBaseClass, "group")}
              onClick={onOpenSettings}
              aria-label="Compte"
            >
              <User className={iconClass} />
            </button>
          </TooltipTrigger>
          <TooltipContent>Compte</TooltipContent>
        </Tooltip>
      )}

      {/* Settings */}
      {onOpenSettings && (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={onOpenSettings}
              className={cn(buttonBaseClass, "group")}
              aria-label="Paramètres"
            >
              <Settings className={iconClass} />
            </button>
          </TooltipTrigger>
          <TooltipContent>Paramètres</TooltipContent>
        </Tooltip>
      )}

      {/* Window Controls (Electron only) */}
      {isElectron && showWindowControls && (
        <>
          <div className={cn(
            "w-px h-5 mx-1",
            variant === "glass" ? "bg-white/20" : "bg-border"
          )} />
          
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={handleMinimize}
                className={cn(buttonBaseClass, "group")}
                aria-label="Minimiser"
              >
                <Minus className={iconClass} />
              </button>
            </TooltipTrigger>
            <TooltipContent>Minimiser</TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={handleMaximize}
                className={cn(buttonBaseClass, "group")}
                aria-label={isMaximized ? "Restaurer" : "Agrandir"}
              >
                {isMaximized ? <Copy className={iconClass} /> : <Square className={cn(iconClass, "w-3.5 h-3.5")} />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{isMaximized ? "Restaurer" : "Agrandir"}</TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={handleClose}
                className={cn(
                  buttonBaseClass, 
                  "group hover:bg-red-500/80 hover:text-white"
                )}
                aria-label="Fermer"
              >
                <X className={cn(iconClass, "group-hover:text-white")} />
              </button>
            </TooltipTrigger>
            <TooltipContent>Fermer</TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  );
};
