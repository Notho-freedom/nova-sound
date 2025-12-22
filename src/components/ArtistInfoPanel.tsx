"use client"

import { useState, useEffect, useCallback, memo } from "react"
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useArtistMetadata, useAlbumMetadata } from "@/hooks/useArtistMetadata"
import { useArtistImages } from "@/hooks/useArtistImage"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import type { Track } from "@/types/music"

interface ArtistInfoPanelProps {
  isOpen: boolean
  onClose: () => void
  currentTrack: Track | null
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

export const ArtistInfoPanel = memo(({ isOpen, onClose, currentTrack }: ArtistInfoPanelProps) => {
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

  const isLoading = isLoadingArtist || isLoadingAlbum || isLoadingImages

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={cn(
              "fixed right-0 top-0 bottom-0 w-full max-w-md z-50",
              "bg-gradient-to-b from-card via-card to-background",
              "border-l border-white/10 shadow-2xl"
            )}
          >
            {/* Header */}
            <div className="relative p-4 border-b border-white/10">
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
                  className={cn(
                    "p-2 rounded-full transition-all",
                    "text-muted-foreground hover:text-foreground",
                    "hover:bg-white/10 active:scale-95"
                  )}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <ScrollArea className="h-[calc(100vh-80px)]">
              {!currentTrack ? (
                <div className="flex flex-col items-center justify-center h-64 text-center p-6">
                  <Music2 className="w-12 h-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">Aucune piste en lecture</p>
                </div>
              ) : isLoading ? (
                <LoadingSkeleton />
              ) : (
                <div className="p-6 space-y-8">
                  {/* Carrousel d'images */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                  >
                    <ImageCarousel images={images} artistName={artistName} />
                  </motion.div>

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
                          {artistMetadata.genres.slice(0, 5).map((genre, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="bg-primary/10 text-primary border-primary/20"
                            >
                              {genre}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Infos de base */}
                      <div className="grid grid-cols-2 gap-3">
                        {artistMetadata.origin && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="w-4 h-4 text-primary" />
                            <span>{artistMetadata.origin}</span>
                          </div>
                        )}
                        {artistMetadata.country && !artistMetadata.origin && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Globe className="w-4 h-4 text-primary" />
                            <span>{artistMetadata.country}</span>
                          </div>
                        )}
                        {artistMetadata.birthDate && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4 text-primary" />
                            <span>{new Date(artistMetadata.birthDate).getFullYear()}</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
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
                      <div className="bg-white/5 rounded-xl p-4 space-y-3">
                        <div className="flex items-start gap-4">
                          {albumMetadata.coverUrl && (
                            <img
                              src={albumMetadata.coverUrl}
                              alt={albumMetadata.name}
                              className="w-20 h-20 rounded-lg object-cover ring-1 ring-white/10"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold truncate">{albumMetadata.name}</h4>
                            <p className="text-sm text-muted-foreground">{albumMetadata.artist}</p>
                            {albumMetadata.year && (
                              <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                                <Calendar className="w-3 h-3" />
                                <span>{albumMetadata.year}</span>
                              </div>
                            )}
                            {albumMetadata.label && (
                              <p className="text-xs text-muted-foreground/60 mt-1">
                                Label: {albumMetadata.label}
                              </p>
                            )}
                          </div>
                        </div>

                        {albumMetadata.description && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {albumMetadata.description.slice(0, 200)}
                            {albumMetadata.description.length > 200 && "..."}
                          </p>
                        )}

                        {albumMetadata.genres && albumMetadata.genres.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {albumMetadata.genres.slice(0, 3).map((genre, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="text-xs border-white/10"
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
                        {artistMetadata.similarArtists.slice(0, 8).map((name, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="border-white/10 hover:bg-white/5 cursor-pointer transition-colors"
                          >
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </InfoSection>
                  )}

                  {/* Liens */}
                  {artistMetadata?.socialLinks && Object.keys(artistMetadata.socialLinks).length > 0 && (
                    <InfoSection title="Liens" icon={Globe} delay={0.6}>
                      <div className="flex flex-wrap gap-2">
                        {artistMetadata.socialLinks.official && (
                          <a
                            href={artistMetadata.socialLinks.official}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs",
                              "bg-white/5 hover:bg-white/10 transition-colors"
                            )}
                          >
                            <Globe className="w-3 h-3" />
                            Site officiel
                          </a>
                        )}
                        {artistMetadata.socialLinks.wikipedia && (
                          <a
                            href={artistMetadata.socialLinks.wikipedia}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs",
                              "bg-white/5 hover:bg-white/10 transition-colors"
                            )}
                          >
                            <Info className="w-3 h-3" />
                            Wikipedia
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
})

ArtistInfoPanel.displayName = "ArtistInfoPanel"

export default ArtistInfoPanel
