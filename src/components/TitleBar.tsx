"use client"

import type React from "react"

import { useState, useEffect, useRef, memo } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Minus, Square, X, Copy, Settings, Cloud, Bell, User, LogOut, Crown, Sparkles, Search } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCloudSync } from "@/hooks/useCloudSync"
import { isElectron, getElectronAPI } from "@/lib/electron-detector"
import { cn } from "@/lib/utils"
import type { Track } from "@/types/music"
import { useYouTubeSearch } from "@/hooks/useYouTubeSearch"
import { youtubeVideoToTrack } from "@/lib/youtube-to-track"

interface TitleBarProps {
  title?: string
  onOpenSettings?: () => void
  uploadProgress?: number
  hasNotifications?: boolean
  onToggleNotifications?: () => void
  onSearch?: (query: string) => void
  searchQuery?: string
  onQuickPlayTrack?: (track: Track) => void
}

const TitleBarComponent = ({
  title = "NEXUS",
  onOpenSettings,
  uploadProgress,
  hasNotifications = false,
  onToggleNotifications,
    searchQuery = "",
  onSearch,
  onQuickPlayTrack,
}: TitleBarProps) => {
  const [isMaximized, setIsMaximized] = useState(false)
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const electronEnv = isElectron()
  const electronAPI = getElectronAPI()
  const { nexusUser, nexusAuthenticated, nexusIsPro, nexusLogout } = useCloudSync()
  const { results: ytResults, search: searchYouTube, loading: ytLoading } = useYouTubeSearch()
  const [quickResults, setQuickResults] = useState<Track[]>([])
  
  // Sync local search with prop
    useEffect(() => {
      setLocalSearchQuery(searchQuery)
    }, [searchQuery])

  // Debounced YouTube search for overlay
  useEffect(() => {
    const q = localSearchQuery.trim()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.length < 2) {
      setQuickResults([])
      return
    }
    debounceRef.current = setTimeout(() => {
      searchYouTube(q)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [localSearchQuery, searchYouTube])

  // Convert YouTube results to tracks (limit 10)
  useEffect(() => {
    if (!ytResults || ytResults.length === 0) {
      setQuickResults([])
      return
    }
    const converted = ytResults
      .filter((r) => r.videoId && r.videoId !== "undefined")
      .map((r) => youtubeVideoToTrack(r))
      .slice(0, 10)
    setQuickResults(converted)
  }, [ytResults])

  // Inject into shared search history (same key as SearchView)
  const addToSearchHistory = (term: string) => {
    const cleaned = term.trim()
    if (!cleaned) return
    try {
      const raw = localStorage.getItem("nexus-search-history")
      const existing: string[] = raw ? JSON.parse(raw) : []
      const normalized = cleaned.toLowerCase()
      const deduped = [cleaned, ...existing.filter((h) => h.trim().toLowerCase() !== normalized)]
      const limited = deduped.slice(0, 8)
      localStorage.setItem("nexus-search-history", JSON.stringify(limited))
    } catch (e) {
      console.warn("Cannot persist search history", e)
    }
  }

  
  // NOTE: Logs supprimés pour améliorer les performances
  // Les logs causaient des re-renders inutiles lors de la navigation

  const handleLogout = async () => {
    await nexusLogout()
  }

  const handleMinimize = async () => {
    if (electronAPI) {
      await electronAPI.minimize()
    }
  }

  const handleMaximize = async () => {
    if (electronAPI) {
      await electronAPI.maximize()
      setIsMaximized(!isMaximized)
    }
  }

  const handleClose = async () => {
    if (electronAPI) {
      await electronAPI.close()
    }
  }

  return (
    <div className="relative z-50">
      {uploadProgress !== undefined && uploadProgress > 0 && uploadProgress < 100 && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-muted/20 overflow-hidden">
          <div className="h-full transition-all duration-300 ease-out relative" style={{ width: `${uploadProgress}%` }}>
            <div className="absolute inset-0 bg-gradient-to-r from-primary via-secondary to-primary animate-gradient-x" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-full bg-gradient-to-r from-transparent to-white/50 blur-sm" />
          </div>
        </div>
      )}

      <TooltipProvider>
        <div
          className="h-11 flex items-center justify-between bg-gradient-to-r from-card/90 via-card/80 to-card/90 backdrop-blur-xl border-b border-white/[0.04] px-3 select-none"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/20 flex items-center justify-center border border-primary/20 group-hover:border-primary/40 transition-all duration-300 overflow-hidden">
                <img 
                  src="/icon.png" 
                  alt="NEXUS" 
                  className="w-7 h-7 object-contain"
                />
              </div>
              <div className="absolute inset-0 rounded-lg bg-primary/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-display text-sm tracking-[0.2em] text-gradient font-bold">{title}</span>
              <span className="text-[10px] text-muted-foreground/60 font-mono">v1.0.0</span>
              {!electronEnv && (
                <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-medium tracking-wide">
                  WEB
                </span>
              )}
            </div>
          </div>

          {/* Search Bar - VS Code style */}
          {onSearch && (
            <div
              className="flex-1 max-w-xl mx-4 relative"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
              <div
                className={cn(
                  "relative flex items-center h-7 rounded-md transition-all duration-200",
                  "bg-white/[0.04] hover:bg-white/[0.06]",
                  isSearchFocused && "bg-white/[0.08] ring-1 ring-primary/30"
                )}
              >
                <Search className="w-3.5 h-3.5 text-muted-foreground/60 ml-2.5 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={localSearchQuery}
                  onChange={(e) => {
                    const next = e.target.value
                    setLocalSearchQuery(next)
                    onSearch(next)
                  }}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => {
                    // Delay to allow click on overlay
                    setTimeout(() => setIsSearchFocused(false), 120)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && localSearchQuery.trim()) {
                      const term = localSearchQuery.trim()
                      addToSearchHistory(term)
                      onSearch(term)
                      if (quickResults[0]) {
                        onQuickPlayTrack?.(quickResults[0])
                      }
                    }
                    if (e.key === "Escape") {
                      setLocalSearchQuery("")
                      onSearch("")
                      e.currentTarget.blur()
                    }
                  }}
                  className={cn(
                    "flex-1 h-full px-2 bg-transparent border-0 outline-none",
                    "text-sm text-foreground placeholder:text-muted-foreground/40",
                    "focus:placeholder:text-muted-foreground/60"
                  )}
                />
                {localSearchQuery && (
                  <button
                    onClick={() => {
                      setLocalSearchQuery("")
                      onSearch("")
                    }}
                    className="mr-1.5 p-0.5 rounded hover:bg-white/[0.08] transition-colors"
                  >
                    <X className="w-3 h-3 text-muted-foreground/60" />
                  </button>
                )}
              </div>

              {/* Quick results overlay */}
              {isSearchFocused && localSearchQuery.trim().length >= 2 && (
                <div className="absolute left-0 right-0 top-full mt-2 rounded-lg border border-white/10 bg-card/95 backdrop-blur-xl shadow-xl overflow-hidden z-[70]">
                  <div className="flex items-center justify-between px-3 py-2 text-[11px] text-muted-foreground/80 border-b border-white/5">
                    <span>Résultats YouTube</span>
                    {ytLoading && <span className="animate-pulse">Chargement…</span>}
                  </div>
                  {quickResults.length === 0 && !ytLoading ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Aucun résultat</div>
                  ) : (
                    <ul className="divide-y divide-white/5 max-h-80 overflow-y-auto">
                      {quickResults.map((track) => (
                        <li key={`quick-${track.id}`}>
                          <button
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 text-left transition-colors"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              const term = track.title || track.artist || localSearchQuery
                              setLocalSearchQuery(term || "")
                              addToSearchHistory(term || "")
                              onSearch(term || "")
                              onQuickPlayTrack?.(track)
                              setIsSearchFocused(false)
                            }}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate text-foreground">{track.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{track.artist} • {track.album}</p>
                            </div>
                            <span className="text-[11px] text-muted-foreground">{track.duration ? Math.max(1, Math.round(track.duration / 60)) : 0}m</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {uploadProgress !== undefined && uploadProgress > 0 && uploadProgress < 100 && (
            <div
              className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
              <Cloud className="w-3.5 h-3.5 text-primary animate-pulse" />
              <span className="text-xs text-muted-foreground">Sync</span>
              <span className="text-xs font-mono text-primary">{uploadProgress}%</span>
            </div>
          )}

          <div className="flex items-center gap-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            {/* Notifications */}
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleNotifications}
                  className={cn(
                    "w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-300 group relative",
                    "hover:bg-white/[0.04] active:scale-95",
                    hasNotifications && "text-primary",
                  )}
                >
                  <Bell className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  {hasNotifications && (
                    <>
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    </>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Notifications</TooltipContent>
            </Tooltip>

            {/* User Avatar */}
            {nexusAuthenticated && nexusUser ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.04] transition-all duration-300 group">
                    <Avatar className="w-6 h-6 border border-white/10 group-hover:border-primary/30 transition-all duration-300">
                      <AvatarImage src={nexusUser.photoURL || undefined} alt={nexusUser.displayName || ""} />
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-secondary/20 text-primary text-xs font-medium">
                        {nexusUser.displayName?.charAt(0).toUpperCase() || <User className="w-3.5 h-3.5" />}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60 glass-card-elevated">
                  <DropdownMenuLabel className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10 border border-white/10">
                        <AvatarImage src={nexusUser.photoURL || undefined} alt={nexusUser.displayName || ""} />
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-secondary/20 text-primary">
                          {nexusUser.displayName?.charAt(0).toUpperCase() || <User className="w-5 h-5" />}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{nexusUser.displayName || "Utilisateur"}</p>
                        <p className="text-xs text-muted-foreground truncate">{nexusUser.email}</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      {nexusIsPro ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-primary/20 to-secondary/20 text-primary border border-primary/20">
                          <Crown className="w-3 h-3" />
                          Pro
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-muted text-muted-foreground">
                          Gratuit
                        </span>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/[0.04]" />
                  <DropdownMenuItem onClick={onOpenSettings} className="cursor-pointer gap-2 py-2.5">
                    <Settings className="w-4 h-4" />
                    Paramètres
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/[0.04]" />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer text-red-400 focus:text-red-400 gap-2 py-2.5"
                  >
                    <LogOut className="w-4 h-4" />
                    Se déconnecter
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={onOpenSettings}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.04] transition-all duration-300 group"
                  >
                    <User className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Se connecter</TooltipContent>
              </Tooltip>
            )}

            {/* Settings */}
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={onOpenSettings}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.04] transition-all duration-300 group"
                >
                  <Settings className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:rotate-90 transition-all duration-500" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Paramètres</TooltipContent>
            </Tooltip>

            {/* Separator */}
            {electronEnv && <div className="w-px h-5 bg-white/[0.06] mx-1" />}

            {electronEnv && (
              <>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleMinimize}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.04] transition-all duration-300 group"
                    >
                      <Minus className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Réduire</TooltipContent>
                </Tooltip>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleMaximize}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.04] transition-all duration-300 group"
                    >
                      {isMaximized ? (
                        <Copy className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground rotate-90 transition-colors" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{isMaximized ? "Restaurer" : "Agrandir"}</TooltipContent>
                </Tooltip>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleClose}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 transition-all duration-300 group"
                    >
                      <X className="w-4 h-4 text-muted-foreground group-hover:text-red-400 transition-colors" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Fermer</TooltipContent>
                </Tooltip>
              </>
            )}

            {/* Web version indicator */}
            {!electronEnv && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground/60 ml-2">
                <Sparkles className="w-3 h-3" />
                <span className="hidden sm:inline">Audio Player</span>
              </div>
            )}
          </div>
        </div>
      </TooltipProvider>
    </div>
  )
}

// Mémoriser le composant pour éviter les re-renders inutiles lors de la navigation
export const TitleBar = memo(TitleBarComponent)
