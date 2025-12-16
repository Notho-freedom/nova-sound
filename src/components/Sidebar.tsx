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
  MoreVertical,
  Edit,
  Trash2,
  Radio,
  Bell
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePlaylists } from "@/hooks/usePlaylists";
import { CreatePlaylistModal } from "@/components/PlaylistModal";
import { PlaylistContextMenu } from "@/components/PlaylistContextMenu";
import { toast } from "sonner";
import { useNotifications } from "@/hooks/useNotifications";
import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";

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
  | "settings"
  | "audio-senses"
  | "album-detail"
  | "artist-detail"
  | "player"
  | "notifications";

interface SidebarProps {
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
  { id: "favorites" as ViewType, icon: Heart, label: "Favoris" },
  { id: "playlists" as ViewType, icon: ListMusic, label: "Playlists" },
  { id: "recent" as ViewType, icon: Clock, label: "Récents" },
  { id: "albums" as ViewType, icon: Disc3, label: "Albums" },
  { id: "artists" as ViewType, icon: Users, label: "Artistes" },
];

const mediaItems = [
  { id: "videos" as ViewType, icon: Video, label: "Vidéos" },
  { id: "audio-senses" as ViewType, icon: Radio, label: "Sens Audio" },
];

const localItems = [
  { id: "local" as ViewType, icon: FolderOpen, label: "Fichiers Locaux" },
  { id: "downloads" as ViewType, icon: Download, label: "Téléchargements" },
];

interface NavItemProps {
  icon: typeof Home;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
  collapsed?: boolean;
}

const NavItem = ({ icon: Icon, label, isActive, onClick, badge, collapsed }: NavItemProps) => {
  const button = (
    <button
      onClick={onClick}
      className={cn(
        "relative w-full flex items-center rounded-lg transition-all duration-200 ease-out group",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
        collapsed 
          ? "px-2.5 py-2.5 justify-center" 
          : "px-3 py-2.5 gap-3",
        isActive 
          ? "bg-primary/20 text-primary" 
          : "text-muted-foreground hover:text-foreground hover:bg-muted/40 active:bg-muted/60"
      )}
    >
      {/* Active indicator bar */}
      {isActive && !collapsed && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
      )}
      
      <Icon className={cn(
        "flex-shrink-0 transition-all duration-200",
        collapsed ? "w-5 h-5" : "w-[18px] h-[18px]",
        isActive ? "scale-105" : "group-hover:scale-105"
      )} />
      
      {!collapsed && (
        <>
          <span className="text-sm font-medium flex-1 text-left truncate transition-colors duration-200">
            {label}
          </span>
          {badge !== undefined && badge > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-secondary/20 text-secondary transition-all duration-200 group-hover:bg-secondary/30">
              {badge}
            </span>
          )}
        </>
      )}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          {button}
        </TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          {label}
          {badge !== undefined && badge > 0 && (
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-secondary/20 text-secondary">
              {badge}
            </span>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
};

const SectionTitle = ({ children, collapsed }: { children: React.ReactNode; collapsed?: boolean }) => {
  if (collapsed) return null;
  return (
    <h3 className="px-3 py-2.5 mb-1 text-[10px] font-display uppercase tracking-widest text-muted-foreground/60 transition-opacity duration-200">
      {children}
    </h3>
  );
};

export const Sidebar = ({ 
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
  const { playlists, createPlaylist, updatePlaylist, deletePlaylist } = usePlaylists();
  const { notifySuccess } = useNotifications();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<{ id: string; name: string } | null>(null);
  const [windowHeight, setWindowHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 1080);

  // Track window height for dynamic spacing
  useEffect(() => {
    const handleResize = () => {
      setWindowHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate dynamic spacing based on window height
  const dynamicSpacing = useMemo(() => {
    // Base spacing values (in rem)
    const minItemSpacing = 0.125; // 0.125rem (space-y-0.5 equivalent)
    const maxItemSpacing = 0.5; // 0.5rem (space-y-2 equivalent)
    const minSectionMargin = 1.5; // 1.5rem (mb-6)
    const maxSectionMargin = 3; // 3rem (mb-12)
    
    // Window height ranges (in pixels)
    const minHeight = 600;
    const maxHeight = 1440;
    
    // Clamp window height to reasonable bounds
    const clampedHeight = Math.max(minHeight, Math.min(maxHeight, windowHeight));
    
    // Calculate interpolation ratio (0 to 1)
    const ratio = (clampedHeight - minHeight) / (maxHeight - minHeight);
    
    // Interpolate spacing values linearly
    const itemSpacing = minItemSpacing + (maxItemSpacing - minItemSpacing) * ratio;
    const sectionMargin = minSectionMargin + (maxSectionMargin - minSectionMargin) * ratio;
    
    return {
      item: itemSpacing,
      section: sectionMargin,
    };
  }, [windowHeight]);

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
  }, []);

  // Save collapsed state
  useEffect(() => {
    localStorage.setItem('nexus-sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  return (
    <div 
      className={cn(
        "h-full flex flex-col bg-card/50 backdrop-blur-sm border-r border-border/50 transition-all duration-300 ease-in-out relative",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Collapse Toggle Button */}
      <button
        onClick={() => handleCollapsedChange(!collapsed)}
        className={cn(
          "absolute -right-3 top-1/2 -translate-y-1/2 z-50",
          "w-6 h-6 rounded-full bg-card border border-border/80",
          "flex items-center justify-center",
          "text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-card/90",
          "transition-all duration-200 ease-out active:scale-95",
          "shadow-md hover:shadow-lg",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
        )}
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>

      <ScrollArea className="flex-1">
        <div className={cn(
          "transition-all duration-300",
          collapsed ? "px-2 py-3" : "px-3 py-4"
        )}>
          {/* Main Navigation */}
          <div 
            style={{
              marginBottom: !collapsed ? `${dynamicSpacing.section}rem` : `${dynamicSpacing.section * 0.6}rem`,
            }}
          >
            <div style={{ gap: `${dynamicSpacing.item}rem` }} className="flex flex-col">
              {mainNavItems.map((item) => (
                <NavItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  isActive={currentView === item.id}
                  onClick={() => onViewChange(item.id)}
                  badge={item.id === "notifications" ? notificationsCount : undefined}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>

          {/* Library */}
          <div 
            style={{
              marginBottom: !collapsed ? `${dynamicSpacing.section}rem` : `${dynamicSpacing.section * 0.6}rem`,
            }}
          >
            <SectionTitle collapsed={collapsed}>Ma Musique</SectionTitle>
            <div style={{ gap: `${dynamicSpacing.item}rem` }} className="flex flex-col">
              {libraryItems.map((item) => (
                <NavItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  isActive={currentView === item.id}
                  onClick={() => onViewChange(item.id)}
                  badge={item.id === "favorites" ? favoritesCount : undefined}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>

          {/* Media */}
          <div 
            style={{
              marginBottom: !collapsed ? `${dynamicSpacing.section}rem` : `${dynamicSpacing.section * 0.6}rem`,
            }}
          >
            <SectionTitle collapsed={collapsed}>Médias</SectionTitle>
            <div style={{ gap: `${dynamicSpacing.item}rem` }} className="flex flex-col">
              {mediaItems.map((item) => (
                <NavItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  isActive={currentView === item.id}
                  onClick={() => onViewChange(item.id)}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>

          {/* Local Files */}
          <div 
            style={{
              marginBottom: !collapsed ? `${dynamicSpacing.section}rem` : `${dynamicSpacing.section * 0.6}rem`,
            }}
          >
            <SectionTitle collapsed={collapsed}>Local</SectionTitle>
            <div style={{ gap: `${dynamicSpacing.item}rem` }} className="flex flex-col">
              {localItems.map((item) => (
                <NavItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  isActive={currentView === item.id}
                  onClick={() => onViewChange(item.id)}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>

          {/* Playlists - Only show when expanded */}
          {!collapsed && (
            <div 
              className="animate-in fade-in slide-in-from-left-2 duration-300"
              style={{
                marginBottom: `${dynamicSpacing.section}rem`,
              }}
            >
              <div className="flex items-center justify-between px-3 py-2.5 mb-1">
                <h3 className="text-[10px] font-display uppercase tracking-widest text-muted-foreground/60">
                  Playlists
                </h3>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => setCreateModalOpen(true)}
                      className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-primary transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Créer une playlist</TooltipContent>
                </Tooltip>
              </div>
              <div style={{ gap: `${dynamicSpacing.item}rem` }} className="flex flex-col">
                {playlists.slice(0, 5).map((playlist) => (
                  <Tooltip key={playlist.id}>
                    <TooltipTrigger asChild>
                      <div className="w-full">
                        <PlaylistContextMenu
                          playlist={playlist}
                          onPlay={() => {
                            onViewChange("playlists");
                            if (onPlayPlaylist) {
                              onPlayPlaylist(playlist.id);
                            }
                          }}
                          onShuffle={() => {
                            onViewChange("playlists");
                            if (onShufflePlaylist) {
                              onShufflePlaylist(playlist.id);
                            }
                          }}
                          onEdit={() => {
                            setEditingPlaylist({ id: playlist.id, name: playlist.name });
                          }}
                          onDelete={async () => {
                            if (confirm(`Supprimer la playlist "${playlist.name}" ?`)) {
                              await deletePlaylist(playlist.id);
                              const message = "Playlist supprimée";
                              toast.success(message);
                              notifySuccess(message);
                            }
                          }}
                          onView={() => onViewChange("playlists")}
                        >
                          <div className="w-full flex items-center gap-2 group">
                            <button
                              onClick={() => onViewChange("playlists")}
                              className="flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 active:bg-muted/60 transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                            >
                              <div className="w-8 h-8 rounded-md bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center group-hover:from-primary/30 group-hover:to-secondary/30 transition-all duration-200 group-hover:scale-105">
                                <Music className="w-4 h-4 text-primary" />
                              </div>
                              <div className="flex-1 text-left min-w-0">
                                <p className="text-sm font-medium truncate transition-colors duration-200">{playlist.name}</p>
                                <p className="text-xs text-muted-foreground/80 mt-0.5">{playlist.trackIds.length} titres</p>
                              </div>
                            </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingPlaylist({ id: playlist.id, name: playlist.name });
                            }}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Renommer
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm(`Supprimer la playlist "${playlist.name}" ?`)) {
                                await deletePlaylist(playlist.id);
                                const message = "Playlist supprimée";
                        toast.success(message);
                        notifySuccess(message);
                              }
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                        </PlaylistContextMenu>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-sm font-medium">{playlist.name}</div>
                      <div className="text-xs text-muted-foreground">{playlist.trackIds.length} titre{playlist.trackIds.length > 1 ? 's' : ''}</div>
                    </TooltipContent>
                  </Tooltip>
                ))}
                {playlists.length === 0 && (
                  <p className="px-3 py-3 text-xs text-muted-foreground/70 italic text-center">
                    Aucune playlist
                  </p>
                )}
                {playlists.length > 5 && (
                  <button
                    onClick={() => onViewChange("playlists")}
                    className="w-full px-3 py-2.5 text-xs font-medium text-primary hover:text-primary/80 hover:bg-primary/10 rounded-lg transition-all duration-200 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
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
                  onClick={() => onViewChange("playlists")}
                  className="w-full flex items-center justify-center px-2.5 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 active:bg-muted/60 transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <div className="relative">
                    <ListMusic className="w-5 h-5 transition-transform duration-200 hover:scale-110" />
                    <span className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-primary text-[10px] font-medium flex items-center justify-center text-primary-foreground shadow-sm">
                      {playlists.length}
                    </span>
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {playlists.length} Playlists
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </ScrollArea>

      {/* Create Playlist Modal */}
      <CreatePlaylistModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onCreatePlaylist={async (name, trackIds) => {
          const playlist = await createPlaylist(name, trackIds);
          if (playlist) {
            const message = "Playlist créée";
            toast.success(message);
            notifySuccess(message);
            setCreateModalOpen(false);
          }
        }}
      />

      {/* Edit Playlist Name Dialog */}
      {editingPlaylist && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Renommer la playlist</h3>
            <input
              type="text"
              value={editingPlaylist.name}
              onChange={(e) => setEditingPlaylist({ ...editingPlaylist, name: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && editingPlaylist.name.trim()) {
                  updatePlaylist(editingPlaylist.id, { name: editingPlaylist.name.trim() });
                  const message = "Playlist renommée";
                  toast.success(message);
                  notifySuccess(message);
                  setEditingPlaylist(null);
                } else if (e.key === "Escape") {
                  setEditingPlaylist(null);
                }
              }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditingPlaylist(null)}
                className="px-4 py-2 text-sm rounded-lg hover:bg-muted/50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  if (editingPlaylist.name.trim()) {
                    await updatePlaylist(editingPlaylist.id, { name: editingPlaylist.name.trim() });
                    const message = "Playlist renommée";
                  toast.success(message);
                  notifySuccess(message);
                    setEditingPlaylist(null);
                  }
                }}
                className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Status Indicator */}
      <div className={cn(
        "border-t border-border/50 transition-all duration-300",
        collapsed ? "px-2 py-2.5" : "px-3 py-3"
      )}>
        <SyncStatusIndicator collapsed={collapsed} />
      </div>
    </div>
  );
};
