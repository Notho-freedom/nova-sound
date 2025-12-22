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
import type { Track } from "@/types/music"

interface ArtistInfoPanelProps {
  isOpen: boolean
  onClose: () => void
  currentTrack: Track | null
  onNavigateToArtist?: () => void
  onPlayTrack?: (track: Track) => void
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

export const ArtistInfoPanel = memo(({ isOpen, onClose, currentTrack, onNavigateToArtist, onPlayTrack }: ArtistInfoPanelProps) => {
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
    const playCount = history
      .filter(h => artistTracks.some(t => t.id === h.trackId))
      .reduce((sum, h) => sum + (h.playCount || 1), 0)

    // Grouper par album
    const albumsMap = new Map<string, { name: string; coverUrl: string; tracks: Track[]; year?: number }>()
    artistTracks.forEach(track => {
      if (!track.album) return
      const key = `${track.album}-${track.artist}`
      if (!albumsMap.has(key)) {
        albumsMap.set(key, {
          name: track.album,
          coverUrl: track.coverUrl,
          tracks: [],
          year: track.year
        })
      }
      albumsMap.get(key)!.tracks.push(track)
    })

    return {
      trackCount: artistTracks.length,
      albumCount: albums.size,
      totalDuration,
      playCount,
      albums: Array.from(albumsMap.values()).sort((a, b) => {
        // Trier par année si disponible, sinon par nom
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
    <div className="h-full w-full bg-gradient-to-b from-card via-card to-background border-l border-border/30 flex flex-col">
      {/* Header */}
      <div className="relative p-4 border-b border-border/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg">{artistName || "Artiste"}</h2>
                    <p className="text-xs text-muted-foreground">Profil & informations</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Fermer le panel"
                  className={cn(
                    "p-2 rounded-full transition-all",
                    "text-muted-foreground hover:text-foreground",
                    "hover:bg-muted/40 active:scale-95"
                  )}
                >
                  <X className="w-5 h-5" />
                  </button>
        </div>
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

            {/* Statistiques de la bibliothèque */}
            {artistStats && artistStats.trackCount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.4 }}
                className="grid grid-cols-3 gap-3"
              >
                <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Music2 className="w-4 h-4 text-primary" />
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Titres</span>
                  </div>
                  <p className="text-2xl font-bold">{artistStats.trackCount}</p>
                </div>
                <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 rounded-xl p-4 border border-secondary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Disc3 className="w-4 h-4 text-secondary" />
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Albums</span>
                  </div>
                  <p className="text-2xl font-bold">{artistStats.albumCount}</p>
                </div>
                <div className="bg-gradient-to-br from-accent/10 to-accent/5 rounded-xl p-4 border border-accent/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-accent" />
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Durée</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {Math.floor(artistStats.totalDuration / 60)}m
                  </p>
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

            {/* Albums de la bibliothèque */}
            {artistStats && artistStats.albums.length > 0 && (
              <InfoSection title="Albums dans votre bibliothèque" icon={Disc3} delay={0.15}>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {artistStats.albums.slice(0, 5).map((album: { name: string; coverUrl: string; tracks: Track[]; year?: number }, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors group cursor-pointer"
                      onClick={() => {
                        if (onPlayTrack && album.tracks.length > 0) {
                          onPlayTrack(album.tracks[0])
                        }
                      }}
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={getCoverUrl(album.coverUrl)}
                          alt={album.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                          {album.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {album.tracks.length} titre{album.tracks.length > 1 ? 's' : ''}
                          {album.year && ` • ${album.year}`}
                        </p>
                      </div>
                      <Play className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                  {artistStats.albums.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      + {artistStats.albums.length - 5} autre{artistStats.albums.length - 5 > 1 ? 's' : ''} album{artistStats.albums.length - 5 > 1 ? 's' : ''}
                    </p>
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

                  {/* Titre en cours */}
                  <InfoSection title="Titre en lecture" icon={Music2} delay={0.4}>
                    <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl p-4 space-y-3 border border-primary/20">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                          <Music2 className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold truncate">{currentTrack.title}</h4>
                          <p className="text-sm text-muted-foreground truncate">{currentTrack.artist}</p>
                        </div>
                      </div>
                      {currentTrack.genre && (
                        <Badge variant="secondary" className="bg-white/5">
                          {currentTrack.genre}
                        </Badge>
                      )}
                    </div>
            </InfoSection>

            {/* Artistes similaires */}
            {artistMetadata?.similarArtists && artistMetadata.similarArtists.length > 0 && (
              <InfoSection title="Artistes similaires" icon={Users} delay={0.5}>
                <div className="flex flex-wrap gap-2">
                  {artistMetadata.similarArtists.slice(0, 10).map((name, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="border-border/30 hover:bg-primary/10 hover:border-primary/30 hover:text-primary cursor-pointer transition-all hover:scale-105"
                    >
                      {name}
                    </Badge>
                  ))}
                </div>
              </InfoSection>
            )}

            {/* Liens sociaux */}
            {artistMetadata?.socialLinks && Object.keys(artistMetadata.socialLinks).length > 0 && (
              <InfoSection title="Réseaux sociaux" icon={Globe} delay={0.6}>
                <div className="grid grid-cols-2 gap-2">
                  {artistMetadata.socialLinks.official && (
                    <a
                      href={artistMetadata.socialLinks.official}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium",
                        "bg-white/5 hover:bg-white/10 transition-all hover:scale-[1.02]",
                        "border border-border/30"
                      )}
                    >
                      <Globe className="w-4 h-4" />
                      Site officiel
                    </a>
                  )}
                  {artistMetadata.socialLinks.wikipedia && (
                    <a
                      href={artistMetadata.socialLinks.wikipedia}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium",
                        "bg-white/5 hover:bg-white/10 transition-all hover:scale-[1.02]",
                        "border border-border/30"
                      )}
                    >
                      <Info className="w-4 h-4" />
                      Wikipedia
                    </a>
                  )}
                  {artistMetadata.socialLinks.youtube && (
                    <a
                      href={artistMetadata.socialLinks.youtube}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium",
                        "bg-red-500/10 hover:bg-red-500/20 transition-all hover:scale-[1.02]",
                        "border border-red-500/20 text-red-400"
                      )}
                    >
                      <Youtube className="w-4 h-4" />
                      YouTube
                    </a>
                  )}
                  {artistMetadata.socialLinks.instagram && (
                    <a
                      href={artistMetadata.socialLinks.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium",
                        "bg-pink-500/10 hover:bg-pink-500/20 transition-all hover:scale-[1.02]",
                        "border border-pink-500/20 text-pink-400"
                      )}
                    >
                      <Instagram className="w-4 h-4" />
                      Instagram
                    </a>
                  )}
                  {artistMetadata.socialLinks.twitter && (
                    <a
                      href={artistMetadata.socialLinks.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium",
                        "bg-blue-500/10 hover:bg-blue-500/20 transition-all hover:scale-[1.02]",
                        "border border-blue-500/20 text-blue-400"
                      )}
                    >
                      <Twitter className="w-4 h-4" />
                      Twitter
                    </a>
                  )}
                  {artistMetadata.socialLinks.facebook && (
                    <a
                      href={artistMetadata.socialLinks.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium",
                        "bg-blue-600/10 hover:bg-blue-600/20 transition-all hover:scale-[1.02]",
                        "border border-blue-600/20 text-blue-400"
                      )}
                    >
                      <Facebook className="w-4 h-4" />
                      Facebook
                    </a>
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
