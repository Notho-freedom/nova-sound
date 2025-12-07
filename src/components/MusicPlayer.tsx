import { useState, useEffect } from "react";
import { Music, ListMusic } from "lucide-react";
import { AlbumArt } from "./AlbumArt";
import { AudioVisualizer } from "./AudioVisualizer";
import { PlayerControls } from "./PlayerControls";
import { ProgressBar } from "./ProgressBar";
import { TrackList } from "./TrackList";
import { BackgroundEffects } from "./BackgroundEffects";
import { demoTracks } from "@/data/tracks";
import { cn } from "@/lib/utils";

export const MusicPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const [volume, setVolume] = useState(70);
  const [isMuted, setIsMuted] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(true);

  const currentTrack = demoTracks[currentTrackIndex];

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

  const handlePlayPause = () => setIsPlaying(!isPlaying);

  const handlePrevious = () => {
    if (currentTime > 3) {
      setCurrentTime(0);
    } else {
      setCurrentTrackIndex((prev) => (prev === 0 ? demoTracks.length - 1 : prev - 1));
      setCurrentTime(0);
    }
  };

  const handleNext = () => {
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
  };

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

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 md:p-8 relative">
      <BackgroundEffects />
      
      <div className="w-full max-w-6xl flex flex-col lg:flex-row gap-6 relative z-10">
        {/* Main Player */}
        <div className="flex-1 glass rounded-2xl p-6 md:p-8 animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center glow-cyan">
                <Music className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-lg md:text-xl tracking-wider text-primary neon-text-cyan">
                  NEXUS
                </h1>
                <p className="text-xs text-muted-foreground">AUDIO SYSTEM</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowPlaylist(!showPlaylist)}
              className={cn(
                "lg:hidden control-button",
                showPlaylist && "text-primary glow-cyan"
              )}
            >
              <ListMusic className="w-5 h-5" />
            </button>
          </div>

          {/* Album Art */}
          <div className="flex justify-center mb-8">
            <AlbumArt
              src={currentTrack.coverUrl || `https://images.unsplash.com/photo-1614149162883-504ce4d13909?w=400&h=400&fit=crop`}
              alt={currentTrack.album}
              isPlaying={isPlaying}
              className="w-48 h-48 md:w-64 md:h-64"
            />
          </div>

          {/* Track Info */}
          <div className="text-center mb-6">
            <h2 className="font-display text-xl md:text-2xl font-bold mb-1 text-foreground">
              {currentTrack.title}
            </h2>
            <p className="text-muted-foreground">
              {currentTrack.artist} — <span className="text-primary/70">{currentTrack.album}</span>
            </p>
          </div>

          {/* Visualizer */}
          <div className="mb-6">
            <AudioVisualizer isPlaying={isPlaying} barCount={50} />
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <ProgressBar
              currentTime={currentTime}
              duration={currentTrack.duration}
              onSeek={handleSeek}
            />
          </div>

          {/* Controls */}
          <PlayerControls
            isPlaying={isPlaying}
            isShuffle={isShuffle}
            repeatMode={repeatMode}
            volume={volume}
            isMuted={isMuted}
            onPlayPause={handlePlayPause}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onShuffle={() => setIsShuffle(!isShuffle)}
            onRepeat={handleRepeat}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={() => setIsMuted(!isMuted)}
          />
        </div>

        {/* Playlist Sidebar */}
        <div 
          className={cn(
            "lg:w-96 glass rounded-2xl p-6 transition-all duration-500",
            "animate-slide-up",
            showPlaylist ? "block" : "hidden lg:block"
          )}
          style={{ animationDelay: "0.1s" }}
        >
          <div className="flex items-center gap-3 mb-6">
            <ListMusic className="w-5 h-5 text-primary" />
            <h2 className="font-display text-lg tracking-wider">QUEUE</h2>
            <span className="ml-auto text-sm text-muted-foreground font-display">
              {demoTracks.length} TRACKS
            </span>
          </div>

          <div className="h-[400px] lg:h-[calc(100vh-280px)] max-h-[600px]">
            <TrackList
              tracks={demoTracks}
              currentTrackIndex={currentTrackIndex}
              isPlaying={isPlaying}
              onTrackSelect={handleTrackSelect}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
