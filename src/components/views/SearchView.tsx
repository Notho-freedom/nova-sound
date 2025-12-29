"use client"

import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react"
import {
  Search,
  Play,
  X,
  Clock,
  TrendingUp,
  Disc3,
  User,
  Music,
  Loader2,
  Sparkles,
  History,
  ChevronRight,
  Pause,
  Mic,
  Radio,
} from "lucide-react"
import type { Track } from "@/types/music"
import { cn } from "@/lib/utils"
import { getCoverUrl } from "@/lib/audio"
import { Input } from "@/components/ui/input"
import { TooltipProvider } from "@/components/ui/tooltip"
import { TrackContextMenu } from "@/components/TrackContextMenu"
import { Skeleton } from "@/components/ui/skeleton"
import { SearchResultsSkeleton, SearchTrackItemSkeleton, ArtistCircleSkeleton, SearchAlbumCardSkeleton } from "@/components/ui/skeletons"
import { usePlaylists } from "@/hooks/usePlaylists"
import { useFavorites } from "@/hooks/useFavorites"
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload"
import { useBunnyUpload } from "@/hooks/useBunnyUpload"
import { useNexusUpload } from "@/hooks/useNexusUpload"
import { useUploadedStatus } from "@/hooks/useUploadedStatus"
import { useCloudSync } from "@/hooks/useCloudSync"
import { useYouTubeSearch } from "@/hooks/useYouTubeSearch"
import { usePlayHistory } from "@/hooks/usePlayHistory"
import { youtubeVideoToTrack } from "@/lib/youtube-to-track"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { ContentCarousel } from "@/components/ui/ContentCarousel"
import { FeaturedCard } from "@/components/ui/FeaturedCard"

interface SearchViewProps {
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onTrackSelect: (index: number) => void;
  onPlayTrack?: (track: Track) => void;
  onPlayNext?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  onAddToPlaylist?: (playlistId: string, track: Track) => void;
  loading?: boolean;
  initialQuery?: string;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

const MAX_HISTORY = 8
const HISTORY_AUTOSAVE_DELAY = 5000 // 5s d'inactivité avant auto-validation

// Browse category card - Enhanced
const CategoryCard = memo(({
  name,
  color,
  icon,
  onClick,
}: {
  name: string
  color: string
  icon?: React.ReactNode
  onClick?: () => void
}) => (
  <motion.button
    whileHover={{ scale: 1.03, y: -2 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={cn(
      "group relative h-28 rounded-2xl overflow-hidden",
      "transition-all duration-300 ease-out",
      "hover:shadow-xl hover:shadow-primary/10",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
    )}
  >
    <div className={cn("absolute inset-0", color)} />
    <div
      className="absolute inset-0 opacity-30"
      style={{
        backgroundImage: `radial-gradient(circle at 80% 20%, white 0%, transparent 50%)`,
      }}
    />
    {/* Icon */}
    {icon && (
      <div className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity">
        {icon}
      </div>
    )}
    <div className="relative h-full flex items-end p-4">
      <h3 className="font-display font-bold text-white text-lg drop-shadow-lg">{name}</h3>
    </div>
  </motion.button>
))

CategoryCard.displayName = "CategoryCard"

// Search result track item - Enhanced
const SearchTrackItem = memo(({
  track,
  isPlaying,
  isCurrent,
  onPlay,
  isYouTube = false,
}: {
  track: Track
  isPlaying: boolean
  isCurrent: boolean
  onPlay: () => void
  isYouTube?: boolean
}) => (
  <div
    onClick={onPlay}
    className={cn(
      "group flex items-center gap-4 p-3 rounded-xl cursor-pointer",
      "transition-all duration-300 ease-out",
      "hover:bg-white/10",
      isCurrent && "bg-primary/10",
    )}
  >
    {/* Album art */}
    <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-white/10 group-hover:ring-primary/30 transition-all">
      <img
        src={getCoverUrl(track.coverUrl) || "/placeholder.svg"}
        alt={track.album || track.title}
        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
      />
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center bg-black/50",
          "opacity-0 group-hover:opacity-100 transition-opacity duration-300",
        )}
      >
        {isCurrent && isPlaying ? (
          <Pause className="w-5 h-5 text-white fill-current" />
        ) : (
          <Play className="w-5 h-5 text-white fill-current" />
        )}
      </div>
      {/* YouTube badge */}
      {isYouTube && (
        <div className="absolute top-1 right-1 px-1 py-0.5 bg-red-600 rounded text-[8px] font-bold text-white">YT</div>
      )}
      {/* Now playing indicator */}
      {isCurrent && isPlaying && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-end gap-0.5 h-3">
          <div className="w-0.5 bg-primary rounded-full animate-wave" style={{ height: "100%" }} />
          <div
            className="w-0.5 bg-primary rounded-full animate-wave"
            style={{ animationDelay: "0.1s", height: "70%" }}
          />
          <div
            className="w-0.5 bg-primary rounded-full animate-wave"
            style={{ animationDelay: "0.2s", height: "85%" }}
          />
        </div>
      )}
    </div>

    {/* Info */}
    <div className="flex-1 min-w-0">
      <p className={cn("text-sm font-medium truncate", isCurrent ? "text-primary" : "text-foreground")}>
        {track.title}
      </p>
      <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
    </div>

    {/* Duration */}
    <span className="text-xs text-muted-foreground font-mono">{formatTime(track.duration)}</span>

    {/* Play button */}
    <div
      className={cn(
        "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
        "bg-primary shadow-lg shadow-primary/20",
        "opacity-0 group-hover:opacity-100",
        "scale-75 group-hover:scale-100",
        "transition-all duration-300",
      )}
    >
      {isCurrent && isPlaying ? (
        <Pause className="w-4 h-4 text-primary-foreground fill-current" />
      ) : (
        <Play className="w-4 h-4 text-primary-foreground fill-current ml-0.5" />
      )}
    </div>
  </div>
))

SearchTrackItem.displayName = "SearchTrackItem"

// History item chip - Enhanced
const HistoryChip = memo(({
  term,
  onSelect,
  onRemove,
}: {
  term: string
  onSelect: () => void
  onRemove: () => void
}) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    className={cn(
      "group flex items-center gap-2 px-4 py-2 rounded-full",
      "bg-muted/50 hover:bg-muted border border-border/50 hover:border-primary/30",
      "transition-all duration-300 cursor-pointer",
    )}
  >
    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
    <span onClick={onSelect} className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
      {term}
    </span>
    <button
      onClick={(e) => {
        e.stopPropagation()
        onRemove()
      }}
      className="opacity-0 group-hover:opacity-100 p-0.5 rounded-full hover:bg-background/50 transition-all"
      title="Supprimer de l'historique"
    >
      <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
    </button>
  </motion.div>
))

HistoryChip.displayName = "HistoryChip"

export const SearchView = ({
  tracks,
  currentTrackIndex,
  isPlaying,
  onTrackSelect,
  onPlayTrack,
  onPlayNext,
  onAddToQueue,
  onAddToPlaylist,
  loading = false,
  initialQuery = "",
}: SearchViewProps) => {
  const [query, setQuery] = useState(initialQuery)
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [youtubeTracks, setYoutubeTracks] = useState<Track[]>([])
  const [isFocused, setIsFocused] = useState(false)
  const youtubeSearchTimerRef = useRef<NodeJS.Timeout | null>(null)
  const historySaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const latestTypedQueryRef = useRef("")
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Hooks for context menu
  const playlistsResult = usePlaylists()
  const playlists = playlistsResult?.playlists ?? []
  const createPlaylist = playlistsResult?.createPlaylist ?? (async () => null)
  const { isFavorite, toggleFavorite } = useFavorites()
  const { uploadTrack, getTrackProgress } = useCloudinaryUpload()
  const { uploadTrack: uploadTrackToBunny, getTrackProgress: getBunnyTrackProgress } = useBunnyUpload()
  const { uploadTrack: uploadTrackToNexus, getTrackProgress: getNexusTrackProgress } = useNexusUpload()
  const { cloudinaryConfigured, nexusIsPro, nexusAuthenticated } = useCloudSync()
  const { isUploaded, getUploadedProvider } = useUploadedStatus()
  const canUploadToCloudinary = cloudinaryConfigured && !nexusIsPro
  const canUploadToBunny = nexusIsPro && nexusAuthenticated
  const canUploadToNexus = nexusIsPro && nexusAuthenticated

  // Play history hook
  const { history } = usePlayHistory()

  // YouTube search hook
  const {
    results: youtubeResults,
    loading: youtubeLoading,
    search: searchYouTube,
    error: youtubeError,
  } = useYouTubeSearch()

  // Load search history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("nexus-search-history")
    if (saved) {
      try {
        const parsed: string[] = JSON.parse(saved)
        // Deduplicate on load with normalization
        const seen = new Set<string>()
        const cleaned = parsed.filter((term) => {
          const key = term.trim().toLowerCase()
          if (!key || seen.has(key)) return false
          seen.add(key)
          return true
        })
        setSearchHistory(cleaned)
      } catch {
        setSearchHistory([])
      }
    }
  }, [])

  // Sync with external initialQuery (e.g., from TitleBar quick search)
  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (historySaveTimerRef.current) {
        clearTimeout(historySaveTimerRef.current)
      }
    }
  }, [])

  // Save search history
  // Similarity ratio (0..1) using Levenshtein distance
  const similarityRatio = (a: string, b: string): number => {
    const s = a.trim().toLowerCase()
    const t = b.trim().toLowerCase()
    if (!s && !t) return 1
    if (!s || !t) return 0
    const m = s.length
    const n = t.length
    const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1))
    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s[i - 1] === t[j - 1] ? 0 : 1
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,      // deletion
          dp[i][j - 1] + 1,      // insertion
          dp[i - 1][j - 1] + cost // substitution
        )
      }
    }
    const dist = dp[m][n]
    const maxLen = Math.max(m, n)
    return maxLen === 0 ? 1 : 1 - dist / maxLen
  }

  const saveToHistory = (term: string) => {
    const cleaned = term.trim()
    const normalized = cleaned.toLowerCase()
    if (!normalized) return

    // Find existing entry similar >=95%
    const existingIndex = searchHistory.findIndex((h) => similarityRatio(h, cleaned) >= 0.95)

    let filtered = searchHistory
    if (existingIndex !== -1) {
      filtered = searchHistory.filter((_, idx) => idx !== existingIndex)
    } else {
      // Otherwise remove exact normalized duplicates
      filtered = searchHistory.filter((h) => h.trim().toLowerCase() !== normalized)
    }

    const newHistory = [cleaned, ...filtered].slice(0, MAX_HISTORY)
    setSearchHistory(newHistory)
    localStorage.setItem("nexus-search-history", JSON.stringify(newHistory))
  }

  const scheduleAutoSaveHistory = (value: string) => {
    latestTypedQueryRef.current = value
    if (historySaveTimerRef.current) {
      clearTimeout(historySaveTimerRef.current)
    }
    if (!value.trim()) return
    historySaveTimerRef.current = setTimeout(() => {
      const cleaned = latestTypedQueryRef.current.trim()
      if (cleaned) {
        saveToHistory(cleaned)
      }
    }, HISTORY_AUTOSAVE_DELAY)
  }

  const clearHistory = () => {
    setSearchHistory([])
    localStorage.removeItem("nexus-search-history")
  }

  const removeFromHistory = (term: string) => {
    const newHistory = searchHistory.filter((h) => h !== term)
    setSearchHistory(newHistory)
    localStorage.setItem("nexus-search-history", JSON.stringify(newHistory))
  }

  const getUniqueTracks = useCallback((trackList: Track[]): Track[] => {
    const seen = new Set<string>()
    return trackList.filter((track) => {
      if (seen.has(track.id)) {
        return false
      }
      seen.add(track.id)
      return true
    })
  }, [])

  // Effect to search YouTube when query changes (with debounce)
  useEffect(() => {
    if (youtubeSearchTimerRef.current) {
      clearTimeout(youtubeSearchTimerRef.current)
    }

    if (query.trim() && query.length >= 2) {
      youtubeSearchTimerRef.current = setTimeout(() => {
        searchYouTube(query)
      }, 3000)
    } else {
      setYoutubeTracks([])
    }

    return () => {
      if (youtubeSearchTimerRef.current) {
        clearTimeout(youtubeSearchTimerRef.current)
      }
    }
  }, [query, searchYouTube])

  // Convert YouTube results to tracks
  useEffect(() => {
    if (youtubeResults.length > 0) {
      const converted = youtubeResults
        .filter((result) => result.videoId && result.videoId !== "undefined" && result.videoId.trim() !== "")
        .map((result) => youtubeVideoToTrack(result))
      setYoutubeTracks(converted)
    } else {
      setYoutubeTracks([])
    }
  }, [youtubeResults])

  // Search results (local + YouTube)
  const searchResults = useMemo(() => {
    if (!query.trim()) return { tracks: [], albums: [], artists: [] }

    const q = query.toLowerCase()

    // Local tracks
    const matchedTracks = tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q) || t.album.toLowerCase().includes(q),
    )

    // Combine local and YouTube tracks
    const allTracks = [...matchedTracks, ...youtubeTracks]
    const uniqueMatchedTracks = getUniqueTracks(allTracks)

    // Group by album
    const albumsMap = new Map<string, { name: string; artist: string; coverUrl: string; count: number }>()
    matchedTracks.forEach((t) => {
      const key = `${t.album}-${t.artist}`
      if (!albumsMap.has(key)) {
        albumsMap.set(key, { name: t.album, artist: t.artist, coverUrl: t.coverUrl, count: 0 })
      }
      albumsMap.get(key)!.count++
    })

    // Group by artist
    const artistsMap = new Map<string, { name: string; coverUrl: string; count: number }>()
    matchedTracks.forEach((t) => {
      if (!artistsMap.has(t.artist)) {
        artistsMap.set(t.artist, { name: t.artist, coverUrl: t.coverUrl, count: 0 })
      }
      artistsMap.get(t.artist)!.count++
    })

    return {
      tracks: uniqueMatchedTracks,
      albums: Array.from(albumsMap.values()).slice(0, 6),
      artists: Array.from(artistsMap.values()).slice(0, 6),
    }
  }, [query, tracks, youtubeTracks, getUniqueTracks])

  // Dynamic data based on user's library
  const dynamicData = useMemo(() => {
    // Top played artists from history
    const artistPlayCounts = new Map<string, { count: number; track: Track }>()
    history.forEach((entry) => {
      const track = tracks.find((t) => t.id === entry.trackId)
      if (track) {
        const current = artistPlayCounts.get(track.artist) || { count: 0, track }
        artistPlayCounts.set(track.artist, { count: current.count + entry.playCount, track })
      }
    })
    const topArtists = Array.from(artistPlayCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([name, data]) => ({ name, playCount: data.count, coverUrl: data.track.coverUrl }))

    // Recently added tracks (last 12) - using reverse order as proxy for recently added
    const recentTracks = [...tracks].slice(-12).reverse()

    // Get real genres from library with counts
    const genreMap = new Map<string, { count: number; coverUrl: string }>()
    tracks.forEach((t) => {
      if (t.genre) {
        const current = genreMap.get(t.genre) || { count: 0, coverUrl: t.coverUrl }
        genreMap.set(t.genre, { count: current.count + 1, coverUrl: t.coverUrl || current.coverUrl })
      }
    })
    const genres = Array.from(genreMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([name, data]) => ({ name, count: data.count, coverUrl: data.coverUrl }))

    // Recommended based on favorites
    const favoriteTrackIds = tracks.filter((t) => isFavorite(t.id)).map((t) => t.id)
    const favoriteArtists = new Set(
      tracks.filter((t) => favoriteTrackIds.includes(t.id)).map((t) => t.artist)
    )
    const recommended = tracks
      .filter((t) => !favoriteTrackIds.includes(t.id) && favoriteArtists.has(t.artist))
      .slice(0, 8)

    return {
      topArtists,
      recentTracks,
      genres,
      recommended,
    }
  }, [tracks, history, isFavorite])

  // Fallback browse categories if no genres
  const browseCategories = dynamicData.genres.length > 0 
    ? dynamicData.genres.map((g) => ({ 
        name: g.name, 
        color: "bg-gradient-to-br from-primary/60 to-secondary/60",
        count: g.count,
        coverUrl: g.coverUrl || undefined
      }))
    : [
        { name: "Électronique", color: "bg-gradient-to-br from-cyan-500 to-blue-600", count: 0, coverUrl: undefined },
        { name: "Synthwave", color: "bg-gradient-to-br from-pink-500 to-purple-600", count: 0, coverUrl: undefined },
        { name: "Ambient", color: "bg-gradient-to-br from-emerald-500 to-teal-600", count: 0, coverUrl: undefined },
        { name: "Cyberpunk", color: "bg-gradient-to-br from-amber-500 to-orange-600", count: 0, coverUrl: undefined },
        { name: "Lo-Fi", color: "bg-gradient-to-br from-indigo-500 to-violet-600", count: 0, coverUrl: undefined },
        { name: "Techno", color: "bg-gradient-to-br from-rose-500 to-pink-600", count: 0, coverUrl: undefined },
      ]

  const handleSearch = (term: string) => {
    const cleaned = term.trim()
    setQuery(cleaned)
    if (cleaned) saveToHistory(cleaned)
  }

  const suggestionPool = useMemo(() => {
    const pool: string[] = []
    pool.push(...searchHistory)
    searchResults.tracks.forEach((t) => {
      if (t.title) pool.push(t.title)
      if (t.artist) pool.push(t.artist)
    })
    youtubeTracks.forEach((t) => {
      if (t.title) pool.push(t.title)
      if (t.artist) pool.push(t.artist)
    })
    return pool
  }, [searchHistory, searchResults.tracks, youtubeTracks])

  const autoCompleteSuggestion = useMemo(() => {
    const base = query.trim().toLowerCase()
    if (!base) return ""
    const found = suggestionPool.find((s) => s && s.toLowerCase().startsWith(base))
    return found || ""
  }, [query, suggestionPool])

  const inlineSuggestions = useMemo(() => {
    if (!query.trim()) return searchHistory.slice(0, 4)
    const base = query.trim().toLowerCase()
    const relatedArtists = searchResults.tracks
      .map((t) => t.artist)
      .filter((a) => a && a.toLowerCase().includes(base))
    const relatedTitles = searchResults.tracks
      .map((t) => t.title)
      .filter((t) => t && t.toLowerCase().includes(base))
    const merged = [...searchHistory.filter((h) => h.toLowerCase().includes(base)), ...relatedArtists, ...relatedTitles]
    const unique: string[] = []
    merged.forEach((m) => {
      if (m && !unique.some((u) => u.toLowerCase() === m.toLowerCase())) unique.push(m)
    })
    return unique.slice(0, 4)
  }, [query, searchHistory, searchResults.tracks])

  const hasResults =
    query && (searchResults.tracks.length > 0 || searchResults.albums.length > 0 || searchResults.artists.length > 0)

  return (
    <TooltipProvider>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="h-full flex flex-col"
      >
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 space-y-8">
            {/* Search Header - Enhanced */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center max-w-2xl mx-auto"
            >
              <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-3">
                <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                  Recherche
                </span>
              </h1>
              <p className="text-muted-foreground text-lg">
                Explorez votre bibliothèque et découvrez de nouvelles pistes
              </p>
            </motion.div>

            {/* Search Bar - Enhanced */}
            <div className="relative">
              <div
                className={cn(
                  "relative flex items-center rounded-2xl overflow-hidden",
                  "bg-white/5 border border-white/10",
                  "transition-all duration-300",
                  isFocused && "border-primary/50 bg-white/10 shadow-lg shadow-primary/10",
                )}
              >
                <div className="pl-4">
                  <Search
                    className={cn(
                      "w-5 h-5 transition-colors duration-300",
                      isFocused ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                </div>
                <div className="relative flex-1">
                  {autoCompleteSuggestion && autoCompleteSuggestion.toLowerCase().startsWith(query.trim().toLowerCase()) && (
                    <div className="absolute inset-0 flex items-center px-1 sm:px-2 pointer-events-none text-base text-muted-foreground/40">
                      <span className="text-transparent select-none">{query}</span>
                      <span>{autoCompleteSuggestion.slice(query.length)}</span>
                    </div>
                  )}
                  <Input
                    ref={inputRef}
                    type="text"
                    placeholder="Artistes, titres ou albums..."
                    value={query}
                    onChange={(e) => {
                      const value = e.target.value
                      setQuery(value)
                      scheduleAutoSaveHistory(value)
                    }}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const cleaned = query.trim()
                        if (cleaned) {
                          saveToHistory(cleaned)
                          if (historySaveTimerRef.current) {
                            clearTimeout(historySaveTimerRef.current)
                            historySaveTimerRef.current = null
                          }
                        }
                      }
                      if (e.key === "Tab" && autoCompleteSuggestion) {
                        e.preventDefault()
                        setQuery(autoCompleteSuggestion)
                        scheduleAutoSaveHistory(autoCompleteSuggestion)
                      }
                    }}
                    className={cn(
                      "flex-1 border-0 bg-transparent py-4 text-base relative z-10",
                      "focus-visible:ring-0 focus-visible:ring-offset-0",
                      "placeholder:text-muted-foreground/50",
                    )}
                  />
                </div>
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className={cn(
                      "mr-3 p-1.5 rounded-full",
                      "hover:bg-white/10 transition-all duration-200",
                      "text-muted-foreground hover:text-foreground",
                    )}
                    title="Effacer la recherche"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                {youtubeLoading && (
                  <div className="mr-4">
                    <Skeleton className="w-5 h-5 rounded-full" />
                  </div>
                )}
              </div>

              <AnimatePresence>
                {(youtubeLoading || loading) && query.trim().length >= 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="mt-3 grid grid-cols-1 gap-2"
                  >
                    {Array.from({ length: 3 }).map((_, i) => (
                      <SearchTrackItemSkeleton key={`search-skel-${i}`} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {inlineSuggestions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {inlineSuggestions.map((s) => (
                    <motion.button
                      key={`sugg-${s}`}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleSearch(s)}
                      className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
                    >
                      {s}
                    </motion.button>
                  ))}
                </div>
              )}
            </div>

            {query ? (
              /* Search Results */
              <div className="space-y-8">
                {/* Loading State - Show skeletons while searching */}
                {(youtubeLoading || loading) && searchResults.tracks.length === 0 && searchResults.artists.length === 0 && searchResults.albums.length === 0 && (
                  <SearchResultsSkeleton />
                )}

                {/* Artists Results */}
                {(youtubeLoading || loading) && searchResults.artists.length === 0 ? (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <Skeleton className="w-5 h-5" />
                      <Skeleton className="h-6 w-24" />
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <ArtistCircleSkeleton key={`artist-skeleton-${i}`} />
                      ))}
                    </div>
                  </section>
                ) : searchResults.artists.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <User className="w-5 h-5 text-primary" />
                      <h2 className="font-display text-lg font-semibold">Artistes</h2>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                      {searchResults.artists.map((artist) => (
                        <button
                          key={artist.name}
                          onClick={() => handleSearch(artist.name)}
                          className={cn(
                            "flex-shrink-0 flex flex-col items-center gap-3 p-4",
                            "transition-all duration-300 ease-out",
                            "hover:scale-105",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          )}
                        >
                          <div
                            className={cn(
                              "w-24 h-24 rounded-full overflow-hidden",
                              "ring-2 ring-white/10 hover:ring-primary/50",
                              "transition-all duration-300",
                            )}
                          >
                            <img
                              src={getCoverUrl(artist.coverUrl) || "/placeholder.svg"}
                              alt={artist.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium truncate max-w-[100px]">{artist.name}</p>
                            <p className="text-xs text-muted-foreground">{artist.count} titres</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {/* Albums Results */}
                {(youtubeLoading || loading) && searchResults.albums.length === 0 ? (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <Skeleton className="w-5 h-5" />
                      <Skeleton className="h-6 w-24" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <SearchAlbumCardSkeleton key={`album-skeleton-${i}`} />
                      ))}
                    </div>
                  </section>
                ) : searchResults.albums.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <Disc3 className="w-5 h-5 text-primary" />
                      <h2 className="font-display text-lg font-semibold">Albums</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      {searchResults.albums.map((album) => (
                        <button
                          key={`${album.name}-${album.artist}`}
                          onClick={() => handleSearch(album.name)}
                          className={cn(
                            "group text-left rounded-xl overflow-hidden",
                            "bg-white/5 hover:bg-white/10",
                            "transition-all duration-300",
                            "hover:scale-[1.03] hover:shadow-xl hover:shadow-primary/10",
                          )}
                        >
                          <div className="relative aspect-square overflow-hidden">
                            <img
                              src={getCoverUrl(album.coverUrl) || "/placeholder.svg"}
                              alt={album.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          </div>
                          <div className="p-3">
                            <p className="text-sm font-medium truncate">{album.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{album.artist}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {/* Tracks Results */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Music className="w-5 h-5 text-primary" />
                    <h2 className="font-display text-lg font-semibold">
                      Titres
                      <span className="ml-2 text-sm text-muted-foreground font-normal">
                        ({searchResults.tracks.length})
                      </span>
                    </h2>
                  </div>

                  {youtubeError && (
                    <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                      <p className="text-sm text-rose-400">{youtubeError}</p>
                    </div>
                  )}

                  {youtubeLoading && searchResults.tracks.length === 0 ? (
                    <div className="space-y-1 bg-white/5 rounded-2xl p-2">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <SearchTrackItemSkeleton key={`track-skeleton-${i}`} />
                      ))}
                    </div>
                  ) : searchResults.tracks.length === 0 && !youtubeLoading ? (
                    <div className="text-center py-16">
                      <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                        <Search className="w-10 h-10 text-muted-foreground/50" />
                      </div>
                      <p className="text-lg font-medium mb-1">Aucun résultat</p>
                      <p className="text-muted-foreground text-sm">Essayez avec d'autres mots-clés</p>
                    </div>
                  ) : (
                    <div className="space-y-1 bg-white/5 rounded-2xl p-2">
                      {youtubeLoading && searchResults.tracks.length > 0 && (
                        <div className="mb-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                          <div className="flex items-center gap-2">
                            <Skeleton className="w-4 h-4 rounded-full" />
                            <Skeleton className="h-4 w-40" />
                          </div>
                        </div>
                      )}
                      {searchResults.tracks.slice(0, 50).map((track) => {
                        const isYouTubeTrack = track.mediaSource === "youtube"
                        let actualIndex: number

                        if (isYouTubeTrack) {
                          actualIndex = -1
                        } else {
                          actualIndex = tracks.findIndex((t) => t.id === track.id)
                        }

                        const isCurrentTrack = !isYouTubeTrack && currentTrackIndex === actualIndex

                        return (
                          <TrackContextMenu
                            key={track.id}
                            track={track}
                            playlists={playlists}
                            isFavorite={isFavorite(track.id)}
                            onPlay={() => {
                              if (isYouTubeTrack && onPlayTrack) {
                                onPlayTrack(track)
                              } else if (!isYouTubeTrack) {
                                onTrackSelect(actualIndex)
                              } else {
                                onAddToQueue?.(track)
                              }
                            }}
                            onPlayNext={() => onPlayNext?.(track)}
                            onAddToQueue={() => onAddToQueue?.(track)}
                            onAddToPlaylist={(playlistId) => onAddToPlaylist?.(playlistId, track)}
                            onCreatePlaylist={() => createPlaylist("Nouvelle playlist", [track.id])}
                            onToggleFavorite={() => toggleFavorite(track.id)}
                            onUploadToCloudinary={() => uploadTrack?.(track)}
                            canUploadToCloudinary={canUploadToCloudinary && !!track.filePath && !isYouTubeTrack}
                            isUploading={getTrackProgress?.(track.id)?.status === "uploading"}
                            onUploadToBunny={() => uploadTrackToBunny?.(track)}
                            canUploadToBunny={canUploadToBunny && !!track.filePath && !isYouTubeTrack}
                            isUploadingToBunny={getBunnyTrackProgress?.(track.id)?.status === "uploading"}
                            onUploadToNexus={() => uploadTrackToNexus?.(track)}
                            canUploadToNexus={canUploadToNexus && !!track.filePath && !isYouTubeTrack}
                            isUploadingToNexus={getNexusTrackProgress?.(track.id)?.status === "uploading"}
                          >
                            <SearchTrackItem
                              track={track}
                              isPlaying={isPlaying}
                              isCurrent={isCurrentTrack}
                              onPlay={() => {
                                if (isYouTubeTrack && onPlayTrack) {
                                  onPlayTrack(track)
                                } else if (!isYouTubeTrack) {
                                  onTrackSelect(actualIndex)
                                } else {
                                  onAddToQueue?.(track)
                                }
                              }}
                              isYouTube={isYouTubeTrack}
                            />
                          </TrackContextMenu>
                        )
                      })}
                    </div>
                  )}
                </section>
              </div>
            ) : (
              /* Browse Mode - No Search */
              <div className="space-y-10">
                {/* Search History */}
                {searchHistory.length > 0 && (
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <History className="w-5 h-5 text-muted-foreground" />
                        <h2 className="font-display text-lg font-semibold">Recherches récentes</h2>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearHistory}
                        className="text-xs text-muted-foreground"
                      >
                        Effacer tout
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {searchHistory.map((term) => (
                        <HistoryChip
                          key={term}
                          term={term}
                          onSelect={() => handleSearch(term)}
                          onRemove={() => removeFromHistory(term)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Top Artists */}
                {dynamicData.topArtists.length > 0 && (
                  <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="w-5 h-5 text-emerald-400" />
                      <h2 className="font-display text-lg font-semibold">Vos artistes les plus écoutés</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                      {dynamicData.topArtists.map((artist, idx) => (
                        <motion.button
                          key={artist.name}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.05 }}
                          onClick={() => handleSearch(artist.name)}
                          className="flex flex-col items-center gap-2 group"
                        >
                          <div className="relative w-full aspect-square rounded-full overflow-hidden ring-2 ring-white/10 group-hover:ring-primary/50 transition-all duration-300">
                            <img
                              src={getCoverUrl(artist.coverUrl) || "/placeholder.svg"}
                              alt={artist.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                              <Play className="w-5 h-5 text-white fill-current" />
                            </div>
                          </div>
                          <div className="text-center w-full">
                            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                              {artist.name}
                            </p>
                            <p className="text-xs text-muted-foreground">{artist.playCount} écoutes</p>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </motion.section>
                )}

                {/* Recent Tracks */}
                {dynamicData.recentTracks.length > 0 && (
                  <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Clock className="w-5 h-5 text-cyan-400" />
                      <h2 className="font-display text-lg font-semibold">Récemment ajoutés</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      {dynamicData.recentTracks.map((track, idx) => {
                        const trackIndex = tracks.findIndex((t) => t.id === track.id)
                        return (
                          <motion.button
                            key={track.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.04 }}
                            onClick={() => trackIndex !== -1 && onTrackSelect(trackIndex)}
                            className="group text-left rounded-xl overflow-hidden bg-white/5 hover:bg-white/10 transition-all duration-300 hover:scale-[1.03]"
                          >
                            <div className="relative aspect-square overflow-hidden">
                              <img
                                src={getCoverUrl(track.coverUrl) || "/placeholder.svg"}
                                alt={track.title}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-3">
                                <Play className="w-8 h-8 text-white fill-current drop-shadow-lg" />
                              </div>
                            </div>
                            <div className="p-3">
                              <p className="text-sm font-medium truncate">{track.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                            </div>
                          </motion.button>
                        )
                      })}
                    </div>
                  </motion.section>
                )}

                {/* Browse Categories/Genres */}
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h2 className="font-display text-lg font-semibold">
                      {dynamicData.genres.length > 0 ? "Vos genres" : "Explorer par genre"}
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {browseCategories.map((cat, idx) => (
                      <motion.div
                        key={cat.name}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <button
                          onClick={() => handleSearch(cat.name)}
                          className={cn(
                            "group relative h-28 rounded-2xl overflow-hidden w-full",
                            "transition-all duration-300 ease-out",
                            "hover:shadow-xl hover:shadow-primary/10 hover:scale-[1.02]",
                          )}
                        >
                          {cat.coverUrl ? (
                            <>
                              <img
                                src={getCoverUrl(cat.coverUrl)}
                                alt={cat.name}
                                className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-70 group-hover:scale-110 transition-all duration-500"
                              />
                              <div className="absolute inset-0 bg-gradient-to-br from-primary/60 to-secondary/80" />
                            </>
                          ) : (
                            <div className={cn("absolute inset-0", cat.color)} />
                          )}
                          <div
                            className="absolute inset-0 opacity-30"
                            style={{
                              backgroundImage: `radial-gradient(circle at 80% 20%, white 0%, transparent 50%)`,
                            }}
                          />
                          <div className="relative h-full flex items-end p-4">
                            <div>
                              <h3 className="font-display font-bold text-white text-lg drop-shadow-lg">
                                {cat.name}
                              </h3>
                              {cat.count && cat.count > 0 && (
                                <p className="text-xs text-white/80 mt-1">{cat.count} titres</p>
                              )}
                            </div>
                          </div>
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </motion.section>

                {/* Recommended Tracks */}
                {dynamicData.recommended.length > 0 && (
                  <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="w-5 h-5 text-purple-400" />
                      <h2 className="font-display text-lg font-semibold">Recommandés pour vous</h2>
                      <span className="text-xs text-muted-foreground">Basé sur vos favoris</span>
                    </div>
                    <div className="space-y-1 bg-white/5 rounded-2xl p-2">
                      {dynamicData.recommended.map((track, idx) => {
                        const trackIndex = tracks.findIndex((t) => t.id === track.id)
                        const isCurrentTrack = currentTrackIndex === trackIndex
                        return (
                          <motion.div
                            key={track.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                          >
                            <SearchTrackItem
                              track={track}
                              isPlaying={isPlaying}
                              isCurrent={isCurrentTrack}
                              onPlay={() => trackIndex !== -1 && onTrackSelect(trackIndex)}
                            />
                          </motion.div>
                        )
                      })}
                    </div>
                  </motion.section>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </TooltipProvider>
  )
}
