import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Skeleton pour une liste de notifications
 */
export const NotificationListSkeleton = ({ count = 6 }: { count?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div key={`notif-skeleton-${i}`} className="p-4 rounded-lg border border-border/30 bg-card/30 flex items-start gap-3 animate-pulse">
        <Skeleton className="w-6 h-6 rounded-full mt-0.5" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
    ))}
  </div>
);
/**
 * Skeleton pour une grille de playlists
 */
export const PlaylistGridSkeleton = ({ count = 12 }: { count?: number }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
    {Array.from({ length: count }).map((_, i) => (
      <PlaylistCardSkeleton key={`playlist-skeleton-${i}`} />
    ))}
  </div>
);

/**
 * Skeleton pour une carte de piste
 */
export const TrackCardSkeleton = ({ className }: { className?: string }) => (
  <div className={cn("group relative overflow-hidden rounded-xl bg-card/50 backdrop-blur-sm p-4", className)}>
    <div className="flex items-center gap-3">
      <Skeleton className="w-12 h-12 rounded-lg flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  </div>
);

/**
 * Skeleton pour une carte d'album
 */
export const AlbumCardSkeleton = ({ className }: { className?: string }) => (
  <div className={cn("group relative overflow-hidden rounded-xl bg-card/50 backdrop-blur-sm", className)}>
    <Skeleton className="aspect-square w-full" />
    <div className="p-4 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  </div>
);

/**
 * Skeleton pour une ligne de tableau
 */
export const TableRowSkeleton = () => (
  <tr className="border-b border-border/30">
    <td className="px-4 py-2.5">
      <Skeleton className="w-6 h-6 mx-auto" />
    </td>
    <td className="px-4 py-2.5">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded flex-shrink-0" />
        <div className="min-w-0 space-y-2 flex-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </td>
    <td className="px-4 py-2.5 hidden md:table-cell">
      <Skeleton className="h-4 w-28" />
    </td>
    <td className="px-4 py-2.5 text-right">
      <Skeleton className="h-4 w-12 ml-auto" />
    </td>
  </tr>
);

/**
 * Skeleton pour une carte de playlist
 */
export const PlaylistCardSkeleton = () => (
  <div className="relative aspect-[3/2] rounded-xl overflow-hidden">
    <Skeleton className="absolute inset-0 w-full h-full" />
  </div>
);

/**
 * Skeleton pour une grille d'albums
 */
export const AlbumGridSkeleton = ({ count = 12 }: { count?: number }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <AlbumCardSkeleton key={`album-skeleton-${i}`} />
    ))}
  </div>
);

/**
 * Skeleton pour une grille de pistes
 */
export const TrackGridSkeleton = ({ count = 10 }: { count?: number }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <TrackCardSkeleton key={`track-skeleton-${i}`} />
    ))}
  </div>
);

/**
 * Skeleton pour un tableau de pistes
 */
export const TrackTableSkeleton = ({ count = 10 }: { count?: number }) => (
  <div className="bg-card/30 backdrop-blur-sm rounded-xl overflow-hidden border border-border/30">
    <table className="w-full">
      <thead>
        <tr className="border-b border-border/30">
          <th className="px-4 py-2.5 text-left text-xs font-display uppercase tracking-widest text-muted-foreground w-12">
            #
          </th>
          <th className="px-4 py-2.5 text-left text-xs font-display uppercase tracking-widest text-muted-foreground">
            Titre
          </th>
          <th className="px-4 py-2.5 text-left text-xs font-display uppercase tracking-widest text-muted-foreground hidden md:table-cell">
            Album
          </th>
          <th className="px-4 py-2.5 text-right text-xs font-display uppercase tracking-widest text-muted-foreground">
            Durée
          </th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: count }).map((_, i) => (
          <TableRowSkeleton key={`table-skeleton-${i}`} />
        ))}
      </tbody>
    </table>
  </div>
);

/**
 * Skeleton pour un header de page
 */
export const PageHeaderSkeleton = () => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  </div>
);

/**
 * Skeleton pour une ligne de tableau d'album
 */
export const AlbumTableRowSkeleton = () => (
  <tr className="border-b border-border/30">
    <td className="px-4 py-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded flex-shrink-0" />
        <div className="min-w-0 space-y-2 flex-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    </td>
    <td className="px-4 py-3 hidden md:table-cell">
      <Skeleton className="h-4 w-28" />
    </td>
    <td className="px-4 py-3 hidden lg:table-cell">
      <Skeleton className="h-4 w-16" />
    </td>
    <td className="px-4 py-3 text-right">
      <Skeleton className="h-4 w-20 ml-auto" />
    </td>
    <td className="px-4 py-3 w-12">
      <Skeleton className="w-6 h-6 mx-auto" />
    </td>
  </tr>
);

/**
 * Skeleton pour un tableau d'albums
 */
export const AlbumTableSkeleton = ({ count = 10 }: { count?: number }) => (
  <div className="bg-card/30 backdrop-blur-sm rounded-xl overflow-hidden border border-border/30">
    <div className="overflow-y-auto max-h-[calc(100vh-400px)]">
      <table className="w-full">
        <thead className="sticky top-0 z-10 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/50">
          <tr className="border-b border-border/30">
            <th className="px-4 py-2.5 text-left text-xs font-display uppercase tracking-widest text-muted-foreground">
              Album
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-display uppercase tracking-widest text-muted-foreground hidden md:table-cell">
              Artiste
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-display uppercase tracking-widest text-muted-foreground hidden lg:table-cell">
              Année
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-display uppercase tracking-widest text-muted-foreground">
              Titres
            </th>
            <th className="px-4 py-2.5 w-12"></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: count }).map((_, i) => (
            <AlbumTableRowSkeleton key={`album-table-skeleton-${i}`} />
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

/**
 * Skeleton pour une ligne de tableau d'artiste
 */
export const ArtistTableRowSkeleton = () => (
  <tr className="border-b border-border/30">
    <td className="px-4 py-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
        <div className="min-w-0 space-y-2 flex-1">
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    </td>
    <td className="px-4 py-3 hidden md:table-cell">
      <Skeleton className="h-4 w-20" />
    </td>
    <td className="px-4 py-3 text-right">
      <Skeleton className="h-4 w-20 ml-auto" />
    </td>
    <td className="px-4 py-3 w-12">
      <Skeleton className="w-6 h-6 mx-auto" />
    </td>
  </tr>
);

/**
 * Skeleton pour un tableau d'artistes
 */
export const ArtistTableSkeleton = ({ count = 10 }: { count?: number }) => (
  <div className="bg-card/30 backdrop-blur-sm rounded-xl overflow-hidden border border-border/30">
    <div className="overflow-y-auto max-h-[calc(100vh-400px)]">
      <table className="w-full">
        <thead className="sticky top-0 z-10 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/50">
          <tr className="border-b border-border/30">
            <th className="px-4 py-2.5 text-left text-xs font-display uppercase tracking-widest text-muted-foreground">
              Artiste
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-display uppercase tracking-widest text-muted-foreground hidden md:table-cell">
              Albums
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-display uppercase tracking-widest text-muted-foreground">
              Titres
            </th>
            <th className="px-4 py-2.5 w-12"></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: count }).map((_, i) => (
            <ArtistTableRowSkeleton key={`artist-table-skeleton-${i}`} />
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

/**
 * Skeleton pour une carte de vidéo
 */
export const VideoCardSkeleton = ({ className }: { className?: string }) => (
  <div className={cn("flex flex-col", className)}>
    <Skeleton className="aspect-video w-full rounded-lg" />
    <div className="mt-2 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  </div>
);

/**
 * Skeleton pour une grille de vidéos
 */
export const VideoGridSkeleton = ({ count = 12 }: { count?: number }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <VideoCardSkeleton key={`video-skeleton-${i}`} />
    ))}
  </div>
);

/**
 * Skeleton pour un carrousel de vidéos
 */
export const VideoCarouselSkeleton = ({ count = 8 }: { count?: number }) => (
  <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={`carousel-skeleton-${i}`} className="flex-shrink-0 w-[220px]">
        <VideoCardSkeleton />
      </div>
    ))}
  </div>
);

/**
 * Skeleton pour un artiste dans la recherche (cercle)
 */
export const ArtistCircleSkeleton = () => (
  <div className="flex-shrink-0 flex flex-col items-center gap-3 p-4">
    <Skeleton className="w-24 h-24 rounded-full" />
    <div className="space-y-2 text-center">
      <Skeleton className="h-4 w-20 mx-auto" />
      <Skeleton className="h-3 w-12 mx-auto" />
    </div>
  </div>
);

/**
 * Skeleton pour une ligne de résultat de recherche (piste)
 */
export const SearchTrackItemSkeleton = () => (
  <div className="flex items-center gap-4 p-3 rounded-xl">
    <Skeleton className="w-12 h-12 rounded-lg flex-shrink-0" />
    <div className="flex-1 min-w-0 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
    <Skeleton className="h-3 w-12" />
    <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
  </div>
);

/**
 * Skeleton pour une carte d'album dans la recherche
 */
export const SearchAlbumCardSkeleton = () => (
  <div className="group text-left rounded-xl overflow-hidden bg-white/5">
    <Skeleton className="aspect-square w-full" />
    <div className="p-3 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  </div>
);

/**
 * Skeleton pour un tableau de tracks de playlist (pour ArtistView)
 */
export const PlaylistTableSkeleton = ({ count = 5 }: { count?: number }) => (
  <div className="max-h-[400px] overflow-y-auto">
    <table className="w-full">
      <tbody>
        {Array.from({ length: count }).map((_, i) => (
          <TableRowSkeleton key={`playlist-table-${i}`} />
        ))}
      </tbody>
    </table>
  </div>
);

/**
 * Skeleton pour les résultats de recherche
 */
export const SearchResultsSkeleton = () => (
  <div className="space-y-8">
    {/* Artists Skeleton */}
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

    {/* Albums Skeleton */}
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

    {/* Tracks Skeleton */}
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="w-5 h-5" />
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="space-y-1 bg-white/5 rounded-2xl p-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <SearchTrackItemSkeleton key={`track-skeleton-${i}`} />
        ))}
      </div>
    </section>
  </div>
);

/**
 * Skeleton pour HomeView - Hero carousel
 */
export const HeroCarouselSkeleton = () => (
  <Skeleton className="w-full h-[480px] rounded-3xl" />
);

/**
 * Skeleton pour HomeView - Quick play grid
 */
export const QuickPlayGridSkeleton = ({ count = 6 }: { count?: number }) => (
  <div className="grid grid-cols-4 md:grid-cols-5 gap-3">
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={`quickplay-${i}`} className="h-20 rounded-xl" />
    ))}
  </div>
);

/**
 * Skeleton pour HomeView - Stats cards
 */
export const StatsGridSkeleton = () => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={`stat-${i}`} className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="w-5 h-5 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
    ))}
  </div>
);

/**
 * Skeleton pour HomeView - Content carousel
 */
export const ContentCarouselSkeleton = ({ title, count = 6, itemWidth = "w-48" }: { title?: string; count?: number; itemWidth?: string }) => (
  <div className="space-y-4">
    <div>
      <Skeleton className="h-6 w-32 mb-2" />
      <Skeleton className="h-4 w-48" />
    </div>
    <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
      {Array.from({ length: count }).map((_, i) => (
        <div key={`carousel-item-${i}`} className={`flex-shrink-0 ${itemWidth}`}>
          <Skeleton className="aspect-square rounded-xl" />
          <Skeleton className="h-4 w-3/4 mt-2 rounded" />
        </div>
      ))}
    </div>
  </div>
);

/**
 * Skeleton pour HomeView - Section avec header et tableau
 */
export const SectionWithTableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <div>
        <Skeleton className="h-6 w-32 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-10 w-24" />
    </div>
    <TrackTableSkeleton count={rows} />
  </div>
);

/**
 * Skeleton complet pour HomeView
 */
export const HomeViewSkeleton = () => (
  <div className="px-6 py-4 space-y-10 animate-fade-in">
    <HeroCarouselSkeleton />
    <QuickPlayGridSkeleton count={6} />
    <StatsGridSkeleton />
    <ContentCarouselSkeleton title="Artistes récents" count={8} />
    <ContentCarouselSkeleton title="Explorer par genre" count={6} />
    <ContentCarouselSkeleton title="Écouté récemment" count={8} />
    <SectionWithTableSkeleton rows={5} />
  </div>
);

/**
 * Skeleton pour PlaylistView
 */
export const PlaylistViewSkeleton = () => (
  <div className="space-y-4 px-6 py-4">
    <div className="flex items-center justify-between">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
    <PlaylistGridSkeleton count={12} />
  </div>
);

/**
 * Skeleton pour ArtistView - Header et playlist
 */
export const ArtistViewSkeleton = () => (
  <div className="space-y-6">
    <div className="relative h-80 bg-gradient-to-b from-primary/30 to-background rounded-2xl overflow-hidden">
      <Skeleton className="absolute inset-0" />
      <div className="absolute bottom-6 left-6 right-6">
        <Skeleton className="h-12 w-48 mb-2 rounded-lg" />
        <Skeleton className="h-4 w-32 rounded" />
      </div>
    </div>
    <div className="px-6 space-y-4">
      <div className="flex gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
      <PlaylistTableSkeleton count={8} />
    </div>
  </div>
);

/**
 * Skeleton pour VideosView
 */
export const VideosViewSkeleton = () => (
  <div className="space-y-6 px-6 py-4">
    <div className="flex items-center justify-between">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
    <VideoCarouselSkeleton count={8} />
    <VideoCarouselSkeleton count={8} />
    <VideoGridSkeleton count={12} />
  </div>
);

/**
 * Skeleton pour SettingsView - Avec tabs
 */
export const SettingsViewSkeleton = () => (
  <div className="h-full overflow-hidden flex flex-col animate-in fade-in duration-200">
    <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/50 border-b border-border/30">
      <div className="px-6 py-4">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
    </div>
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 p-5">
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="w-9 h-9 rounded-lg" />
                <Skeleton className="h-5 w-32" />
              </div>
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="flex items-center justify-between py-3 border-b border-border/30">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-6 w-12" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

/**
 * Skeleton pour CloudView & DownloadsView - Table de fichiers
 */
export const FileTableSkeleton = ({ count = 10 }: { count?: number }) => (
  <div className="bg-card/30 backdrop-blur-sm rounded-xl overflow-hidden border border-border/30">
    <div className="overflow-y-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border/30">
            <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground">Nom</th>
            <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground hidden md:table-cell">Type</th>
            <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground hidden lg:table-cell">Taille</th>
            <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground hidden md:table-cell">Date</th>
            <th className="px-4 py-3 text-right text-xs font-display uppercase tracking-widest text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: count }).map((_, i) => (
            <tr key={`file-skeleton-${i}`} className="border-b border-border/30">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <Skeleton className="h-4 w-16" />
              </td>
              <td className="px-4 py-3 hidden lg:table-cell">
                <Skeleton className="h-4 w-20" />
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <Skeleton className="h-4 w-24" />
              </td>
              <td className="px-4 py-3 text-right">
                <Skeleton className="h-8 w-24 ml-auto" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

