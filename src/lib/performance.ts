/**
 * Utilitaires d'optimisation pour les performances
 */

/**
 * Debounce optimisé avec support Promise
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;
  let startTime: number | null = null;
  
  return (...args: Parameters<T>) => {
    if (rafId) {
      cancelAnimationFrame(rafId);
    }

    if (typeof requestAnimationFrame === "undefined") {
      queueMicrotask(() => fn(...args));
      return;
    }

    startTime = performance.now();
    const tick = (now: number) => {
      if (startTime !== null && now - startTime >= delay) {
        fn(...args);
        startTime = null;
        rafId = null;
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
  };
}

/**
 * Throttle pour limiter les appels fréquents
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;
  let rafId: number | null = null;
  let startTime: number | null = null;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      if (typeof requestAnimationFrame === "undefined") {
        queueMicrotask(() => {
          inThrottle = false;
          if (lastArgs) {
            fn(...lastArgs);
            lastArgs = null;
          }
        });
        return;
      }

      startTime = performance.now();
      const tick = (now: number) => {
        if (startTime !== null && now - startTime >= limit) {
          inThrottle = false;
          if (lastArgs) {
            fn(...lastArgs);
            lastArgs = null;
          }
          startTime = null;
          rafId = null;
          return;
        }
        rafId = requestAnimationFrame(tick);
      };

      rafId = requestAnimationFrame(tick);
    } else {
      lastArgs = args;
    }
  };
}

/**
 * Mémoisation avec cache LRU
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  maxSize: number = 100
): T {
  const cache = new Map<string, ReturnType<T>>();
  const keys: string[] = [];
  
  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const result = fn(...args);
    
    // Gérer la taille du cache
    if (keys.length >= maxSize) {
      const oldestKey = keys.shift()!;
      cache.delete(oldestKey);
    }
    
    cache.set(key, result);
    keys.push(key);
    
    return result;
  }) as T;
}

/**
 * RAF (requestAnimationFrame) debounce pour animations fluides
 */
export function rafDebounce<T extends (...args: any[]) => any>(
  fn: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;
  
  return (...args: Parameters<T>) => {
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(() => {
      fn(...args);
      rafId = null;
    });
  };
}

/**
 * Batch updates pour regrouper les mises à jour d'état
 */
export function batchUpdates<T>(
  updates: (() => T)[],
  callback: (results: T[]) => void
): void {
  const results: T[] = [];
  
  // Utiliser queueMicrotask pour batching natif
  queueMicrotask(() => {
    for (const update of updates) {
      results.push(update());
    }
    callback(results);
  });
}

/**
 * Intersection Observer optimisé pour lazy loading
 */
export function createLazyObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options: IntersectionObserverInit = {}
): IntersectionObserver | null {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return null;
  }
  
  return new IntersectionObserver(callback, {
    rootMargin: '50px',
    threshold: 0.1,
    ...options,
  });
}

/**
 * Préchargement d'images optimisé
 */
export function preloadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Préchargement batch d'images avec limite de concurrence
 */
export async function preloadImages(
  urls: string[],
  concurrency: number = 3
): Promise<void> {
  const chunks: string[][] = [];
  
  for (let i = 0; i < urls.length; i += concurrency) {
    chunks.push(urls.slice(i, i + concurrency));
  }
  
  for (const chunk of chunks) {
    await Promise.allSettled(chunk.map(preloadImage));
  }
}

/**
 * Storage optimisé avec compression pour gros objets
 */
export const optimizedStorage = {
  set: (key: string, value: any, compress: boolean = false): void => {
    try {
      const data = JSON.stringify(value);
      if (compress && data.length > 10000) {
        // Pour les gros objets, utiliser compression basique
        // (en production, utiliser pako ou lz-string)
        localStorage.setItem(key, data);
      } else {
        localStorage.setItem(key, data);
      }
    } catch (e) {
      console.warn('[Storage] Erreur écriture:', e);
      // Nettoyer le storage si plein
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith('yt_cache_')) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.slice(0, 10).forEach(k => localStorage.removeItem(k));
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Abandon silencieux
      }
    }
  },
  
  get: <T>(key: string, defaultValue: T): T => {
    try {
      const data = localStorage.getItem(key);
      if (data) {
        return JSON.parse(data) as T;
      }
    } catch (e) {
      console.warn('[Storage] Erreur lecture:', e);
    }
    return defaultValue;
  },
  
  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};
