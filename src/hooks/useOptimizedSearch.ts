import { useCallback, useRef, useMemo } from 'react';

/**
 * Optimized search hook with smart debouncing and caching
 * Prevents excessive API calls and re-renders
 */
export function useOptimizedSearch() {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheRef = useRef<Map<string, any>>(new Map());
  const lastQueryRef = useRef<string>('');

  const debounce = useCallback((callback: () => void, delay: number) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(callback, delay);
  }, []);

  const getFromCache = useCallback((query: string) => {
    return cacheRef.current.get(query.toLowerCase());
  }, []);

  const setInCache = useCallback((query: string, data: any) => {
    cacheRef.current.set(query.toLowerCase(), data);
    // Limit cache size to 50 items
    if (cacheRef.current.size > 50) {
      const firstKey = cacheRef.current.keys().next().value;
      if (firstKey !== undefined) {
        cacheRef.current.delete(firstKey);
      }
    }
  }, []);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
    lastQueryRef.current = '';
  }, []);

  return useMemo(() => ({
    debounce,
    getFromCache,
    setInCache,
    clearCache,
    lastQueryRef,
  }), [debounce, getFromCache, setInCache, clearCache]);
}
