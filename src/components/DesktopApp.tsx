import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { TitleBar } from "./TitleBar";
import { Sidebar, ViewType } from "./Sidebar";
import { NowPlayingBar } from "./NowPlayingBar";
import { QueuePanel } from "./QueuePanel";
import { FullscreenPlayer } from "./FullscreenPlayer";
import { LoadingScreen } from "./LoadingScreen";
import { LyricsDisplay } from "./LyricsDisplay";
import { UpdateNotification } from "./UpdateNotification";
import { lazy, Suspense } from "react";
import { HomeView } from "./views/HomeView";
import { SearchView } from "./views/SearchView";
import { LibraryView } from "./views/LibraryView";
import { SettingsView } from "./views/SettingsView";

// Lazy load heavy components
const VideosView = lazy(() => import("./views/VideosView").then(m => ({ default: m.VideosView })));
const DownloadsView = lazy(() => import("./views/DownloadsView").then(m => ({ default: m.DownloadsView })));
const AudioSensesView = lazy(() => import("./views/AudioSensesView").then(m => ({ default: m.AudioSensesView })));
import { BackgroundEffects } from "./BackgroundEffects";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Clock, Music } from "lucide-react";
import { useLibrary } from "@/hooks/useLibrary";
import { useFavorites } from "@/hooks/useFavorites";
import { usePlayHistory } from "@/hooks/usePlayHistory";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useQueue } from "@/hooks/useQueue";
import { useCloudSync } from "@/hooks/useCloudSync";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";
import { getAudioSrc } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Track } from "@/types/music";
import { VibrantUI, BassPulse } from "@/components/VibrantUI";
import { useAudioVibes } from "@/hooks/useAudioVibes";

export const DesktopApp = () => {
  const { tracks: libraryTracks, loading: libraryLoading, scanning, scanProgress } = useLibrary();
  const { favorites, isFavorite, addFavorite, removeFavorite } = useFavorites();
  const { history, addToHistory } = usePlayHistory();
  const { playlists, addTracksToPlaylist } = usePlaylists();
  const { overallProgress: cloudSyncProgress, isUploading: cloudSyncUploading } = useCloudSync();
  const { overallProgress: cloudinaryProgress, isUploading: cloudinaryUploading } = useCloudinaryUpload();
  
  // Combined upload progress (Cloudinary or Nexus)
  const overallProgress = cloudinaryUploading ? cloudinaryProgress : (cloudSyncUploading ? cloudSyncProgress : undefined);
  const isUploading = cloudinaryUploading || cloudSyncUploading;
  
  // Queue management
  const {
    queue,
    currentTrack: queueCurrentTrack,
    addToQueue,
    addToQueueNext,
    setCurrentIndex,
    setQueue,
    shuffle: shuffleQueue,
    unshuffle: unshuffleQueue,
    isShuffled: queueIsShuffled,
  } = useQueue(libraryTracks);
  
  // Initialize queue with library tracks when they change
  useEffect(() => {
    if (libraryTracks.length > 0 && queue.tracks.length === 0) {
      setQueue(libraryTracks);
    }
  }, [libraryTracks, queue.tracks.length, setQueue]);
  
  const tracks = queue.tracks.length > 0 ? queue.tracks : libraryTracks;
  const currentTrackIndex = queue.currentIndex;
  const currentTrack = queueCurrentTrack || (tracks.length > 0 ? tracks[currentTrackIndex] || tracks[0] : null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewType>("home");
  const [previousView, setPreviousView] = useState<ViewType>("home");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isShuffle, setIsShuffle] = useState(queueIsShuffled);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  // Load volume from localStorage on mount
  const [volume, setVolume] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('nexus-volume');
      return saved ? parseInt(saved, 10) : 70;
    }
    return 70;
  });
  const [isMuted, setIsMuted] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showInlinePlayer, setShowInlinePlayer] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [albumToOpen, setAlbumToOpen] = useState<string | null>(null);

  // Audio element ref for real playback
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
        
        // Attendre que l'audio soit chargé avant de jouer pour éviter l'erreur
        const handleCanPlay = () => {
          if (isPlaying && audioRef.current) {
            audioRef.current.play().catch((err) => {
              console.error('Failed to play audio:', err);
            });
          }
          audioRef.current?.removeEventListener('canplay', handleCanPlay);
        };
        
        const handleLoadedData = () => {
          if (isPlaying && audioRef.current) {
            audioRef.current.play().catch((err) => {
              console.error('Failed to play audio:', err);
            });
          }
          audioRef.current?.removeEventListener('loadeddata', handleLoadedData);
        };
        
        // Ajouter les listeners avant de changer la source
        audioRef.current.addEventListener('canplay', handleCanPlay);
        audioRef.current.addEventListener('loadeddata', handleLoadedData);
        
        // Changer la source et charger
        audioRef.current.src = audioSrc;
        audioRef.current.load();
      }
    }

    // Add to play history
    if (currentTrack) {
      addToHistory(currentTrack.id);
    }
  }, [currentTrack?.id, isPlaying]);

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
    
    // Save volume to localStorage and sync to Firebase
    localStorage.setItem('nexus-volume', volume.toString());
    
    // Sync to Firebase (debounced)
    const timeoutId = setTimeout(async () => {
      try {
        const { firebaseSyncService } = await import('../services/firebase-sync');
        firebaseSyncService.queueSync('volume', volume);
      } catch (error) {
        // Silently fail if Firebase sync is not available
      }
    }, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [volume, isMuted]);

  // Update current time from audio element with higher precision
  useEffect(() => {
    if (!audioRef.current) return;

    // Use requestAnimationFrame for smoother, more frequent updates
    let animationFrameId: number;
    let lastUpdateTime = 0;

    const updateTime = () => {
      if (audioRef.current) {
        const now = audioRef.current.currentTime;
        // Update more frequently (every ~50ms or on significant change)
        if (Math.abs(now - lastUpdateTime) >= 0.05 || !lastUpdateTime) {
          setCurrentTime(now); // Keep decimal precision for lyrics sync
          lastUpdateTime = now;
        }
        if (isPlaying) {
          animationFrameId = requestAnimationFrame(updateTime);
        }
      }
    };

    const handleTimeUpdate = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime); // Keep precision
      }
    };

    const handleEnded = () => {
      handleNext();
    };

    // Start animation frame loop for smooth updates when playing
    if (isPlaying) {
      animationFrameId = requestAnimationFrame(updateTime);
    }

    // Also listen to timeupdate as backup
    audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
    audioRef.current.addEventListener('ended', handleEnded);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (audioRef.current) {
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        audioRef.current.removeEventListener('ended', handleEnded);
      }
    };
  }, [isPlaying]);

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
          } else if (showInlinePlayer) {
            setShowInlinePlayer(false);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, showInlinePlayer]);

  const handlePlayPause = useCallback(() => setIsPlaying(prev => !prev), []);

  const handlePrevious = useCallback(() => {
    if (tracks.length === 0) return;
    
    if (currentTime > 3) {
      setCurrentTime(0);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
    } else {
      const newIndex = currentTrackIndex === 0 ? tracks.length - 1 : currentTrackIndex - 1;
      setCurrentIndex(newIndex);
      setCurrentTime(0);
    }
  }, [currentTime, tracks.length, currentTrackIndex, setCurrentIndex]);

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
      setCurrentIndex(randomIndex);
    } else {
      const newIndex = currentTrackIndex === tracks.length - 1
        ? (repeatMode === "all" ? 0 : currentTrackIndex)
        : currentTrackIndex + 1;
      setCurrentIndex(newIndex);
    }
    setCurrentTime(0);
  }, [repeatMode, isShuffle, currentTrackIndex, tracks.length, setCurrentIndex]);

  const handleSeek = useCallback((value: number[]) => {
    const newTime = value[0];
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  }, []);

  const handleVolumeChange = useCallback((value: number[]) => {
    setVolume(value[0]);
    setIsMuted(prev => prev && value[0] > 0 ? false : prev);
  }, []);

  const handleRepeat = useCallback(() => {
    const modes: ("off" | "all" | "one")[] = ["off", "all", "one"];
    const currentIndex = modes.indexOf(repeatMode);
    setRepeatMode(modes[(currentIndex + 1) % modes.length]);
  }, [repeatMode]);

  const handleTrackSelect = useCallback((index: number) => {
    setCurrentIndex(index);
    setCurrentTime(0);
    setIsPlaying(true);
    
    // Auto-fill queue with album tracks from current track
    const track = tracks[index];
    if (track) {
      const albumTracks = libraryTracks.filter(
        t => t.album === track.album && t.artist === track.artist
      ).sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0));
      
      const currentTrackIndexInAlbum = albumTracks.findIndex(t => t.id === track.id);
      if (currentTrackIndexInAlbum >= 0) {
        const remainingAlbumTracks = albumTracks.slice(currentTrackIndexInAlbum + 1);
        // Add remaining album tracks to queue after current position
        if (remainingAlbumTracks.length > 0) {
          const currentQueueTracks = queue.tracks;
          const insertIndex = index + 1;
          const tracksToAdd = remainingAlbumTracks.filter(
            t => !currentQueueTracks.slice(insertIndex).some(qt => qt.id === t.id)
          );
          if (tracksToAdd.length > 0) {
            addToQueueNext(tracksToAdd);
          }
        }
      }
    }
  }, [tracks, libraryTracks, queue.tracks, setCurrentIndex, addToQueueNext]);

  // Queue management handlers
  const handlePlayNext = useCallback((track: Track | Track[]) => {
    const tracksToAdd = Array.isArray(track) ? track : [track];
    addToQueueNext(tracksToAdd);
    toast.success(`Ajouté${tracksToAdd.length > 1 ? 's' : ''} à la suite`);
  }, [addToQueueNext]);

  const handleAddToQueue = useCallback((track: Track | Track[]) => {
    const tracksToAdd = Array.isArray(track) ? track : [track];
    addToQueue(tracksToAdd);
    toast.success(`Ajouté${tracksToAdd.length > 1 ? 's' : ''} à la file`);
  }, [addToQueue]);

  const handleAddToPlaylist = useCallback(async (playlistId: string, track: Track | Track[]) => {
    const tracksToAdd = Array.isArray(track) ? track : [track];
    const trackIds = tracksToAdd.map(t => t.id);
    try {
      await addTracksToPlaylist(playlistId, trackIds);
      toast.success(`Ajouté${tracksToAdd.length > 1 ? 's' : ''} à la playlist`);
    } catch (error) {
      console.error('Failed to add tracks to playlist:', error);
      toast.error('Erreur lors de l\'ajout à la playlist');
    }
  }, [addTracksToPlaylist]);

  const handleShuffle = useCallback(() => {
    if (isShuffle) {
      unshuffleQueue();
      setIsShuffle(false);
    } else {
      shuffleQueue();
      setIsShuffle(true);
    }
  }, [isShuffle, shuffleQueue, unshuffleQueue]);

  // Sync shuffle state with queue
  useEffect(() => {
    setIsShuffle(queueIsShuffled);
  }, [queueIsShuffled]);

  // Playlist handlers
  const handlePlayPlaylist = useCallback((playlistId: string) => {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) {
      toast.error('Playlist introuvable');
      return;
    }

    // Get tracks from playlist trackIds
    const playlistTracks = playlist.trackIds
      .map(id => libraryTracks.find(t => t.id === id))
      .filter((t): t is Track => t !== undefined);

    if (playlistTracks.length === 0) {
      toast.error('La playlist est vide');
      return;
    }

    // Set queue and start playing
    setQueue(playlistTracks);
    setCurrentIndex(0);
    setIsPlaying(true);
    toast.success(`Lecture de "${playlist.name}"`);
  }, [playlists, libraryTracks, setQueue, setCurrentIndex]);

  const handleShufflePlaylist = useCallback((playlistId: string) => {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) {
      toast.error('Playlist introuvable');
      return;
    }

    // Get tracks from playlist trackIds
    const playlistTracks = playlist.trackIds
      .map(id => libraryTracks.find(t => t.id === id))
      .filter((t): t is Track => t !== undefined);

    if (playlistTracks.length === 0) {
      toast.error('La playlist est vide');
      return;
    }

    // Shuffle tracks
    const shuffled = [...playlistTracks].sort(() => Math.random() - 0.5);

    // Set queue and start playing
    setQueue(shuffled);
    setCurrentIndex(0);
    setIsPlaying(true);
    setIsShuffle(true);
    toast.success(`Lecture aléatoire de "${playlist.name}"`);
  }, [playlists, libraryTracks, setQueue, setCurrentIndex]);

  const handleToggleFavorite = useCallback(() => {
    if (!currentTrack) return;
    if (isFavorite(currentTrack.id)) {
      removeFavorite(currentTrack.id);
    } else {
      addFavorite(currentTrack.id);
    }
  }, [currentTrack, isFavorite, addFavorite, removeFavorite]);

  const handleShowPlayer = useCallback(() => {
    if (showInlinePlayer) {
      setShowInlinePlayer(false);
      setCurrentView(previousView);
    } else {
      setPreviousView(currentView);
      setShowInlinePlayer(true);
      setCurrentView("player");
    }
  }, [showInlinePlayer, currentView, previousView]);

  const handleOpenSettings = useCallback(() => {
    setCurrentView("settings");
    setShowInlinePlayer(false);
  }, []);

  const handleNavigateToAlbum = useCallback(() => {
    if (!currentTrack) return;
    setShowInlinePlayer(false);
    // Set the album key to open (format: "albumName-artistName")
    const albumKey = `${currentTrack.album}-${currentTrack.artist}`;
    setAlbumToOpen(albumKey);
    setCurrentView("albums");
    // Reset albumToOpen after a short delay to allow LibraryView to process it
    setTimeout(() => setAlbumToOpen(null), 100);
    toast.success(`Ouverture de l'album "${currentTrack.album}"`);
  }, [currentTrack]);

  const handleNavigateToArtist = useCallback(() => {
    if (!currentTrack) return;
    setShowInlinePlayer(false);
    setCurrentView("artists");
    // Note: LibraryView will handle artist filtering internally when in artists view mode
    toast.success(`Affichage de l'artiste "${currentTrack.artist}"`);
  }, [currentTrack]);

  // Utility function to remove duplicates from track lists
  const getUniqueTracks = useCallback((trackList: Track[]): Track[] => {
    const seen = new Set<string>();
    return trackList.filter(track => {
      if (seen.has(track.id)) {
        return false;
      }
      seen.add(track.id);
      return true;
    });
  }, []);

  // Get favorite tracks (without duplicates)
  const favoriteTracks = useMemo(() => {
    return getUniqueTracks(tracks.filter(track => isFavorite(track.id)));
  }, [tracks, isFavorite, getUniqueTracks]);

  // Get recently played tracks from history (for QueuePanel) - without duplicates
  const historyTracks = useMemo(() => {
    const mapped = history
      .map(h => libraryTracks.find(t => t.id === h.trackId))
      .filter((t): t is Track => t !== undefined);
    return getUniqueTracks(mapped).slice(0, 50);
  }, [history, libraryTracks, getUniqueTracks]);

  // Get recently played tracks from history (for HomeView) - without duplicates
  const recentTracks = useMemo(() => {
    const mapped = history
      .map(h => tracks.find(t => t.id === h.trackId))
      .filter((t): t is Track => t !== undefined);
    return getUniqueTracks(mapped).slice(0, 20);
  }, [history, tracks, getUniqueTracks]);

  // Get recently added tracks (sorted by addedAt date) - without duplicates
  const recentlyAddedTracks = useMemo(() => {
    const filtered = libraryTracks.filter(t => t.addedAt);
    const unique = getUniqueTracks(filtered);
    return unique
      .sort((a, b) => {
        const dateA = a.addedAt ? new Date(a.addedAt).getTime() : 0;
        const dateB = b.addedAt ? new Date(b.addedAt).getTime() : 0;
        return dateB - dateA; // Most recent first
      })
      .slice(0, 50);
  }, [libraryTracks, getUniqueTracks]);

  // Get album tracks for current track - without duplicates
  const albumTracks = useMemo(() => {
    if (!currentTrack) return [];
    const filtered = libraryTracks.filter(t => t.album === currentTrack.album && t.artist === currentTrack.artist);
    const unique = getUniqueTracks(filtered);
    return unique.sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0));
  }, [currentTrack, libraryTracks, getUniqueTracks]);

  // Get similar tracks (same artist or genre, random selection) - without duplicates
  const similarTracks = useMemo(() => {
    if (!currentTrack) return [];
    
    // Find tracks with same artist or genre
    const candidates = libraryTracks.filter(t => 
      t.id !== currentTrack.id && 
      (t.artist === currentTrack.artist || 
       (currentTrack.genre && t.genre === currentTrack.genre))
    );
    
    // Remove duplicates and shuffle
    const unique = getUniqueTracks(candidates);
    const shuffled = [...unique].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 20);
  }, [currentTrack, libraryTracks, getUniqueTracks]);

  const handlePlayTrack = useCallback((track: Track) => {
    const trackIndex = tracks.findIndex(t => t.id === track.id);
    if (trackIndex >= 0) {
      handleTrackSelect(trackIndex);
    } else {
      // Track not in current queue, add it and play
      addToQueueNext(track);
      const newIndex = queue.tracks.length;
      setTimeout(() => {
        setCurrentIndex(newIndex);
        setIsPlaying(true);
      }, 100);
    }
  }, [tracks, queue.tracks.length, addToQueueNext, setCurrentIndex, handleTrackSelect]);

  const renderView = () => {
    // Inline player view
    if (showInlinePlayer && currentTrack) {
      return (
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
          onShuffle={handleShuffle}
          onRepeat={handleRepeat}
          onSeek={handleSeek}
          onVolumeChange={handleVolumeChange}
          onMuteToggle={() => setIsMuted(!isMuted)}
          onClose={handleShowPlayer}
          isInline={true}
          isFavorite={currentTrack ? isFavorite(currentTrack.id) : false}
          onToggleFavorite={handleToggleFavorite}
        />
      );
    }

    switch (currentView) {
      case "home":
        return (
        <HomeView
          tracks={tracks}
          currentTrackIndex={currentTrackIndex}
          isPlaying={isPlaying}
          onTrackSelect={handleTrackSelect}
          recentTracks={recentTracks}
          favoriteTracks={favoriteTracks}
          history={history}
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
            onPlayNext={handlePlayNext}
            onAddToQueue={handleAddToQueue}
            onAddToPlaylist={handleAddToPlaylist}
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
            emptyMessage="Aucun favori. Cliquez sur ❤️ pour ajouter des titres."
            onPlayNext={handlePlayNext}
            onAddToQueue={handleAddToQueue}
            onAddToPlaylist={handleAddToPlaylist}
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
            onPlayNext={handlePlayNext}
            onAddToQueue={handleAddToQueue}
            onAddToPlaylist={handleAddToPlaylist}
          />
        );
      case "recent":
        return (
          <div className="h-full flex flex-col animate-in fade-in duration-300">
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-8">
                {/* Section: Récemment écoutées */}
                {recentTracks.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Clock className="w-5 h-5 text-primary" />
                      <h2 className="font-display text-xl font-bold tracking-wider">
                        ÉCOUTÉ RÉCEMMENT
                      </h2>
                      <span className="text-sm text-muted-foreground">
                        ({recentTracks.length})
                      </span>
                    </div>
                    <LibraryView
                      tracks={recentTracks}
                      currentTrackIndex={currentTrackIndex}
                      isPlaying={isPlaying}
                      onTrackSelect={(index) => {
                        const track = recentTracks[index];
                        const realIndex = tracks.findIndex(t => t.id === track.id);
                        if (realIndex !== -1) handleTrackSelect(realIndex);
                      }}
                      title=""
                      showFilters={false}
                      showHistory={true}
                      emptyMessage="Aucun historique d'écoute."
                      onPlayNext={handlePlayNext}
                      onAddToQueue={handleAddToQueue}
                      onAddToPlaylist={handleAddToPlaylist}
                    />
                  </div>
                )}

                {/* Section: Récemment ajoutées */}
                {recentlyAddedTracks.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Music className="w-5 h-5 text-primary" />
                      <h2 className="font-display text-xl font-bold tracking-wider">
                        RÉCEMMENT AJOUTÉES
                      </h2>
                      <span className="text-sm text-muted-foreground">
                        ({recentlyAddedTracks.length})
                      </span>
                    </div>
                    <LibraryView
                      tracks={recentlyAddedTracks}
                      currentTrackIndex={currentTrackIndex}
                      isPlaying={isPlaying}
                      onTrackSelect={(index) => {
                        const track = recentlyAddedTracks[index];
                        const realIndex = tracks.findIndex(t => t.id === track.id);
                        if (realIndex !== -1) handleTrackSelect(realIndex);
                      }}
                      title=""
                      showFilters={false}
                      emptyMessage="Aucune musique récemment ajoutée."
                      onPlayNext={handlePlayNext}
                      onAddToQueue={handleAddToQueue}
                      onAddToPlaylist={handleAddToPlaylist}
                    />
                  </div>
                )}

                {/* Empty state */}
                {recentTracks.length === 0 && recentlyAddedTracks.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Clock className="w-16 h-16 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Aucun historique</h3>
                    <p className="text-muted-foreground text-sm max-w-md">
                      Vos pistes récemment écoutées et récemment ajoutées apparaîtront ici.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      case "albums":
        return (
          <LibraryView
            tracks={tracks}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={handleTrackSelect}
            title="Albums"
            viewMode="albums"
            initialSelectedAlbum={albumToOpen}
            onPlayNext={handlePlayNext}
            onAddToQueue={handleAddToQueue}
            onAddToPlaylist={handleAddToPlaylist}
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
            viewMode="artists"
            onPlayNext={handlePlayNext}
            onAddToQueue={handleAddToQueue}
            onAddToPlaylist={handleAddToPlaylist}
          />
        );
      case "videos":
        return <VideosView />;
      case "local":
        return (
          <LibraryView
            tracks={tracks.filter(t => t.filePath)}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onTrackSelect={(index) => {
              const localTracks = tracks.filter(t => t.filePath);
              const track = localTracks[index];
              const realIndex = tracks.findIndex(t => t.id === track.id);
              if (realIndex !== -1) handleTrackSelect(realIndex);
            }}
            title="Fichiers Locaux"
            viewMode="folders"
            onPlayNext={handlePlayNext}
            onAddToQueue={handleAddToQueue}
            onAddToPlaylist={handleAddToPlaylist}
          />
        );
      case "downloads":
        return (
          <Suspense fallback={<div className="p-6">Chargement des téléchargements...</div>}>
            <DownloadsView />
          </Suspense>
        );
      case "audio-senses":
        return (
          <Suspense fallback={<div className="p-6">Chargement des sens audio...</div>}>
            {audioRef.current && <AudioSensesView audioElement={audioRef.current} />}
          </Suspense>
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
  const noTracksMessage = tracks.length === 0 && !libraryLoading && !showInlinePlayer && currentView !== "settings" && (
    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
      <div className="glass rounded-xl p-8 text-center max-w-md pointer-events-auto animate-in fade-in zoom-in duration-300">
        <h2 className="font-display text-xl mb-3">Bibliothèque vide</h2>
        <p className="text-muted-foreground mb-4">
          Ajoutez des dossiers de musique dans les Paramètres pour commencer à écouter.
        </p>
        <button 
          onClick={handleOpenSettings}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          Ouvrir les Paramètres
        </button>
      </div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={0}>
      <UpdateNotification />
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
            audioElement={audioRef.current}
            onPlayPause={handlePlayPause}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onShuffle={handleShuffle}
            onRepeat={handleRepeat}
            onSeek={handleSeek}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={() => setIsMuted(!isMuted)}
            onClose={() => setIsFullscreen(false)}
            isFavorite={isFavorite(currentTrack.id)}
            onToggleFavorite={handleToggleFavorite}
          />
        )}

        {/* Title Bar */}
        <TitleBar 
          onOpenSettings={handleOpenSettings} 
          uploadProgress={isUploading ? overallProgress : undefined}
        />

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden relative">
          <BackgroundEffects />

          {/* Sidebar */}
          <Sidebar 
            currentView={currentView} 
            onViewChange={(view) => {
              setShowInlinePlayer(false);
              setCurrentView(view);
              // Clear album selection when changing views
              if (view !== "albums") setAlbumToOpen(null);
            }}
            favoritesCount={favoriteTracks.length}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
            onPlayPlaylist={handlePlayPlaylist}
            onShufflePlaylist={handleShufflePlaylist}
          />

          {/* Content Area */}
          <div className="flex-1 flex overflow-hidden relative z-10">
            {noTracksMessage}
            
            <div className={cn(
              "flex-1 transition-all duration-300 relative",
              isQueueOpen && "mr-80",
              showInlinePlayer && "flex items-center justify-center"
            )}>
              {showInlinePlayer ? (
                <div className="h-full w-full flex items-center justify-center animate-in fade-in duration-200">
                  {renderView()}
                </div>
              ) : (
                <ScrollArea className="h-full w-full">
                  <div className="animate-in fade-in duration-200">
                    {renderView()}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Queue Panel */}
            {isQueueOpen && (
              <div className="absolute right-0 top-0 bottom-0 z-20 animate-in slide-in-from-right duration-300">
                <QueuePanel
                  tracks={tracks}
                  currentTrackIndex={currentTrackIndex}
                  isPlaying={isPlaying}
                  onTrackSelect={handleTrackSelect}
                  onClose={() => setIsQueueOpen(false)}
                  albumTracks={albumTracks}
                  similarTracks={similarTracks}
                  historyTracks={historyTracks}
                  onPlayTrack={handlePlayTrack}
                />
              </div>
            )}

            {/* Lyrics Panel */}
            {isLyricsOpen && currentTrack && (
              <div className="absolute right-0 top-0 bottom-0 z-20 w-80 animate-in slide-in-from-right duration-300">
                <LyricsDisplay
                  currentTrack={currentTrack}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  className="h-full"
                />
              </div>
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
            isFavorite={isFavorite(currentTrack.id)}
            onPlayPause={handlePlayPause}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onShuffle={handleShuffle}
            onRepeat={handleRepeat}
            onSeek={handleSeek}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={() => setIsMuted(!isMuted)}
            onToggleQueue={() => {
              setIsQueueOpen(!isQueueOpen);
              if (!isQueueOpen) setIsLyricsOpen(false);
            }}
            onFullscreen={() => setIsFullscreen(true)}
            onToggleFavorite={handleToggleFavorite}
            onShowPlayer={handleShowPlayer}
            onShowLyrics={() => {
              setIsLyricsOpen(!isLyricsOpen);
              if (!isLyricsOpen) setIsQueueOpen(false);
            }}
            onNavigateToAlbum={handleNavigateToAlbum}
            onNavigateToArtist={handleNavigateToArtist}
            isQueueOpen={isQueueOpen}
          />
        )}

        {/* Scan progress indicator */}
        {scanning && scanProgress && (
          <div className="fixed bottom-20 right-4 glass rounded-lg p-4 z-[10000] max-w-xs animate-in slide-in-from-right duration-300">
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
    </TooltipProvider>
  );
};
