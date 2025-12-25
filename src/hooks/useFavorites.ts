import { useState, useEffect, useCallback } from "react";

interface UseFavoritesReturn {
  favorites: string[];
  loading: boolean;
  isFavorite: (trackId: string) => boolean;
  toggleFavorite: (trackId: string) => Promise<void>;
  addFavorite: (trackId: string) => Promise<void>;
  removeFavorite: (trackId: string) => Promise<void>;
}

export function useFavorites(): UseFavoritesReturn {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Check if running in Electron - use reliable detection
  const isElectron = typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';

  // Load favorites on mount
  useEffect(() => {
    const loadFavorites = async () => {
      if (!isElectron) {
        // Use localStorage in web mode
        const stored = localStorage.getItem("nexus-favorites");
        if (stored) {
          setFavorites(JSON.parse(stored));
        }
        setLoading(false);
        return;
      }

      try {
        if (!window.electronAPI) {
          setFavorites([]);
          setLoading(false);
          return;
        }
        const favs = await window.electronAPI.getFavorites();
        setFavorites(favs);
      } catch (err) {
        console.error("Failed to load favorites:", err);
      } finally {
        setLoading(false);
      }
    };

    loadFavorites();

    // Écouter les mises à jour Firebase
    const handleFirebaseUpdate = (event: CustomEvent) => {
      const data = event.detail;
      if (data?.favorites && Array.isArray(data.favorites)) {
        console.log('[useFavorites] Firebase sync: updating favorites');
        setFavorites(data.favorites);
        if (!isElectron) {
          localStorage.setItem("nexus-favorites", JSON.stringify(data.favorites));
        }
      }
    };

    window.addEventListener('firebase-sync-update', handleFirebaseUpdate as EventListener);

    return () => {
      window.removeEventListener('firebase-sync-update', handleFirebaseUpdate as EventListener);
    };
  }, [isElectron]);

  // Save to localStorage in web mode
  useEffect(() => {
    if (!isElectron) {
      localStorage.setItem("nexus-favorites", JSON.stringify(favorites));
    }
  }, [favorites, isElectron]);

  const isFavorite = useCallback(
    (trackId: string): boolean => {
      return favorites.includes(trackId);
    },
    [favorites]
  );

  const addFavorite = useCallback(
    async (trackId: string) => {
      if (favorites.includes(trackId)) return;

      const newFavorites = [...favorites, trackId];
      
      if (isElectron && window.electronAPI) {
        await window.electronAPI.addFavorite(trackId);
      }
      setFavorites(newFavorites);
      
      // Sync to Firebase
      try {
        const { firebaseSyncService } = await import('@/services/firebase-sync');
        firebaseSyncService.queueSync('favorites', newFavorites);
      } catch (error) {
        console.error('Error syncing favorites to Firebase:', error);
      }
    },
    [favorites, isElectron]
  );

  const removeFavorite = useCallback(
    async (trackId: string) => {
      if (!favorites.includes(trackId)) return;

      const newFavorites = favorites.filter((id) => id !== trackId);
      
      if (isElectron && window.electronAPI) {
        await window.electronAPI.removeFavorite(trackId);
      }
      setFavorites(newFavorites);
      
      // Sync to Firebase
      try {
        const { firebaseSyncService } = await import('@/services/firebase-sync');
        firebaseSyncService.queueSync('favorites', newFavorites);
      } catch (error) {
        console.error('Error syncing favorites to Firebase:', error);
      }
    },
    [favorites, isElectron]
  );

  const toggleFavorite = useCallback(
    async (trackId: string) => {
      if (isFavorite(trackId)) {
        await removeFavorite(trackId);
      } else {
        await addFavorite(trackId);
      }
    },
    [isFavorite, addFavorite, removeFavorite]
  );

  return {
    favorites,
    loading,
    isFavorite,
    toggleFavorite,
    addFavorite,
    removeFavorite,
  };
}

