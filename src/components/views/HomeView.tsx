"use client";

import { Play, Clock, TrendingUp, Sparkles, Heart, Music, Disc, Timer, Users, Star, Zap, Library, ChevronRight, Headphones } from "lucide-react";
import { Track } from "@/types/music";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import { useState, useMemo, memo } from "react";
import { useCloudSync } from "@/hooks/useCloudSync";
import { TrackCardSkeleton, PlaylistCardSkeleton, HomeViewSkeleton } from "@/components/ui/skeletons";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { UploadIndicator } from "@/components/UploadIndicator";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useFavorites } from "@/hooks/useFavorites";
import { useHomeWorker } from "@/hooks/useHomeWorker";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";
import { useBunnyUpload } from "@/hooks/useBunnyUpload";
import { useNexusUpload } from "@/hooks/useNexusUpload";
import { useUploadedStatus } from "@/hooks/useUploadedStatus";
import { useListeningStats, formatDuration } from "@/hooks/useListeningStats";
import { useGenres, formatGenreName } from "@/hooks/useGenres";
import { Button } from "@/components/ui/button";
import { HelpButton, HelpIcon } from "@/components/ui/HelpButton";
import { motion } from "framer-motion";
import { useI18n } from "@/i18n";

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
import { GenreExploreSection } from "@/components/GenreExploreSection";

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
  const { t } = useI18n();
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
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const isDayMix = new Date().getHours() < 18;
  
  const canUploadToCloudinary = cloudinaryConfigured && nexusIsPro;
  const canUploadToBunny = nexusIsPro && nexusAuthenticated;
  const canUploadToNexus = nexusIsPro && nexusAuthenticated;
  const canUploadToLocal = nexusAuthenticated;
  
  const currentTrack = currentTrackIndex >= 0 ? tracks[currentTrackIndex] : null;
  const userName = nexusUser?.displayName || nexusUser?.email?.split("@")[0] || "";

  const topGenres = useMemo(() => genres, [genres]);
  const selectedGenreTracks = useMemo(
    () => (selectedGenre ? getTracksByGenre(selectedGenre) : []),
    [selectedGenre, getTracksByGenre]
  );

  // IMPORTANT: Ces données sont calculées à partir de l'historique et ne sont JAMAIS supprimées
  // Les fonctions de lecture (handlePlayPlaylist, handlePlayTracks, etc.) ne touchent pas à ces données
  const recentArtists = useMemo(() => {
    if (!stats?.recentArtists) return [];
    return stats.recentArtists;
  }, [stats]);

  const { computed } = useHomeWorker({
    tracks,
    recentTracks,
    favoriteTracks,
    history,
    currentTrack,
    recentArtists,
  });

  const displayRecent = computed?.displayRecent ?? (recentTracks.length ? recentTracks : tracks);
  const displayFavorites = computed?.displayFavorites ?? (favoriteTracks.length ? favoriteTracks : []);
  const playlistSelections = computed?.playlistSelections ?? { discoveries: [], similar: [], mix: [] };
  const newTracks = computed?.newTracks ?? tracks;

  // Hero slides
  const heroSlides = (computed?.heroSlides ?? []).map((slide) => ({
    ...slide,
    imageUrl: getCoverUrl(slide.coverUrl ?? undefined),
  }));

  const quickPlayItems = computed?.quickPlayItems ?? [];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return t("homeGreetingNight");
    if (hour < 12) return t("homeGreetingMorning");
    if (hour < 18) return t("homeGreetingAfternoon");
    return t("homeGreetingEvening");
  };

  // Loading skeleton
  if (loading) {
    return <HomeViewSkeleton />;
  }

  return (
    <div className="h-full min-h-0 w-full pb-8 space-y-10 animate-fade-in overflow-hidden contain-inline-size">
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
              title={t("homeWelcomeTitle")}
              description={t("homeWelcomeDescription")}
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
              <h3 className="text-lg font-semibold">{t("homeStatsTitle")}</h3>
              <HelpIcon
                title={t("homeStatsHelpTitle")}
                description={t("homeStatsHelpDescription")}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label={t("homeStatsListeningTime")}
                value={formatDuration(stats.weeklyListeningTime)}
                icon={<Timer className="w-5 h-5" />}
                subtitle={t("homeStatsThisWeek")}
                trend={stats.weeklyListeningTime > stats.dailyListeningTime * 7 * 0.8 ? "up" : "neutral"}
              />
              <StatCard
                label={t("homeStatsTracks")}
                value={stats.totalTracks.toLocaleString()}
                icon={<Music className="w-5 h-5" />}
                subtitle={t("homeStatsInLibrary")}
              />
              <StatCard
                label={t("homeStatsPlays")}
                value={stats.totalPlays.toLocaleString()}
                icon={<Headphones className="w-5 h-5" />}
                subtitle={t("homeStatsTotal")}
                trend="up"
              />
              <StatCard
                label={t("homeStatsArtists")}
                value={stats.topArtists.length.toLocaleString()}
                icon={<Users className="w-5 h-5" />}
                subtitle={t("homeStatsDifferent")}
              />
            </div>
          </motion.div>
        </section>
      )}

      {/* Recently Played Artists - Carousel */}
      {recentArtists.length > 0 && (
        <section className="pl-6 pr-6 overflow-hidden max-w-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{t("homeRecentArtistsTitle")}</h3>
            <HelpIcon
              title={t("homeRecentArtistsHelpTitle")}
              description={t("homeRecentArtistsHelpDescription")}
            />
          </div>
          <ContentCarousel
            title=""
            subtitle={t("homeRecentArtistsSubtitle")}
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

      <GenreExploreSection
        genres={topGenres.map((genre) => ({
          name: formatGenreName(genre.name),
          trackCount: genre.trackCount,
        }))}
        onSelectGenre={(genreName) => {
          const match = topGenres.find((g) => formatGenreName(g.name) === genreName);
          setSelectedGenre(match?.name ?? genreName);
        }}
        onViewAll={
          onFilterByGenre
            ? () => {
                setSelectedGenre(null);
                onFilterByGenre("");
              }
            : undefined
        }
      />

      {selectedGenre && selectedGenreTracks.length > 0 && (
        <section className="px-6">
          <SectionHeader
            title={t("homeGenreTitle", { genre: formatGenreName(selectedGenre) })}
            icon={<Disc className="w-5 h-5 text-secondary" />}
            count={selectedGenreTracks.length}
            action={
              <div className="flex items-center gap-2">
                {onFilterByGenre && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onFilterByGenre(selectedGenre)}
                  >
                    {t("homeGenreViewInSearch")}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setSelectedGenre(null)}>
                  {t("homeClose")}
                </Button>
              </div>
            }
          />
          <div className="bg-card/30 backdrop-blur-sm rounded-2xl overflow-hidden border border-border/30">
            <div className="overflow-y-auto h-[360px] overflow-x-hidden">
              <table className="w-full table-fixed">
                <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-md">
                  <tr className="border-b border-border/30">
                    <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground w-12">{t("homeTableIndex")}</th>
                    <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground w-[45%]">{t("libraryColumnTitle")}</th>
                    <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground hidden md:table-cell w-[35%]">{t("labelAlbum")}</th>
                    <th className="px-4 py-3 text-right text-xs font-display uppercase tracking-widest text-muted-foreground w-[80px]">{t("libraryColumnDuration")}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedGenreTracks.map((track, idx) => {
                    const actualIndex = tracks.findIndex(t => t.id === track.id);
                    const isCurrentTrack = currentTrackIndex === actualIndex;

                    return (
                      <tr
                        key={`genre-${track.id}-${idx}`}
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
                                <div className="w-1 h-4 bg-primary rounded-full animate-wave wave-delay-100" />
                                <div className="w-1 h-4 bg-primary rounded-full animate-wave wave-delay-200" />
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
          </div>
        </section>
      )}

      {/* Recently Played Tracks - Carousel */}
      {displayRecent.length > 0 && (
        <section className="pl-6 pr-6 overflow-hidden max-w-full">
          <ContentCarousel
            title={recentTracks.length > 0 ? t("homeRecentlyPlayed") : t("homeDiscover")}
            subtitle={t("homeTracksCount", { count: displayRecent.length })}
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
                  onCreatePlaylist={() => createPlaylist(t("homeNewPlaylistName"), [track.id])}
                  onToggleFavorite={() => toggleFavorite(track.id)}
                  onUploadToCloudinary={() => uploadTrack?.(track)}
                  canUploadToCloudinary={canUploadToCloudinary && !!track.filePath}
                  isUploading={getTrackProgress?.(track.id)?.status === 'uploading'}
                  onUploadToBunny={() => uploadTrackToBunny?.(track)}
                  canUploadToBunny={canUploadToBunny && !!track.filePath}
                  isUploadingToBunny={getBunnyTrackProgress?.(track.id)?.status === 'uploading'}
                  onUploadToNexus={() => uploadTrackToNexus?.(track, 'planethoster')}
                  canUploadToNexus={canUploadToNexus && !!track.filePath}
                  isUploadingToNexus={getNexusTrackProgress?.(track.id)?.status === 'uploading'}
                  onUploadToLocal={() => uploadTrackToNexus?.(track, 'local')}
                  canUploadToLocal={canUploadToLocal && !!track.filePath}
                  isUploadingToLocal={getNexusTrackProgress?.(track.id)?.status === 'uploading'}
                  isAuthenticated={nexusAuthenticated}
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
            title={t("homeNewInLibrary")}
            subtitle={t("homeNewInLibrarySubtitle")}
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
                  badge={t("homeNewBadge")}
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
            title={t("homeFavoritesTitle")}
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
                {t("homePlay")}
              </Button>
            ) : null}
          />
          <div className="bg-card/30 backdrop-blur-sm rounded-2xl overflow-hidden border border-border/30">
            <div className="overflow-y-auto h-[360px] overflow-x-hidden">
              <table className="w-full table-fixed">
                <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-md">
                  <tr className="border-b border-border/30">
                    <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground w-12">{t("homeTableIndex")}</th>
                    <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground w-[45%]">{t("libraryColumnTitle")}</th>
                    <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground hidden md:table-cell w-[35%]">{t("labelAlbum")}</th>
                    <th className="px-4 py-3 text-right text-xs font-display uppercase tracking-widest text-muted-foreground w-[80px]">{t("libraryColumnDuration")}</th>
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
                                <div className="w-1 h-4 bg-primary rounded-full animate-wave wave-delay-100" />
                                <div className="w-1 h-4 bg-primary rounded-full animate-wave wave-delay-200" />
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
          </div>
        </section>
      )}

      {/* Made For You - Playlist Recommendations */}
      {(playlistSelections.discoveries.length > 0 || playlistSelections.similar.length > 0 || playlistSelections.mix.length > 0) && (
        <section className="px-6">
          <SectionHeader
            title={t("homeForYouTitle")}
            icon={<Sparkles className="w-5 h-5 text-amber-500" />}
            subtitle={t("homeForYouSubtitle")}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {playlistSelections.discoveries.length > 0 && (
              <PlaylistCard
                title={t("homeDiscoveriesTitle")}
                subtitle={t("homeDiscoveriesSubtitle", { count: playlistSelections.discoveries.length })}
                description={t("homeDiscoveriesDescription")}
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
                title={t("homeSimilarTitle")}
                subtitle={t("homeSimilarSubtitle", { count: playlistSelections.similar.length })}
                description={t("homeSimilarDescription")}
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
                title={isDayMix ? t("homeMixEnergyTitle") : t("homeMixChillTitle")}
                subtitle={t("homeMixSubtitle", {
                  count: playlistSelections.mix.length,
                  mood: isDayMix ? t("homeMixEnergyMood") : t("homeMixChillMood"),
                })}
                description={isDayMix ? t("homeMixEnergyDescription") : t("homeMixChillDescription")}
                tracks={playlistSelections.mix}
                gradient={isDayMix 
                  ? "from-amber-500/90 via-orange-600/80 to-red-600/90"
                  : "from-indigo-600/90 via-blue-700/80 to-cyan-800/90"
                }
                icon={<TrendingUp className={cn(
                  "w-4 h-4",
                  isDayMix ? "text-yellow-300" : "text-cyan-300"
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
          <h3 className="text-xl font-display font-bold mb-2">{t("homeEmptyLibraryTitle")}</h3>
          <p className="text-muted-foreground text-sm max-w-md">
            {t("homeEmptyLibraryDescription")}
          </p>
        </div>
      )}
    </div>
  );
});

HomeView.displayName = 'HomeView';
