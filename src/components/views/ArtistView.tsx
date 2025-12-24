"use client";

import { useState, useMemo, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  Shuffle,
  Heart,
  Share2,
  MoreHorizontal,
  Music,
  Disc3,
  Clock,
  Calendar,
  MapPin,
  Globe,
  Users,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Image as ImageIcon,
  Info,
  Sparkles,
  TrendingUp,
  X,
  ListMusic,
  Loader2,
} from "lucide-react";
import { Track } from "@/types/music";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useFavorites } from "@/hooks/useFavorites";
import { useArtistMetadata } from "@/hooks/useArtistMetadata";
import { useArtistImages } from "@/hooks/useArtistImage";
import { useArtistPlaylists } from "@/hooks/useArtistPlaylists";
import { ContentCarousel } from "@/components/ui/ContentCarousel";
import { FeaturedCard } from "@/components/ui/FeaturedCard";

interface ArtistViewProps {
  artistName: string;
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onTrackSelect: (index: number) => void;
  onPlayNext?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  onPlayTrackList?: (tracks: Track[], startIndex?: number) => void;
  onAddToPlaylist?: (playlistId: string, track: Track) => void;
  onBack?: () => void;
  onAlbumClick?: (albumName: string, artistName: string) => void;
  onArtistClick?: (artistName: string) => void;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes} min`;
};

// Social icon components
const SocialIcon = ({ type, url }: { type: string; url: string }) => {
  const icons: Record<string, JSX.Element> = {
    wikipedia: <Globe className="w-4 h-4" />,
    official: <Globe className="w-4 h-4" />,
    facebook: <span className="text-xs font-bold">f</span>,
    twitter: <span className="text-xs font-bold">𝕏</span>,
    instagram: <span className="text-xs font-bold">IG</span>,
    youtube: <span className="text-xs font-bold">▶</span>,
  };

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "w-9 h-9 rounded-full flex items-center justify-center",
        "bg-muted/50 hover:bg-primary hover:text-primary-foreground",
        "transition-all duration-200"
      )}
      title={type.charAt(0).toUpperCase() + type.slice(1)}
    >
      {icons[type] || <ExternalLink className="w-4 h-4" />}
    </a>
  );
};

export const ArtistView = memo(({
  artistName,
  tracks,
  currentTrackIndex,
  isPlaying,
  onTrackSelect,
  onPlayNext,
  onAddToQueue,
  onPlayTrackList,
  onAddToPlaylist,
  onBack,
  onAlbumClick,
  onArtistClick,
}: ArtistViewProps) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<number | null>(null);
  const [showFullBio, setShowFullBio] = useState(false);

  // Hooks
  const playlistsResult = usePlaylists();
  const playlists = playlistsResult?.playlists ?? [];
  const createPlaylist = playlistsResult?.createPlaylist ?? (async () => null);
  const { isFavorite, toggleFavorite } = useFavorites();

  // Fetch artist metadata
  const { metadata, isLoading: metadataLoading } = useArtistMetadata({
    artistName,
    enabled: !!artistName,
    combined: true,
  });

  // Fetch artist gallery images
  const { images: galleryImages, isLoading: imagesLoading } = useArtistImages({
    query: artistName,
    limit: 20,
    enabled: !!artistName,
  });

  // Fetch artist playlists from YouTube
  const { 
    playlists: artistPlaylists, 
    loading: playlistsLoading, 
    loadPlaylistVideos,
    loadingPlaylistId,
  } = useArtistPlaylists({
    artistName,
    enabled: !!artistName,
    maxPlaylists: 10,
  });

  // State for expanded playlist
  const [expandedPlaylistId, setExpandedPlaylistId] = useState<string | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);

  // Get artist tracks from the library
  const artistTracks = useMemo(() => {
    return tracks.filter(t => t.artist.toLowerCase() === artistName.toLowerCase());
  }, [tracks, artistName]);

  // Get albums
  const albums = useMemo(() => {
    const albumsMap = new Map<string, { 
      name: string; 
      coverUrl: string; 
      year?: number;
      tracks: Track[];
      totalDuration: number;
    }>();
    
    artistTracks.forEach(track => {
      const key = track.album || "Singles";
      if (!albumsMap.has(key)) {
        albumsMap.set(key, { 
          name: key, 
          coverUrl: track.coverUrl, 
          year: track.year,
          tracks: [],
          totalDuration: 0,
        });
      }
      const album = albumsMap.get(key)!;
      album.tracks.push(track);
      album.totalDuration += track.duration;
    });
    
    return Array.from(albumsMap.values())
      .sort((a, b) => (b.year || 0) - (a.year || 0));
  }, [artistTracks]);

  // Get popular tracks (sort by some metric - here we just take first 5)
  const popularTracks = useMemo(() => {
    return artistTracks.slice(0, 5);
  }, [artistTracks]);

  // Get total stats
  const stats = useMemo(() => ({
    totalTracks: artistTracks.length,
    totalAlbums: albums.length,
    totalDuration: artistTracks.reduce((sum, t) => sum + t.duration, 0),
    genres: [...new Set(artistTracks.flatMap(t => t.genre ? [t.genre] : []))],
  }), [artistTracks, albums]);

  // Get similar artists from metadata
  const similarArtists = useMemo(() => {
    if (!metadata?.similarArtists) return [];
    return metadata.similarArtists.slice(0, 6);
  }, [metadata]);

  // Handlers
  const handlePlayAll = useCallback(() => {
    if (artistTracks.length > 0) {
      const firstTrack = artistTracks[0];
      const idx = tracks.findIndex(t => t.id === firstTrack.id);
      if (idx !== -1) onTrackSelect(idx);
    }
  }, [artistTracks, tracks, onTrackSelect]);

  const handleShuffle = useCallback(() => {
    if (artistTracks.length > 0) {
      const shuffled = [...artistTracks].sort(() => Math.random() - 0.5);
      const idx = tracks.findIndex(t => t.id === shuffled[0].id);
      if (idx !== -1) onTrackSelect(idx);
    }
  }, [artistTracks, tracks, onTrackSelect]);

  // Get cover image - priority: metadata, gallery, first track
  const coverImage = useMemo(() => {
    if (metadata?.imageUrl) return metadata.imageUrl;
    if (galleryImages.length > 0) return galleryImages[0].url;
    if (artistTracks[0]?.coverUrl) return getCoverUrl(artistTracks[0].coverUrl);
    return null;
  }, [metadata, galleryImages, artistTracks]);

  // Loading state
  if (metadataLoading && artistTracks.length === 0) {
    return (
      <div className="p-6 space-y-8">
        <div className="flex items-start gap-6">
          <Skeleton className="w-48 h-48 rounded-full" />
          <div className="flex-1 space-y-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-96" />
            <Skeleton className="h-4 w-48" />
            <div className="flex gap-3">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  // Empty state
  if (artistTracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <Users className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Artiste non trouvé</h2>
        <p className="text-muted-foreground text-center max-w-md mb-4">
          Aucune musique de "{artistName}" n'a été trouvée dans votre bibliothèque.
        </p>
        {onBack && (
          <Button onClick={onBack} variant="outline">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="pb-8 overflow-hidden">
      {/* Hero Section */}
      <div className="relative">
        {/* Background gradient with image */}
        <div className="absolute inset-0 h-[400px] overflow-hidden">
          {coverImage && (
            <img
              src={coverImage}
              alt=""
              className="w-full h-full object-cover opacity-30 blur-2xl scale-110"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/80 to-background" />
        </div>

        {/* Content */}
        <div className="relative px-6 pt-8 pb-6">
          {/* Back button */}
          {onBack && (
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={onBack}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group mb-6"
            >
              <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              Retour
            </motion.button>
          )}

          {/* Artist Header */}
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-end">
            {/* Artist Image */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative"
            >
              <div className="w-48 h-48 md:w-56 md:h-56 rounded-full overflow-hidden shadow-2xl ring-4 ring-primary/20 bg-gradient-to-br from-primary/30 to-secondary/30">
                {coverImage ? (
                  <img
                    src={coverImage}
                    alt={artistName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Users className="w-24 h-24 text-muted-foreground/50" />
                  </div>
                )}
              </div>
              {metadata?.source && (
                <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs">
                  {metadata.source}
                </Badge>
              )}
            </motion.div>

            {/* Artist Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-center md:text-left flex-1"
            >
              <Badge variant="secondary" className="mb-2">Artiste</Badge>
              <h1 className="font-display text-4xl md:text-5xl font-bold mb-3">
                {artistName}
              </h1>

              {/* Quick stats */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-muted-foreground mb-4">
                <span className="flex items-center gap-1.5">
                  <Disc3 className="w-4 h-4" />
                  {stats.totalAlbums} album{stats.totalAlbums > 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1.5">
                  <Music className="w-4 h-4" />
                  {stats.totalTracks} titre{stats.totalTracks > 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {formatDuration(stats.totalDuration)}
                </span>
                {metadata?.origin && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    {metadata.origin}
                  </span>
                )}
              </div>

              {/* Genres */}
              {(metadata?.genres || stats.genres).length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-4">
                  {(metadata?.genres || stats.genres).slice(0, 5).map(genre => (
                    <Badge key={genre} variant="outline" className="text-xs">
                      {genre}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <Button onClick={handlePlayAll} size="lg" className="gap-2">
                  <Play className="w-5 h-5 fill-current" />
                  Lecture
                </Button>
                <Button onClick={handleShuffle} variant="outline" size="lg" className="gap-2">
                  <Shuffle className="w-5 h-5" />
                  Aléatoire
                </Button>
                <Button variant="ghost" size="lg" className="gap-2">
                  <Heart className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="lg" className="gap-2">
                  <Share2 className="w-5 h-5" />
                </Button>
              </div>

              {/* Social links */}
              {metadata?.socialLinks && Object.keys(metadata.socialLinks).length > 0 && (
                <div className="flex gap-2 mt-4 justify-center md:justify-start">
                  {Object.entries(metadata.socialLinks).map(([type, url]) => (
                    url && <SocialIcon key={type} type={type} url={url} />
                  ))}
                </div>
              )}

              {/* Tabs Navigation - in hero */}
              <div className="mt-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="bg-background/50 backdrop-blur-sm">
                    <TabsTrigger value="overview" className="gap-2">
                      <Sparkles className="w-4 h-4" />
                      Vue d'ensemble
                    </TabsTrigger>
                    <TabsTrigger value="discography" className="gap-2">
                      <Disc3 className="w-4 h-4" />
                      Discographie
                    </TabsTrigger>
                    <TabsTrigger value="about" className="gap-2">
                      <Info className="w-4 h-4" />
                      À propos
                    </TabsTrigger>
                    <TabsTrigger value="playlists" className="gap-2">
                      <ListMusic className="w-4 h-4" />
                      Playlists
                    </TabsTrigger>
                    <TabsTrigger value="gallery" className="gap-2">
                      <ImageIcon className="w-4 h-4" />
                      Galerie
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Tabs Content Section */}
      <div className="px-6 mt-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Hidden TabsList for state sync */}
          <TabsList className="hidden">
            <TabsTrigger value="overview" />
            <TabsTrigger value="discography" />
            <TabsTrigger value="about" />
            <TabsTrigger value="playlists" />
            <TabsTrigger value="gallery" />
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-8 mt-24">
            {/* Popular Tracks */}
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Titres populaires
              </h2>
              <div className="bg-card/30 backdrop-blur-sm rounded-xl border border-border/30 overflow-hidden">
                <table className="w-full">
                  <tbody>
                    {popularTracks.map((track, idx) => {
                      const actualIndex = tracks.findIndex(t => t.id === track.id);
                      const isCurrentTrack = currentTrackIndex === actualIndex;

                      return (
                        <tr
                          key={track.id}
                          onClick={() => actualIndex !== -1 && onTrackSelect(actualIndex)}
                          className={cn(
                            "group cursor-pointer transition-colors",
                            isCurrentTrack ? "bg-primary/10" : "hover:bg-muted/40"
                          )}
                        >
                          <td className="w-12 px-4 py-3 text-center">
                            {isCurrentTrack && isPlaying ? (
                              <div className="flex items-center justify-center gap-0.5">
                                <div className="w-1 h-4 bg-primary rounded-full animate-pulse" />
                                <div className="w-1 h-3 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.1s' }} />
                                <div className="w-1 h-4 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                              </div>
                            ) : (
                              <>
                                <span className="text-sm text-muted-foreground group-hover:hidden">{idx + 1}</span>
                                <Play className="w-4 h-4 hidden group-hover:block fill-current" />
                              </>
                            )}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
                                <img
                                  src={getCoverUrl(track.coverUrl)}
                                  alt={track.album}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className={cn(
                                  "font-medium truncate",
                                  isCurrentTrack ? "text-primary" : "text-foreground"
                                )}>
                                  {track.title}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {track.album}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-muted-foreground font-mono">
                            {formatTime(track.duration)}
                          </td>
                          <td className="px-4 py-3">
                            <TrackContextMenu
                              track={track}
                              playlists={playlists}
                              isFavorite={isFavorite(track.id)}
                              onPlay={() => actualIndex !== -1 && onTrackSelect(actualIndex)}
                              onPlayNext={() => onPlayNext?.(track)}
                              onAddToQueue={() => onAddToQueue?.(track)}
                              onAddToPlaylist={(playlistId) => onAddToPlaylist?.(playlistId, track)}
                              onCreatePlaylist={() => createPlaylist("Nouvelle playlist", [track.id])}
                              onToggleFavorite={() => toggleFavorite(track.id)}
                            >
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                title="Plus d'options"
                                aria-label="Plus d'options"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                            </TrackContextMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {artistTracks.length > 5 && (
                <Button
                  variant="ghost"
                  className="mt-3"
                  onClick={() => setActiveTab("discography")}
                >
                  Voir tous les titres ({artistTracks.length})
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </section>

            {/* Albums Carousel */}
            {albums.length > 0 && (
              <section className="overflow-hidden -mx-6">
                <div className="px-6">
                  <ContentCarousel
                    title="Albums"
                    subtitle={`${albums.length} album${albums.length > 1 ? 's' : ''}`}
                    icon={<Disc3 className="w-5 h-5 text-primary" />}
                  >
                    {albums.map((album) => (
                      <FeaturedCard
                        key={album.name}
                        title={album.name}
                        subtitle={album.year ? String(album.year) : `${album.tracks.length} titres`}
                        imageUrl={getCoverUrl(album.coverUrl)}
                        onClick={() => onAlbumClick?.(album.name, artistName)}
                        onPlay={() => {
                          const idx = tracks.findIndex(t => t.id === album.tracks[0].id);
                          if (idx !== -1) onTrackSelect(idx);
                        }}
                        size="md"
                        className="snap-start"
                      />
                    ))}
                  </ContentCarousel>
                </div>
              </section>
            )}

            {/* Similar Artists */}
            {similarArtists.length > 0 && (
              <section className="overflow-hidden -mx-6">
                <div className="px-6">
                  <ContentCarousel
                    title="Artistes similaires"
                    subtitle="Découvrez des artistes similaires"
                    icon={<Users className="w-5 h-5 text-secondary" />}
                  >
                    {similarArtists.map((artist) => (
                      <motion.button
                        key={artist}
                        whileHover={{ scale: 1.03 }}
                        onClick={() => onArtistClick?.(artist)}
                        className="flex-shrink-0 snap-start text-center group"
                      >
                        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-2 group-hover:ring-2 ring-primary transition-all">
                          <Users className="w-12 h-12 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium truncate max-w-[128px]">{artist}</p>
                      </motion.button>
                    ))}
                  </ContentCarousel>
                </div>
              </section>
            )}
          </TabsContent>

          {/* Discography Tab */}
          <TabsContent value="discography" className="space-y-8 mt-24">
            {albums.map((album) => (
              <section key={album.name} className="space-y-4">
                <div className="flex items-center gap-4">
                  <div
                    className="w-20 h-20 rounded-lg overflow-hidden cursor-pointer hover:ring-2 ring-primary transition-all"
                    onClick={() => onAlbumClick?.(album.name, artistName)}
                  >
                    <img
                      src={getCoverUrl(album.coverUrl)}
                      alt={album.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{album.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {album.year && `${album.year} • `}
                      {album.tracks.length} titre{album.tracks.length > 1 ? 's' : ''} •{' '}
                      {formatDuration(album.totalDuration)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="ml-auto gap-2"
                    onClick={() => {
                      const idx = tracks.findIndex(t => t.id === album.tracks[0].id);
                      if (idx !== -1) onTrackSelect(idx);
                    }}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Lecture
                  </Button>
                </div>

                <div className="bg-card/30 backdrop-blur-sm rounded-xl border border-border/30 overflow-hidden">
                  <table className="w-full">
                    <tbody>
                      {album.tracks.map((track, idx) => {
                        const actualIndex = tracks.findIndex(t => t.id === track.id);
                        const isCurrentTrack = currentTrackIndex === actualIndex;

                        return (
                          <tr
                            key={track.id}
                            onClick={() => actualIndex !== -1 && onTrackSelect(actualIndex)}
                            className={cn(
                              "group cursor-pointer transition-colors",
                              isCurrentTrack ? "bg-primary/10" : "hover:bg-muted/40"
                            )}
                          >
                            <td className="w-12 px-4 py-2.5 text-center">
                              <span className="text-sm text-muted-foreground group-hover:hidden">
                                {idx + 1}
                              </span>
                              <Play className="w-4 h-4 hidden group-hover:block mx-auto fill-current" />
                            </td>
                            <td className="py-2.5">
                              <p className={cn(
                                "font-medium",
                                isCurrentTrack ? "text-primary" : "text-foreground"
                              )}>
                                {track.title}
                              </p>
                            </td>
                            <td className="px-4 py-2.5 text-right text-sm text-muted-foreground font-mono">
                              {formatTime(track.duration)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </TabsContent>

          {/* About Tab */}
          <TabsContent value="about" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Biography */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-card/30 backdrop-blur-sm rounded-xl border border-border/30 p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Info className="w-5 h-5 text-primary" />
                    Biographie
                  </h3>
                  {metadataLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ) : metadata?.biography ? (
                    <div>
                      <p className={cn(
                        "text-muted-foreground leading-relaxed whitespace-pre-line",
                        !showFullBio && "line-clamp-6"
                      )}>
                        {metadata.biography}
                      </p>
                      {metadata.biography.length > 500 && (
                        <Button
                          variant="link"
                          className="mt-2 p-0 h-auto"
                          onClick={() => setShowFullBio(!showFullBio)}
                        >
                          {showFullBio ? "Voir moins" : "Lire la suite"}
                        </Button>
                      )}
                      {metadata.biographyUrl && (
                        <a
                          href={metadata.biographyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary text-sm hover:underline inline-flex items-center gap-1 mt-2"
                        >
                          Source: {metadata.source}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      Aucune biographie disponible pour cet artiste.
                    </p>
                  )}
                </div>
              </div>

              {/* Quick Info Sidebar */}
              <div className="space-y-4">
                <div className="bg-card/30 backdrop-blur-sm rounded-xl border border-border/30 p-6">
                  <h3 className="text-lg font-semibold mb-4">Informations</h3>
                  <dl className="space-y-3">
                    {metadata?.origin && (
                      <div>
                        <dt className="text-xs text-muted-foreground uppercase tracking-wider">Origine</dt>
                        <dd className="text-sm font-medium flex items-center gap-2 mt-1">
                          <MapPin className="w-4 h-4 text-primary" />
                          {metadata.origin}
                        </dd>
                      </div>
                    )}
                    {metadata?.yearsActive && (
                      <div>
                        <dt className="text-xs text-muted-foreground uppercase tracking-wider">Années d'activité</dt>
                        <dd className="text-sm font-medium flex items-center gap-2 mt-1">
                          <Calendar className="w-4 h-4 text-primary" />
                          {metadata.yearsActive}
                        </dd>
                      </div>
                    )}
                    {metadata?.birthDate && (
                      <div>
                        <dt className="text-xs text-muted-foreground uppercase tracking-wider">Date de naissance</dt>
                        <dd className="text-sm font-medium mt-1">{metadata.birthDate}</dd>
                      </div>
                    )}
                    {metadata?.website && (
                      <div>
                        <dt className="text-xs text-muted-foreground uppercase tracking-wider">Site officiel</dt>
                        <dd className="text-sm font-medium mt-1">
                          <a
                            href={metadata.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                          >
                            Visiter
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Library Stats */}
                <div className="bg-card/30 backdrop-blur-sm rounded-xl border border-border/30 p-6">
                  <h3 className="text-lg font-semibold mb-4">Dans votre bibliothèque</h3>
                  <dl className="space-y-3">
                    <div className="flex justify-between items-center">
                      <dt className="text-sm text-muted-foreground">Albums</dt>
                      <dd className="text-sm font-medium">{stats.totalAlbums}</dd>
                    </div>
                    <div className="flex justify-between items-center">
                      <dt className="text-sm text-muted-foreground">Titres</dt>
                      <dd className="text-sm font-medium">{stats.totalTracks}</dd>
                    </div>
                    <div className="flex justify-between items-center">
                      <dt className="text-sm text-muted-foreground">Durée totale</dt>
                      <dd className="text-sm font-medium">{formatDuration(stats.totalDuration)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Playlists Tab */}
          <TabsContent value="playlists" className="mt-0">
            {playlistsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            ) : artistPlaylists.length > 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground mb-4">
                  {artistPlaylists.length} playlist{artistPlaylists.length > 1 ? 's' : ''} trouvée{artistPlaylists.length > 1 ? 's' : ''} sur YouTube
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {artistPlaylists.map((playlist) => (
                    <motion.div
                      key={playlist.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "bg-card/30 backdrop-blur-sm rounded-xl border transition-all overflow-hidden",
                        expandedPlaylistId === playlist.id
                          ? "border-primary/50 col-span-full"
                          : "border-border/30 hover:border-primary/30 cursor-pointer"
                      )}
                    >
                      {/* Playlist Header */}
                      <div
                        className="flex items-center gap-4 p-4"
                        onClick={async () => {
                          if (expandedPlaylistId === playlist.id) {
                            setExpandedPlaylistId(null);
                            setPlaylistTracks([]);
                          } else {
                            setExpandedPlaylistId(playlist.id);
                            const tracks = await loadPlaylistVideos(playlist.id);
                            setPlaylistTracks(tracks);
                          }
                        }}
                      >
                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-muted relative group">
                          {playlist.thumbnailUrl ? (
                            <img
                              src={playlist.thumbnailUrl}
                              alt={playlist.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
                              <ListMusic className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                          {loadingPlaylistId === playlist.id && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <Loader2 className="w-5 h-5 animate-spin text-white" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{playlist.title}</h4>
                          <p className="text-sm text-muted-foreground truncate">
                            {playlist.channelTitle}
                          </p>
                          <p className="text-xs text-muted-foreground/70">
                            {playlist.itemCount > 0 ? `${playlist.itemCount} vidéos` : 'Playlist YouTube'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-9 w-9 p-0"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const tracks = await loadPlaylistVideos(playlist.id);
                              if (tracks.length > 0) {
                                onPlayTrackList?.(tracks, 0);
                              }
                            }}
                          >
                            <Play className="w-4 h-4 fill-current" />
                          </Button>
                          <ChevronRight 
                            className={cn(
                              "w-4 h-4 text-muted-foreground transition-transform",
                              expandedPlaylistId === playlist.id && "rotate-90"
                            )}
                          />
                        </div>
                      </div>

                      {/* Expanded Playlist Content */}
                      <AnimatePresence>
                        {expandedPlaylistId === playlist.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-border/30"
                          >
                            {loadingPlaylistId === playlist.id ? (
                              <div className="p-6 flex items-center justify-center">
                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                <span className="ml-2 text-sm text-muted-foreground">Chargement...</span>
                              </div>
                            ) : playlistTracks.length > 0 ? (
                              <div className="max-h-[400px] overflow-y-auto">
                                <table className="w-full">
                                  <tbody>
                                    {playlistTracks.map((track, idx) => (
                                      <tr
                                        key={`pl-track-${idx}-${track.id}`}
                                        className="group cursor-pointer hover:bg-muted/40 transition-colors"
                                        onClick={() => {
                                          onPlayTrackList?.(playlistTracks, idx);
                                        }}
                                      >
                                        <td className="w-12 px-4 py-2.5 text-center">
                                          <span className="text-sm text-muted-foreground group-hover:hidden">
                                            {idx + 1}
                                          </span>
                                          <Play className="w-4 h-4 hidden group-hover:block mx-auto fill-current" />
                                        </td>
                                        <td className="py-2.5">
                                          <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
                                              <img
                                                src={getCoverUrl(track.coverUrl)}
                                                alt=""
                                                className="w-full h-full object-cover"
                                              />
                                            </div>
                                            <div className="min-w-0">
                                              <p className="font-medium truncate">{track.title}</p>
                                              <p className="text-xs text-muted-foreground truncate">
                                                {track.artist}
                                              </p>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-sm text-muted-foreground font-mono">
                                          {formatTime(track.duration)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="p-6 text-center text-muted-foreground text-sm">
                                Aucune vidéo trouvée dans cette playlist
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ListMusic className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucune playlist</h3>
                <p className="text-muted-foreground text-sm max-w-md">
                  Aucune playlist YouTube n'a été trouvée pour "{artistName}".
                </p>
              </div>
            )}
          </TabsContent>

          {/* Gallery Tab */}
          <TabsContent value="gallery" className="mt-0">
            {imagesLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-xl" />
                ))}
              </div>
            ) : galleryImages.length > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {galleryImages.map((image, idx) => (
                    <motion.button
                      key={`gallery-${idx}-${image.url}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => setSelectedGalleryImage(idx)}
                      className="aspect-square rounded-xl overflow-hidden bg-muted group"
                      title={`Image ${idx + 1}`}
                    >
                      <img
                        src={image.thumbnailUrl || image.url}
                        alt={`${artistName} - ${idx + 1}`}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        loading="lazy"
                      />
                    </motion.button>
                  ))}
                </div>

                {/* Lightbox */}
                <AnimatePresence>
                  {selectedGalleryImage !== null && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                      onClick={() => setSelectedGalleryImage(null)}
                    >
                      <button
                        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors"
                        onClick={() => setSelectedGalleryImage(null)}
                        title="Fermer"
                        aria-label="Fermer la galerie"
                      >
                        <X className="w-8 h-8" />
                      </button>
                      
                      <button
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedGalleryImage(prev => 
                            prev !== null ? (prev - 1 + galleryImages.length) % galleryImages.length : 0
                          );
                        }}
                        title="Image précédente"
                        aria-label="Image précédente"
                      >
                        <ChevronLeft className="w-8 h-8" />
                      </button>
                      
                      <button
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedGalleryImage(prev => 
                            prev !== null ? (prev + 1) % galleryImages.length : 0
                          );
                        }}
                        title="Image suivante"
                        aria-label="Image suivante"
                      >
                        <ChevronRight className="w-8 h-8" />
                      </button>

                      <motion.img
                        key={selectedGalleryImage}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        src={galleryImages[selectedGalleryImage].url}
                        alt={artistName}
                        className="max-w-full max-h-[90vh] object-contain rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                      />
                      
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
                        {selectedGalleryImage + 1} / {galleryImages.length}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ImageIcon className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucune image</h3>
                <p className="text-muted-foreground text-sm max-w-md">
                  Aucune image n'a été trouvée pour cet artiste.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
});

ArtistView.displayName = "ArtistView";
