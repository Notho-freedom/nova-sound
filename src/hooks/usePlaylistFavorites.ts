"use client";

import { useState, useEffect, useCallback } from "react";
import type { Playlist } from "@/types/music";

interface UsePlaylistFavoritesReturn {
  favoritePlaylistIds: string[];
  loading: boolean;
  isFavorite: (playlistId: string) => boolean;
  toggleFavorite: (playlistId: string) => Promise<void>;
  addFavorite: (playlistId: string) => Promise<void>;
  removeFavorite: (playlistId: string) => Promise<void>;
}

/**
 * Hook centralisé pour gérer les playlists favorites
 * Fonctionne pour les playlists locales et YouTube
 */
export function usePlaylistFavorites(): UsePlaylistFavoritesReturn {
  const [favoritePlaylistIds, setFavoritePlaylistIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Check if running in Electron - use reliable detection
  const isElectron = typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';

  // Load favorite playlists on mount
  useEffect(() => {
    const loadFavoritePlaylists = async () => {
      if (!isElectron) {
        // Use localStorage in web mode
        const stored = localStorage.getItem("nexus-favorite-playlists");
        if (stored) {
          try {
            setFavoritePlaylistIds(JSON.parse(stored));
          } catch (error) {
            console.error("Failed to parse favorite playlists:", error);
            setFavoritePlaylistIds([]);
          }
        }
        setLoading(false);
        return;
      }

      try {
        if (!window.electronAPI) {
          setFavoritePlaylistIds([]);
          setLoading(false);
          return;
        }
        // Try to get from Electron storage, fallback to localStorage
        const stored = localStorage.getItem("nexus-favorite-playlists");
        if (stored) {
          try {
            setFavoritePlaylistIds(JSON.parse(stored));
          } catch (error) {
            console.error("Failed to parse favorite playlists:", error);
            setFavoritePlaylistIds([]);
          }
        }
      } catch (err) {
        console.error("Failed to load favorite playlists:", err);
      } finally {
        setLoading(false);
      }
    };

    loadFavoritePlaylists();

    // Écouter les mises à jour Firebase
    const handleFirebaseUpdate = (event: CustomEvent) => {
      const data = event.detail;
      if (data?.favoritePlaylists && Array.isArray(data.favoritePlaylists)) {
        setFavoritePlaylistIds(data.favoritePlaylists);
        if (!isElectron) {
          localStorage.setItem("nexus-favorite-playlists", JSON.stringify(data.favoritePlaylists));
        }
      }
    };

    window.addEventListener('firebase-sync-update', handleFirebaseUpdate as EventListener);
    
    // Écouter les mises à jour locales des favoris (pour synchroniser toutes les instances du hook)
    const handleLocalUpdate = (event: CustomEvent) => {
      const data = event.detail;
      if (data?.favoritePlaylistIds && Array.isArray(data.favoritePlaylistIds)) {
        setFavoritePlaylistIds(data.favoritePlaylistIds);
      }
    };

    window.addEventListener('playlist-favorites-updated', handleLocalUpdate as EventListener);

    return () => {
      window.removeEventListener('firebase-sync-update', handleFirebaseUpdate as EventListener);
      window.removeEventListener('playlist-favorites-updated', handleLocalUpdate as EventListener);
    };
  }, [isElectron]);

  // Save to localStorage whenever favorites change
  useEffect(() => {
    if (!loading) {
      localStorage.setItem("nexus-favorite-playlists", JSON.stringify(favoritePlaylistIds));
    }
  }, [favoritePlaylistIds, loading]);

  const isFavorite = useCallback(
    (playlistId: string): boolean => {
      return favoritePlaylistIds.includes(playlistId);
    },
    [favoritePlaylistIds]
  );

  const addFavorite = useCallback(
    async (playlistId: string) => {
      if (favoritePlaylistIds.includes(playlistId)) return;

      const newFavorites = [...favoritePlaylistIds, playlistId];
      
      if (isElectron && window.electronAPI) {
        // Optionally save to Electron storage if API exists
        // For now, we use localStorage which works for both Electron and web
      }
      setFavoritePlaylistIds(newFavorites);
      
      // Notifier les autres composants du changement
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('playlist-favorites-updated', {
          detail: { favoritePlaylistIds: newFavorites }
        }));
      }
      
      // Sync to Firebase
      try {
        const { firebaseSyncService } = await import('@/services/firebase-sync');
        firebaseSyncService.queueSync('favoritePlaylists', newFavorites);
      } catch (error) {
        console.error('Error syncing favorite playlists to Firebase:', error);
      }
    },
    [favoritePlaylistIds, isElectron]
  );

  const removeFavorite = useCallback(
    async (playlistId: string) => {
      if (!favoritePlaylistIds.includes(playlistId)) return;

      const newFavorites = favoritePlaylistIds.filter((id) => id !== playlistId);
      
      if (isElectron && window.electronAPI) {
        // Optionally remove from Electron storage if API exists
      }
      setFavoritePlaylistIds(newFavorites);
      
      // Notifier les autres composants du changement
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('playlist-favorites-updated', {
          detail: { favoritePlaylistIds: newFavorites }
        }));
      }
      
      // Sync to Firebase
      try {
        const { firebaseSyncService } = await import('@/services/firebase-sync');
        firebaseSyncService.queueSync('favoritePlaylists', newFavorites);
      } catch (error) {
        console.error('Error syncing favorite playlists to Firebase:', error);
      }
    },
    [favoritePlaylistIds, isElectron]
  );

  const toggleFavorite = useCallback(
    async (playlistId: string) => {
      if (isFavorite(playlistId)) {
        await removeFavorite(playlistId);
      } else {
        await addFavorite(playlistId);
      }
    },
    [isFavorite, addFavorite, removeFavorite]
  );

  return {
    favoritePlaylistIds,
    loading,
    isFavorite,
    toggleFavorite,
    addFavorite,
    removeFavorite,
  };
}

