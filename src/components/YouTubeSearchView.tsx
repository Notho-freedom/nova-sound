"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Search, Play, Music, Video as VideoIcon, Loader2, AlertCircle, ExternalLink, ChevronRight, History, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useYouTubeSearch, type YouTubeSearchResult } from "@/hooks/useYouTubeSearch";
import { useYouTubeAutocomplete } from "@/hooks/useYouTubeAutocomplete";
import { useVideoLibrary } from "@/hooks/useVideoLibrary";
import { usePlayHistory } from "@/hooks/usePlayHistory";
import { useLibrary } from "@/hooks/useLibrary";
import type { Video, Track } from "@/types/music";
import { youtubeVideoToTrack } from "@/lib/youtube-to-track";
import { searchYouTubeByArtist } from "@/lib/youtube-artist-search";
import { extractYouTubeVideoId } from "@/lib/youtube";
import { YouTubePlayer } from "@/components/YouTubePlayer";

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
  
  // Historique et suggestions
  const { recentlyWatched, enhancedVideos } = useVideoLibrary();
  const { history: audioHistory } = usePlayHistory();
  const { tracks: audioTracks } = useLibrary();
  const [artistSuggestions, setArtistSuggestions] = useState<YouTubeSearchResult[]>([]);
  const [loadingArtistSuggestions, setLoadingArtistSuggestions] = useState(false);
  
  // État pour la vidéo en cours de lecture
  const [playingVideo, setPlayingVideo] = useState<Video | null>(null);
  const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false);
  
  // Filtrer TOUTES les vidéos YouTube de l'historique (pas de limite)
  // Utiliser à la fois recentlyWatched, enhancedVideos ET l'historique brut depuis localStorage
  const youtubeWatchHistory = useMemo(() => {
    // 1. Vidéos YouTube depuis recentlyWatched
    const fromRecentlyWatched = recentlyWatched
      .filter(v => v.mediaSource === 'youtube' || v.youtubeVideoId || (v.filePath && extractYouTubeVideoId(v.filePath)));
    
    // 2. Vidéos YouTube depuis enhancedVideos (pour capturer celles qui ne sont pas dans recentlyWatched)
    const fromEnhancedVideos = enhancedVideos
      .filter(v => (v.mediaSource === 'youtube' || v.youtubeVideoId || (v.filePath && extractYouTubeVideoId(v.filePath))))
      .filter(v => !fromRecentlyWatched.some(rw => rw.id === v.id));
    
    // 3. Récupérer l'historique brut depuis localStorage pour trouver les vidéos YouTube manquantes
    let rawWatchHistory: Array<{ videoId: string; watchedAt: string }> = [];
    try {
      const saved = localStorage.getItem("nexus-video-watch-history");
      if (saved) {
        rawWatchHistory = JSON.parse(saved);
      }
    } catch (error) {
      // Ignorer les erreurs de parsing
    }
    
    // 4. Reconstruire les vidéos YouTube depuis l'historique brut si elles ne sont pas dans enhancedVideos
    const fromRawHistory: Video[] = [];
    const existingIds = new Set([...fromRecentlyWatched, ...fromEnhancedVideos].map(v => v.id));
    
    for (const entry of rawWatchHistory) {
      // Vérifier si c'est une vidéo YouTube (ID commence par "youtube-" ou contient un videoId YouTube)
      if (entry.videoId.startsWith('youtube-') || entry.videoId.includes('youtube-audio-')) {
        const videoId = entry.videoId.replace('youtube-', '').replace('youtube-audio-', '');
        const id = `youtube-${videoId}`;
        
        if (!existingIds.has(id) && !existingIds.has(entry.videoId)) {
          // Créer une vidéo YouTube minimale depuis l'historique
          fromRawHistory.push({
            id: id,
            filePath: `https://www.youtube.com/watch?v=${videoId}`,
            title: `Vidéo YouTube ${videoId}`,
            description: '',
            duration: 0,
            thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            fileSize: 0,
            addedAt: entry.watchedAt,
            mediaSource: 'youtube',
            youtubeVideoId: videoId,
            type: 'music_video',
            lastPlayedAt: entry.watchedAt,
          });
        }
      } else {
        // Vérifier si c'est une URL YouTube
        const videoId = extractYouTubeVideoId(entry.videoId);
        if (videoId) {
          const id = `youtube-${videoId}`;
          if (!existingIds.has(id) && !existingIds.has(entry.videoId)) {
            fromRawHistory.push({
              id: id,
              filePath: entry.videoId,
              title: `Vidéo YouTube ${videoId}`,
              description: '',
              duration: 0,
              thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
              fileSize: 0,
              addedAt: entry.watchedAt,
              mediaSource: 'youtube',
              youtubeVideoId: videoId,
              type: 'music_video',
              lastPlayedAt: entry.watchedAt,
            });
          }
        }
      }
    }
    
    // 5. Combiner et dédupliquer par ID
    const allYouTubeVideos = [...fromRecentlyWatched, ...fromEnhancedVideos, ...fromRawHistory];
    const unique = Array.from(
      new Map(allYouTubeVideos.map(v => [v.id, v])).values()
    );
    
    // 6. Trier par date de visionnage (plus récent en premier)
    const sorted = unique.sort((a, b) => {
      const aTime = a.lastPlayedAt ? new Date(a.lastPlayedAt).getTime() : new Date(a.addedAt).getTime();
      const bTime = b.lastPlayedAt ? new Date(b.lastPlayedAt).getTime() : new Date(b.addedAt).getTime();
      return bTime - aTime;
    });
    
    // Log pour débogage (toujours afficher pour voir l'état)
    console.log(`[YouTubeSearchView] Historique YouTube calculé: ${sorted.length} vidéos`, {
      fromRecentlyWatched: fromRecentlyWatched.length,
      fromEnhancedVideos: fromEnhancedVideos.length,
      fromRawHistory: fromRawHistory.length,
      recentlyWatchedTotal: recentlyWatched.length,
      enhancedVideosTotal: enhancedVideos.length,
      rawWatchHistoryTotal: rawWatchHistory.length,
    });
    
    return sorted;
  }, [recentlyWatched, enhancedVideos]);
  
  // Fonction helper pour extraire l'artiste d'un titre YouTube
  const extractArtistFromTitle = useCallback((title: string, channelTitle?: string): string | null => {
    if (!title) return null;
    
    // Patterns communs: "Artiste - Titre", "Artiste – Titre", "Artiste | Titre"
    const separators = [' - ', ' – ', ' — ', ' | ', ' • '];
    for (const sep of separators) {
      if (title.includes(sep)) {
        const parts = title.split(sep);
        if (parts.length >= 2 && parts[0].trim().length > 1) {
          return parts[0].trim();
        }
      }
    }
    
    // Si pas de séparateur, utiliser le channel comme artiste
    return channelTitle || null;
  }, []);

  // Fonction helper pour vérifier si une vidéo correspond à un artiste
  const videoMatchesArtist = useCallback((video: Video, artistName: string): boolean => {
    if (!artistName || artistName.length < 2) return false;
    
    const artistLower = artistName.toLowerCase().trim();
    const titleLower = (video.title || '').toLowerCase();
    const channelLower = (video.channelTitle || '').toLowerCase();
    const descriptionLower = (video.description || '').toLowerCase();
    
    // Vérifier si l'artiste apparaît dans le titre, la chaîne ou la description
    if (titleLower.includes(artistLower) || channelLower.includes(artistLower) || descriptionLower.includes(artistLower)) {
      return true;
    }
    
    // Extraire l'artiste du titre et comparer
    const extractedArtist = extractArtistFromTitle(video.title, video.channelTitle);
    if (extractedArtist && extractedArtist.toLowerCase().includes(artistLower)) {
      return true;
    }
    
    return false;
  }, [extractArtistFromTitle]);

  // Fallback: chercher dans l'historique YouTube local des vidéos correspondant aux artistes
  const findSuggestionsFromHistory = useCallback((artists: string[]): YouTubeSearchResult[] => {
    if (artists.length === 0 || youtubeWatchHistory.length === 0) {
      return [];
    }
    
    const matchedVideos: YouTubeSearchResult[] = [];
    const seenVideoIds = new Set<string>();
    
    // Pour chaque artiste, chercher des vidéos correspondantes dans l'historique
    for (const artist of artists) {
      if (matchedVideos.length >= 15) break; // Limite de 15 suggestions
      
      for (const video of youtubeWatchHistory) {
        if (seenVideoIds.has(video.id)) continue;
        
        if (videoMatchesArtist(video, artist)) {
          // Convertir Video en YouTubeSearchResult
          const videoId = video.youtubeVideoId || extractYouTubeVideoId(video.filePath) || '';
          if (!videoId) continue;
          
          matchedVideos.push({
            videoId: videoId,
            title: video.title || '',
            description: video.description || '',
            thumbnailUrl: video.thumbnailUrl || '',
            channelTitle: video.channelTitle || '',
            publishedAt: video.addedAt || video.lastPlayedAt || '',
            duration: video.duration ? `PT${Math.floor(video.duration / 3600)}H${Math.floor((video.duration % 3600) / 60)}M${video.duration % 60}S` : undefined,
            viewCount: undefined,
          });
          
          seenVideoIds.add(video.id);
          
          if (matchedVideos.length >= 15) break;
        }
      }
    }
    
    return matchedVideos;
  }, [youtubeWatchHistory, videoMatchesArtist]);

  // Charger les suggestions basées sur les artistes les plus écoutés OU l'historique de recherche YouTube
  const loadArtistSuggestions = useCallback(async () => {
    // Charger l'historique de recherche YouTube
    let searchHistory: string[] = [];
    try {
      const saved = localStorage.getItem("nexus-search-history");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          searchHistory = parsed.slice(0, 10); // Top 10 recherches récentes
        }
      }
    } catch (error) {
      // Ignorer les erreurs de parsing
    }
    
    // Calculer les artistes les plus écoutés depuis l'historique audio
    const artistCounts = new Map<string, number>();
    if (audioHistory.length > 0 && audioTracks.length > 0) {
      audioHistory.forEach(entry => {
        const track = audioTracks.find(t => t.id === entry.trackId);
        if (track && track.artist) {
          const count = artistCounts.get(track.artist) || 0;
          artistCounts.set(track.artist, count + (entry.playCount || 1));
        }
      });
    }
    
    // Extraire aussi les artistes depuis l'historique de recherche YouTube
    // (chercher des patterns comme "artiste - titre" ou juste "artiste")
    searchHistory.forEach(query => {
      const parts = query.split(/\s*-\s*|\s*–\s*/);
      if (parts.length > 0 && parts[0].trim().length > 2) {
        const artist = parts[0].trim();
        const count = artistCounts.get(artist) || 0;
        artistCounts.set(artist, count + 1);
      }
    });
    
    // Top 5 artistes (augmenté pour avoir plus de résultats)
    const topArtists = Array.from(artistCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([artist]) => artist);
    
    // Si pas d'artistes mais des recherches, utiliser les recherches comme "artistes"
    const searchTerms = topArtists.length === 0 && searchHistory.length > 0
      ? searchHistory.slice(0, 3)
      : topArtists;
    
    if (searchTerms.length === 0) {
      setArtistSuggestions([]);
      return;
    }
    
    // Charger les suggestions pour chaque terme (artiste ou recherche)
    setLoadingArtistSuggestions(true);
    try {
      const allSuggestions: YouTubeSearchResult[] = [];
      let apiFailed = false;
      
      // Essayer d'abord avec l'API YouTube
      for (const term of searchTerms) {
        try {
          const suggestions = await searchYouTubeByArtist(term, 5);
          if (suggestions.length > 0) {
            const converted = suggestions.map(s => ({
              videoId: s.videoId,
              title: s.title,
              description: s.description,
              thumbnailUrl: s.thumbnailUrl,
              channelTitle: s.channelTitle,
              publishedAt: s.publishedAt,
              duration: s.duration ? `PT${Math.floor(s.duration / 3600)}H${Math.floor((s.duration % 3600) / 60)}M${s.duration % 60}S` : undefined,
              viewCount: s.viewCount?.toString(),
            }));
            allSuggestions.push(...converted);
          }
        } catch (error) {
          console.warn(`[YouTubeSearchView] Erreur API suggestions pour ${term}:`, error);
          apiFailed = true;
        }
      }
      
      // Si l'API a échoué ou n'a pas retourné assez de résultats, utiliser le fallback historique
      if (apiFailed || allSuggestions.length < 5) {
        console.log(`[YouTubeSearchView] Utilisation du fallback historique (API: ${allSuggestions.length} résultats)`);
        const historySuggestions = findSuggestionsFromHistory(searchTerms);
        
        // Combiner les résultats API et historique, en priorisant l'API
        const combined = [...allSuggestions];
        const existingIds = new Set(allSuggestions.map(s => s.videoId));
        
        for (const histSuggestion of historySuggestions) {
          if (!existingIds.has(histSuggestion.videoId)) {
            combined.push(histSuggestion);
          }
        }
        
        allSuggestions.length = 0;
        allSuggestions.push(...combined);
      }
      
      // Dédupliquer par videoId
      const unique = Array.from(
        new Map(allSuggestions.map(r => [r.videoId, r])).values()
      );

      const finalSuggestions = unique.slice(0, 15); // Max 15 suggestions
      console.log(`[YouTubeSearchView] Suggestions artistes chargées: ${finalSuggestions.length} vidéos`, {
        searchTerms,
        allSuggestionsCount: allSuggestions.length,
        uniqueCount: unique.length,
        fromAPI: !apiFailed,
        fromHistory: apiFailed || allSuggestions.length < 5,
      });
      setArtistSuggestions(finalSuggestions);
    } catch (error) {
      console.error('[YouTubeSearchView] Erreur chargement suggestions artistes:', error);
      // En cas d'erreur totale, essayer quand même le fallback historique
      try {
        const historySuggestions = findSuggestionsFromHistory(searchTerms);
        setArtistSuggestions(historySuggestions.slice(0, 15));
      } catch (fallbackError) {
        console.error('[YouTubeSearchView] Erreur fallback historique:', fallbackError);
        setArtistSuggestions([]);
      }
    } finally {
      setLoadingArtistSuggestions(false);
    }
  }, [audioHistory, audioTracks, findSuggestionsFromHistory, youtubeWatchHistory]);

  // Charger les suggestions au montage et quand les données changent
  useEffect(() => {
    // Ne charger que si on n'a pas de recherche active
    if (!searchQuery.trim()) {
      loadArtistSuggestions();
    }
  }, [loadArtistSuggestions, searchQuery]);

  // Mettre à jour les suggestions quand la requête change
  useEffect(() => {
    if (searchQuery.trim() && searchQuery.length >= 2) {
      searchSuggestions(searchQuery);
      setShowSuggestions(true);
    } else {
      clearSuggestions();
      setShowSuggestions(false);
      // Si la recherche est vide, on affiche l'historique et les suggestions
      clearResults();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

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
      // Mode vidéo : jouer dans le lecteur intégré
      const video = convertToVideo(result);
      setPlayingVideo(video);
      setIsPlayerFullscreen(true);
      // Ajouter à l'historique
      if (onPlayVideo) {
        onPlayVideo(video, playbackMode === "audio");
      }
    }
  }, [convertToVideo, onPlayVideo, playbackMode, onPlayAsAudio]);
  
  // Gérer la lecture des vidéos de l'historique
  const handlePlayHistoryVideo = useCallback((video: Video) => {
    if (playbackMode === "audio" && onPlayAsAudio) {
      // Mode audio : convertir en Track
      const track = youtubeVideoToTrack({
        videoId: video.youtubeVideoId || extractYouTubeVideoId(video.filePath || '') || '',
        title: video.title,
        description: video.description || '',
        thumbnailUrl: video.thumbnailUrl || '',
        channelTitle: video.channelTitle || '',
        publishedAt: video.addedAt || '',
        duration: video.duration ? `PT${Math.floor(video.duration / 3600)}H${Math.floor((video.duration % 3600) / 60)}M${video.duration % 60}S` : undefined,
        viewCount: undefined,
      });
      onPlayAsAudio(track);
    } else {
      // Mode vidéo : jouer dans le lecteur intégré
      setPlayingVideo(video);
      setIsPlayerFullscreen(true);
      // Ajouter à l'historique
      if (onPlayVideo) {
        onPlayVideo(video, playbackMode === "audio");
      }
    }
  }, [playbackMode, onPlayAsAudio, onPlayVideo]);

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

  // Obtenir l'ID de la vidéo YouTube en cours de lecture
  const playingVideoId = playingVideo 
    ? (playingVideo.youtubeVideoId || extractYouTubeVideoId(playingVideo.filePath || ''))
    : null;

  return (
    <div className="flex flex-col h-full relative">
      {/* Lecteur vidéo intégré en overlay */}
      {isPlayerFullscreen && playingVideo && playingVideoId && (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
          <div className="absolute top-4 right-4 z-50">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setPlayingVideo(null);
                setIsPlayerFullscreen(false);
              }}
              className="bg-black/50 hover:bg-black/70 text-white"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex-1 w-full h-full">
            <YouTubePlayer
              videoId={playingVideoId}
              autoPlay={true}
              audioOnly={playbackMode === "audio"}
              className="w-full h-full"
            />
          </div>
        </div>
      )}
      
      {/* Contenu principal */}
      <div className={cn("flex flex-col h-full", isPlayerFullscreen && "opacity-0 pointer-events-none")}>
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
                        key={`suggestion-${suggestion.query}-${index}-${suggestion.type || 'query'}`}
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
        {/* Debug: Afficher l'état de la recherche */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-4 p-2 bg-muted/50 rounded text-xs font-mono">
            <div>searchQuery: "{searchQuery}" (trim: "{searchQuery.trim()}")</div>
            <div>searchQuery.trim() === "": {searchQuery.trim() === "" ? 'true' : 'false'}</div>
            <div>Condition: {searchQuery.trim() ? 'AFFICHER RÉSULTATS' : 'AFFICHER HISTORIQUE/SUGGESTIONS'}</div>
          </div>
        )}
        
        {/* Mode recherche active */}
        {searchQuery.trim() ? (
          <>
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

            {/* Résultats de recherche */}
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : results.length > 0 ? (
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
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Search className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucun résultat</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Aucune vidéo trouvée pour "{searchQuery}". Essayez avec d'autres mots-clés.
                </p>
              </div>
            )}
          </>
        ) : (
          /* Pas de recherche active : afficher historique et suggestions */
          <div className="space-y-8">
            {/* Debug: Afficher l'état */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mb-4 p-2 bg-muted/50 rounded text-xs">
                <div>Historique: {youtubeWatchHistory.length} vidéos</div>
                <div>Suggestions: {artistSuggestions.length} vidéos</div>
                <div>Chargement suggestions: {loadingArtistSuggestions ? 'Oui' : 'Non'}</div>
              </div>
            )}
            
            {/* Historique de visionnage YouTube */}
            {youtubeWatchHistory.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-semibold">Vidéos récemment regardées</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {youtubeWatchHistory
                    .filter((video) => {
                      const videoId = video.youtubeVideoId || extractYouTubeVideoId(video.filePath || '');
                      return !!videoId;
                    })
                    .map((video) => {
                      const videoId = video.youtubeVideoId || extractYouTubeVideoId(video.filePath || '');
                      
                      return (
                        <div
                          key={`youtube-history-${video.id}-${videoId}`}
                        className="group relative bg-card rounded-lg overflow-hidden border border-border/50 hover:border-primary/50 transition-all duration-200 hover:shadow-lg"
                      >
                        <div className="relative aspect-video bg-muted overflow-hidden">
                          <img
                            src={video.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                            alt={video.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button
                              size="icon"
                              className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90"
                              onClick={() => onPlayVideo(video, playbackMode === "audio")}
                            >
                              <Play className="w-6 h-6 fill-current ml-1" />
                            </Button>
                          </div>
                          {video.duration && (
                            <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 rounded text-xs text-white font-medium">
                              {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                            </div>
                          )}
                        </div>
                        <div className="p-4 space-y-2">
                          <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                            {video.title}
                          </h3>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {video.description || 'YouTube'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Suggestions basées sur les artistes */}
            {artistSuggestions.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-semibold">Suggestions basées sur vos artistes</h2>
                </div>
                {loadingArtistSuggestions ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {artistSuggestions.map((result) => (
                      <div
                        key={result.videoId}
                        className="group relative bg-card rounded-lg overflow-hidden border border-border/50 hover:border-primary/50 transition-all duration-200 hover:shadow-lg"
                      >
                        <div className="relative aspect-video bg-muted overflow-hidden">
                          <img
                            src={result.thumbnailUrl}
                            alt={result.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button
                              size="icon"
                              className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90"
                              onClick={() => handlePlay(result)}
                            >
                              <Play className="w-6 h-6 fill-current ml-1" />
                            </Button>
                          </div>
                          {result.duration && (
                            <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 rounded text-xs text-white font-medium">
                              {formatYouTubeDuration(result.duration)}
                            </div>
                          )}
                        </div>
                        <div className="p-4 space-y-2">
                          <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                            {result.title}
                          </h3>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {result.channelTitle}
                          </p>
                          {result.viewCount && (
                            <p className="text-xs text-muted-foreground">
                              {formatViewCount(result.viewCount)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Message par défaut si pas d'historique ni de suggestions */}
            {youtubeWatchHistory.length === 0 && artistSuggestions.length === 0 && !loadingArtistSuggestions && (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-center py-12">
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
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
};
