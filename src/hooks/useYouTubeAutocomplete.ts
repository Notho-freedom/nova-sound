import { useState, useEffect, useCallback, useRef } from "react";

export interface AutocompleteSuggestion {
  query: string;
  type: 'search' | 'video';
}

interface UseYouTubeAutocompleteReturn {
  suggestions: AutocompleteSuggestion[];
  loading: boolean;
  error: string | null;
  searchSuggestions: (query: string) => void;
  clearSuggestions: () => void;
}

/**
 * Hook pour l'autocomplétion de recherche YouTube
 * Utilise l'API YouTube Data v3 pour les suggestions
 */
export function useYouTubeAutocomplete(): UseYouTubeAutocompleteReturn {
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Obtenir la clé API YouTube
  const getYouTubeApiKey = (): string | null => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem("nexus-youtube-api-key");
      if (savedKey) return savedKey;
      const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
      if (apiKey) return apiKey;
    }
    return null;
  };

  // Recherche de suggestions via YouTube Data API et historique de recherche
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      return;
    }

    // D'abord, charger l'historique de recherche pour les suggestions locales
    const searchHistory: string[] = [];
    try {
      const saved = localStorage.getItem("nexus-search-history");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          searchHistory.push(...parsed);
        }
      }
    } catch (error) {
      // Ignorer les erreurs de parsing
    }

    // Filtrer l'historique pour les correspondances avec la requête
    const historyMatches = searchHistory
      .filter(term => term.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 3)
      .map(term => ({ query: term, type: 'search' as const }));

    const apiKey = getYouTubeApiKey();
    if (!apiKey) {
      // Si pas de clé API, utiliser uniquement l'historique
      setSuggestions(historyMatches);
      setError('Clé API YouTube non configurée. Configurez-la dans les paramètres.');
      return;
    }

    // Vérifier le circuit breaker AVANT tout appel API
    let canUseAPI = true;
    try {
      const { youtubeQuotaManager } = await import('@/services/youtube-quota-manager');
      canUseAPI = youtubeQuotaManager.canUseAPI();
      if (!canUseAPI) {
        console.log('[YouTube Autocomplete] Circuit breaker ouvert, utilisation du fallback amélioré');
        
        // Fallback amélioré : historique + cache YouTube + suggestions intelligentes
        const fallback: AutocompleteSuggestion[] = [];
        
        // 1. Ajouter les correspondances de l'historique
        historyMatches.forEach(suggestion => fallback.push(suggestion));
        
        // 2. Chercher dans le cache YouTube pour des recherches similaires
        try {
          const { youtubeCacheService } = await import('@/services/youtube-cache');
          
          // Chercher dans l'historique de recherche pour trouver des recherches similaires
          const allSearchHistory = searchHistory.length > 0 ? searchHistory : [];
          
          // Pour chaque recherche de l'historique, vérifier le cache
          for (const historyQuery of allSearchHistory.slice(0, 10)) {
            if (fallback.length >= 8) break; // Limiter à 8 suggestions
            
            // Vérifier si la recherche de l'historique contient des mots de la requête actuelle
            const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
            const historyWords = historyQuery.toLowerCase().split(/\s+/);
            const hasCommonWords = queryWords.some(qw => 
              historyWords.some(hw => hw.includes(qw) || qw.includes(hw))
            );
            
            if (hasCommonWords || historyQuery.toLowerCase().includes(query.toLowerCase())) {
              // Vérifier si cette recherche a des résultats en cache
              const cached = await youtubeCacheService.getSearch(historyQuery);
              if (cached && cached.results.length > 0) {
                // Ajouter la recherche si elle n'est pas déjà présente
                const key = historyQuery.toLowerCase();
                if (!fallback.some(s => s.query.toLowerCase() === key)) {
                  fallback.push({ query: historyQuery, type: 'search' });
                }
              }
            }
          }
          
          // 3. Ajouter des suggestions basées sur les titres de vidéos en cache
          // Chercher dans les recherches récentes pour trouver des vidéos pertinentes
          for (const historyQuery of allSearchHistory.slice(0, 5)) {
            if (fallback.length >= 8) break;
            
            try {
              const cached = await youtubeCacheService.getSearch(historyQuery);
              if (cached && cached.results.length > 0) {
                // Filtrer les vidéos dont le titre contient des mots de la requête
                const queryLower = query.toLowerCase();
                const relevantVideos = cached.results
                  .filter(v => {
                    const titleLower = (v.title || '').toLowerCase();
                    const channelLower = (v.channelTitle || '').toLowerCase();
                    return titleLower.includes(queryLower) || 
                           channelLower.includes(queryLower) ||
                           queryLower.split(/\s+/).some(word => 
                             word.length > 2 && (titleLower.includes(word) || channelLower.includes(word))
                           );
                  })
                  .slice(0, 3); // Max 3 suggestions de vidéos
                
                relevantVideos.forEach(video => {
                  const key = video.title.toLowerCase();
                  if (!fallback.some(s => s.query.toLowerCase() === key) && fallback.length < 8) {
                    fallback.push({ query: video.title, type: 'video' });
                  }
                });
              }
            } catch (error) {
              // Ignorer les erreurs individuelles
            }
          }
        } catch (error) {
          console.warn('[YouTube Autocomplete] Erreur lors de la recherche dans le cache:', error);
        }
        
        // 4. Ajouter la requête actuelle si elle n'est pas déjà présente
        if (!fallback.some(s => s.query.toLowerCase() === query.toLowerCase())) {
          fallback.push({ query: query, type: 'search' });
        }
        
        setSuggestions(fallback);
        setError(null);
        return; // Retourner immédiatement sans appeler l'API
      }
    } catch (error) {
      // Continuer si le service n'est pas disponible
    }

    // Annuler la requête précédente si elle existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      // Utiliser l'endpoint search/list de YouTube Data API v3
      // avec type=video et maxResults limité pour les suggestions
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?` +
        `part=snippet&` +
        `q=${encodeURIComponent(query)}&` +
        `type=video&` +
        `maxResults=5&` +
        `key=${apiKey}`,
        {
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        const isQuotaError = response.status === 403 || response.status === 429;
        
        if (isQuotaError) {
          console.warn('[YouTube Autocomplete] Quota épuisé, fallback amélioré');
          // Enregistrer l'échec
          try {
            const { youtubeQuotaManager } = await import('@/services/youtube-quota-manager');
            youtubeQuotaManager.recordFailure();
          } catch (error) {
            // Ignorer
          }
          
          // Fallback amélioré : historique + cache YouTube
          const fallback: AutocompleteSuggestion[] = [];
          historyMatches.forEach(suggestion => fallback.push(suggestion));
          
          // Chercher dans le cache YouTube pour des recherches similaires
          try {
            const { youtubeCacheService } = await import('@/services/youtube-cache');
            
            for (const historyQuery of searchHistory.slice(0, 10)) {
              if (fallback.length >= 8) break;
              
              const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
              const historyWords = historyQuery.toLowerCase().split(/\s+/);
              const hasCommonWords = queryWords.some(qw => 
                historyWords.some(hw => hw.includes(qw) || qw.includes(hw))
              );
              
              if (hasCommonWords || historyQuery.toLowerCase().includes(query.toLowerCase())) {
                const cached = await youtubeCacheService.getSearch(historyQuery);
                if (cached && cached.results.length > 0) {
                  const key = historyQuery.toLowerCase();
                  if (!fallback.some(s => s.query.toLowerCase() === key)) {
                    fallback.push({ query: historyQuery, type: 'search' });
                  }
                }
              }
            }
          } catch (error) {
            // Ignorer les erreurs de cache
          }
          
          if (!fallback.some(s => s.query.toLowerCase() === query.toLowerCase())) {
            fallback.push({ query: query, type: 'search' });
          }
          setSuggestions(fallback);
          return; // Retourner sans erreur
        }
        
        const errorData = await response.json().catch(() => ({}));
        console.error('[YouTube Autocomplete] Erreur API:', response.status, errorData);
        // Pour les autres erreurs, utiliser quand même le fallback historique
        const fallback: AutocompleteSuggestion[] = [];
        historyMatches.forEach(suggestion => fallback.push(suggestion));
        if (!fallback.some(s => s.query.toLowerCase() === query.toLowerCase())) {
          fallback.push({ query: query, type: 'search' });
        }
        setSuggestions(fallback);
        return; // Ne pas lancer d'erreur, utiliser le fallback
      }

      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        console.log('[YouTube Autocomplete] Aucune suggestion YouTube trouvée pour:', query);
        // Si pas de résultats YouTube, retourner au moins l'historique et la requête
        const fallback: AutocompleteSuggestion[] = [];
        historyMatches.forEach(suggestion => fallback.push(suggestion));
        if (!fallback.some(s => s.query.toLowerCase() === query.toLowerCase())) {
          fallback.push({ query: query, type: 'search' });
        }
        setSuggestions(fallback);
        return;
      }
      
      const searchSuggestions: AutocompleteSuggestion[] = data.items.map((item: any) => ({
        query: item.snippet.title,
        type: 'video' as const,
      }));

      // Combiner l'historique, la requête originale, et les suggestions YouTube
      // Éviter les doublons
      const seen = new Set<string>();
      const combined: AutocompleteSuggestion[] = [];
      
      // D'abord l'historique (priorité)
      historyMatches.forEach(suggestion => {
        const key = suggestion.query.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(suggestion);
        }
      });
      
      // Ensuite la requête originale
      const queryKey = query.toLowerCase();
      if (!seen.has(queryKey)) {
        seen.add(queryKey);
        combined.push({ query: query, type: 'search' });
      }
      
      // Enfin les suggestions YouTube
      searchSuggestions.forEach(suggestion => {
        const key = suggestion.query.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(suggestion);
        }
      });

      setSuggestions(combined);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Requête annulée, ignorer
        return;
      }
      console.error('Erreur autocomplétion YouTube:', err);
      setError(err.message);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Recherche avec debounce
  const searchSuggestions = useCallback((query: string) => {
    // Annuler le timer précédent
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Si la requête est trop courte, ne pas chercher
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      return;
    }

    // Debounce de 300ms
    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(query);
    }, 300);
  }, [fetchSuggestions]);

  const clearSuggestions = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setSuggestions([]);
    setError(null);
  }, []);

  // Nettoyer lors du démontage
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    suggestions,
    loading,
    error,
    searchSuggestions,
    clearSuggestions,
  };
}
