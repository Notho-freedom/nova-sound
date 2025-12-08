import { useState, useEffect, useCallback, useRef } from "react";
import { TitleBar } from "./TitleBar";
import { Sidebar, ViewType } from "./Sidebar";
import { NowPlayingBar } from "./NowPlayingBar";
import { QueuePanel } from "./QueuePanel";
import { FullscreenPlayer } from "./FullscreenPlayer";
import { LoadingScreen } from "./LoadingScreen";
import { HomeView } from "./views/HomeView";
import { SearchView } from "./views/SearchView";
import { LibraryView } from "./views/LibraryView";
import { SettingsView } from "./views/SettingsView";
import { BackgroundEffects } from "./BackgroundEffects";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLibrary } from "@/hooks/useLibrary";
import { useFavorites } from "@/hooks/useFavorites";
import { getAudioSrc, getCoverUrl } from "@/lib/audio";
import type { Track } from "@/types/music";

export const DesktopApp = () => {
  const { tracks, loading: libraryLoading, scanning, scanProgress } = useLibrary();
  const { favorites, isFavorite } = useFavorites();
  
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewType>("home");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const [volume, setVolume] = useState(70);
  const [isMuted, setIsMuted] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Audio element ref for real playback
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Get current track safely
  const currentTrack: Track | null = tracks.length > 0 ? tracks[currentTrackIndex] || tracks[0] : null;

  // Loading complete handler
  const handleLoadComplete = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume / 100;
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Update audio source when track changes
  useEffect(() => {
    if (!audioRef.current || !currentTrack) return;

    // Check if we have a real file path (Electron mode)
    if (currentTrack.filePath) {
      const audioSrc = getAudioSrc(currentTrack.filePath);
      if (audioSrc) {
        console.log('Loading audio:', audioSrc);
        audioRef.current.src = audioSrc;
        audioRef.current.load();
        if (isPlaying) {
          audioRef.current.play().catch((err) => {
            console.error('Failed to play audio:', err);
          });
        }
      }
    }
  }, [currentTrack?.id]);

  // Handle play/pause
  useEffect(() => {
    if (!audioRef.current || !currentTrack?.filePath) return;

    if (isPlaying) {
      audioRef.current.play().catch(console.error);
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, currentTrack?.filePath]);

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

  // Update current time from audio element
  useEffect(() => {
    if (!audioRef.current) return;

    const handleTimeUpdate = () => {
      if (audioRef.current) {
        setCurrentTime(Math.floor(audioRef.current.currentTime));
      }
    };

    const handleEnded = () => {
      handleNext();
    };

    audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
    audioRef.current.addEventListener('ended', handleEnded);

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        audioRef.current.removeEventListener('ended', handleEnded);
      }
    };
  }, []);

  // Fallback: Simulate playback progress when no real audio file
  useEffect(() => {
    if (!isPlaying || !currentTrack || currentTrack.filePath) return;

    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        if (prev >= currentTrack.duration) {
          handleNext();
          return 0;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, currentTrack?.duration, currentTrack?.filePath]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.code) {
        case "Space":
          e.preventDefault();
          setIsPlaying((prev) => !prev);
          break;
        case "ArrowRight":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleNext();
          }
          break;
        case "ArrowLeft":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handlePrevious();
          }
          break;
        case "ArrowUp":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setVolume((prev) => Math.min(100, prev + 5));
          }
          break;
        case "ArrowDown":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setVolume((prev) => Math.max(0, prev - 5));
          }
          break;
        case "KeyM":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setIsMuted((prev) => !prev);
          }
          break;
        case "F11":
          e.preventDefault();
          setIsFullscreen((prev) => !prev);
          break;
        case "Escape":
          if (isFullscreen) {
            setIsFullscreen(false);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const handlePlayPause = () => setIsPlaying(!isPlaying);

  const handlePrevious = useCallback(() => {
    if (tracks.length === 0) return;
    
    if (currentTime > 3) {
      setCurrentTime(0);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
    } else {
      setCurrentTrackIndex((prev) =>
        prev === 0 ? tracks.length - 1 : prev - 1
      );
      setCurrentTime(0);
    }
  }, [currentTime, tracks.length]);

  const handleNext = useCallback(() => {
    if (tracks.length === 0) return;

    if (repeatMode === "one") {
      setCurrentTime(0);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(console.error);
      }
      return;
    }

    if (isShuffle) {
      let randomIndex;
      do {
        randomIndex = Math.floor(Math.random() * tracks.length);
      } while (randomIndex === currentTrackIndex && tracks.length > 1);
      setCurrentTrackIndex(randomIndex);
    } else {
      setCurrentTrackIndex((prev) => {
        if (prev === tracks.length - 1) {
          return repeatMode === "all" ? 0 : prev;
        }
        return prev + 1;
      });
    }
    setCurrentTime(0);
  }, [repeatMode, isShuffle, currentTrackIndex, tracks.length]);

  const handleSeek = (value: number[]) => {
    const newTime = value[0];
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    if (isMuted && value[0] > 0) setIsMuted(false);
  };

  const handleRepeat = () => {
    const modes: ("off" | "all" | "one")[] = ["off", "all", "one"];
    const currentIndex = modes.indexOf(repeatMode);
    setRepeatMode(modes[(currentIndex + 1) % modes.length]);
  };

  const handleTrackSelect = (index: number) => {
    setCurrentTrackIndex(index);
    setCurrentTime(0);
    setIsPlaying(true);
  };

  // Get favorite tracks
  const favoriteTracks = tracks.filter(track => isFavorite(track.id));

  // Get recently played (use history or just first few for demo)
  const recentTracks = tracks.slice(0, 10);

  const renderView = () => {
    switch (currentView) {
      case "home":
        return (
          <HomeView
            tracks={tracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={handleTrackSelect}
          />
        );
      case "search":
        return (
          <SearchView
            tracks={tracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={handleTrackSelect}
          />
        );
      case "library":
        return (
          <LibraryView
            tracks={tracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={handleTrackSelect}
          />
        );
      case "favorites":
        return (
          <LibraryView
            tracks={favoriteTracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={(index) => {
              const track = favoriteTracks[index];
              const realIndex = tracks.findIndex(t => t.id === track.id);
              if (realIndex !== -1) handleTrackSelect(realIndex);
            }}
            title="Favoris"
          />
        );
      case "playlists":
        return (
          <LibraryView
            tracks={tracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={handleTrackSelect}
            title="Playlists"
          />
        );
      case "recent":
        return (
          <LibraryView
            tracks={recentTracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={(index) => {
              const track = recentTracks[index];
              const realIndex = tracks.findIndex(t => t.id === track.id);
              if (realIndex !== -1) handleTrackSelect(realIndex);
            }}
            title="Écouté récemment"
          />
        );
      case "albums":
        return (
          <LibraryView
            tracks={tracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={handleTrackSelect}
            title="Albums"
          />
        );
      case "artists":
        return (
          <LibraryView
            tracks={tracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={handleTrackSelect}
            title="Artistes"
          />
        );
      case "settings":
        return <SettingsView />;
      default:
        return (
          <div className="p-6">
            <h1 className="font-display text-3xl font-bold text-foreground">
              {currentView.charAt(0).toUpperCase() + currentView.slice(1)}
            </h1>
            <p className="text-muted-foreground mt-2">
              Cette section sera bientôt disponible.
            </p>
          </div>
        );
    }
  };

  // Show loading screen
  if (isLoading) {
    return <LoadingScreen onLoadComplete={handleLoadComplete} />;
  }

  // Show message if no tracks
  const noTracksMessage = tracks.length === 0 && !libraryLoading && (
    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
      <div className="glass rounded-xl p-8 text-center max-w-md pointer-events-auto">
        <h2 className="font-display text-xl mb-3">Bibliothèque vide</h2>
        <p className="text-muted-foreground mb-4">
          Ajoutez des dossiers de musique dans les Paramètres pour commencer à écouter.
        </p>
        <button 
          onClick={() => setCurrentView("settings")}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          Ouvrir les Paramètres
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Fullscreen Player */}
      {isFullscreen && currentTrack && (
        <FullscreenPlayer
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          currentTime={currentTime}
          isShuffle={isShuffle}
          repeatMode={repeatMode}
          volume={volume}
          isMuted={isMuted}
          onPlayPause={handlePlayPause}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onShuffle={() => setIsShuffle(!isShuffle)}
          onRepeat={handleRepeat}
          onSeek={handleSeek}
          onVolumeChange={handleVolumeChange}
          onMuteToggle={() => setIsMuted(!isMuted)}
          onClose={() => setIsFullscreen(false)}
        />
      )}

      {/* Title Bar */}
      <TitleBar />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        <BackgroundEffects />

        {/* Sidebar */}
        <Sidebar 
          currentView={currentView} 
          onViewChange={setCurrentView}
          favoritesCount={favoriteTracks.length}
        />

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden relative z-10">
          {noTracksMessage}
          
          <ScrollArea className="flex-1">
            {renderView()}
          </ScrollArea>

          {/* Queue Panel */}
          {isQueueOpen && (
            <QueuePanel
              tracks={tracks}
              currentTrackIndex={currentTrackIndex}
              isPlaying={isPlaying}
              onTrackSelect={handleTrackSelect}
              onClose={() => setIsQueueOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Now Playing Bar */}
      {currentTrack && (
        <NowPlayingBar
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          currentTime={currentTime}
          isShuffle={isShuffle}
          repeatMode={repeatMode}
          volume={volume}
          isMuted={isMuted}
          onPlayPause={handlePlayPause}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onShuffle={() => setIsShuffle(!isShuffle)}
          onRepeat={handleRepeat}
          onSeek={handleSeek}
          onVolumeChange={handleVolumeChange}
          onMuteToggle={() => setIsMuted(!isMuted)}
          onToggleQueue={() => setIsQueueOpen(!isQueueOpen)}
          onFullscreen={() => setIsFullscreen(true)}
          isQueueOpen={isQueueOpen}
        />
      )}

      {/* Scan progress indicator */}
      {scanning && scanProgress && (
        <div className="fixed bottom-20 right-4 glass rounded-lg p-4 z-50 max-w-xs">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <div>
              <p className="text-sm font-medium">Scan en cours...</p>
              <p className="text-xs text-muted-foreground">
                {scanProgress.current}/{scanProgress.total} fichiers
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
