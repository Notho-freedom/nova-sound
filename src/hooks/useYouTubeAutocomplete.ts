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
        console.log('[YouTube Autocomplete] Circuit breaker ouvert, utilisation uniquement du fallback historique');
        // Utiliser directement le fallback historique sans appeler l'API
        const fallback: AutocompleteSuggestion[] = [];
        historyMatches.forEach(suggestion => fallback.push(suggestion));
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
          console.warn('[YouTube Autocomplete] Quota épuisé, fallback historique');
          // Enregistrer l'échec
          try {
            const { youtubeQuotaManager } = await import('@/services/youtube-quota-manager');
            youtubeQuotaManager.recordFailure();
          } catch (error) {
            // Ignorer
          }
          
          // Fallback : utiliser uniquement l'historique
          const fallback: AutocompleteSuggestion[] = [];
          historyMatches.forEach(suggestion => fallback.push(suggestion));
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
