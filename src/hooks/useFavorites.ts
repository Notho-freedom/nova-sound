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

  const isElectron = !!window.electronAPI;

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
        const favs = await window.electronAPI!.getFavorites();
        setFavorites(favs);
      } catch (err) {
        console.error("Failed to load favorites:", err);
      } finally {
        setLoading(false);
      }
    };

    loadFavorites();
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
      
      if (isElectron) {
        await window.electronAPI!.addFavorite(trackId);
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
      
      if (isElectron) {
        await window.electronAPI!.removeFavorite(trackId);
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

