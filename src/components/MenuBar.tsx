"use client";

import { useState, useRef, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PlayCircle,
  ArrowLeft,
  ArrowRight,
  FileText,
  FolderOpen,
  Compass,
  Search,
  RefreshCw,
  Eye,
  Play,
  Settings,
  Crown,
  HelpCircle,
} from "lucide-react";

interface MenuBarProps {
  onOpenSettings?: () => void;
  onOpenSearchPage?: (query?: string) => void;
}

export function MenuBar({ onOpenSettings, onOpenSearchPage }: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const hideMenuTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hideMenuTimeoutRef.current) clearTimeout(hideMenuTimeoutRef.current);
    };
  }, []);

  const openMenuWithHover = (menu: string) => {
    if (hideMenuTimeoutRef.current) clearTimeout(hideMenuTimeoutRef.current);
    setOpenMenu(menu);
  };

  const scheduleMenuClose = () => {
    if (hideMenuTimeoutRef.current) clearTimeout(hideMenuTimeoutRef.current);
    hideMenuTimeoutRef.current = setTimeout(() => setOpenMenu(null), 220);
  };

  const cancelMenuClose = () => {
    if (hideMenuTimeoutRef.current) clearTimeout(hideMenuTimeoutRef.current);
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpenMenu(null);
      e.preventDefault();
    }
  };

  // Actions handlers
  const handlePlayToggle = () => {
    window.dispatchEvent(new CustomEvent("nexus-play-toggle"));
    setOpenMenu(null);
  };

  const handlePreviousTrack = () => {
    window.dispatchEvent(new CustomEvent("nexus-play-prev"));
    setOpenMenu(null);
  };

  const handleNextTrack = () => {
    window.dispatchEvent(new CustomEvent("nexus-play-next"));
    setOpenMenu(null);
  };

  const handleNewPlaylist = () => {
    window.dispatchEvent(new CustomEvent("nexus-new-playlist"));
    setOpenMenu(null);
  };

  const handleOpenFiles = () => {
    window.dispatchEvent(new CustomEvent("nexus-open-files", { detail: { multiple: true } }));
    setOpenMenu(null);
  };

  const handleOpenFolders = () => {
    window.dispatchEvent(new CustomEvent("nexus-open-folders", { detail: { multiple: true } }));
    setOpenMenu(null);
  };

  const handleImportLibrary = () => {
    window.dispatchEvent(new CustomEvent("nexus-import-library"));
    setOpenMenu(null);
  };

  const handleNavigateHome = () => {
    window.dispatchEvent(new CustomEvent("nexus-nav", { detail: { target: "home" } }));
    setOpenMenu(null);
  };

  const handleNavigateLibrary = () => {
    window.dispatchEvent(new CustomEvent("nexus-nav", { detail: { target: "library" } }));
    setOpenMenu(null);
  };

  const handleNavigateSearch = () => {
    onOpenSearchPage?.("");
    setOpenMenu(null);
  };

  const handleSyncNow = async () => {
    window.dispatchEvent(new CustomEvent("nexus-sync-start"));
    try {
      // Sync via global event - le TitleBar ou DesktopApp gérera
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("nexus-sync-complete"));
      }, 1000);
    } catch (error) {
      console.error("MenuBar: Manual sync failed:", error);
      window.dispatchEvent(new CustomEvent("nexus-sync-error"));
    }
    setOpenMenu(null);
  };

  const handleClearCache = () => {
    window.dispatchEvent(new CustomEvent("nexus-clear-cache"));
    setOpenMenu(null);
  };

  const handleToggleMiniPlayer = () => {
    window.dispatchEvent(new CustomEvent("nexus-toggle-mini-player"));
    setOpenMenu(null);
  };

  const handleOpenNowPlaying = () => {
    window.dispatchEvent(new CustomEvent("nexus-open-now-playing"));
    setOpenMenu(null);
  };

  const handleOpenQueue = () => {
    window.dispatchEvent(new CustomEvent("nexus-open-queue"));
    setOpenMenu(null);
  };

  const handleToggleSidebar = () => {
    window.dispatchEvent(new CustomEvent("nexus-toggle-sidebar"));
    setOpenMenu(null);
  };

  const handleOpenSubscription = () => {
    window.dispatchEvent(new CustomEvent("nexus-open-subscription"));
    setOpenMenu(null);
  };

  const handleCheckUpdates = () => {
    window.dispatchEvent(new CustomEvent("nexus-check-updates"));
    setOpenMenu(null);
  };

  const handleAbout = () => {
    window.dispatchEvent(new CustomEvent("nexus-about"));
    setOpenMenu(null);
  };

  const handleOpenDocumentation = () => {
    window.open("https://github.com/Notho-freedom/nova-sound", "_blank");
    setOpenMenu(null);
  };

  return (
    <div 
      className="hidden md:flex flex-none items-center gap-0.5 sm:gap-1 ml-1 md:ml-2 flex-wrap overflow-x-auto max-w-[50vw]"
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      {/* Musique */}
      <DropdownMenu open={openMenu === "musique"} onOpenChange={(v) => setOpenMenu(v ? "musique" : null)}>
        <DropdownMenuTrigger
          asChild
          onMouseEnter={() => openMenuWithHover("musique")}
          onMouseLeave={scheduleMenuClose}
          onKeyDown={handleMenuKeyDown}
        >
          <button
            className="px-2 py-1 rounded-md text-[12px] text-muted-foreground hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background transition-all"
            aria-label="Menu Musique - Lecture, pistes, playlists"
            aria-expanded={openMenu === "musique"}
            aria-haspopup="true"
          >
            Musique
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-52 glass-card-elevated"
          onMouseEnter={cancelMenuClose}
          onMouseLeave={scheduleMenuClose}
        >
          <DropdownMenuItem className="gap-2 text-xs" onClick={handlePlayToggle}>
            <PlayCircle className="w-3.5 h-3.5" />
            Lecture / Pause
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 text-xs" onClick={handlePreviousTrack}>
            <ArrowLeft className="w-3.5 h-3.5" />
            Piste précédente
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 text-xs" onClick={handleNextTrack}>
            <ArrowRight className="w-3.5 h-3.5" />
            Piste suivante
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-white/[0.06]" />
          <DropdownMenuItem className="gap-2 text-xs" onClick={handleNewPlaylist}>
            <FileText className="w-3.5 h-3.5" />
            Nouvelle playlist
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Bibliothèque */}
      <DropdownMenu open={openMenu === "bibliotheque"} onOpenChange={(v) => setOpenMenu(v ? "bibliotheque" : null)}>
        <DropdownMenuTrigger
          asChild
          onMouseEnter={() => openMenuWithHover("bibliotheque")}
          onMouseLeave={scheduleMenuClose}
          onKeyDown={handleMenuKeyDown}
        >
          <button className="px-2 py-1 rounded-md text-[12px] text-muted-foreground hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background transition-all">
            Bibliothèque
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-52 glass-card-elevated"
          onMouseEnter={cancelMenuClose}
          onMouseLeave={scheduleMenuClose}
        >
          <DropdownMenuItem className="gap-2 text-xs" onClick={handleOpenFiles}>
            <FileText className="w-3.5 h-3.5" />
            Ouvrir des fichiers…
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 text-xs" onClick={handleOpenFolders}>
            <FolderOpen className="w-3.5 h-3.5" />
            Ouvrir des dossiers…
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-white/[0.06]" />
          <DropdownMenuItem className="gap-2 text-xs" onClick={handleImportLibrary}>
            <FileText className="w-3.5 h-3.5" />
            Importer la bibliothèque
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-white/[0.06]" />
          <DropdownMenuItem className="gap-2 text-xs" onClick={handleNavigateHome}>
            <Compass className="w-3.5 h-3.5" />
            Accueil
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 text-xs" onClick={handleNavigateLibrary}>
            <Compass className="w-3.5 h-3.5" />
            Bibliothèque
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 text-xs" onClick={handleNavigateSearch}>
            <Search className="w-3.5 h-3.5" />
            Rechercher
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Cloud */}
      <DropdownMenu open={openMenu === "cloud"} onOpenChange={(v) => setOpenMenu(v ? "cloud" : null)}>
        <DropdownMenuTrigger
          asChild
          onMouseEnter={() => openMenuWithHover("cloud")}
          onMouseLeave={scheduleMenuClose}
          onKeyDown={handleMenuKeyDown}
        >
          <button className="px-2 py-1 rounded-md text-[12px] text-muted-foreground hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background transition-all">
            Cloud
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-48 glass-card-elevated"
          onMouseEnter={cancelMenuClose}
          onMouseLeave={scheduleMenuClose}
        >
          <DropdownMenuItem className="gap-2 text-xs" onClick={handleSyncNow}>
            <RefreshCw className="w-3.5 h-3.5" />
            Synchroniser maintenant
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 text-xs" onClick={handleClearCache}>
            <RefreshCw className="w-3.5 h-3.5" />
            Nettoyer le cache
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Lecture */}
      <DropdownMenu open={openMenu === "lecture"} onOpenChange={(v) => setOpenMenu(v ? "lecture" : null)}>
        <DropdownMenuTrigger
          asChild
          onMouseEnter={() => openMenuWithHover("lecture")}
          onMouseLeave={scheduleMenuClose}
          onKeyDown={handleMenuKeyDown}
        >
          <button className="px-2 py-1 rounded-md text-[12px] text-muted-foreground hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background transition-all">
            Lecture
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-56 glass-card-elevated"
          onMouseEnter={cancelMenuClose}
          onMouseLeave={scheduleMenuClose}
        >
          <DropdownMenuItem className="gap-2 text-xs" onClick={handleToggleMiniPlayer}>
            <Eye className="w-3.5 h-3.5" />
            Basculer mini lecteur
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 text-xs" onClick={handleOpenNowPlaying}>
            <PlayCircle className="w-3.5 h-3.5" />
            En cours de lecture
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 text-xs" onClick={handleOpenQueue}>
            <Play className="w-3.5 h-3.5" />
            File d'attente
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Affichage */}
      <DropdownMenu open={openMenu === "affichage"} onOpenChange={(v) => setOpenMenu(v ? "affichage" : null)}>
        <DropdownMenuTrigger
          asChild
          onMouseEnter={() => openMenuWithHover("affichage")}
          onMouseLeave={scheduleMenuClose}
          onKeyDown={handleMenuKeyDown}
        >
          <button className="px-2 py-1 rounded-md text-[12px] text-muted-foreground hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background transition-all">
            Affichage
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-56 glass-card-elevated"
          onMouseEnter={cancelMenuClose}
          onMouseLeave={scheduleMenuClose}
        >
          <DropdownMenuItem className="gap-2 text-xs" onClick={handleToggleSidebar}>
            <Eye className="w-3.5 h-3.5" />
            Basculer la sidebar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Compte */}
      <DropdownMenu open={openMenu === "compte"} onOpenChange={(v) => setOpenMenu(v ? "compte" : null)}>
        <DropdownMenuTrigger
          asChild
          onMouseEnter={() => openMenuWithHover("compte")}
          onMouseLeave={scheduleMenuClose}
          onKeyDown={handleMenuKeyDown}
        >
          <button className="px-2 py-1 rounded-md text-[12px] text-muted-foreground hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background transition-all">
            Compte
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-52 glass-card-elevated"
          onMouseEnter={cancelMenuClose}
          onMouseLeave={scheduleMenuClose}
        >
          <DropdownMenuItem className="gap-2 text-xs" onClick={() => { onOpenSettings?.(); setOpenMenu(null); }}>
            <Settings className="w-3.5 h-3.5" />
            Paramètres
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 text-xs" onClick={handleOpenSubscription}>
            <Crown className="w-3.5 h-3.5" />
            Abonnement
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Aide */}
      <DropdownMenu open={openMenu === "aide"} onOpenChange={(v) => setOpenMenu(v ? "aide" : null)}>
        <DropdownMenuTrigger
          asChild
          onMouseEnter={() => openMenuWithHover("aide")}
          onMouseLeave={scheduleMenuClose}
          onKeyDown={handleMenuKeyDown}
        >
          <button className="px-2 py-1 rounded-md text-[12px] text-muted-foreground hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background transition-all">
            Aide
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-60 glass-card-elevated"
          onMouseEnter={cancelMenuClose}
          onMouseLeave={scheduleMenuClose}
        >
          <DropdownMenuItem className="gap-2 text-xs" onClick={handleOpenDocumentation}>
            <HelpCircle className="w-3.5 h-3.5" />
            Documentation & code source
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 text-xs" onClick={handleCheckUpdates}>
            <HelpCircle className="w-3.5 h-3.5" />
            Rechercher des mises à jour
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-white/[0.06]" />
          <DropdownMenuItem className="gap-2 text-xs" onClick={handleAbout}>
            <HelpCircle className="w-3.5 h-3.5" />
            À propos de NEXUS
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
