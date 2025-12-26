import { useState, useEffect, useMemo } from "react";
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
  FolderOpen,
  Download,
  ChevronLeft,
  ChevronRight,
  Music,
  Radio,
  Bell,
  Settings,
  Play,
  Cloud,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { usePlaylists } from "@/hooks/usePlaylists";
import { usePlaylistMetadata } from "@/hooks/usePlaylistMetadata";
import { CreatePlaylistModal } from "@/components/PlaylistModal";
import { PlaylistContextMenu } from "@/components/PlaylistContextMenu";
import { toast } from "sonner";
import { useNotifications } from "@/hooks/useNotifications";
import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";
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
  | "local"
  | "downloads"
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
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onPlayPlaylist?: (playlistId: string) => void;
  onShufflePlaylist?: (playlistId: string) => void;
}

const mainNavItems = [
  { id: "home" as ViewType, icon: Home, label: "Accueil" },
  { id: "search" as ViewType, icon: Search, label: "Rechercher" },
  { id: "library" as ViewType, icon: Library, label: "Bibliothèque" },
  { id: "notifications" as ViewType, icon: Bell, label: "Notifications" },
];

const libraryItems = [
  { id: "favorites" as ViewType, icon: Heart, label: "Favoris", color: "text-rose-400" },
  { id: "recent" as ViewType, icon: Clock, label: "Récents", color: "text-amber-400" },
  { id: "albums" as ViewType, icon: Disc3, label: "Albums", color: "text-violet-400" },
  { id: "artists" as ViewType, icon: Users, label: "Artistes", color: "text-emerald-400" },
];

const mediaItems = [
  { id: "videos" as ViewType, icon: Video, label: "Vidéos" },
  { id: "audio-senses" as ViewType, icon: Radio, label: "Sens Audio" },
];

const localItems = [
  { id: "local" as ViewType, icon: FolderOpen, label: "Fichiers Locaux" },
  { id: "downloads" as ViewType, icon: Download, label: "Téléchargements" },
  { id: "cloud" as ViewType, icon: Cloud, label: "Cloud Storage", color: "text-cyan-400" },
];

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
        "relative w-full flex items-center rounded-xl transition-all duration-300 ease-out group",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        collapsed ? "px-3 py-3 justify-center" : "px-4 py-3 gap-3",
        isActive
          ? "bg-gradient-to-r from-primary/20 via-primary/10 to-transparent text-primary shadow-lg shadow-primary/10"
          : "text-muted-foreground hover:text-foreground hover:bg-white/5 active:bg-white/10",
      )}
    >
      {/* Animated glow border for active */}
      {isActive && (
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/30 to-secondary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-xl" />
      )}

      {/* Left accent line */}
      {isActive && !collapsed && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-primary via-primary to-secondary rounded-r-full shadow-lg shadow-primary/50" />
      )}

      <div
        className={cn(
          "relative flex items-center justify-center transition-all duration-300",
          collapsed ? "w-6 h-6" : "w-5 h-5",
          isActive && "animate-pulse-glow",
        )}
      >
        <Icon
          className={cn(
            "flex-shrink-0 transition-all duration-300",
            collapsed ? "w-5 h-5" : "w-[18px] h-[18px]",
            isActive ? "scale-110" : "group-hover:scale-110",
            color && !isActive && color,
          )}
        />
      </div>

      {!collapsed && (
        <>
          <span
            className={cn(
              "text-sm font-medium flex-1 text-left truncate transition-all duration-300",
              isActive && "font-semibold",
            )}
          >
            {label}
          </span>
          {badge !== undefined && badge > 0 && (
            <span
              className={cn(
                "min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full flex items-center justify-center transition-all duration-300",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-white/10 text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary",
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
        <TooltipContent side="right" className="flex items-center gap-2 bg-card/95 backdrop-blur-xl border-border/50">
          <span className="font-medium">{label}</span>
          {badge !== undefined && badge > 0 && (
            <span className="px-1.5 py-0.5 text-xs font-bold rounded-full bg-primary/20 text-primary flex items-center justify-center">
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
      <h3 className="text-[10px] font-display uppercase tracking-[0.2em] text-muted-foreground/50">{children}</h3>
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
  collapsed: controlledCollapsed,
  onCollapsedChange,
  onPlayPlaylist,
  onShufflePlaylist,
}: SidebarProps) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const hookPlaylists = usePlaylists();
  // Use prop playlists if provided (from DesktopApp), otherwise use hook playlists
  const playlists = propPlaylists ?? hookPlaylists.playlists;
  const { createPlaylist, updatePlaylist, deletePlaylist } = hookPlaylists;
  const { notifySuccess } = useNotifications();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<{ id: string; name: string } | null>(null);
  
  // Enrich playlists with metadata (covers, duration, artists)
  const playlistMetadata = usePlaylistMetadata(playlists, tracks);

  // Wrapper pour mesurer les temps de réponse au clic sur les nav items
  const handleViewChangeWithMetrics = (newView: ViewType, source: string) => {
    const startTime = performance.now();
    const timestamp = new Date().toISOString();
    
    console.log(`🖱️ [Sidebar] Clic sur nav item:`, {
      view: newView,
      source,
      timestamp,
      previousView: currentView,
      startTime: startTime.toFixed(2),
    });

    // Appeler la fonction de changement de vue
    onViewChange(newView);

    // Mesurer le temps après le changement (asynchrone pour capturer le re-render)
    requestAnimationFrame(() => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`⏱️ [Sidebar] Temps de réponse:`, {
        view: newView,
        source,
        duration: `${duration.toFixed(2)}ms`,
        timestamp: new Date().toISOString(),
        performance: duration < 16 ? '✅ Excellent (< 16ms)' : duration < 50 ? '✅ Bon (< 50ms)' : duration < 100 ? '⚠️ Acceptable (< 100ms)' : '❌ Lent (> 100ms)',
      });
    });
  };

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
        className={cn(
          "h-full flex flex-col transition-all duration-500 ease-out relative",
          "bg-gradient-to-b from-card/80 via-card/60 to-card/40 backdrop-blur-2xl",
          "border-r border-white/5",
          collapsed ? "w-[72px]" : "w-60",
        )}
      >
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none" />

        {/* Top section with logo */}
        <div
          className={cn(
            "relative flex items-center border-b border-white/5 transition-all duration-500",
            collapsed ? "px-3 py-4 justify-center hidden" : "px-4 py-5",
          )}
        >
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div
                className={cn(
                  "rounded-lg bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/20 flex items-center justify-center border border-primary/20 group-hover:border-primary/40 transition-all duration-300 overflow-hidden",
                  collapsed ? "w-10 h-10" : "w-7 h-7",
                )}
              >
                <img 
                  src="/icon.png" 
                  alt="NEXUS" 
                  className={cn("object-contain", collapsed ? "w-10 h-10" : "w-7 h-7")}
                />
              </div>
              <div className="absolute inset-0 rounded-lg bg-primary/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
            </div>
            {!collapsed && (
              <div className="animate-in fade-in slide-in-from-left-2 duration-500">
                <h1 className="font-display text-lg font-bold tracking-wider bg-gradient-to-r from-primary via-foreground to-secondary bg-clip-text text-transparent">
                  NEXUS
                </h1>
                <p className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground/50">Audio System</p>
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
            "bg-card/90 backdrop-blur-xl border border-white/10",
            "flex items-center justify-center",
            "text-muted-foreground hover:text-primary hover:border-primary/50",
            "transition-all duration-300 ease-out",
            "hover:shadow-lg hover:shadow-primary/20",
            "active:scale-95",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
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
                  badge={item.id === "notifications" ? notificationsCount : undefined}
                  collapsed={collapsed}
                />
              ))}
            </div>

            {/* Your Library */}
            <div className="mb-6">
              <SectionTitle collapsed={collapsed}>Ma Musique</SectionTitle>
              <div className="space-y-1">
                {libraryItems.map((item) => (
                  <NavItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    isActive={currentView === item.id}
                    onClick={() => handleViewChangeWithMetrics(item.id, `library-${item.label}`)}
                    badge={item.id === "favorites" ? favoritesCount : undefined}
                    collapsed={collapsed}
                    color={item.color}
                  />
                ))}
              </div>
            </div>

            {/* Media */}
            <div className="mb-6">
              <SectionTitle collapsed={collapsed}>Médias</SectionTitle>
              <div className="space-y-1">
                {mediaItems.map((item) => (
                  <NavItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    isActive={currentView === item.id}
                    onClick={() => handleViewChangeWithMetrics(item.id, `media-${item.label}`)}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            </div>

            {/* Local Files */}
            <div className="mb-6">
              <SectionTitle collapsed={collapsed}>Local</SectionTitle>
              <div className="space-y-1">
                {localItems.map((item) => (
                  <NavItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    isActive={currentView === item.id}
                    onClick={() => handleViewChangeWithMetrics(item.id, `local-${item.label}`)}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            </div>

            {/* Playlists - Only show when expanded */}
            {!collapsed && (
              <div className="animate-in fade-in slide-in-from-left-2 duration-500">
                <SectionTitle
                  collapsed={collapsed}
                  action={
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setCreateModalOpen(true)}
                          aria-label="Créer une playlist"
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
                      <TooltipContent>Créer une playlist</TooltipContent>
                    </Tooltip>
                  }
                >
                  Playlists
                </SectionTitle>

                <div className="space-y-1">
                  {playlists.slice(0, 5).map((playlist) => {
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
                        if (confirm(`Supprimer la playlist "${playlist.name}" ?`)) {
                          await deletePlaylist(playlist.id)
                          const message = "Playlist supprimée"
                          toast.success(message)
                          notifySuccess(message)
                        }
                      }}
                      onView={() => handleViewChangeWithMetrics("playlists", `playlist-view-${playlist.id}`)}
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
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-xs font-medium truncate">{playlist.name}</p>
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
                  <span className="font-medium">Playlists ({playlists.length})</span>
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
            <NavItem
              icon={Settings}
              label="Paramètres"
              isActive={currentView === "settings"}
              onClick={() => handleViewChangeWithMetrics("settings", "settings")}
              collapsed={collapsed}
            />
          </div>

          {/* Sync Status */}
          {!collapsed && (
            <div className="mt-4 px-2">
              <SyncStatusIndicator />
            </div>
          )}
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
