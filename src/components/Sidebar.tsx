import { useState, useEffect, useMemo, useCallback, startTransition } from "react";
import { 
  Home, 
  Library, 
  Search, 
  Heart, 
  ListMusic, 
  Clock, 
  Disc3, 
  Users, 
  Video,
  Plus,
  ChevronLeft,
  ChevronRight,
  Music,
  Radio,
  Bell,
  Settings,
  Play,
  Cloud
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { usePlaylists } from "@/hooks/usePlaylists";
import { usePlaylistMetadata } from "@/hooks/usePlaylistMetadata";
import { usePlaylistFavorites } from "@/hooks/usePlaylistFavorites";
import { CreatePlaylistModal } from "@/components/PlaylistModal";
import { PlaylistContextMenu } from "@/components/PlaylistContextMenu";
import { toast } from "sonner";
import { useNotifications } from "@/hooks/useNotifications";
import { useI18n } from "@/i18n";

import type { Track, Playlist } from "@/types/music";

export type ViewType = 
  | "home" 
  | "library" 
  | "search" 
  | "favorites" 
  | "playlists" 
  | "recent" 
  | "albums" 
  | "artists" 
  | "videos"
  | "cloud"
  | "settings"
  | "audio-senses"
  | "album-detail"
  | "artist-detail"
  | "player"
  | "notifications";

interface SidebarProps {
  tracks?: Track[];
  playlists?: Playlist[];
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  favoritesCount?: number;
  notificationsCount?: number;
  recentCount?: number;
  albumsCount?: number;
  artistsCount?: number;
  videosCount?: number;
  cloudCount?: number;
  playlistsCount?: number;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onPlayPlaylist?: (playlistId: string) => void;
  onShufflePlaylist?: (playlistId: string) => void;
}

interface NavItemProps {
  icon: typeof Home;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
  collapsed?: boolean;
  color?: string;
}

const NavItem = ({ icon: Icon, label, isActive, onClick, badge, collapsed, color }: NavItemProps) => {
  const button = (
    <button
      onClick={onClick}
      className={cn(
        // Base styles - Theme-aware Vision Pro
        "relative w-full flex items-center rounded-xl",
        "transition-all duration-300 ease-out group/nav",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/30",
        collapsed ? "px-0 py-3 justify-center" : "px-4 py-3 gap-3",
        // Active state - Using sidebar semantic tokens
        isActive
          ? cn(
              "bg-sidebar-accent/80 backdrop-blur-xl",
              "border border-sidebar-primary/30",
              "shadow-lg shadow-sidebar-primary/10",
              "text-sidebar-foreground"
            )
          : cn(
              "text-sidebar-foreground/70",
              "hover:text-sidebar-foreground",
              "hover:bg-sidebar-accent/50",
              "border border-transparent"
            ),
      )}
    >
      {/* Glow effect for active state */}
      {isActive && !collapsed && (
        <div 
          className="absolute inset-0 rounded-xl opacity-50 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 100% 100% at 50% 0%, hsl(var(--sidebar-primary) / 0.2) 0%, transparent 70%)'
          }}
        />
      )}

      <div
        className={cn(
          "relative flex items-center justify-center transition-all duration-200",
          collapsed ? "w-7 h-7" : "w-5 h-5",
        )}
      >
        <Icon
          className={cn(
            "flex-shrink-0 transition-all duration-300",
            collapsed ? "w-5 h-5" : "w-[18px] h-[18px]",
            isActive 
              ? "text-sidebar-primary drop-shadow-[0_0_8px_hsl(var(--sidebar-primary)/0.5)]" 
              : color || "text-current",
            "group-hover/nav:scale-110",
          )}
        />
      </div>

      {collapsed && badge !== undefined && badge > 0 && (
        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-sidebar-primary shadow-lg shadow-sidebar-primary/50 animate-pulse" />
      )}

      {!collapsed && (
        <>
          <span
            className={cn(
              "text-[13px] flex-1 text-left truncate transition-colors duration-200",
              isActive ? "font-semibold text-sidebar-foreground" : "font-medium",
            )}
          >
            {label}
          </span>
          {badge !== undefined && badge > 0 && (
            <span
              className={cn(
                "min-w-[22px] h-[22px] px-1.5 text-[11px] font-semibold rounded-full",
                "flex items-center justify-center",
                "bg-sidebar-accent backdrop-blur-sm text-sidebar-accent-foreground",
                "border border-sidebar-border/50",
                "transition-all duration-200",
              )}
            >
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </>
      )}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent 
          side="right" 
          className={cn(
            "flex items-center gap-2",
            "bg-popover/95 backdrop-blur-2xl",
            "border border-border",
            "shadow-xl"
          )}
        >
          <span className="font-medium text-popover-foreground">{label}</span>
          {badge !== undefined && badge > 0 && (
            <span 
              className={cn(
                "px-1.5 py-0.5 text-xs font-bold rounded-full",
                "bg-primary/20 text-primary"
              )}
            >
              {badge}
            </span>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
};

const SectionTitle = ({
  children,
  collapsed,
  action,
}: { children: React.ReactNode; collapsed?: boolean; action?: React.ReactNode }) => {
  if (collapsed) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <h3 className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/40">{children}</h3>
      {action}
    </div>
  );
};

export const Sidebar = ({ 
  tracks = [],
  playlists: propPlaylists,
  currentView, 
  onViewChange, 
  favoritesCount,
  notificationsCount,
  recentCount,
  albumsCount,
  artistsCount,
  videosCount,
  cloudCount,
  playlistsCount,
  collapsed: controlledCollapsed,
  onCollapsedChange,
  onPlayPlaylist,
  onShufflePlaylist,
}: SidebarProps) => {
  const { t } = useI18n();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const hookPlaylists = usePlaylists();
  // Use prop playlists if provided (from DesktopApp), otherwise use hook playlists
  const allPlaylists = propPlaylists ?? hookPlaylists.playlists;
  const { createPlaylist, updatePlaylist, deletePlaylist } = hookPlaylists;
  const { notifySuccess } = useNotifications();

  const mainNavItems = useMemo(
    () => [
      { id: "home" as ViewType, icon: Home, label: t("navHome") },
      { id: "search" as ViewType, icon: Search, label: t("navSearch") },
      { id: "library" as ViewType, icon: Library, label: t("navLibrary") },
      { id: "playlists" as ViewType, icon: ListMusic, label: t("navPlaylists") },
      { id: "notifications" as ViewType, icon: Bell, label: t("navNotifications") },
    ],
    [t]
  );

  const libraryItems = useMemo(
    () => [
      { id: "favorites" as ViewType, icon: Heart, label: t("navFavorites"), color: "text-rose-400" },
      { id: "recent" as ViewType, icon: Clock, label: t("navRecent"), color: "text-amber-400" },
      { id: "albums" as ViewType, icon: Disc3, label: t("navAlbums"), color: "text-violet-400" },
      { id: "artists" as ViewType, icon: Users, label: t("navArtists"), color: "text-emerald-400" },
    ],
    [t]
  );

  const mediaItems = useMemo(
    () => [
      { id: "videos" as ViewType, icon: Video, label: t("navVideos") },
      { id: "audio-senses" as ViewType, icon: Radio, label: t("navAudioSenses") },
    ],
    [t]
  );

  const localItems = useMemo(
    () => [
      { id: "cloud" as ViewType, icon: Cloud, label: t("navCloudStorage"), color: "text-cyan-400" },
    ],
    [t]
  );
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<{ id: string; name: string } | null>(null);
  
  // Fonction helper pour obtenir le badge d'un élément
  const getBadgeForItem = (itemId: ViewType): number | undefined => {
    switch (itemId) {
      case "notifications":
        return notificationsCount;
      case "playlists":
        return playlistsCount;
      case "favorites":
        return favoritesCount;
      case "recent":
        return recentCount;
      case "albums":
        return albumsCount;
      case "artists":
        return artistsCount;
      case "videos":
        return videosCount;
      case "cloud":
        return cloudCount;
      default:
        return undefined;
    }
  };
  
  // Gestion centralisée des playlists favorites
  const { isFavorite: isPlaylistFavorite, toggleFavorite: togglePlaylistFavorite, favoritePlaylistIds } = usePlaylistFavorites();
  
  // Filtrer pour ne montrer que les playlists favorites dans la sidebar
  // Utiliser directement favoritePlaylistIds pour que le filtre se mette à jour immédiatement
  const playlists = useMemo(() => {
    const favoriteIdsSet = new Set(favoritePlaylistIds);
    return allPlaylists.filter(playlist => favoriteIdsSet.has(playlist.id));
  }, [allPlaylists, favoritePlaylistIds]);
  
  // Enrich playlists with metadata (covers, duration, artists)
  const playlistMetadata = usePlaylistMetadata(playlists, tracks);

  // Optimized view change with startTransition for non-blocking updates
  const handleViewChangeWithMetrics = useCallback((newView: ViewType, source: string) => {
    const startTime = performance.now();
    
    // Use startTransition to mark this as a non-urgent update
    startTransition(() => {
      onViewChange(newView);
    });

    void startTime;
  }, [onViewChange]);

  const handleCollapsedChange = (value: boolean) => {
    if (onCollapsedChange) {
      onCollapsedChange(value);
    } else {
      setInternalCollapsed(value);
    }
  };

  // Load collapsed state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('nexus-sidebar-collapsed');
    if (saved !== null) {
      handleCollapsedChange(saved === 'true');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save collapsed state
  useEffect(() => {
    localStorage.setItem('nexus-sidebar-collapsed', String(collapsed));
  }, [collapsed]);

    return (
    <TooltipProvider>
      <div
        data-coachmark="sidebar"
        className={cn(
          "h-full flex flex-col relative group",
          "transition-all duration-500 ease-out-expo",
          // Theme-aware glass sidebar using semantic tokens
          "bg-sidebar-background/95 backdrop-blur-2xl",
          "border-r border-sidebar-border/50",
          collapsed ? "w-[72px]" : "w-64",
        )}
      >
        {/* Ambient top glow - uses primary from current theme */}
        <div 
          className="absolute inset-x-0 top-0 h-32 pointer-events-none opacity-40"
          style={{
            background: 'radial-gradient(ellipse 100% 100% at 50% 0%, hsl(var(--sidebar-primary) / 0.15) 0%, transparent 70%)'
          }}
        />
        
        {/* Subtle edge highlight */}
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-sidebar-border/40 via-sidebar-border/20 to-transparent pointer-events-none" />

        {/* Top section with logo */}
        <div
          className={cn(
            "relative flex items-center border-b border-sidebar-border/30 transition-all duration-500",
            collapsed ? "px-3 py-4 justify-center hidden" : "px-4 py-5",
          )}
        >
          <div className="flex items-center gap-3">
            <div className="relative group/logo">
              <div
                className={cn(
                  "rounded-xl bg-gradient-to-br from-sidebar-primary/20 via-sidebar-primary/10 to-sidebar-accent/30",
                  "flex items-center justify-center",
                  "border border-sidebar-primary/20 group-hover/logo:border-sidebar-primary/40",
                  "transition-all duration-300 overflow-hidden",
                  "shadow-lg shadow-sidebar-primary/10",
                  collapsed ? "w-10 h-10" : "w-8 h-8",
                )}
              >
                <img 
                  src="/icon.png" 
                  alt="NEXUS" 
                  className={cn("object-contain", collapsed ? "w-10 h-10" : "w-8 h-8")}
                />
              </div>
              <div className="absolute inset-0 rounded-xl bg-sidebar-primary/20 blur-lg opacity-0 group-hover/logo:opacity-100 transition-opacity duration-300 -z-10" />
            </div>
            {!collapsed && (
              <div className="animate-in fade-in slide-in-from-left-2 duration-500">
                <h1 className="font-display text-lg font-bold tracking-wider bg-gradient-to-r from-sidebar-primary via-sidebar-foreground to-sidebar-accent-foreground bg-clip-text text-transparent">
                  NEXUS
                </h1>
                <p className="text-[9px] uppercase tracking-[0.3em] text-sidebar-foreground/40">{t("appSubtitle")}</p>
              </div>
            )}
          </div>
        </div>

        {/* Collapse Toggle Button */}
        <button
          onClick={() => handleCollapsedChange(!collapsed)}
          className={cn(
            "absolute -right-3 top-20 z-50",
            "w-6 h-6 rounded-full",
            "bg-sidebar-accent/90 backdrop-blur-xl",
            "border border-sidebar-border",
            "flex items-center justify-center",
            "text-sidebar-foreground/70 hover:text-sidebar-primary hover:border-sidebar-primary/50",
            "transition-all duration-300 ease-out",
            "hover:shadow-lg hover:shadow-sidebar-primary/20",
            "active:scale-95",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/50",
          )}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        <ScrollArea className="flex-1 py-2">
          <div className={cn("transition-all duration-500", collapsed ? "px-2" : "px-2")}>
            {/* Main Navigation */}
            <div className="space-y-1 mb-6">
              {mainNavItems.map((item) => (
                <NavItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  isActive={currentView === item.id}
                  onClick={() => handleViewChangeWithMetrics(item.id, `mainNav-${item.label}`)}
                  badge={getBadgeForItem(item.id)}
                  collapsed={collapsed}
                />
              ))}
            </div>

            {/* Your Library */}
            <div className="mb-6">
              <SectionTitle collapsed={collapsed}>{t("sectionMyMusic")}</SectionTitle>
              <div className="space-y-1">
                {libraryItems.map((item) => (
                  <NavItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    isActive={currentView === item.id}
                    onClick={() => handleViewChangeWithMetrics(item.id, `library-${item.label}`)}
                    badge={getBadgeForItem(item.id)}
                    collapsed={collapsed}
                    color={item.color}
                  />
                ))}
              </div>
            </div>

            {/* Media */}
            <div className="mb-6">
              <SectionTitle collapsed={collapsed}>{t("sectionMedia")}</SectionTitle>
              <div className="space-y-1">
                {mediaItems.map((item) => (
                  <NavItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    isActive={currentView === item.id}
                    onClick={() => handleViewChangeWithMetrics(item.id, `media-${item.label}`)}
                    badge={getBadgeForItem(item.id)}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            </div>

            {/* Cloud */}
            <div className="mb-6">
              <SectionTitle collapsed={collapsed}>{t("sectionCloud")}</SectionTitle>
              <div className="space-y-1">
                {localItems.map((item) => (
                  <NavItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    isActive={currentView === item.id}
                    onClick={() => handleViewChangeWithMetrics(item.id, `local-${item.label}`)}
                    badge={getBadgeForItem(item.id)}
                    collapsed={collapsed}
                    color={item.color}
                  />
                ))}
              </div>
            </div>

            {/* Playlists - Only show when expanded */}
            {!collapsed && (
              <div 
                data-coachmark="sidebar-playlists"
                className="animate-in fade-in slide-in-from-left-2 duration-500"
              >
                <SectionTitle
                  collapsed={collapsed}
                  action={
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setCreateModalOpen(true)}
                          aria-label={t("actionCreatePlaylist")}
                          className={cn(
                            "p-1.5 rounded-lg transition-all duration-300",
                            "text-muted-foreground/50 hover:text-primary",
                            "hover:bg-primary/10 active:scale-95",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                          )}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{t("actionCreatePlaylist")}</TooltipContent>
                    </Tooltip>
                  }
                >
                  {t("sectionPlaylists")}
                </SectionTitle>

                <div className="space-y-1">
                  {playlists.map((playlist) => {
                    const metadata = playlistMetadata.find(m => m.playlist.id === playlist.id);
                    return (
                    <PlaylistContextMenu
                      key={playlist.id}
                      playlist={playlist}
                      onPlay={() => {
                        handleViewChangeWithMetrics("playlists", `playlist-play-${playlist.id}`)
                        if (onPlayPlaylist) {
                          onPlayPlaylist(playlist.id)
                        }
                      }}
                      onShuffle={() => {
                        handleViewChangeWithMetrics("playlists", `playlist-shuffle-${playlist.id}`)
                        if (onShufflePlaylist) {
                          onShufflePlaylist(playlist.id)
                        }
                      }}
                      onEdit={() => {
                        setEditingPlaylist({ id: playlist.id, name: playlist.name })
                      }}
                      onDelete={async () => {
                        if (confirm(t("actionDeletePlaylistConfirm", { name: playlist.name }))) {
                          await deletePlaylist(playlist.id)
                          const message = t("toastPlaylistDeleted")
                          toast.success(message)
                          notifySuccess(message)
                        }
                      }}
                      onView={() => handleViewChangeWithMetrics("playlists", `playlist-view-${playlist.id}`)}
                      onToggleFavorite={() => togglePlaylistFavorite(playlist.id)}
                      isFavorite={isPlaylistFavorite(playlist.id)}
                    >
                      <div
                        onClick={() => handleViewChangeWithMetrics("playlists", `playlist-item-${playlist.id}`)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg group cursor-pointer",
                          "text-foreground/85 bg-white/1.5 border border-white/4",
                          "hover:bg-white/3 hover:border-white/6",
                          "transition-all duration-200 ease-out",
                        )}
                      >
                        <div className="flex-shrink-0">
                          {metadata && metadata.coverUrls.some(c => c) ? (
                            <div className="grid grid-cols-2 gap-1 w-8 h-8 rounded-md overflow-hidden border border-white/8 shadow-sm">
                              {metadata.coverUrls.map((coverUrl, idx) => (
                                <div
                                  key={idx}
                                  className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center"
                                >
                                  {coverUrl ? (
                                    <img
                                      src={coverUrl}
                                      alt=""
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <Music className="w-1.5 h-1.5 text-white/40" />
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : metadata?.coverUrl ? (
                            <div
                              className={cn(
                                "w-8 h-8 rounded-md flex items-center justify-center",
                                "border border-white/8 overflow-hidden",
                                "shadow-sm",
                              )}
                            >
                              <img
                                src={metadata.coverUrl}
                                alt={playlist.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div
                              className={cn(
                                "w-8 h-8 rounded-md flex items-center justify-center",
                                "bg-gradient-to-br from-primary/30 to-secondary/30",
                                "border border-white/8",
                              )}
                            >
                              <Music className="w-3.5 h-3.5 text-white/60" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 text-left min-w-0 max-w-[8rem]">
                          <p className="text-xs font-medium truncate max-w-xs">{playlist.name}</p>
                          <p className="text-[10px] text-muted-foreground/60">
                            {metadata?.trackCount || 0} titres
                            {metadata && metadata.trackCount > 0 && (
                              <>
                                {" • "}
                                {Math.floor(metadata.totalDuration / 60)}m
                              </>
                            )}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (onPlayPlaylist) onPlayPlaylist(playlist.id)
                          }}
                          aria-label={`Lire la playlist ${playlist.name}`}
                          className="p-1 rounded-md text-white/60 hover:text-white hover:bg-white/15 transition-colors"
                        >
                          <Play className="w-3 h-3 fill-current" />
                        </button>
                      </div>
                    </PlaylistContextMenu>
                  );
                  })}

                  {playlists.length === 0 && (
                    <p className="px-4 py-6 text-xs text-muted-foreground/40 italic text-center">Aucune playlist</p>
                  )}

                  {playlists.length > 5 && (
                    <button
                      onClick={() => handleViewChangeWithMetrics("playlists", "playlist-see-all")}
                      className={cn(
                        "w-full px-4 py-2 text-xs font-medium",
                        "text-primary/70 hover:text-primary",
                        "hover:bg-primary/5 rounded-lg",
                        "transition-all duration-300",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                      )}
                    >
                      Voir tout ({playlists.length})
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Collapsed playlist indicator */}
            {collapsed && playlists.length > 0 && (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleViewChangeWithMetrics("playlists", "playlist-collapsed")}
                    className={cn(
                      "w-full flex items-center justify-center px-3 py-3 rounded-xl",
                      "text-muted-foreground hover:text-foreground hover:bg-white/5",
                      "transition-all duration-300 ease-out",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    )}
                  >
                    <div className="relative">
                      <ListMusic className="w-5 h-5" />
                      <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] font-bold rounded-full bg-primary/20 text-primary flex items-center justify-center">
                        {playlists.length}
                      </span>
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-card/95 backdrop-blur-xl border-border/50">
                  <span className="font-medium">{t("tooltipPlaylistsCount", { count: playlists.length })}</span>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </ScrollArea>

        {/* Bottom section */}
        <div
          className={cn("border-t border-white/5 transition-all duration-500", collapsed ? "px-2 py-3" : "px-2 py-3")}
        >
          {/* Settings & Notifications */}
          <div className="space-y-1">
            <div data-coachmark="sidebar-settings">
              <NavItem
                icon={Settings}
                label="Paramètres"
                isActive={currentView === "settings"}
                onClick={() => handleViewChangeWithMetrics("settings", "settings")}
                collapsed={collapsed}
              />
            </div>
          </div>
        </div>

        {/* Create Playlist Modal */}
        <CreatePlaylistModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          onCreatePlaylist={async (name: string, trackIds: string[]) => {
            await createPlaylist(name, trackIds)
            setCreateModalOpen(false)
            toast.success("Playlist créée")
            notifySuccess("Playlist créée")
          }}
        />

        {/* Edit Playlist Modal */}
        {editingPlaylist && (
          <CreatePlaylistModal
            open={!!editingPlaylist}
            onOpenChange={(open) => !open && setEditingPlaylist(null)}
            onCreatePlaylist={async (name: string, trackIds: string[]) => {
              await updatePlaylist(editingPlaylist.id, { name })
              setEditingPlaylist(null)
              toast.success("Playlist renommée")
              notifySuccess("Playlist renommée")
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
};
