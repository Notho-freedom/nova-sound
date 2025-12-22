/**
 * Hook pour l'autocomplétion YouTube
 * Utilise le service YouTube unifié depuis src/services/youtube/
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { YouTube } from "@/services/youtube";

export interface AutocompleteSuggestion {
  query: string;
  type: 'search' | 'video';
  isRecent?: boolean;
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
 * Utilise le service YouTube unifié avec cache automatique
 */
export function useYouTubeAutocomplete(): UseYouTubeAutocompleteReturn {
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Recherche de suggestions via le service unifié
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Charger l'historique de recherche pour les suggestions locales
      const searchHistory: string[] = [];
      try {
        const saved = localStorage.getItem("nexus-search-history");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            searchHistory.push(...parsed);
          }
        }
      } catch {
        // Ignorer les erreurs de parsing
      }

      // Suggestions depuis l'historique
      const historyMatches = searchHistory
        .filter(term => term.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 3)
        .map(term => ({ query: term, type: 'search' as const, isRecent: true }));

      // Utiliser le service unifié pour l'autocomplétion
      const autocompleteResults = await YouTube.getAutocomplete(query);
      
      // Combiner historique et autocomplétion
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
      
      // Ajouter la requête originale si différente
      const queryKey = query.toLowerCase();
      if (!seen.has(queryKey)) {
        seen.add(queryKey);
        combined.push({ query: query, type: 'search' });
      }
      
      // Ensuite les suggestions YouTube
      autocompleteResults.forEach(suggestion => {
        const key = suggestion.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          combined.push({ query: suggestion, type: 'search' });
        }
      });

      setSuggestions(combined.slice(0, 8));
    } catch (err: any) {
      console.error('[useYouTubeAutocomplete] Erreur:', err);
      setError(err.message || 'Erreur autocomplétion');
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

    // Debounce de 200ms
    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(query);
    }, 200);
  }, [fetchSuggestions]);

  const clearSuggestions = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
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
