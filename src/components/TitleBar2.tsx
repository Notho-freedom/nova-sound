import { useState, useEffect } from "react";
import { Minus, Square, X, Music, Copy, Settings, Cloud, Bell, User, LogOut, Crown } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface TitleBar2Props {
  title?: string;
  onOpenSettings?: () => void;
  uploadProgress?: number; // 0-100 or undefined if not uploading
  hasNotifications?: boolean;
  onToggleNotifications?: () => void;
}

export const TitleBar2 = ({ 
  title = "NEXUS", 
  onOpenSettings,
  uploadProgress,
  hasNotifications = false,
  onToggleNotifications
}: TitleBar2Props) => {
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

  return (
    <div className="relative">
      {/* Upload Progress Bar */}
      {uploadProgress !== undefined && uploadProgress > 0 && uploadProgress < 100 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
          <div 
            className="h-full bg-gradient-to-r from-white/60 to-white/40 transition-all duration-200 ease-out"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      {/* TitleBar2 - Transparent, blends with hero */}
      <div 
        className={cn(
          "h-12 flex items-center justify-between px-6 select-none gap-2 transition-all duration-300",
          "bg-gradient-to-b from-black/40 via-black/20 to-transparent backdrop-blur-sm",
          "border-b border-white/10"
        )}
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* App Icon & Title */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
            <Music className="w-4 h-4 text-white" />
          </div>
          <span className="font-display text-sm tracking-wider text-white drop-shadow-lg">
            {title}
          </span>
          <span className="text-[10px] text-white/60 ml-1 drop-shadow">
            v1.0.0
            {!isElectron && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-white/20 text-white/80 text-[9px] backdrop-blur-sm">
                WEB
              </span>
            )}
          </span>
        </div>

        {/* Center - Upload Status (if uploading) */}
        {uploadProgress !== undefined && uploadProgress > 0 && uploadProgress < 100 && (
          <div 
            className="flex items-center gap-2 text-xs text-white/80 drop-shadow"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <Cloud className="w-3.5 h-3.5 text-white animate-pulse" />
            <span>Synchronisation... {uploadProgress}%</span>
          </div>
        )}

        {/* Right Side Controls */}
        <div 
          className="flex items-center gap-1"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {/* Notifications */}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleNotifications}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/20 transition-all duration-200 ease-out active:scale-95 group relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                <Bell className="w-4 h-4 text-white/90 group-hover:text-white group-hover:scale-105 transition-all duration-200 ease-out drop-shadow" />
                {hasNotifications && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-400 animate-pulse shadow-lg" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>Notifications</TooltipContent>
          </Tooltip>

          {/* User Avatar */}
          {nexusAuthenticated && nexusUser ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/20 transition-all duration-200 ease-out active:scale-95 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent">
                  <Avatar className="w-7 h-7 border border-white/30 group-hover:scale-105 transition-transform duration-200 ease-out ring-1 ring-white/20">
                    <AvatarImage src={nexusUser.photoURL || undefined} alt={nexusUser.displayName || ""} />
                    <AvatarFallback className="bg-white/20 text-white text-xs">
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
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{nexusUser.displayName || "Utilisateur"}</p>
                      <p className="text-xs text-muted-foreground truncate">{nexusUser.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {nexusIsPro ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/20 text-primary">
                        <Crown className="w-3 h-3" />
                        Pro
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
                        Gratuit
                      </span>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onOpenSettings} className="cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" />
                  Paramètres
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Se déconnecter
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={onOpenSettings}
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/20 transition-all duration-200 ease-out active:scale-95 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                >
                  <User className="w-4 h-4 text-white/90 group-hover:text-white group-hover:scale-105 transition-all duration-200 ease-out drop-shadow" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Se connecter</TooltipContent>
            </Tooltip>
          )}

          {/* Settings */}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={onOpenSettings}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/20 transition-all duration-200 ease-out active:scale-95 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                <Settings className="w-4 h-4 text-white/90 group-hover:text-white group-hover:rotate-45 group-hover:scale-105 transition-all duration-200 ease-out drop-shadow" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Paramètres</TooltipContent>
          </Tooltip>

          {/* Separator */}
          {isElectron && (
            <div className="w-px h-5 bg-white/20 mx-1" />
          )}

          {/* Window Controls - Only show in Electron */}
          {isElectron && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleMinimize}
                    className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/20 transition-all duration-200 ease-out active:scale-95 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                  >
                    <Minus className="w-4 h-4 text-white/90 group-hover:text-white group-hover:scale-105 transition-all duration-200 ease-out drop-shadow" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">Réduire</div>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleMaximize}
                    className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/20 transition-all duration-200 ease-out active:scale-95 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                  >
                    {isMaximized ? (
                      <Copy className="w-3.5 h-3.5 text-white/90 group-hover:text-white group-hover:scale-105 rotate-90 transition-all duration-200 ease-out drop-shadow" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-white/90 group-hover:text-white group-hover:scale-105 transition-all duration-200 ease-out drop-shadow" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">{isMaximized ? "Restaurer" : "Agrandir"}</div>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleClose}
                    className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-red-500/80 transition-all duration-200 ease-out active:scale-95 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                  >
                    <X className="w-4 h-4 text-white/90 group-hover:text-white group-hover:scale-105 transition-all duration-200 ease-out drop-shadow" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">Fermer</div>
                </TooltipContent>
              </Tooltip>
            </>
          )}

          {/* Web version indicator */}
          {!isElectron && (
            <div className="flex items-center gap-2 text-xs text-white/60 ml-2">
              <span className="hidden sm:inline">Lecteur Multimédia</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

