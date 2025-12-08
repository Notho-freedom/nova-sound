import { useState, useEffect, useRef, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Music2, Search, RefreshCw, Clock, AlignLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Track, LyricsResult, LyricsLine } from "@/types/music";

interface LyricsDisplayProps {
  currentTrack: Track | null;
  currentTime: number;
  isPlaying: boolean;
  className?: string;
}

export const LyricsDisplay = ({
  currentTrack,
  currentTime,
  isPlaying,
  className,
}: LyricsDisplayProps) => {
  const [lyrics, setLyrics] = useState<LyricsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [offset, setOffset] = useState(0); // Sync offset in seconds
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentLineRef = useRef<HTMLDivElement>(null);

  // Load lyrics when track changes
  useEffect(() => {
    const loadLyrics = async () => {
      if (!currentTrack) {
        setLyrics(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        if (window.electronAPI?.getLyrics) {
          const result = await window.electronAPI.getLyrics(
            currentTrack.artist,
            currentTrack.title,
            currentTrack.duration
          );
          setLyrics(result);
          if (!result) {
            setError("Paroles non trouvées");
          }
        } else {
          // Web mode - no lyrics available
          setError("Paroles disponibles uniquement en mode application");
        }
      } catch (err) {
        setError("Erreur lors du chargement des paroles");
        console.error("Failed to load lyrics:", err);
      } finally {
        setLoading(false);
      }
    };

    loadLyrics();
    setOffset(0);
  }, [currentTrack?.id]);

  // Find current lyrics line
  const getCurrentLineIndex = useCallback((): number => {
    if (!lyrics?.syncedLyrics) return -1;
    
    const adjustedTime = currentTime + offset;
    let currentIndex = -1;

    for (let i = 0; i < lyrics.syncedLyrics.length; i++) {
      if (lyrics.syncedLyrics[i].time <= adjustedTime) {
        currentIndex = i;
      } else {
        break;
      }
    }

    return currentIndex;
  }, [lyrics, currentTime, offset]);

  const currentLineIndex = getCurrentLineIndex();

  // Auto-scroll to current line
  useEffect(() => {
    if (currentLineRef.current && isPlaying) {
      currentLineRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentLineIndex, isPlaying]);

  // Search for lyrics
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);

    try {
      if (window.electronAPI?.searchLyrics) {
        const results = await window.electronAPI.searchLyrics(searchQuery);
        if (results.length > 0) {
          // Get first result
          const firstResult = results[0];
          const fullLyrics = await window.electronAPI.getLyrics(
            firstResult.artist,
            firstResult.title,
            firstResult.duration
          );
          setLyrics(fullLyrics);
          setShowSearch(false);
        } else {
          setError("Aucun résultat trouvé");
        }
      }
    } catch (err) {
      setError("Erreur lors de la recherche");
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Render synced lyrics
  const renderSyncedLyrics = () => {
    if (!lyrics?.syncedLyrics) return null;

    return (
      <div className="space-y-4 py-4">
        {lyrics.syncedLyrics.map((line, index) => (
          <div
            key={index}
            ref={index === currentLineIndex ? currentLineRef : null}
            className={cn(
              "px-4 py-2 rounded-lg transition-all duration-300 cursor-pointer",
              index === currentLineIndex
                ? "text-primary text-lg font-semibold scale-105 bg-primary/10"
                : index < currentLineIndex
                ? "text-muted-foreground/50"
                : "text-foreground/80 hover:text-foreground"
            )}
          >
            {line.text || "♪"}
          </div>
        ))}
      </div>
    );
  };

  // Render plain lyrics
  const renderPlainLyrics = () => {
    if (!lyrics?.plainLyrics) return null;

    return (
      <div className="whitespace-pre-wrap text-foreground/80 leading-relaxed p-4">
        {lyrics.plainLyrics}
      </div>
    );
  };

  return (
    <div className={cn("glass rounded-xl flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <Music2 className="w-5 h-5 text-primary" />
          <h3 className="font-display text-lg tracking-wider">PAROLES</h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Offset control */}
          {lyrics?.syncedLyrics && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <button
                onClick={() => setOffset(o => o - 0.5)}
                className="px-1 hover:text-primary"
              >
                -
              </button>
              <span className="w-8 text-center">{offset > 0 ? "+" : ""}{offset}s</span>
              <button
                onClick={() => setOffset(o => o + 0.5)}
                className="px-1 hover:text-primary"
              >
                +
              </button>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSearch(!showSearch)}
            className="h-8 w-8"
          >
            <Search className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (currentTrack) {
                setLyrics(null);
                setError(null);
                // Trigger reload
              }
            }}
            className="h-8 w-8"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="p-4 border-b border-border/50">
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher des paroles..."
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Track info */}
      {currentTrack && (
        <div className="px-4 py-3 border-b border-border/50">
          <p className="font-semibold text-foreground">{currentTrack.title}</p>
          <p className="text-sm text-muted-foreground">{currentTrack.artist}</p>
        </div>
      )}

      {/* Lyrics content */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        {loading ? (
          <div className="flex items-center justify-center h-full p-8">
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
              <RefreshCw className="w-8 h-8 animate-spin" />
              <span>Chargement des paroles...</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full p-8">
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
              <AlignLeft className="w-8 h-8 opacity-50" />
              <span>{error}</span>
              {currentTrack && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSearch(true)}
                >
                  Rechercher manuellement
                </Button>
              )}
            </div>
          </div>
        ) : !currentTrack ? (
          <div className="flex items-center justify-center h-full p-8">
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
              <Music2 className="w-8 h-8 opacity-50" />
              <span>Aucune piste en cours</span>
            </div>
          </div>
        ) : lyrics?.syncedLyrics ? (
          renderSyncedLyrics()
        ) : lyrics?.plainLyrics ? (
          renderPlainLyrics()
        ) : (
          <div className="flex items-center justify-center h-full p-8">
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
              <AlignLeft className="w-8 h-8 opacity-50" />
              <span>Paroles non disponibles</span>
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Current line indicator (synced mode) */}
      {lyrics?.syncedLyrics && currentLineIndex >= 0 && (
        <div className="p-3 border-t border-border/50 bg-primary/5">
          <p className="text-sm text-primary text-center font-medium truncate">
            {lyrics.syncedLyrics[currentLineIndex]?.text || "♪"}
          </p>
        </div>
      )}
    </div>
  );
};

