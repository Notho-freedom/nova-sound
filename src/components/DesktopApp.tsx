import { useState, useEffect, useCallback } from "react";
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
import { demoTracks } from "@/data/tracks";
import { ScrollArea } from "@/components/ui/scroll-area";

export const DesktopApp = () => {
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

  const currentTrack = demoTracks[currentTrackIndex];

  // Loading complete handler
  const handleLoadComplete = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Simulate playback progress
  useEffect(() => {
    if (!isPlaying) return;

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
  }, [isPlaying, currentTrack.duration]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
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
    if (currentTime > 3) {
      setCurrentTime(0);
    } else {
      setCurrentTrackIndex((prev) =>
        prev === 0 ? demoTracks.length - 1 : prev - 1
      );
      setCurrentTime(0);
    }
  }, [currentTime]);

  const handleNext = useCallback(() => {
    if (repeatMode === "one") {
      setCurrentTime(0);
      return;
    }

    if (isShuffle) {
      let randomIndex;
      do {
        randomIndex = Math.floor(Math.random() * demoTracks.length);
      } while (randomIndex === currentTrackIndex && demoTracks.length > 1);
      setCurrentTrackIndex(randomIndex);
    } else {
      setCurrentTrackIndex((prev) => {
        if (prev === demoTracks.length - 1) {
          return repeatMode === "all" ? 0 : prev;
        }
        return prev + 1;
      });
    }
    setCurrentTime(0);
  }, [repeatMode, isShuffle, currentTrackIndex]);

  const handleSeek = (value: number[]) => {
    setCurrentTime(value[0]);
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

  const renderView = () => {
    switch (currentView) {
      case "home":
        return (
          <HomeView
            tracks={demoTracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={handleTrackSelect}
          />
        );
      case "search":
        return (
          <SearchView
            tracks={demoTracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={handleTrackSelect}
          />
        );
      case "library":
        return (
          <LibraryView
            tracks={demoTracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={handleTrackSelect}
          />
        );
      case "favorites":
        return (
          <LibraryView
            tracks={demoTracks.slice(0, 3)}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={handleTrackSelect}
            title="Favoris"
          />
        );
      case "playlists":
        return (
          <LibraryView
            tracks={demoTracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={handleTrackSelect}
            title="Playlists"
          />
        );
      case "recent":
        return (
          <LibraryView
            tracks={demoTracks.slice(0, 4)}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={handleTrackSelect}
            title="Écouté récemment"
          />
        );
      case "albums":
        return (
          <LibraryView
            tracks={demoTracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={handleTrackSelect}
            title="Albums"
          />
        );
      case "artists":
        return (
          <LibraryView
            tracks={demoTracks}
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

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Fullscreen Player */}
      {isFullscreen && (
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
        <Sidebar currentView={currentView} onViewChange={setCurrentView} />

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden relative z-10">
          <ScrollArea className="flex-1">
            {renderView()}
          </ScrollArea>

          {/* Queue Panel */}
          {isQueueOpen && (
            <QueuePanel
              tracks={demoTracks}
              currentTrackIndex={currentTrackIndex}
              isPlaying={isPlaying}
              onTrackSelect={handleTrackSelect}
              onClose={() => setIsQueueOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Now Playing Bar */}
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
    </div>
  );
};
