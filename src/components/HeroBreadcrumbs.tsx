import { Play, Minus, Square, X, Copy, Settings, Bell, User, LogOut, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import type { Track } from "@/types/music";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
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

interface HeroBreadcrumbsProps {
  className?: string;
  userName?: string;
  trackCount?: number;
  featuredTracks?: Track[];
  onTrackSelect?: (track: Track) => void;
  onOpenSettings?: () => void;
  uploadProgress?: number;
  hasNotifications?: boolean;
  onToggleNotifications?: () => void;
  showTitleBar2?: boolean; // Control visibility of TitleBar2 controls
}

export const HeroBreadcrumbs = ({ 
  className, 
  userName, 
  trackCount, 
  featuredTracks = [],
  onTrackSelect,
  onOpenSettings,
  uploadProgress,
  hasNotifications = false,
  onToggleNotifications,
  showTitleBar2 = true, // Show TitleBar2 controls by default
}: HeroBreadcrumbsProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bonjour";
    if (hour < 18) return "Bon après-midi";
    return "Bonsoir";
  };

  const currentTrack = featuredTracks[currentIndex];
  const backgroundImage = currentTrack?.coverUrl 
    ? getCoverUrl(currentTrack.coverUrl)
    : undefined;

  // Auto-play slider
  useEffect(() => {
    if (!isAutoPlaying || featuredTracks.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredTracks.length);
    }, 6000); // Change slide every 6 seconds

    return () => clearInterval(interval);
  }, [isAutoPlaying, featuredTracks.length]);


  if (featuredTracks.length === 0) {
    return null;
  }

  return (
    <div className={cn("relative w-full h-[60vh] min-h-[500px] max-h-[700px] overflow-hidden group", className)}>
      {/* Background Images - Slider */}
      <div className="absolute inset-0 w-full h-full">
        {featuredTracks.map((track, index) => {
          const coverUrl = track.coverUrl ? getCoverUrl(track.coverUrl) : undefined;
          if (!coverUrl) return null;
          
          return (
            <div
              key={track.id}
              className={cn(
                "absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out",
                index === currentIndex ? "opacity-100 z-0" : "opacity-0 z-[-1]"
              )}
              style={{
                backgroundImage: `url(${coverUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            />
          );
        })}
      </div>
      
      {/* Netflix-Style Perfect Gradient System - 7 couches pour un fondu invisible */}
      
      {/* Couche 1: Assombrissement supérieur pour la lisibilité du texte */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.75) 15%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0.4) 45%, rgba(0,0,0,0.2) 60%, transparent 75%)'
        }}
      />
      
      {/* Couche 2: Transition centrale douce */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, transparent 50%, rgba(0,0,0,0.15) 65%, rgba(0,0,0,0.35) 75%, rgba(0,0,0,0.6) 85%, rgba(0,0,0,0.85) 95%, rgba(0,0,0,0.95) 100%)'
        }}
      />
      
      {/* Couche 3: Transition principale vers le background - Ultra progressive */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-[70%] pointer-events-none"
        style={{
          background: `linear-gradient(to top, 
            hsl(var(--background)) 0%,
            hsl(var(--background) / 0.995) 8%,
            hsl(var(--background) / 0.985) 14%,
            hsl(var(--background) / 0.97) 20%,
            hsl(var(--background) / 0.945) 26%,
            hsl(var(--background) / 0.91) 32%,
            hsl(var(--background) / 0.865) 38%,
            hsl(var(--background) / 0.81) 44%,
            hsl(var(--background) / 0.745) 50%,
            hsl(var(--background) / 0.67) 56%,
            hsl(var(--background) / 0.585) 62%,
            hsl(var(--background) / 0.49) 68%,
            hsl(var(--background) / 0.39) 74%,
            hsl(var(--background) / 0.285) 80%,
            hsl(var(--background) / 0.18) 86%,
            hsl(var(--background) / 0.09) 92%,
            hsl(var(--background) / 0.03) 96%,
            transparent 100%
          )`
        }}
      />
      
      {/* Couche 4: Renforcement du bas - Garantit un fondu parfait */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-[45%] pointer-events-none"
        style={{
          background: `linear-gradient(to top, 
            hsl(var(--background)) 0%,
            hsl(var(--background) / 0.98) 12%,
            hsl(var(--background) / 0.93) 24%,
            hsl(var(--background) / 0.84) 36%,
            hsl(var(--background) / 0.71) 48%,
            hsl(var(--background) / 0.54) 60%,
            hsl(var(--background) / 0.35) 72%,
            hsl(var(--background) / 0.18) 84%,
            hsl(var(--background) / 0.05) 92%,
            transparent 100%
          )`
        }}
      />
      
      {/* Couche 5: Edge polish - Bord ultra lisse */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background: `linear-gradient(to top, 
            hsl(var(--background)) 0%,
            hsl(var(--background) / 0.95) 20%,
            hsl(var(--background) / 0.80) 40%,
            hsl(var(--background) / 0.55) 60%,
            hsl(var(--background) / 0.25) 80%,
            transparent 100%
          )`
        }}
      />
      
      {/* Couche 6: Final seamless blend - Le secret Netflix */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
        style={{
          background: `linear-gradient(to top, 
            hsl(var(--background)) 0%,
            hsl(var(--background) / 0.92) 25%,
            hsl(var(--background) / 0.65) 50%,
            hsl(var(--background) / 0.30) 75%,
            transparent 100%
          )`
        }}
      />
      
      {/* Couche 7: Micro-polish imperceptible mais crucial */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none"
        style={{
          background: `linear-gradient(to top, 
            hsl(var(--background)) 0%,
            hsl(var(--background) / 0.75) 33%,
            hsl(var(--background) / 0.40) 66%,
            transparent 100%
          )`
        }}
      />

      {/* TitleBar2 Controls - Fused with hero at the top right - Only visible when hero is visible */}
      {showTitleBar2 && (onOpenSettings !== undefined || onToggleNotifications !== undefined) && (
        <div 
          className="absolute top-4 right-8 md:top-6 md:right-12 z-30 flex items-center gap-1 select-none"
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
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-end p-6 md:p-12 pb-20 md:pb-24">
        {/* Hero Content - Bottom aligned like Netflix with perfect positioning */}
        <div className="flex items-end justify-between gap-8 pb-4">
          <div className="space-y-4 max-w-3xl flex-1">
            <h1 className="font-display text-5xl md:text-7xl font-bold text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] leading-tight animate-in fade-in slide-in-from-bottom-4 duration-700">
              {getGreeting()}{userName ? `, ${userName}` : ""}
            </h1>
            <p className="text-white/95 text-xl md:text-2xl font-medium drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
              {trackCount !== undefined && trackCount > 0
                ? `${trackCount} ${trackCount === 1 ? "piste disponible" : "pistes disponibles"} dans votre bibliothèque`
                : "Votre système audio futuriste personnel. Découvrez, écoutez et explorez votre musique comme jamais auparavant."
              }
            </p>
            {currentTrack && (
              <div className="pt-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
                <p className="text-white/80 text-sm md:text-base drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                  En vedette : <span className="font-semibold text-white">{currentTrack.title}</span> par {currentTrack.artist}
                </p>
              </div>
            )}
          </div>
          
          {/* Action Buttons - Right aligned */}
          {currentTrack && onTrackSelect && (
            <div className="flex-shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
              <Button
                onClick={() => onTrackSelect(currentTrack)}
                className="bg-white text-black hover:bg-white/90 font-semibold px-8 py-6 text-lg rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
              >
                <Play className="w-5 h-5 mr-2 fill-current" />
                Lire maintenant
              </Button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

