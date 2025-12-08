import { useState } from "react";
import { 
  Home, 
  Library, 
  Search, 
  Heart, 
  ListMusic, 
  Clock, 
  Disc3, 
  Users, 
  Radio, 
  Settings,
  Plus,
  FolderOpen,
  Download,
  Mic2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

type ViewType = 
  | "home" 
  | "library" 
  | "search" 
  | "favorites" 
  | "playlists" 
  | "recent" 
  | "albums" 
  | "artists" 
  | "radio"
  | "local"
  | "downloads"
  | "podcasts"
  | "settings";

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const mainNavItems = [
  { id: "home" as ViewType, icon: Home, label: "Accueil" },
  { id: "search" as ViewType, icon: Search, label: "Rechercher" },
  { id: "library" as ViewType, icon: Library, label: "Bibliothèque" },
];

const libraryItems = [
  { id: "favorites" as ViewType, icon: Heart, label: "Favoris" },
  { id: "playlists" as ViewType, icon: ListMusic, label: "Playlists" },
  { id: "recent" as ViewType, icon: Clock, label: "Récents" },
  { id: "albums" as ViewType, icon: Disc3, label: "Albums" },
  { id: "artists" as ViewType, icon: Users, label: "Artistes" },
];

const discoverItems = [
  { id: "radio" as ViewType, icon: Radio, label: "Radio" },
  { id: "podcasts" as ViewType, icon: Mic2, label: "Podcasts" },
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
}

const NavItem = ({ icon: Icon, label, isActive, onClick, badge }: NavItemProps) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
      isActive 
        ? "bg-primary/20 text-primary glow-cyan" 
        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
    )}
  >
    <Icon className={cn(
      "w-5 h-5 transition-all duration-200",
      isActive && "drop-shadow-[0_0_8px_hsl(var(--neon-cyan))]"
    )} />
    <span className="text-sm font-medium flex-1 text-left">{label}</span>
    {badge !== undefined && badge > 0 && (
      <span className="px-2 py-0.5 text-xs rounded-full bg-secondary/20 text-secondary">
        {badge}
      </span>
    )}
  </button>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="px-3 py-2 text-[10px] font-display uppercase tracking-widest text-muted-foreground/50">
    {children}
  </h3>
);

export const Sidebar = ({ currentView, onViewChange }: SidebarProps) => {
  const [playlists] = useState([
    { id: 1, name: "Cyberpunk Mix", count: 24 },
    { id: 2, name: "Night Drive", count: 18 },
    { id: 3, name: "Focus Mode", count: 32 },
    { id: 4, name: "Workout Beats", count: 45 },
  ]);

  return (
    <div className="w-56 h-full flex flex-col bg-card border-r border-border">
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-6">
          {/* Main Navigation */}
          <div className="space-y-1">
            {mainNavItems.map((item) => (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                isActive={currentView === item.id}
                onClick={() => onViewChange(item.id)}
              />
            ))}
          </div>

          {/* Library */}
          <div>
            <SectionTitle>Ma Musique</SectionTitle>
            <div className="space-y-1">
              {libraryItems.map((item) => (
                <NavItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  isActive={currentView === item.id}
                  onClick={() => onViewChange(item.id)}
                  badge={item.id === "favorites" ? 12 : undefined}
                />
              ))}
            </div>
          </div>

          {/* Discover */}
          <div>
            <SectionTitle>Découvrir</SectionTitle>
            <div className="space-y-1">
              {discoverItems.map((item) => (
                <NavItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  isActive={currentView === item.id}
                  onClick={() => onViewChange(item.id)}
                />
              ))}
            </div>
          </div>

          {/* Local Files */}
          <div>
            <SectionTitle>Local</SectionTitle>
            <div className="space-y-1">
              {localItems.map((item) => (
                <NavItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  isActive={currentView === item.id}
                  onClick={() => onViewChange(item.id)}
                />
              ))}
            </div>
          </div>

          {/* Playlists */}
          <div>
            <div className="flex items-center justify-between px-3 py-2">
              <h3 className="text-[10px] font-display uppercase tracking-widest text-muted-foreground/50">
                Playlists
              </h3>
              <button className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-primary transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1">
              {playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                    <ListMusic className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm truncate">{playlist.name}</p>
                    <p className="text-xs text-muted-foreground">{playlist.count} titres</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Settings Button */}
      <div className="p-3 border-t border-border">
        <NavItem
          icon={Settings}
          label="Paramètres"
          isActive={currentView === "settings"}
          onClick={() => onViewChange("settings")}
        />
      </div>
    </div>
  );
};

export type { ViewType };
