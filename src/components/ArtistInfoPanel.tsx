"use client"

import { useState, useEffect, useCallback, memo, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Calendar,
  MapPin,
  Music2,
  Disc3,
  Globe,
  Users,
  Sparkles,
  Info,
  Loader2,
  Clock,
  Play,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  TrendingUp,
  Shuffle,
  ListPlus,
  Heart,
  MoreVertical,
  BarChart3,
  Award,
  Radio,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useArtistMetadata, useAlbumMetadata } from "@/hooks/useArtistMetadata"
import { useArtistImages } from "@/hooks/useArtistImage"
import { useLibrary } from "@/hooks/useLibrary"
import { usePlayHistory } from "@/hooks/usePlayHistory"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { getCoverUrl } from "@/lib/audio"
import { formatDuration } from "@/hooks/useListeningStats"
import type { Track } from "@/types/music"

interface ArtistInfoPanelProps {
  isOpen: boolean
  onClose: () => void
  currentTrack: Track | null
  onNavigateToArtist?: () => void
  onPlayTrack?: (track: Track) => void
  onPlayTracks?: (trackIds: string[]) => void
  onShuffleTracks?: (trackIds: string[]) => void
  onAddToQueue?: (tracks: Track[]) => void
  onAddToPlaylist?: (playlistId: string, track: Track) => void
  playlists?: Array<{ id: string; name: string }>
  onCreatePlaylist?: (name: string, trackIds: string[]) => void
}

// Carousel d'images
const ImageCarousel = memo(({ images, artistName }: { images: { url: string; author?: string }[]; artistName: string }) => {
  const [currentIndex, setCurrentIndex] = useState(0)

  const next = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % images.length)
  }, [images.length])

  const prev = useCallback(() => {
    setCurrentIndex(prev => (prev - 1 + images.length) % images.length)
  }, [images.length])

  // Auto-slide
  useEffect(() => {
    if (images.length <= 1) return
    const timer = setInterval(next, 5000)
    return () => clearInterval(timer)
  }, [next, images.length])

  if (images.length === 0) {
    return (
      <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
        <Users className="w-16 h-16 text-muted-foreground/30" />
      </div>
    )
  }

  return (
    <div className="relative aspect-[16/9] rounded-2xl overflow-hidden group">
      <AnimatePresence mode="wait">
        <motion.img
          key={currentIndex}
          src={images[currentIndex].url}
          alt={`${artistName} - Image ${currentIndex + 1}`}
          className="absolute inset-0 w-full h-full object-cover"
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.5 }}
        />
      </AnimatePresence>

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

      {/* Navigation */}
      {images.length > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Image précédente"
            className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full",
              "bg-black/50 backdrop-blur-sm text-white",
              "opacity-0 group-hover:opacity-100 transition-opacity",
              "hover:bg-black/70 active:scale-95"
            )}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            aria-label="Image suivante"
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full",
              "bg-black/50 backdrop-blur-sm text-white",
              "opacity-0 group-hover:opacity-100 transition-opacity",
              "hover:bg-black/70 active:scale-95"
            )}
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Dots indicator */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-300",
                  idx === currentIndex ? "w-6 bg-white" : "bg-white/50 hover:bg-white/70"
                )}
              />
            ))}
          </div>
        </>
      )}

      {/* Credit */}
      {images[currentIndex]?.author && (
        <div className="absolute bottom-3 right-3 text-xs text-white/60">
          Photo: {images[currentIndex].author}
        </div>
      )}
    </div>
  )
})

ImageCarousel.displayName = "ImageCarousel"

// Section Info avec animation
const InfoSection = memo(({ 
  title, 
  icon: Icon, 
  children,
  delay = 0 
}: { 
  title: string
  icon: React.ElementType
  children: React.ReactNode
  delay?: number
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    className="space-y-3"
  >
    <div className="flex items-center gap-2 text-primary">
      <Icon className="w-4 h-4" />
      <h3 className="font-semibold text-sm uppercase tracking-wider">{title}</h3>
    </div>
    {children}
  </motion.div>
))

InfoSection.displayName = "InfoSection"

// Skeleton de chargement
const LoadingSkeleton = () => (
  <div className="space-y-6 p-6">
    <Skeleton className="aspect-[16/9] rounded-2xl" />
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
      <Skeleton className="h-32 w-full" />
    </div>
  </div>
)

export const ArtistInfoPanel = memo(({ 
  isOpen, 
  onClose, 
  currentTrack, 
  onNavigateToArtist, 
  onPlayTrack,
  onPlayTracks,
  onShuffleTracks,
  onAddToQueue,
  onAddToPlaylist,
  playlists = [],
  onCreatePlaylist
}: ArtistInfoPanelProps) => {
  const artistName = currentTrack?.artist || ""
  const albumName = currentTrack?.album || ""

  // Récupérer les métadonnées de l'artiste
  const { metadata: artistMetadata, isLoading: isLoadingArtist } = useArtistMetadata({
    artistName,
    enabled: isOpen && !!artistName,
    combined: true,
  })

  // Récupérer les métadonnées de l'album
  const { metadata: albumMetadata, isLoading: isLoadingAlbum } = useAlbumMetadata({
    albumName,
    artistName,
    enabled: isOpen && !!albumName && !!artistName,
  })

  // Récupérer les images de l'artiste
  const { images, isLoading: isLoadingImages } = useArtistImages({
    query: artistName,
    limit: 10,
    enabled: isOpen && !!artistName,
  })

  // Récupérer les tracks de l'artiste depuis la bibliothèque
  const { getTracksByArtist } = useLibrary()
  const { history } = usePlayHistory()
  
  const artistTracks = useMemo(() => {
    if (!artistName) return []
    return getTracksByArtist(artistName)
  }, [artistName, getTracksByArtist])

  // Calculer les statistiques de l'artiste
  const artistStats = useMemo(() => {
    if (artistTracks.length === 0) return null

    const albums = new Set(artistTracks.map(t => t.album).filter(Boolean))
    const totalDuration = artistTracks.reduce((sum, t) => sum + (t.duration || 0), 0)
    
    // Statistiques d'écoute détaillées
    const trackPlayCounts = new Map<string, number>()
    history
      .filter(h => artistTracks.some(t => t.id === h.trackId))
      .forEach(h => {
        const current = trackPlayCounts.get(h.trackId) || 0
        trackPlayCounts.set(h.trackId, current + (h.playCount || 1))
      })
    
    const playCount = Array.from(trackPlayCounts.values()).reduce((sum, count) => sum + count, 0)
    
    // Top tracks par nombre d'écoutes
    const topTracks = artistTracks
      .map(track => ({
        track,
        playCount: trackPlayCounts.get(track.id) || 0
      }))
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 10)
      .map(item => item.track)

    // Grouper par album
    const albumsMap = new Map<string, { name: string; coverUrl: string; tracks: Track[]; year?: number; playCount: number }>()
    artistTracks.forEach(track => {
      if (!track.album) return
      const key = `${track.album}-${track.artist}`
      if (!albumsMap.has(key)) {
        albumsMap.set(key, {
          name: track.album,
          coverUrl: track.coverUrl,
          tracks: [],
          year: track.year,
          playCount: 0
        })
      }
      albumsMap.get(key)!.tracks.push(track)
      albumsMap.get(key)!.playCount += trackPlayCounts.get(track.id) || 0
    })

    return {
      trackCount: artistTracks.length,
      albumCount: albums.size,
      totalDuration,
      playCount,
      topTracks,
      albums: Array.from(albumsMap.values()).sort((a, b) => {
        // Trier par nombre d'écoutes d'abord, puis par année
        if (b.playCount !== a.playCount) return b.playCount - a.playCount
        if (a.year && b.year) return b.year - a.year
        if (a.year) return -1
        if (b.year) return 1
        return a.name.localeCompare(b.name)
      })
    }
  }, [artistTracks, history])

  const isLoading = isLoadingArtist || isLoadingAlbum || isLoadingImages

  if (!isOpen) return null;

  return (
    <div className="h-full w-full bg-gradient-to-b from-card/95 via-card/90 to-background/95 backdrop-blur-xl border-l border-border/40 flex flex-col shadow-2xl">
      {/* Header avec gradient amélioré */}
      <div className="relative p-5 border-b border-border/40 bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/10 backdrop-blur-sm">
        {/* Effet de brillance animé */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
        
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0, rotate: -180 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="p-2.5 rounded-xl bg-gradient-to-br from-primary/30 via-primary/20 to-secondary/30 shadow-xl ring-2 ring-primary/20"
            >
              <Sparkles className="w-5 h-5 text-primary drop-shadow-lg" />
            </motion.div>
            <div>
              <motion.h2 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="font-bold text-xl bg-gradient-to-r from-primary via-primary/90 to-secondary bg-clip-text text-transparent drop-shadow-sm"
              >
                {artistName || "Artiste"}
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="text-xs text-muted-foreground font-medium"
              >
                Profil & informations
              </motion.p>
            </div>
          </div>
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            aria-label="Fermer le panel"
            className={cn(
              "p-2 rounded-full transition-all",
              "text-muted-foreground hover:text-foreground",
              "hover:bg-muted/50 active:scale-95",
              "ring-1 ring-border/30 hover:ring-border/50"
            )}
          >
            <X className="w-5 h-5" />
          </motion.button>
        </div>
        
        {/* Quick Actions améliorées */}
        {artistStats && artistStats.trackCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="flex gap-2 mt-4 relative z-10"
          >
            {onPlayTracks && (
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  onClick={() => onPlayTracks(artistTracks.map(t => t.id))}
                  size="sm"
                  className="flex-1 bg-gradient-to-r from-primary via-primary/90 to-primary/80 hover:from-primary/95 hover:via-primary/90 hover:to-primary/85 text-primary-foreground shadow-xl hover:shadow-2xl transition-all ring-2 ring-primary/30 hover:ring-primary/50 font-semibold"
                >
                  <Play className="w-4 h-4 mr-2 fill-current" />
                  Tout lire
                </Button>
              </motion.div>
            )}
            {onShuffleTracks && (
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  onClick={() => onShuffleTracks(artistTracks.map(t => t.id))}
                  size="sm"
                  variant="outline"
                  className="flex-1 border-secondary/40 hover:bg-gradient-to-r hover:from-secondary/20 hover:to-secondary/10 hover:border-secondary/60 shadow-md hover:shadow-lg transition-all font-medium"
                >
                  <Shuffle className="w-4 h-4 mr-2" />
                  Mélanger
                </Button>
              </motion.div>
            )}
            {onAddToQueue && (
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Button
                  onClick={() => onAddToQueue(artistTracks)}
                  size="sm"
                  variant="ghost"
                  className="px-3 hover:bg-accent/20 hover:text-accent ring-1 ring-border/30 hover:ring-accent/30"
                >
                  <ListPlus className="w-4 h-4" />
                </Button>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {!currentTrack ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-6">
            <Music2 className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Aucune piste en lecture</p>
          </div>
        ) : isLoading ? (
          <LoadingSkeleton />
        ) : (
          <div className="p-6 space-y-6">
            {/* Carrousel d'images */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <ImageCarousel images={images} artistName={artistName} />
            </motion.div>

            {/* Statistiques de la bibliothèque améliorées */}
            {artistStats && artistStats.trackCount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.4 }}
                className="space-y-3"
              >
                {/* Stats principales améliorées */}
                <div className="grid grid-cols-2 gap-3">
                  <motion.div
                    whileHover={{ scale: 1.03, y: -2 }}
                    className="bg-gradient-to-br from-primary/25 via-primary/15 to-primary/8 rounded-xl p-4 border-2 border-primary/40 shadow-xl relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/15 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-primary/20 transition-colors" />
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-2">
                        <motion.div 
                          whileHover={{ rotate: 360 }}
                          transition={{ duration: 0.6 }}
                          className="p-2 rounded-lg bg-gradient-to-br from-primary/30 to-primary/20 shadow-md ring-1 ring-primary/30"
                        >
                          <Music2 className="w-4 h-4 text-primary" />
                        </motion.div>
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Titres</span>
                      </div>
                      <motion.p 
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.1, type: "spring" }}
                        className="text-3xl font-extrabold bg-gradient-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent drop-shadow-sm"
                      >
                        {artistStats.trackCount}
                      </motion.p>
                    </div>
                  </motion.div>
                  
                  <motion.div
                    whileHover={{ scale: 1.03, y: -2 }}
                    className="bg-gradient-to-br from-secondary/25 via-secondary/15 to-secondary/8 rounded-xl p-4 border-2 border-secondary/40 shadow-xl relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-secondary/15 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-secondary/20 transition-colors" />
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-secondary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-2">
                        <motion.div 
                          whileHover={{ rotate: 360 }}
                          transition={{ duration: 0.6 }}
                          className="p-2 rounded-lg bg-gradient-to-br from-secondary/30 to-secondary/20 shadow-md ring-1 ring-secondary/30"
                        >
                          <Disc3 className="w-4 h-4 text-secondary" />
                        </motion.div>
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Albums</span>
                      </div>
                      <motion.p 
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.15, type: "spring" }}
                        className="text-3xl font-extrabold bg-gradient-to-r from-secondary via-secondary/90 to-secondary/70 bg-clip-text text-transparent drop-shadow-sm"
                      >
                        {artistStats.albumCount}
                      </motion.p>
                    </div>
                  </motion.div>
                </div>

                {/* Stats secondaires améliorées */}
                <div className="grid grid-cols-2 gap-3">
                  <motion.div
                    whileHover={{ scale: 1.03, y: -1 }}
                    className="bg-gradient-to-br from-accent/25 via-accent/15 to-accent/8 rounded-xl p-3.5 border-2 border-accent/40 shadow-lg relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-1.5">
                        <motion.div
                          animate={{ rotate: [0, 360] }}
                          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        >
                          <Clock className="w-4 h-4 text-accent" />
                        </motion.div>
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Durée totale</span>
                      </div>
                      <p className="text-xl font-extrabold text-accent drop-shadow-sm">
                        {formatDuration(artistStats.totalDuration)}
                      </p>
                    </div>
                  </motion.div>
                  
                  <motion.div
                    whileHover={{ scale: 1.03, y: -1 }}
                    className="bg-gradient-to-br from-amber-500/25 via-amber-500/15 to-amber-500/8 rounded-xl p-3.5 border-2 border-amber-500/40 shadow-lg relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-1.5">
                        <BarChart3 className="w-4 h-4 text-amber-500" />
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Écoutes</span>
                      </div>
                      <p className="text-xl font-extrabold text-amber-500 drop-shadow-sm">
                        {artistStats.playCount.toLocaleString()}
                      </p>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* Infos rapides */}
            {artistMetadata && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="space-y-4"
              >
                {/* Genres */}
                {artistMetadata.genres && artistMetadata.genres.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {artistMetadata.genres.slice(0, 6).map((genre, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors"
                      >
                        {genre}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Infos de base */}
                <div className="grid grid-cols-2 gap-3">
                  {artistMetadata.origin && (
                    <div className="flex items-center gap-2 text-sm bg-muted/30 rounded-lg p-2.5">
                      <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="truncate">{artistMetadata.origin}</span>
                    </div>
                  )}
                  {artistMetadata.country && !artistMetadata.origin && (
                    <div className="flex items-center gap-2 text-sm bg-muted/30 rounded-lg p-2.5">
                      <Globe className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="truncate">{artistMetadata.country}</span>
                    </div>
                  )}
                  {artistMetadata.birthDate && (
                    <div className="flex items-center gap-2 text-sm bg-muted/30 rounded-lg p-2.5">
                      <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
                      <span>{new Date(artistMetadata.birthDate).getFullYear()}</span>
                      {artistMetadata.deathDate && (
                        <span className="text-muted-foreground">
                          - {new Date(artistMetadata.deathDate).getFullYear()}
                        </span>
                      )}
                    </div>
                  )}
                  {artistMetadata.yearsActive && (
                    <div className="flex items-center gap-2 text-sm bg-muted/30 rounded-lg p-2.5">
                      <TrendingUp className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="truncate">{artistMetadata.yearsActive}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Top Tracks amélioré */}
            {artistStats && artistStats.topTracks.length > 0 && (
              <InfoSection title="Top Titres" icon={Award} delay={0.15}>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {artistStats.topTracks.map((track, idx) => {
                    const playCount = history
                      .filter(h => h.trackId === track.id)
                      .reduce((sum, h) => sum + (h.playCount || 1), 0)
                    const isCurrent = currentTrack?.id === track.id
                    
                    return (
                      <motion.div
                        key={track.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + idx * 0.03, type: "spring", stiffness: 200 }}
                        whileHover={{ scale: 1.02, x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onPlayTrack?.(track)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer group relative overflow-hidden",
                          isCurrent 
                            ? "bg-gradient-to-r from-primary/25 via-primary/15 to-primary/10 border-2 border-primary/40 shadow-lg" 
                            : "bg-gradient-to-r from-muted/30 via-muted/20 to-muted/10 hover:from-muted/40 hover:via-muted/30 hover:to-muted/20 border border-transparent hover:border-primary/30 shadow-md hover:shadow-lg"
                        )}
                      >
                        {isCurrent && (
                          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10 animate-pulse" />
                        )}
                        <motion.div 
                          whileHover={{ scale: 1.1, rotate: 5 }}
                          className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 shadow-lg ring-2 ring-border/20 group-hover:ring-primary/40 transition-all"
                        >
                          <img
                            src={getCoverUrl(track.coverUrl)}
                            alt={track.title}
                            className="w-full h-full object-cover"
                          />
                        </motion.div>
                        <div className="flex-1 min-w-0 relative z-10">
                          <p className={cn(
                            "font-semibold text-sm truncate",
                            isCurrent ? "text-primary" : "group-hover:text-primary transition-colors"
                          )}>
                            {track.title}
                          </p>
                          {playCount > 0 && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Radio className="w-3 h-3 text-muted-foreground" />
                              <p className="text-xs text-muted-foreground">
                                {playCount} écoute{playCount > 1 ? 's' : ''}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 relative z-10">
                          {idx < 3 && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: 0.2 + idx * 0.03, type: "spring" }}
                            >
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-xs px-2 py-0.5 font-bold shadow-md",
                                  idx === 0 && "border-amber-500/60 text-amber-500 bg-amber-500/10",
                                  idx === 1 && "border-slate-400/60 text-slate-400 bg-slate-400/10",
                                  idx === 2 && "border-orange-600/60 text-orange-600 bg-orange-600/10"
                                )}
                              >
                                #{idx + 1}
                              </Badge>
                            </motion.div>
                          )}
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileHover={{ opacity: 1, scale: 1.1 }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Play className="w-4 h-4 text-primary fill-primary/20" />
                          </motion.div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </InfoSection>
            )}

            {/* Albums de la bibliothèque améliorés */}
            {artistStats && artistStats.albums.length > 0 && (
              <InfoSection title="Albums dans votre bibliothèque" icon={Disc3} delay={0.2}>
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {artistStats.albums.slice(0, 8).map((album: { name: string; coverUrl: string; tracks: Track[]; year?: number; playCount: number }, idx: number) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + idx * 0.03, type: "spring", stiffness: 200 }}
                      whileHover={{ scale: 1.02, x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        if (onPlayTrack && album.tracks.length > 0) {
                          onPlayTrack(album.tracks[0])
                        }
                      }}
                      className="flex items-center gap-3 p-3.5 rounded-xl bg-gradient-to-r from-muted/30 via-muted/20 to-muted/10 hover:from-muted/50 hover:via-muted/30 hover:to-muted/20 transition-all group cursor-pointer border border-border/30 hover:border-primary/40 shadow-md hover:shadow-xl relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <motion.div 
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 shadow-xl ring-2 ring-border/30 group-hover:ring-primary/50 transition-all relative z-10"
                      >
                        <img
                          src={getCoverUrl(album.coverUrl)}
                          alt={album.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </motion.div>
                      <div className="flex-1 min-w-0 relative z-10">
                        <p className="font-bold text-sm truncate group-hover:text-primary transition-colors">
                          {album.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <div className="flex items-center gap-1">
                            <Music2 className="w-3 h-3 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground font-medium">
                              {album.tracks.length} titre{album.tracks.length > 1 ? 's' : ''}
                            </p>
                          </div>
                          {album.year && (
                            <>
                              <span className="text-muted-foreground/50">•</span>
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-muted-foreground" />
                                <p className="text-xs text-muted-foreground font-medium">{album.year}</p>
                              </div>
                            </>
                          )}
                          {album.playCount > 0 && (
                            <>
                              <span className="text-muted-foreground/50">•</span>
                              <div className="flex items-center gap-1">
                                <Radio className="w-3 h-3 text-primary/70" />
                                <p className="text-xs text-muted-foreground font-medium">{album.playCount}</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileHover={{ opacity: 1, scale: 1.1 }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity relative z-10"
                      >
                        <Play className="w-5 h-5 text-primary fill-primary/30 drop-shadow-md" />
                      </motion.div>
                    </motion.div>
                  ))}
                  {artistStats.albums.length > 8 && (
                    <motion.p 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs text-muted-foreground text-center pt-2 font-medium"
                    >
                      + {artistStats.albums.length - 8} autre{artistStats.albums.length - 8 > 1 ? 's' : ''} album{artistStats.albums.length - 8 > 1 ? 's' : ''}
                    </motion.p>
                  )}
                </div>
              </InfoSection>
            )}

            {/* Biographie de l'artiste */}
            {artistMetadata?.biography && (
              <InfoSection title="Biographie" icon={Users} delay={0.2}>
                <div className="prose prose-sm prose-invert max-w-none">
                  <p className="text-muted-foreground leading-relaxed text-sm">
                    {artistMetadata.biographyShort || artistMetadata.biography.slice(0, 500)}
                    {artistMetadata.biography.length > 500 && "..."}
                  </p>
                  {artistMetadata.biographyUrl && (
                    <a
                      href={artistMetadata.biographyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline mt-2 text-xs"
                    >
                      Lire plus <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </InfoSection>
            )}

            {/* Album en cours */}
            {albumMetadata && (
              <InfoSection title="Album en cours" icon={Disc3} delay={0.3}>
                <div className="bg-gradient-to-br from-card/50 to-card/30 rounded-xl p-4 space-y-3 border border-border/30">
                  <div className="flex items-start gap-4">
                    {albumMetadata.coverUrl && (
                      <img
                        src={albumMetadata.coverUrl}
                        alt={albumMetadata.name}
                        className="w-20 h-20 rounded-lg object-cover ring-2 ring-primary/20 shadow-lg"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-base truncate mb-1">{albumMetadata.name}</h4>
                      <p className="text-sm text-muted-foreground mb-2">{albumMetadata.artist}</p>
                      <div className="flex flex-wrap gap-2 items-center">
                        {albumMetadata.year && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded">
                            <Calendar className="w-3 h-3" />
                            <span>{albumMetadata.year}</span>
                          </div>
                        )}
                        {albumMetadata.trackCount && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded">
                            <Music2 className="w-3 h-3" />
                            <span>{albumMetadata.trackCount} pistes</span>
                          </div>
                        )}
                        {albumMetadata.label && (
                          <div className="text-xs text-muted-foreground/80 bg-muted/30 px-2 py-1 rounded">
                            {albumMetadata.label}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {albumMetadata.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                      {albumMetadata.description}
                    </p>
                  )}

                  {albumMetadata.genres && albumMetadata.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/20">
                      {albumMetadata.genres.slice(0, 4).map((genre, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="text-xs border-primary/20 text-primary/80"
                        >
                          {genre}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </InfoSection>
            )}

            {/* Titre en cours amélioré */}
            {currentTrack && (
              <InfoSection title="Titre en lecture" icon={Zap} delay={0.35}>
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  className="bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/10 rounded-xl p-4 space-y-3 border border-primary/30 shadow-lg relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                  <div className="relative">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-lg overflow-hidden shadow-lg ring-2 ring-primary/20">
                        <img
                          src={getCoverUrl(currentTrack.coverUrl)}
                          alt={currentTrack.album}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-base truncate bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                          {currentTrack.title}
                        </h4>
                        <p className="text-sm text-muted-foreground truncate">{currentTrack.artist}</p>
                        {currentTrack.album && (
                          <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{currentTrack.album}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap pt-2">
                      {currentTrack.genre && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                          {currentTrack.genre}
                        </Badge>
                      )}
                      {currentTrack.year && (
                        <Badge variant="outline" className="text-xs">
                          <Calendar className="w-3 h-3 mr-1" />
                          {currentTrack.year}
                        </Badge>
                      )}
                      {currentTrack.duration > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {Math.floor(currentTrack.duration / 60)}:{(currentTrack.duration % 60).toString().padStart(2, '0')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </motion.div>
              </InfoSection>
            )}

            {/* Artistes similaires améliorés */}
            {artistMetadata?.similarArtists && artistMetadata.similarArtists.length > 0 && (
              <InfoSection title="Artistes similaires" icon={Users} delay={0.4}>
                <div className="flex flex-wrap gap-2">
                  {artistMetadata.similarArtists.slice(0, 12).map((name, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 + idx * 0.02 }}
                      whileHover={{ scale: 1.05 }}
                    >
                      <Badge
                        variant="outline"
                        className="border-border/30 hover:bg-gradient-to-r hover:from-primary/20 hover:to-secondary/20 hover:border-primary/50 hover:text-primary cursor-pointer transition-all px-3 py-1.5"
                      >
                        {name}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </InfoSection>
            )}

            {/* Liens sociaux améliorés */}
            {artistMetadata?.socialLinks && Object.keys(artistMetadata.socialLinks).length > 0 && (
              <InfoSection title="Réseaux sociaux" icon={Globe} delay={0.5}>
                <div className="grid grid-cols-2 gap-2">
                  {artistMetadata.socialLinks.official && (
                    <motion.a
                      href={artistMetadata.socialLinks.official}
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium",
                        "bg-gradient-to-r from-white/5 to-white/5 hover:from-white/10 hover:to-white/10 transition-all",
                        "border border-border/30 hover:border-primary/30 shadow-sm hover:shadow-md"
                      )}
                    >
                      <Globe className="w-4 h-4" />
                      Site officiel
                    </motion.a>
                  )}
                  {artistMetadata.socialLinks.wikipedia && (
                    <motion.a
                      href={artistMetadata.socialLinks.wikipedia}
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium",
                        "bg-gradient-to-r from-white/5 to-white/5 hover:from-white/10 hover:to-white/10 transition-all",
                        "border border-border/30 hover:border-primary/30 shadow-sm hover:shadow-md"
                      )}
                    >
                      <Info className="w-4 h-4" />
                      Wikipedia
                    </motion.a>
                  )}
                  {artistMetadata.socialLinks.youtube && (
                    <motion.a
                      href={artistMetadata.socialLinks.youtube}
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium",
                        "bg-gradient-to-r from-red-500/10 to-red-500/10 hover:from-red-500/20 hover:to-red-500/20 transition-all",
                        "border border-red-500/20 hover:border-red-500/40 text-red-400 shadow-sm hover:shadow-md"
                      )}
                    >
                      <Youtube className="w-4 h-4" />
                      YouTube
                    </motion.a>
                  )}
                  {artistMetadata.socialLinks.instagram && (
                    <motion.a
                      href={artistMetadata.socialLinks.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium",
                        "bg-gradient-to-r from-pink-500/10 to-pink-500/10 hover:from-pink-500/20 hover:to-pink-500/20 transition-all",
                        "border border-pink-500/20 hover:border-pink-500/40 text-pink-400 shadow-sm hover:shadow-md"
                      )}
                    >
                      <Instagram className="w-4 h-4" />
                      Instagram
                    </motion.a>
                  )}
                  {artistMetadata.socialLinks.twitter && (
                    <motion.a
                      href={artistMetadata.socialLinks.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium",
                        "bg-gradient-to-r from-blue-500/10 to-blue-500/10 hover:from-blue-500/20 hover:to-blue-500/20 transition-all",
                        "border border-blue-500/20 hover:border-blue-500/40 text-blue-400 shadow-sm hover:shadow-md"
                      )}
                    >
                      <Twitter className="w-4 h-4" />
                      Twitter
                    </motion.a>
                  )}
                  {artistMetadata.socialLinks.facebook && (
                    <motion.a
                      href={artistMetadata.socialLinks.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium",
                        "bg-gradient-to-r from-blue-600/10 to-blue-600/10 hover:from-blue-600/20 hover:to-blue-600/20 transition-all",
                        "border border-blue-600/20 hover:border-blue-600/40 text-blue-400 shadow-sm hover:shadow-md"
                      )}
                    >
                      <Facebook className="w-4 h-4" />
                      Facebook
                    </motion.a>
                  )}
                </div>
              </InfoSection>
            )}

            {/* Source */}
            {artistMetadata?.source && (
              <div className="text-center text-xs text-muted-foreground/50 pt-4 border-t border-white/5">
                Données fournies par {artistMetadata.source}
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  )
})

ArtistInfoPanel.displayName = "ArtistInfoPanel"

export default ArtistInfoPanel

