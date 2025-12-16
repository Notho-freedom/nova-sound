import { useState, useEffect } from "react";
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
        "w-full flex items-center gap-3 rounded-lg transition-all duration-300 group",
        collapsed ? "px-2 py-2.5 justify-center" : "px-3 py-2.5",
        isActive 
          ? "bg-primary/20 text-primary glow-cyan" 
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
    >
      <Icon className={cn(
        "w-5 h-5 transition-all duration-300 flex-shrink-0",
        isActive && "drop-shadow-[0_0_8px_hsl(var(--neon-cyan))]"
      )} />
      {!collapsed && (
        <>
          <span className="text-sm font-medium flex-1 text-left truncate">{label}</span>
          {badge !== undefined && badge > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-secondary/20 text-secondary">
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
    <h3 className="px-3 py-2 text-[10px] font-display uppercase tracking-widest text-muted-foreground/50 transition-opacity duration-300">
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
          "w-6 h-6 rounded-full bg-card border border-border",
          "flex items-center justify-center",
          "text-muted-foreground hover:text-primary hover:border-primary/50",
          "transition-all duration-300 hover:scale-110",
          "shadow-lg"
        )}
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>

      <ScrollArea className="flex-1">
        <div className={cn("p-2 space-y-4", collapsed && "px-1.5")}>
          {/* Spacing from top */}
          <div className="pt-4" />
          
          {/* Main Navigation */}
          <div className="space-y-1">
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

          {/* Library */}
          <div>
            <SectionTitle collapsed={collapsed}>Ma Musique</SectionTitle>
            <div className="space-y-1">
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
          <div>
            <SectionTitle collapsed={collapsed}>Médias</SectionTitle>
            <div className="space-y-1">
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
          <div>
            <SectionTitle collapsed={collapsed}>Local</SectionTitle>
            <div className="space-y-1">
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
            <div className="animate-in fade-in slide-in-from-left-2 duration-300">
              <div className="flex items-center justify-between px-3 py-2">
                <h3 className="text-[10px] font-display uppercase tracking-widest text-muted-foreground/50">
                  Playlists
                </h3>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => setCreateModalOpen(true)}
                      className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Créer une playlist</TooltipContent>
                </Tooltip>
              </div>
              <div className="space-y-1">
                {playlists.slice(0, 5).map((playlist) => (
                  <PlaylistContextMenu
                    key={playlist.id}
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
                        className="flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200"
                      >
                        <div className="w-8 h-8 rounded bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center group-hover:from-primary/30 group-hover:to-secondary/30 transition-all">
                          <Music className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-sm truncate">{playlist.name}</p>
                          <p className="text-xs text-muted-foreground">{playlist.trackIds.length} titres</p>
                        </div>
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
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
                ))}
                {playlists.length === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground italic">
                    Aucune playlist
                  </p>
                )}
                {playlists.length > 5 && (
                  <button
                    onClick={() => onViewChange("playlists")}
                    className="w-full px-3 py-2 text-xs text-primary hover:underline text-left"
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
                  className="w-full flex items-center justify-center px-2 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200"
                >
                  <div className="relative">
                    <ListMusic className="w-5 h-5" />
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[10px] flex items-center justify-center text-primary-foreground">
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
    </div>
  );
};
