/**
 * useVectorSearch Hook
 * 
 * React hook for semantic search with Vector
 */

import { useState, useCallback, useEffect } from "react";
import {
  searchTracksSemantically,
  isVectorSearchAvailable,
  type VectorSearchResult,
} from "@/services/vector-search";

export interface UseVectorSearchReturn {
  results: VectorSearchResult[];
  loading: boolean;
  error: string | null;
  search: (query: string) => Promise<void>;
  isAvailable: boolean;
  checkingAvailability: boolean;
}

export function useVectorSearch(): UseVectorSearchReturn {
  const [results, setResults] = useState<VectorSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(true);

  // Check if Vector search is available on mount
  useEffect(() => {
    const checkAvailability = async () => {
      setCheckingAvailability(true);
      const available = await isVectorSearchAvailable();
      setIsAvailable(available);
      setCheckingAvailability(false);
    };

    checkAvailability();
  }, []);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const searchResults = await searchTracksSemanticSearch(query);
      setResults(searchResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    results,
    loading,
    error,
    search,
    isAvailable,
    checkingAvailability,
  };
}
