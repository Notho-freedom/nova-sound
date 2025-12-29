"use client"

import type React from "react"

import { memo, useEffect, useRef, useState } from "react"
import { Minus, Square, X, Copy, Settings, Cloud, Bell, User, LogOut, Crown, Sparkles, Search, UserCircle, Play, ArrowLeft, ArrowRight } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { useCloudSync } from "@/hooks/useCloudSync"
import { useYouTubeSearch } from "@/hooks/useYouTubeSearch"
import { getElectronAPI, isElectron } from "@/lib/electron-detector"
import { youtubeVideoToTrack } from "@/lib/youtube-to-track"
import { cn } from "@/lib/utils"
import type { Track } from "@/types/music"

interface TitleBarProps {
  title?: string
  onOpenSettings?: () => void
  uploadProgress?: number
  hasNotifications?: boolean
  onToggleNotifications?: () => void
  onSearch?: (query: string) => void
  searchQuery?: string
  onQuickPlayTrack?: (track: Track) => void
  onOpenSearchPage?: (query?: string) => void
  onOpenArtistView?: (artist?: string) => void
  canGoBack?: boolean
  canGoForward?: boolean
  onGoBack?: () => void
  onGoForward?: () => void
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
  onOpenSearchPage,
  onOpenArtistView,
  canGoBack = false,
  canGoForward = false,
  onGoBack,
  onGoForward,
}: TitleBarProps) => {
  const [isMaximized, setIsMaximized] = useState(false)
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSearchedRef = useRef<string>("")
  const electronEnv = isElectron()
  const electronAPI = getElectronAPI()
  const { nexusUser, nexusAuthenticated, nexusIsPro, nexusLogout } = useCloudSync()
  const { results: ytResults, search: searchYouTube, loading: ytLoading } = useYouTubeSearch()
  const [quickResults, setQuickResults] = useState<Track[]>([])

  // Sync local search with prop
  useEffect(() => {
    setLocalSearchQuery(searchQuery)
  }, [searchQuery])

  // Debounced YouTube search for overlay (avoid repeat on same query)
  useEffect(() => {
    const q = localSearchQuery.trim()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.length < 2) {
      setQuickResults([])
      return
    }
    const normalized = q.toLowerCase()
    if (normalized === lastSearchedRef.current && quickResults.length > 0) {
      return
    }
    debounceRef.current = setTimeout(() => {
      searchYouTube(q)
      lastSearchedRef.current = normalized
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [localSearchQuery, searchYouTube, quickResults.length])

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

  const handleLogout = async () => {
    await nexusLogout()
  }

  const handleMinimize = async () => {
    if (electronAPI) await electronAPI.minimize()
  }

  const handleMaximize = async () => {
    if (electronAPI) {
      await electronAPI.maximize()
      setIsMaximized(!isMaximized)
    }
  }

  const handleClose = async () => {
    if (electronAPI) await electronAPI.close()
  }

  const autoSuggestion = (() => {
    const q = localSearchQuery.trim().toLowerCase()
    if (!q) return ""
    const candidate = quickResults.find((t) => t.title?.toLowerCase().startsWith(q) || t.artist?.toLowerCase().startsWith(q))
    return candidate?.title || ""
  })()

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
                <img src="/icon.png" alt="NEXUS" className="w-7 h-7 object-contain" />
              </div>
              <div className="absolute inset-0 rounded-lg bg-primary/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <span className="font-display text-sm tracking-[0.2em] text-gradient font-bold">{title}</span>
                <span className="text-[10px] text-muted-foreground/60 font-mono">v1.0.0</span>
              </div>
              {!electronEnv && (
                <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-medium tracking-wide">
                  WEB
                </span>
              )}
            </div>
          </div>

          {/* Navigation buttons + Search bar together */}
          <div className="flex-0 w-1/3 flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            {/* Navigation buttons - VSCode style (next to search) */}
            <div className="flex items-center gap-0.5" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={onGoBack}
                  disabled={!canGoBack}
                  className={cn(
                    "w-7 h-7 rounded-md flex items-center justify-center transition-all duration-200",
                    canGoBack
                      ? "text-muted-foreground hover:text-foreground hover:bg-white/[0.06] active:bg-white/[0.08]"
                      : "text-muted-foreground/30 cursor-not-allowed"
                  )}
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Retour</TooltipContent>
            </Tooltip>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={onGoForward}
                  disabled={!canGoForward}
                  className={cn(
                    "w-7 h-7 rounded-md flex items-center justify-center transition-all duration-200",
                    canGoForward
                      ? "text-muted-foreground hover:text-foreground hover:bg-white/[0.06] active:bg-white/[0.08]"
                      : "text-muted-foreground/30 cursor-not-allowed"
                  )}
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Suivant</TooltipContent>
            </Tooltip>
          </div>

          {onSearch && (
            <div className="flex-1 flex items-center gap-0 relative" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
              <div
                className={cn(
                  "relative w-full flex items-center h-7 rounded-md transition-all duration-200",
                  "bg-white/[0.04] hover:bg-white/[0.06]",
                  isSearchFocused && "bg-white/[0.08] ring-1 ring-primary/30"
                )}
              >
                <Search className="w-3.5 h-3.5 text-muted-foreground/60 ml-2.5 flex-shrink-0" />
                <div className="relative flex-1 h-full">
                  {autoSuggestion && localSearchQuery && autoSuggestion.toLowerCase().startsWith(localSearchQuery.trim().toLowerCase()) && (
                    <div className="absolute inset-0 flex items-center px-2 pointer-events-none text-sm text-muted-foreground/35">
                      <span className="text-transparent select-none">{localSearchQuery}</span>
                      <span>{autoSuggestion.slice(localSearchQuery.length)}</span>
                    </div>
                  )}
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
                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 120)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && localSearchQuery.trim()) {
                        const term = localSearchQuery.trim()
                        addToSearchHistory(term)
                        onSearch(term)
                        if (quickResults[0]) onQuickPlayTrack?.(quickResults[0])
                      }
                      if (e.key === "Tab" && autoSuggestion) {
                        e.preventDefault()
                        setLocalSearchQuery(autoSuggestion)
                        onSearch(autoSuggestion)
                      }
                      if (e.key === "Escape") {
                        setLocalSearchQuery("")
                        onSearch("")
                        e.currentTarget.blur()
                      }
                    }}
                    className={cn(
                      "w-full h-full px-2 bg-transparent border-0 outline-none relative z-10",
                      "text-sm text-foreground placeholder:text-muted-foreground/40",
                      "focus:placeholder:text-muted-foreground/60"
                    )}
                  />
                </div>
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

              {isSearchFocused && localSearchQuery.trim().length >= 2 && (
                <div className="fixed left-0 right-0 top-11 mx-auto w-[calc(100%-160px)] max-w-xl rounded-lg border border-white/10 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden z-[9999]" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
                  <div className="flex items-center justify-between gap-2 px-3 py-2 text-[11px] text-muted-foreground/80 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <span>Résultats YouTube</span>
                      {ytLoading && <span className="animate-pulse">Chargement…</span>}
                    </div>
                    <button
                      className="text-[11px] px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 transition-all"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const term = localSearchQuery.trim()
                        if (term) {
                          addToSearchHistory(term)
                          onSearch(term)
                        }
                        onOpenSearchPage?.(term)
                      }}
                    >
                      Page recherche
                    </button>
                  </div>
                  {ytLoading && (
                    <div className="grid grid-cols-1 gap-1 px-3 py-2">
                      {Array.from({ length: 3 }).map((_, idx) => (
                        <div key={`sk-${idx}`} className="flex items-center gap-3 py-2">
                          <div className="w-10 h-10 rounded-md bg-white/5 animate-pulse" />
                          <div className="flex-1 space-y-1">
                            <div className="h-3 rounded bg-white/5 animate-pulse" />
                            <div className="h-3 w-1/2 rounded bg-white/5 animate-pulse" />
                          </div>
                          <div className="w-8 h-3 rounded bg-white/5 animate-pulse" />
                        </div>
                      ))}
                    </div>
                  )}
                  {quickResults.length === 0 && !ytLoading ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Aucun résultat</div>
                  ) : (
                    <ul className="divide-y divide-white/5 max-h-80 overflow-y-auto">
                      {quickResults.map((track) => (
                        <li key={`quick-${track.id}`} className="group relative">
                          <button
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors text-left"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              onQuickPlayTrack?.(track)
                              if (track.artist) {
                                onOpenArtistView?.(track.artist)
                              }
                              setIsSearchFocused(false)
                            }}
                          >
                            <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0 ring-1 ring-white/10">
                              <img src={track.coverUrl || "/placeholder.svg"} alt={track.title} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate text-foreground">{track.title}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {track.artist} • {track.album}
                              </p>
                            </div>
                            <span className="text-[11px] text-muted-foreground mr-2">
                              {track.duration ? Math.max(1, Math.round(track.duration / 60)) : 0}m
                            </span>
                          </button>
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              className="p-1.5 rounded-md bg-primary/10 hover:bg-primary/20 transition-all"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={(e) => {
                                e.stopPropagation()
                                onQuickPlayTrack?.(track)
                                setIsSearchFocused(false)
                              }}
                              title="Lire seulement"
                            >
                              <Play className="w-4 h-4 text-primary" />
                            </button>
                            <button
                              className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 transition-all"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (track.artist) {
                                  onOpenArtistView?.(track.artist)
                                  setIsSearchFocused(false)
                                }
                              }}
                              title="Voir l'artiste seulement"
                            >
                              <UserCircle className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          </div>

          <div className="flex items-center gap-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleNotifications}
                  className={cn(
                    "w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-300 group relative",
                    "hover:bg-white/[0.04] active:scale-95",
                    hasNotifications && "text-primary"
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
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-muted text-muted-foreground">Gratuit</span>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/[0.04]" />
                  <DropdownMenuItem onClick={onOpenSettings} className="cursor-pointer gap-2 py-2.5">
                    <Settings className="w-4 h-4" />
                    Paramètres
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/[0.04]" />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-400 focus:text-red-400 gap-2 py-2.5">
                    <LogOut className="w-4 h-4" />
                    Se déconnecter
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button onClick={onOpenSettings} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.04] transition-all duration-300 group">
                    <User className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Se connecter</TooltipContent>
              </Tooltip>
            )}

            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button onClick={onOpenSettings} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.04] transition-all duration-300 group">
                  <Settings className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:rotate-90 transition-all duration-500" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Paramètres</TooltipContent>
            </Tooltip>

            {electronEnv && <div className="w-px h-5 bg-white/[0.06] mx-1" />}

            {electronEnv && (
              <>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button onClick={handleMinimize} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.04] transition-all duration-300 group">
                      <Minus className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Réduire</TooltipContent>
                </Tooltip>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button onClick={handleMaximize} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.04] transition-all duration-300 group">
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
                    <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 transition-all duration-300 group">
                      <X className="w-4 h-4 text-muted-foreground group-hover:text-red-400 transition-colors" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Fermer</TooltipContent>
                </Tooltip>
              </>
            )}

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

export const TitleBar = memo(TitleBarComponent)
