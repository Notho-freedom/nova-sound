"use client";

import { Play, Clock, TrendingUp, Sparkles, Heart, Music, Disc, Timer, Users, Star, Zap, Library, ChevronRight, Headphones } from "lucide-react";
import { Track } from "@/types/music";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import { useState, useMemo, useCallback, memo } from "react";
import { useCloudSync } from "@/hooks/useCloudSync";
import { Skeleton } from "@/components/ui/skeleton";
import { TrackCardSkeleton, PlaylistCardSkeleton, HomeViewSkeleton } from "@/components/ui/skeletons";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { UploadIndicator } from "@/components/UploadIndicator";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useFavorites } from "@/hooks/useFavorites";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";
import { useBunnyUpload } from "@/hooks/useBunnyUpload";
import { useNexusUpload } from "@/hooks/useNexusUpload";
import { useUploadedStatus } from "@/hooks/useUploadedStatus";
import { useListeningStats, formatDuration } from "@/hooks/useListeningStats";
import { useGenres, formatGenreName } from "@/hooks/useGenres";
import { Button } from "@/components/ui/button";
import { HelpButton, HelpIcon } from "@/components/ui/HelpButton";
import { motion } from "framer-motion";

// UI Components
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard } from "@/components/ui/StatCard";
import { ArtistCard } from "@/components/ui/ArtistCard";
import { PlaylistCard } from "@/components/ui/PlaylistCard";
import { GenreCard } from "@/components/ui/GenreCard";
import { TrackCard } from "@/components/ui/TrackCard";
import { HeroCarousel } from "@/components/ui/HeroCarousel";
import { ContentCarousel } from "@/components/ui/ContentCarousel";
import { QuickPlayCard } from "@/components/ui/QuickPlayCard";
import { FeaturedCard } from "@/components/ui/FeaturedCard";

interface HistoryEntry {
  trackId: string;
  playedAt: string;
  playCount: number;
}

interface HomeViewProps {
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onTrackSelect: (index: number) => void;
  onPlayTrack?: (track: Track) => void;
  onPlayPause?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onShuffle?: () => void;
  onPlayNext?: (track: Track | Track[]) => void;
  onAddToQueue?: (track: Track | Track[]) => void;
  onAddToPlaylist?: (playlistId: string, track: Track) => void;
  onPlayTracks?: (trackIds: string[]) => void;
  onPlayTrackList?: (tracks: Track[]) => void;
  onFilterByGenre?: (genre: string) => void;
  onFilterByArtist?: (artist: string) => void;
  onNavigateToArtist?: (artist: string) => void;
  onNavigateToAlbum?: (album: string, artist: string) => void;
  recentTracks?: Track[];
  favoriteTracks?: Track[];
  history?: HistoryEntry[];
  loading?: boolean;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// Fisher-Yates shuffle
function fisherYatesShuffle<T>(array: T[], seed: number = 0): T[] {
  const shuffled = [...array];
  let currentIndex = shuffled.length;
  let seedValue = seed;
  const random = () => {
    seedValue = (seedValue * 9301 + 49297) % 233280;
    return seedValue / 233280;
  };
  while (currentIndex !== 0) {
    const randomIndex = Math.floor(random() * currentIndex);
    currentIndex--;
    [shuffled[currentIndex], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[currentIndex]];
  }
  return shuffled;
}

const generatePlaylistSelections = (tracks: Track[], history: HistoryEntry[] = []) => {
  const playCountMap = new Map<string, number>();
  history.forEach(entry => playCountMap.set(entry.trackId, entry.playCount || 1));

  const tracksWithCounts: Array<{ track: Track; playCount: number }> = [];
  for (const track of tracks) {
    const playCount = playCountMap.get(track.id) || 0;
    if (playCount > 0) {
      tracksWithCounts.push({ track, playCount });
    }
  }
  
  tracksWithCounts.sort((a, b) => b.playCount - a.playCount);
  const topTracks = tracksWithCounts;
  
  const shuffled1 = fisherYatesShuffle(topTracks, Date.now() % 1000);
  const shuffled2 = fisherYatesShuffle(topTracks, (Date.now() + 1) % 1000);
  const shuffled3 = fisherYatesShuffle(topTracks, (Date.now() + 2) % 1000);

  return {
    discoveries: shuffled1.map(item => item.track),
    similar: shuffled2.map(item => item.track),
    mix: shuffled3.map(item => item.track),
  };
};

// Greeting based on time of day
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 6) return "Bonne nuit";
  if (hour < 12) return "Bonjour";
  if (hour < 18) return "Bon après-midi";
  return "Bonsoir";
};

export const HomeView = memo(({
  tracks,
  currentTrackIndex,
  isPlaying,
  onTrackSelect,
  onPlayTrack,
  onPlayPause,
  onNext,
  onPrevious,
  onShuffle,
  onPlayNext,
  onAddToQueue,
  onAddToPlaylist,
  onFilterByGenre,
  onFilterByArtist,
  onNavigateToArtist,
  onNavigateToAlbum,
  recentTracks = [],
  favoriteTracks = [],
  history = [],
  onPlayTrackList,
  loading = false,
}: HomeViewProps) => {
  // Hooks
  const playlistsResult = usePlaylists();
  const playlists = playlistsResult?.playlists ?? [];
  const createPlaylist = playlistsResult?.createPlaylist ?? (async () => null);
  const { isFavorite, toggleFavorite } = useFavorites();
  const { uploadTrack, getTrackProgress } = useCloudinaryUpload();
  const { uploadTrack: uploadTrackToBunny, getTrackProgress: getBunnyTrackProgress } = useBunnyUpload();
  const { uploadTrack: uploadTrackToNexus, getTrackProgress: getNexusTrackProgress } = useNexusUpload();
  const { cloudinaryConfigured, nexusIsPro, nexusAuthenticated, nexusUser } = useCloudSync();
  const { isUploaded, getUploadedProvider } = useUploadedStatus();
  const { stats } = useListeningStats(tracks, history);
  const { genres, getTracksByGenre } = useGenres(tracks);
  
  const canUploadToCloudinary = cloudinaryConfigured && !nexusIsPro;
  const canUploadToBunny = nexusIsPro && nexusAuthenticated;
  const canUploadToNexus = nexusIsPro && nexusAuthenticated;
  
  const currentTrack = currentTrackIndex >= 0 ? tracks[currentTrackIndex] : null;
  const userName = nexusUser?.displayName || nexusUser?.email?.split("@")[0] || "";

  // Helpers
  const getUniqueTracks = useCallback((trackList: Track[]) => {
    const seen = new Set<string>();
    return trackList.filter(track => {
      if (seen.has(track.id)) return false;
      seen.add(track.id);
      return true;
    });
  }, []);

  // Memoized data
  // IMPORTANT: displayRecent et displayFavorites sont calculés à partir de recentTracks et favoriteTracks
  // Ces données ne sont JAMAIS supprimées par les fonctions de lecture
  const displayRecent = useMemo(() => 
    recentTracks.length > 0 
      ? getUniqueTracks(recentTracks)
      : getUniqueTracks(tracks),
    [recentTracks, tracks, getUniqueTracks]
  );
  
  const displayFavorites = useMemo(() => 
    favoriteTracks.length > 0 ? getUniqueTracks(favoriteTracks) : [],
    [favoriteTracks, getUniqueTracks]
  );

  const playlistSelections = useMemo(() => 
    generatePlaylistSelections(tracks, history),
    [tracks, history]
  );

  const newTracks = useMemo(() => {
    return getUniqueTracks(tracks).reverse();
  }, [tracks, getUniqueTracks]);

  const topGenres = useMemo(() => genres, [genres]);

  // IMPORTANT: Ces données sont calculées à partir de l'historique et ne sont JAMAIS supprimées
  // Les fonctions de lecture (handlePlayPlaylist, handlePlayTracks, etc.) ne touchent pas à ces données
  const recentArtists = useMemo(() => {
    if (!stats?.recentArtists) return [];
    return stats.recentArtists;
  }, [stats]);

  // Hero slides
  const heroSlides = useMemo(() => {
    const slides = [];
    
    // Current track or first recent
    if (currentTrack) {
      slides.push({
        id: currentTrack.id,
        title: currentTrack.title,
        subtitle: "En cours de lecture",
        description: `${currentTrack.artist} • ${currentTrack.album}`,
        imageUrl: getCoverUrl(currentTrack.coverUrl),
        gradient: "from-primary/40 to-secondary/40",
      });
    }

    // Top artists - use all available recent artists (not limited)
    recentArtists.forEach(artist => {
      const artistTrack = tracks.find(t => t.artist === artist.name);
      if (artistTrack) {
        slides.push({
          id: `artist-${artist.name}`,
          title: artist.name,
          subtitle: "Artiste populaire",
          description: `${artist.trackCount} titres • ${artist.playCount} écoutes`,
          imageUrl: artist.imageUrl || getCoverUrl(artistTrack.coverUrl),
          gradient: "from-secondary/40 to-accent/40",
        });
      }
    });

    // Recent albums (all available, not limited to 6)
    const seenAlbums = new Set<string>();
    displayRecent.forEach(track => {
      const albumKey = `${track.album}-${track.artist}`;
      if (!seenAlbums.has(albumKey) && track.album !== "Album inconnu") {
        seenAlbums.add(albumKey);
        slides.push({
          id: `album-${albumKey}`,
          title: track.album,
          subtitle: "Album récent",
          description: track.artist,
          imageUrl: getCoverUrl(track.coverUrl),
          gradient: "from-accent/40 to-primary/40",
        });
      }
    });

    // Fallback: Add individual tracks as slides if we have fewer than 5 slides total
    if (slides.length < 5) {
      const seenTracks = new Set(slides.map(s => s.id));
      displayRecent.forEach(track => {
        if (slides.length < 12 && !seenTracks.has(track.id)) {
          seenTracks.add(track.id);
          slides.push({
            id: track.id,
            title: track.title,
            subtitle: "Titre récent",
            description: `${track.artist} • ${track.album}`,
            imageUrl: getCoverUrl(track.coverUrl),
            gradient: "from-primary/40 to-secondary/40",
          });
        }
      });
    }

    return slides;
  }, [currentTrack, recentArtists, displayRecent, tracks]);

  // Quick play items (6 items for the grid)
  const quickPlayItems = useMemo(() => {
    const items: Track[] = [];
    const seen = new Set<string>();

    // Add recent tracks
    displayRecent.forEach(track => {
      if (items.length < 6 && !seen.has(track.id)) {
        seen.add(track.id);
        items.push(track);
      }
    });

    return items;
  }, [displayRecent]);

  // Loading skeleton
  if (loading) {
    return <HomeViewSkeleton />;
  }

  return (
    <div className="pb-8 space-y-10 animate-fade-in overflow-hidden w-full" style={{ contain: 'inline-size' }}>
      {/* Hero Section with Carousel */}
      {heroSlides.length > 0 && (
        <section className="px-6">
          <HeroCarousel
            slides={heroSlides}
            autoPlay={true}
            interval={8000}
            onPlay={(slide) => {
              const track = tracks.find(t => t.id === slide.id);
              if (track) {
                const idx = tracks.findIndex(t => t.id === track.id);
                if (idx !== -1) onTrackSelect(idx);
              }
            }}
            onShuffle={onShuffle}
          />
        </section>
      )}

      {/* Greeting & Quick Play Grid */}
      <section className="px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl md:text-3xl font-bold">
              {getGreeting()}{userName ? `, ${userName}` : ""}
            </h2>
            <HelpButton
              title="Bienvenue"
              description="Cliquez sur les titres pour les écouter. Utilisez le carrousel du haut pour explorer vos artistes et albums récents. Les recommandations sont basées sur votre historique d'écoute."
              size="icon-sm"
            />
          </div>
          
          <div className="grid grid-cols-4 md:grid-cols-5 gap-3">
            {quickPlayItems.map((track) => {
              const actualIndex = tracks.findIndex(t => t.id === track.id);
              const isCurrent = currentTrackIndex === actualIndex;
              
              return (
                <QuickPlayCard
                  key={track.id}
                  title={track.title}
                  subtitle={track.artist}
                  imageUrl={getCoverUrl(track.coverUrl)}
                  isPlaying={isPlaying}
                  isCurrent={isCurrent}
                  onClick={() => onPlayTrack ? onPlayTrack(track) : (actualIndex !== -1 && onTrackSelect(actualIndex))}
                />
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* Stats Section */}
      {stats && (
        <section className="px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Vos statistiques</h3>
              <HelpIcon
                title="Statistiques"
                description="Suivez vos habitudes d'écoute : temps total écouté, nombre de pistes, écoutes cumulées et diversité artistique."
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Temps d'écoute"
                value={formatDuration(stats.weeklyListeningTime)}
                icon={<Timer className="w-5 h-5" />}
                subtitle="Cette semaine"
                trend={stats.weeklyListeningTime > stats.dailyListeningTime * 7 * 0.8 ? "up" : "neutral"}
              />
              <StatCard
                label="Pistes"
                value={stats.totalTracks.toLocaleString()}
                icon={<Music className="w-5 h-5" />}
                subtitle="Dans votre bibliothèque"
              />
              <StatCard
                label="Écoutes"
                value={stats.totalPlays.toLocaleString()}
                icon={<Headphones className="w-5 h-5" />}
                subtitle="Total"
                trend="up"
              />
              <StatCard
                label="Artistes"
                value={stats.topArtists.length.toLocaleString()}
                icon={<Users className="w-5 h-5" />}
                subtitle="Différents"
              />
            </div>
          </motion.div>
        </section>
      )}

      {/* Recently Played Artists - Carousel */}
      {recentArtists.length > 0 && (
        <section className="pl-6 pr-6 overflow-hidden max-w-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Artistes récents</h3>
            <HelpIcon
              title="Artistes récents"
              description="Découvrez les artistes que vous écoutez le plus en ce moment. Cliquez sur un artiste pour filtrer vos titres."
            />
          </div>
          <ContentCarousel
            title=""
            subtitle="Vos artistes écoutés récemment"
            icon={<Users className="w-5 h-5 text-primary" />}
          >
            {recentArtists.map((artist, idx) => (
              <ArtistCard
                key={`artist-${artist.name}-${idx}`}
                name={artist.name}
                imageUrl={artist.imageUrl}
                trackCount={artist.trackCount}
                playCount={artist.playCount}
                onClick={() => onFilterByArtist?.(artist.name)}
                onNavigateToArtist={onNavigateToArtist}
                className="flex-shrink-0 snap-start"
              />
            ))}
          </ContentCarousel>
        </section>
      )}

      {/* Explore by Genre - Carousel */}
      {topGenres.length > 0 && (
        <section className="pl-6 pr-6 overflow-hidden max-w-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Explorer par genre</h3>
            <HelpIcon
              title="Genres"
              description="Explorez votre musique par genre. Cliquez sur un genre pour voir tous les titres de cette catégorie."
            />
          </div>
          <ContentCarousel
            title="Explorer par genre"
            subtitle={`${genres.length} genres disponibles`}
            icon={<Disc className="w-5 h-5 text-secondary" />}
            action={
              genres.length > 8 && (
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                  Voir tout
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )
            }
          >
            {topGenres.map((genre) => (
              <GenreCard
                key={genre.name}
                name={formatGenreName(genre.name)}
                trackCount={genre.trackCount}
                onClick={() => onFilterByGenre?.(genre.name)}
                className="flex-shrink-0 snap-start w-40"
              />
            ))}
          </ContentCarousel>
        </section>
      )}

      {/* Recently Played Tracks - Carousel */}
      {displayRecent.length > 0 && (
        <section className="pl-6 pr-6 overflow-hidden max-w-full">
          <ContentCarousel
            title={recentTracks.length > 0 ? "Écouté récemment" : "À découvrir"}
            subtitle={`${displayRecent.length} titres`}
            icon={<Clock className="w-5 h-5 text-accent" />}
          >
            {displayRecent.map((track, idx) => {
              const actualIndex = tracks.findIndex(t => t.id === track.id);
              const isCurrent = currentTrackIndex === actualIndex;
              
              return (
                <TrackContextMenu
                  key={`recent-${track.id}-${idx}`}
                  track={track}
                  playlists={playlists}
                  isFavorite={isFavorite(track.id)}
                  onPlay={() => actualIndex !== -1 && onTrackSelect(actualIndex)}
                  onPlayNext={() => onPlayNext?.(track)}
                  onAddToQueue={() => onAddToQueue?.(track)}
                  onAddToPlaylist={(playlistId) => onAddToPlaylist?.(playlistId, track)}
                  onCreatePlaylist={() => createPlaylist("Nouvelle playlist", [track.id])}
                  onToggleFavorite={() => toggleFavorite(track.id)}
                  onUploadToCloudinary={() => uploadTrack?.(track)}
                  canUploadToCloudinary={canUploadToCloudinary && !!track.filePath}
                  isUploading={getTrackProgress?.(track.id)?.status === 'uploading'}
                  onUploadToBunny={() => uploadTrackToBunny?.(track)}
                  canUploadToBunny={canUploadToBunny && !!track.filePath}
                  isUploadingToBunny={getBunnyTrackProgress?.(track.id)?.status === 'uploading'}
                  onUploadToNexus={() => uploadTrackToNexus?.(track)}
                  canUploadToNexus={canUploadToNexus && !!track.filePath}
                  isUploadingToNexus={getNexusTrackProgress?.(track.id)?.status === 'uploading'}
                >
                  <FeaturedCard
                    title={track.title}
                    subtitle={track.artist}
                    imageUrl={getCoverUrl(track.coverUrl)}
                    isPlaying={isPlaying}
                    isCurrent={isCurrent}
                    onClick={() => onPlayTrack ? onPlayTrack(track) : (actualIndex !== -1 && onTrackSelect(actualIndex))}
                    onPlay={() => onPlayTrack ? onPlayTrack(track) : (actualIndex !== -1 && onTrackSelect(actualIndex))}
                    size="md"
                    className="snap-start"
                  />
                </TrackContextMenu>
              );
            })}
          </ContentCarousel>
        </section>
      )}

      {/* New in Library - Carousel */}
      {newTracks.length > 0 && (
        <section className="pl-6 pr-6 overflow-hidden max-w-full">
          <ContentCarousel
            title="Nouveautés"
            subtitle="Récemment ajouté à votre bibliothèque"
            icon={<Star className="w-5 h-5 text-yellow-500" />}
          >
            {newTracks.map((track, idx) => {
              const actualIndex = tracks.findIndex(t => t.id === track.id);
              const isCurrent = currentTrackIndex === actualIndex;
              
              return (
                <FeaturedCard
                  key={`new-${track.id}-${idx}`}
                  title={track.title}
                  subtitle={track.artist}
                  imageUrl={getCoverUrl(track.coverUrl)}
                  badge="NEW"
                  badgeColor="bg-yellow-500"
                  isPlaying={isPlaying}
                  isCurrent={isCurrent}
                  onClick={() => onPlayTrack ? onPlayTrack(track) : (actualIndex !== -1 && onTrackSelect(actualIndex))}
                  onPlay={() => onPlayTrack ? onPlayTrack(track) : (actualIndex !== -1 && onTrackSelect(actualIndex))}
                  size="md"
                  className="snap-start"
                />
              );
            })}
          </ContentCarousel>
        </section>
      )}

      {/* Favorites Section */}
      {displayFavorites.length > 0 && (
        <section className="px-6">
          <SectionHeader
            title="Vos favoris"
            icon={<Heart className="w-5 h-5 text-red-500" />}
            count={favoriteTracks.length}
            action={onPlayTrackList ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onPlayTrackList(displayFavorites)}
                className="gap-2"
              >
                <Play className="w-4 h-4" />
                Lecture
              </Button>
            ) : null}
          />
          <div className="bg-card/30 backdrop-blur-sm rounded-2xl overflow-hidden border border-border/30">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground w-12">#</th>
                  <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground">Titre</th>
                  <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground hidden md:table-cell">Album</th>
                  <th className="px-4 py-3 text-right text-xs font-display uppercase tracking-widest text-muted-foreground">Durée</th>
                </tr>
              </thead>
              <tbody>
                {displayFavorites.map((track, idx) => {
                  const actualIndex = tracks.findIndex(t => t.id === track.id);
                  const isCurrentTrack = currentTrackIndex === actualIndex;
                  
                  return (
                    <tr
                      key={`favorite-${track.id}-${idx}`}
                      onClick={() => onPlayTrack ? onPlayTrack(track) : (actualIndex !== -1 && onTrackSelect(actualIndex))}
                      className={cn(
                        "group cursor-pointer transition-all duration-200",
                        isCurrentTrack ? "bg-primary/10" : "hover:bg-muted/40"
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="w-6 flex items-center justify-center">
                          {isCurrentTrack && isPlaying ? (
                            <div className="flex items-center gap-0.5">
                              <div className="w-1 h-4 bg-primary rounded-full animate-wave" />
                              <div className="w-1 h-4 bg-primary rounded-full animate-wave" style={{ animationDelay: '0.1s' }} />
                              <div className="w-1 h-4 bg-primary rounded-full animate-wave" style={{ animationDelay: '0.2s' }} />
                            </div>
                          ) : (
                            <>
                              <span className="text-sm text-muted-foreground group-hover:hidden">{idx + 1}</span>
                              <Play className="w-4 h-4 text-foreground hidden group-hover:block fill-current" />
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 shadow-md">
                            <img src={getCoverUrl(track.coverUrl)} alt={track.album} loading="lazy" className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className={cn("text-sm font-medium truncate", isCurrentTrack ? "text-primary" : "text-foreground")}>{track.title}</p>
                              {isUploaded(track.id) && <UploadIndicator provider={getUploadedProvider(track.id) || undefined} size="sm" />}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="text-sm text-muted-foreground truncate">{track.album}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-muted-foreground font-mono">{formatTime(track.duration)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Made For You - Playlist Recommendations */}
      {(playlistSelections.discoveries.length > 0 || playlistSelections.similar.length > 0 || playlistSelections.mix.length > 0) && (
        <section className="px-6">
          <SectionHeader
            title="Pour vous"
            icon={<Sparkles className="w-5 h-5 text-amber-500" />}
            subtitle="Playlists personnalisées basées sur vos goûts"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {playlistSelections.discoveries.length > 0 && (
              <PlaylistCard
                title="Découvertes"
                subtitle={`${playlistSelections.discoveries.length} perles cachées`}
                description="Explorations musicales"
                tracks={playlistSelections.discoveries}
                gradient="from-violet-600/90 via-purple-600/80 to-indigo-700/90"
                icon={<Zap className="w-4 h-4 text-cyan-400" />}
                onClick={() => {
                  const idx = tracks.findIndex(t => t.id === playlistSelections.discoveries[0]?.id);
                  if (idx !== -1) onTrackSelect(idx);
                }}
              />
            )}
            
            {playlistSelections.similar.length > 0 && (
              <PlaylistCard
                title="Similaires"
                subtitle={`${playlistSelections.similar.length} titres qui vous ressemblent`}
                description="Basé sur vos goûts"
                tracks={playlistSelections.similar}
                gradient="from-rose-500/90 via-pink-600/80 to-fuchsia-700/90"
                icon={<Heart className="w-4 h-4 text-red-300 fill-red-300" />}
                onClick={() => {
                  const idx = tracks.findIndex(t => t.id === playlistSelections.similar[0]?.id);
                  if (idx !== -1) onTrackSelect(idx);
                }}
              />
            )}
            
            {playlistSelections.mix.length > 0 && (
              <PlaylistCard
                title={new Date().getHours() < 18 ? "Energy Mix" : "Chill Session"}
                subtitle={`${playlistSelections.mix.length} titres pour ${new Date().getHours() < 18 ? "vous booster" : "vous détendre"}`}
                description={new Date().getHours() < 18 ? "⚡ Énergisant" : "🌙 Apaisant"}
                tracks={playlistSelections.mix}
                gradient={new Date().getHours() < 18 
                  ? "from-amber-500/90 via-orange-600/80 to-red-600/90"
                  : "from-indigo-600/90 via-blue-700/80 to-cyan-800/90"
                }
                icon={<TrendingUp className={cn(
                  "w-4 h-4",
                  new Date().getHours() < 18 ? "text-yellow-300" : "text-cyan-300"
                )} />}
                onClick={() => {
                  const idx = tracks.findIndex(t => t.id === playlistSelections.mix[0]?.id);
                  if (idx !== -1) onTrackSelect(idx);
                }}
              />
            )}
          </div>
        </section>
      )}

      {/* Empty state */}
      {tracks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-6"
          >
            <Library className="w-12 h-12 text-primary" />
          </motion.div>
          <h3 className="text-xl font-display font-bold mb-2">Bibliothèque vide</h3>
          <p className="text-muted-foreground text-sm max-w-md">
            Ajoutez des dossiers de musique dans les paramètres pour commencer à écouter.
          </p>
        </div>
      )}
    </div>
  );
});

HomeView.displayName = 'HomeView';
