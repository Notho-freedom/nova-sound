import { useState, useEffect } from "react";
import { Minus, Square, X, Music, Copy, Settings, Cloud, Bell } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TitleBarProps {
  title?: string;
  onOpenSettings?: () => void;
  uploadProgress?: number; // 0-100 or undefined if not uploading
  hasNotifications?: boolean;
}

export const TitleBar = ({ 
  title = "NEXUS", 
  onOpenSettings,
  uploadProgress,
  hasNotifications = false
}: TitleBarProps) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    setIsElectron(!!window.electronAPI);
  }, []);

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
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-muted/30">
          <div 
            className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      <div 
        className="h-10 flex items-center justify-between bg-card/80 backdrop-blur-sm border-b border-border/50 px-3 select-none"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* App Icon & Title */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center">
            <Music className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="font-display text-sm tracking-wider text-primary">
            {title}
          </span>
          <span className="text-[10px] text-muted-foreground ml-1">
            v1.0.0
            {!isElectron && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[9px]">
                WEB
              </span>
            )}
          </span>
        </div>

        {/* Center - Upload Status (if uploading) */}
        {uploadProgress !== undefined && uploadProgress > 0 && uploadProgress < 100 && (
          <div 
            className="flex items-center gap-2 text-xs text-muted-foreground"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <Cloud className="w-3.5 h-3.5 text-primary animate-pulse" />
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
                className="w-8 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors group relative"
              >
                <Bell className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                {hasNotifications && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>Notifications</TooltipContent>
          </Tooltip>

          {/* Settings */}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={onOpenSettings}
                className="w-8 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors group"
              >
                <Settings className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:rotate-45 transition-all duration-300" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Paramètres</TooltipContent>
          </Tooltip>

          {/* Separator */}
          {isElectron && (
            <div className="w-px h-4 bg-border mx-1" />
          )}

          {/* Window Controls - Only show in Electron */}
          {isElectron && (
            <>
              <button
                onClick={handleMinimize}
                className="w-8 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors group"
                title="Réduire"
              >
                <Minus className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
              </button>
              <button
                onClick={handleMaximize}
                className="w-8 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors group"
                title={isMaximized ? "Restaurer" : "Agrandir"}
              >
                {isMaximized ? (
                  <Copy className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground rotate-90" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
                )}
              </button>
              <button
                onClick={handleClose}
                className="w-8 h-7 flex items-center justify-center rounded hover:bg-destructive/80 transition-colors group"
                title="Fermer"
              >
                <X className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
              </button>
            </>
          )}

          {/* Web version indicator */}
          {!isElectron && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground ml-2">
              <span className="hidden sm:inline">Lecteur Multimédia</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
