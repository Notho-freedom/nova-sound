"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, Play, Music, Video as VideoIcon, Loader2, AlertCircle, ExternalLink, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useYouTubeSearch, type YouTubeSearchResult } from "@/hooks/useYouTubeSearch";
import { useYouTubeAutocomplete } from "@/hooks/useYouTubeAutocomplete";
import type { Video, Track } from "@/types/music";
import { youtubeVideoToTrack } from "@/lib/youtube-to-track";

interface YouTubeSearchViewProps {
  onPlayVideo: (video: Video, audioOnly?: boolean) => void;
  onAddToQueue?: (video: Video) => void;
  onPlayAsAudio?: (track: Track) => void; // Callback pour jouer comme audio et naviguer vers inline player
}

/**
 * Composant de recherche YouTube intégré dans Nexus
 */
export const YouTubeSearchView = ({ onPlayVideo, onAddToQueue, onPlayAsAudio }: YouTubeSearchViewProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [playbackMode, setPlaybackMode] = useState<"video" | "audio">("video");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  
  const { results, loading, error, search, clearResults, convertToVideo } = useYouTubeSearch();
  const { suggestions, loading: autocompleteLoading, searchSuggestions, clearSuggestions } = useYouTubeAutocomplete();

  // Mettre à jour les suggestions quand la requête change
  useEffect(() => {
    if (searchQuery.trim() && searchQuery.length >= 2) {
      searchSuggestions(searchQuery);
      setShowSuggestions(true);
    } else {
      clearSuggestions();
      setShowSuggestions(false);
    }
  }, [searchQuery, searchSuggestions, clearSuggestions]);

  // Fermer les suggestions quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Navigation au clavier dans les suggestions
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === "Enter") {
        handleSearch();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedSuggestionIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < suggestions.length) {
          const selectedQuery = suggestions[selectedSuggestionIndex].query;
          setSearchQuery(selectedQuery);
          setShowSuggestions(false);
          search(selectedQuery);
        } else if (searchQuery.trim()) {
          handleSearch();
        }
        break;
      case "Escape":
        e.preventDefault();
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  }, [showSuggestions, suggestions, selectedSuggestionIndex, searchQuery, search]);

  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (searchQuery.trim()) {
      setShowSuggestions(false);
      clearSuggestions();
      await search(searchQuery);
    }
  }, [searchQuery, search, clearSuggestions]);

  const handleSuggestionClick = useCallback((suggestionQuery: string) => {
    setSearchQuery(suggestionQuery);
    setShowSuggestions(false);
    clearSuggestions();
    search(suggestionQuery);
  }, [search, clearSuggestions]);

  const handlePlay = useCallback((result: YouTubeSearchResult) => {
    if (playbackMode === "audio" && onPlayAsAudio) {
      // Mode audio : convertir en Track et jouer dans le système audio
      const track = youtubeVideoToTrack(result);
      onPlayAsAudio(track);
    } else {
      // Mode vidéo : jouer comme vidéo
      const video = convertToVideo(result);
      onPlayVideo(video, playbackMode === "audio");
    }
  }, [convertToVideo, onPlayVideo, playbackMode, onPlayAsAudio]);

  const handleAddToQueue = useCallback((result: YouTubeSearchResult) => {
    if (onAddToQueue) {
      const video = convertToVideo(result);
      onAddToQueue(video);
    }
  }, [convertToVideo, onAddToQueue]);

  // Formater la durée YouTube (PT4M13S -> 4:13)
  const formatYouTubeDuration = (duration?: string): string => {
    if (!duration) return "";
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return duration;
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Formater le nombre de vues
  const formatViewCount = (count?: string): string => {
    if (!count) return "";
    const num = parseInt(count, 10);
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M vues`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K vues`;
    return `${num} vues`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header avec recherche */}
      <div className="flex-shrink-0 p-6 border-b border-border/30 bg-background/80 backdrop-blur-sm">
        <div className="space-y-4">
          {/* Barre de recherche */}
          <form onSubmit={handleSearch} className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground z-10" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Rechercher sur YouTube..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedSuggestionIndex(-1);
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (suggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                className="pl-10 pr-4 h-12 text-base"
                disabled={loading}
              />
              
              {/* Dropdown des suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="absolute top-full left-0 right-0 mt-1 bg-card border border-border/50 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto"
                >
                  <div className="p-1">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={`${suggestion.query}-${index}`}
                        type="button"
                        onClick={() => handleSuggestionClick(suggestion.query)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2",
                          index === selectedSuggestionIndex
                            ? "bg-primary/20 text-primary"
                            : "hover:bg-muted text-foreground"
                        )}
                        onMouseEnter={() => setSelectedSuggestionIndex(index)}
                      >
                        {suggestion.type === "video" ? (
                          <VideoIcon className="w-4 h-4 flex-shrink-0" />
                        ) : (
                          <Search className="w-4 h-4 flex-shrink-0" />
                        )}
                        <span className="flex-1 truncate">{suggestion.query}</span>
                        {index === selectedSuggestionIndex && (
                          <ChevronRight className="w-4 h-4 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                  {autocompleteLoading && (
                    <div className="p-2 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Recherche de suggestions...
                    </div>
                  )}
                </div>
              )}
            </div>
            <Button
              type="submit"
              disabled={loading || !searchQuery.trim()}
              className="h-12 px-6"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Recherche...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Rechercher
                </>
              )}
            </Button>
          </form>

          {/* Mode de lecture */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">Mode de lecture :</span>
            <div className="flex items-center gap-2">
              <Button
                variant={playbackMode === "video" ? "default" : "outline"}
                size="sm"
                onClick={() => setPlaybackMode("video")}
                className="gap-2"
              >
                <VideoIcon className="w-4 h-4" />
                Vidéo
              </Button>
              <Button
                variant={playbackMode === "audio" ? "default" : "outline"}
                size="sm"
                onClick={() => setPlaybackMode("audio")}
                className="gap-2"
              >
                <Music className="w-4 h-4" />
                Audio
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Message d'erreur */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive mb-1">Erreur de recherche</p>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{error}</p>
            </div>
          </div>
        )}

        {/* Résultats */}
        {results.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {results.map((result) => (
              <div
                key={result.videoId}
                className="group relative bg-card rounded-lg overflow-hidden border border-border/50 hover:border-primary/50 transition-all duration-200 hover:shadow-lg"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-muted overflow-hidden">
                  <img
                    src={result.thumbnailUrl}
                    alt={result.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {/* Overlay avec bouton play */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      size="icon"
                      className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90"
                      onClick={() => handlePlay(result)}
                    >
                      <Play className="w-6 h-6 fill-current ml-1" />
                    </Button>
                  </div>
                  {/* Durée */}
                  {result.duration && (
                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 rounded text-xs text-white font-medium">
                      {formatYouTubeDuration(result.duration)}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4 space-y-2">
                  <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                    {result.title}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {result.channelTitle}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {result.viewCount && (
                      <span>{formatViewCount(result.viewCount)}</span>
                    )}
                    {result.publishedAt && (
                      <>
                        <span>•</span>
                        <span>{new Date(result.publishedAt).toLocaleDateString('fr-FR')}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex flex-col gap-2">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="w-8 h-8 bg-background/90 backdrop-blur-sm"
                      onClick={() => window.open(`https://www.youtube.com/watch?v=${result.videoId}`, '_blank')}
                      title="Ouvrir sur YouTube"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                    {onAddToQueue && (
                      <Button
                        size="icon"
                        variant="secondary"
                        className="w-8 h-8 bg-background/90 backdrop-blur-sm"
                        onClick={() => handleAddToQueue(result)}
                        title="Ajouter à la file"
                      >
                        <Music className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : !loading && !error && searchQuery ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <Search className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Aucun résultat</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Aucune vidéo trouvée pour "{searchQuery}". Essayez avec d'autres mots-clés.
            </p>
          </div>
        ) : !loading && !error ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <VideoIcon className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Recherche YouTube</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              Recherchez des vidéos sur YouTube et lisez-les directement dans Nexus.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <VideoIcon className="w-4 h-4" />
              <span>Mode vidéo</span>
              <span>•</span>
              <Music className="w-4 h-4" />
              <span>Mode audio</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
