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

  // Find current lyrics line with improved precision and anticipation
  const getCurrentLineIndex = useCallback((): number => {
    if (!lyrics?.syncedLyrics || lyrics.syncedLyrics.length === 0) return -1;
    
    // Add small anticipation (0.2s) to compensate for display delay
    const anticipation = 0.2;
    const adjustedTime = currentTime + offset + anticipation;
    
    // Binary search for better performance with large lyrics
    let left = 0;
    let right = lyrics.syncedLyrics.length - 1;
    let currentIndex = -1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const lineTime = lyrics.syncedLyrics[mid].time;
      
      if (lineTime <= adjustedTime) {
        currentIndex = mid;
        left = mid + 1; // Continue searching right for the latest matching line
      } else {
        right = mid - 1;
      }
    }

    return currentIndex;
  }, [lyrics, currentTime, offset]);

  const currentLineIndex = getCurrentLineIndex();

  // Auto-scroll to current line with better timing
  useEffect(() => {
    if (currentLineRef.current && (isPlaying || currentLineIndex >= 0)) {
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        if (currentLineRef.current) {
          currentLineRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
          });
        }
      });
    }
  }, [currentLineIndex, isPlaying]);

  // Also scroll when lyrics are first loaded
  useEffect(() => {
    if (lyrics?.syncedLyrics && currentLineIndex >= 0 && currentLineRef.current) {
      setTimeout(() => {
        if (currentLineRef.current) {
          currentLineRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }, 300);
    }
  }, [lyrics?.syncedLyrics]);

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

  // Render synced lyrics - ensure all lines are displayed
  const renderSyncedLyrics = () => {
    if (!lyrics?.syncedLyrics) return null;

    return (
      <div className="space-y-3 py-6">
        {lyrics.syncedLyrics.map((line, index) => {
          const isCurrent = index === currentLineIndex;
          const isPast = index < currentLineIndex;
          const isNext = index === currentLineIndex + 1;
          
          return (
            <div
              key={`${line.time}-${index}`}
              ref={isCurrent ? currentLineRef : null}
              className={cn(
                "px-6 py-3 rounded-lg transition-all duration-200 ease-out",
                "min-h-[3rem] flex items-center",
                isCurrent
                  ? "text-primary text-xl font-bold scale-105 bg-primary/20 shadow-lg shadow-primary/20 border-2 border-primary/30"
                  : isPast
                  ? "text-muted-foreground/40 text-base"
                  : isNext
                  ? "text-foreground/90 text-lg font-medium bg-muted/20"
                  : "text-foreground/70 text-base hover:text-foreground hover:bg-muted/10"
              )}
            >
              <div className="flex-1">
                {line.text || "♪"}
              </div>
              {isCurrent && (
                <div className="ml-4 w-2 h-2 rounded-full bg-primary animate-pulse" />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Render plain lyrics - ensure complete display
  const renderPlainLyrics = () => {
    if (!lyrics?.plainLyrics) return null;

    // Split into lines for better display
    const lines = lyrics.plainLyrics.split('\n').filter(line => line.trim());

    return (
      <div className="space-y-2 py-6 px-4">
        {lines.map((line, index) => (
          <div
            key={`plain-${index}`}
            className="text-foreground/80 leading-relaxed text-base py-1"
          >
            {line.trim() || '\u00A0'}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={cn("glass rounded-xl flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
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
                className="px-1 hover:text-primary transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 rounded"
              >
                -
              </button>
              <span className="w-8 text-center">{offset > 0 ? "+" : ""}{offset}s</span>
              <button
                onClick={() => setOffset(o => o + 0.5)}
                className="px-1 hover:text-primary transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 rounded"
              >
                +
              </button>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSearch(!showSearch)}
            className="h-8 w-8 transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
          >
            <Search className="w-4 h-4 hover:scale-105 transition-transform duration-200 ease-out" />
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
            className="h-8 w-8 transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
          >
            <RefreshCw className="w-4 h-4 hover:scale-105 transition-transform duration-200 ease-out" />
          </Button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-4 py-3 border-b border-border/50">
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher des paroles..."
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1 transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-primary/50"
            />
            <Button onClick={handleSearch} disabled={loading} className="transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2">
              <Search className="w-4 h-4 hover:scale-105 transition-transform duration-200 ease-out" />
            </Button>
          </div>
        </div>
      )}

      {/* Track info */}
      {currentTrack && (
        <div className="px-4 py-2.5 border-b border-border/50">
          <p className="font-semibold text-foreground">{currentTrack.title}</p>
          <p className="text-sm text-muted-foreground">{currentTrack.artist}</p>
        </div>
      )}

      {/* Lyrics content - ensure full height and scrolling */}
      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        <div className="min-h-full">
          {loading ? (
            <div className="flex items-center justify-center h-full min-h-[400px] p-8">
              <div className="flex flex-col items-center gap-4 text-muted-foreground">
                <RefreshCw className="w-8 h-8 animate-spin" />
                <span>Chargement des paroles...</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full min-h-[400px] p-8">
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
            <div className="flex items-center justify-center h-full min-h-[400px] p-8">
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
            <div className="flex items-center justify-center h-full min-h-[400px] p-8">
              <div className="flex flex-col items-center gap-4 text-muted-foreground">
                <AlignLeft className="w-8 h-8 opacity-50" />
                <span>Paroles non disponibles</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Current line indicator and progress (synced mode) */}
      {lyrics?.syncedLyrics && currentLineIndex >= 0 && (
        <div className="px-4 py-3 border-t border-border/50 bg-primary/5">
          <div className="flex items-center justify-between gap-4 mb-2">
            <p className="text-sm text-primary text-center font-semibold flex-1 truncate">
              {lyrics.syncedLyrics[currentLineIndex]?.text || "♪"}
            </p>
            {currentTrack && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatTime(currentTime)} / {formatTime(currentTrack.duration)}
              </span>
            )}
          </div>
          {/* Progress indicator */}
          {currentTrack && currentTrack.duration > 0 && (
            <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-200 ease-out"
                style={{ width: `${(currentTime / currentTrack.duration) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

