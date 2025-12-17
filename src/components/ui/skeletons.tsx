import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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

