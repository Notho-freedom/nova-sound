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

  // Recherche de suggestions via YouTube Data API
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      return;
    }

    const apiKey = getYouTubeApiKey();
    if (!apiKey) {
      // Pas de clé API, pas d'autocomplétion
      setSuggestions([]);
      return;
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
        throw new Error(`Erreur API: ${response.status}`);
      }

      const data = await response.json();
      
      const searchSuggestions: AutocompleteSuggestion[] = data.items.map((item: any) => ({
        query: item.snippet.title,
        type: 'video' as const,
      }));

      // Ajouter aussi la requête originale comme première suggestion
      setSuggestions([
        { query: query, type: 'search' },
        ...searchSuggestions,
      ]);
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
