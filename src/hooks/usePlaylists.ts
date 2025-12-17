import { useState, useEffect, useCallback } from "react";
import type { Playlist } from "@/types/music";
import { notificationService } from "@/services/notification-service";

interface UsePlaylistsReturn {
  playlists: Playlist[];
  loading: boolean;
  createPlaylist: (name: string, trackIds?: string[]) => Promise<Playlist | null>;
  updatePlaylist: (id: string, data: Partial<Playlist>) => Promise<Playlist | null>;
  deletePlaylist: (id: string) => Promise<void>;
  addTracksToPlaylist: (playlistId: string, trackIds: string[]) => Promise<void>;
  removeTracksFromPlaylist: (playlistId: string, trackIds: string[]) => Promise<void>;
  importPlaylist: () => Promise<Playlist | null>;
  exportPlaylist: (playlistId: string, format: "m3u" | "pls") => Promise<void>;
  refreshPlaylists: () => Promise<void>;
}

export function usePlaylists(): UsePlaylistsReturn {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  const isElectron = !!window.electronAPI;

  // Load playlists on mount and listen to Firebase sync updates
  useEffect(() => {
    const loadPlaylists = async () => {
      if (!isElectron) {
        // Use localStorage in web mode
        const stored = localStorage.getItem("nexus-playlists");
        if (stored) {
          setPlaylists(JSON.parse(stored));
        }
        setLoading(false);
        return;
      }

      try {
        const lists = await window.electronAPI!.getPlaylists();
        setPlaylists(lists);
      } catch (err) {
        console.error("Failed to load playlists:", err);
      } finally {
        setLoading(false);
      }
    };

    loadPlaylists();

    // Listen to Firebase sync updates
    const handlePlaylistsUpdate = (event: CustomEvent) => {
      if (event.detail) {
        setPlaylists(event.detail);
      }
    };

    window.addEventListener('firebase-playlists-update', handlePlaylistsUpdate as EventListener);
    return () => {
      window.removeEventListener('firebase-playlists-update', handlePlaylistsUpdate as EventListener);
    };
  }, [isElectron]);

  // Save to localStorage in web mode
  useEffect(() => {
    if (!isElectron && !loading) {
      localStorage.setItem("nexus-playlists", JSON.stringify(playlists));
    }
  }, [playlists, isElectron, loading]);

  const createPlaylist = useCallback(
    async (name: string, trackIds: string[] = []): Promise<Playlist | null> => {
      try {
        let playlist: Playlist | null = null;
        
        if (isElectron) {
          playlist = await window.electronAPI!.createPlaylist(name, trackIds);
          setPlaylists((prev) => [...prev, playlist!]);
        } else {
          // Web mode
          playlist = {
            id: crypto.randomUUID(),
            name,
            trackIds,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setPlaylists((prev) => [...prev, playlist!]);
        }
        
        // Sync to Firebase
        if (playlist) {
          try {
            const { firebaseSyncService } = await import('@/services/firebase-sync');
            const updatedPlaylists = [...playlists, playlist];
            firebaseSyncService.queueSync('playlists', updatedPlaylists);
          } catch (error) {
            console.error('Error syncing playlists to Firebase:', error);
          }
          // Notify user
          notificationService.playlistCreated(playlist.name);
        }
        
        return playlist;
      } catch (err) {
        console.error("Failed to create playlist:", err);
        notificationService.error("Erreur", "Impossible de créer la playlist");
        return null;
      }
    },
    [isElectron, playlists]
  );

  const updatePlaylist = useCallback(
    async (id: string, data: Partial<Playlist>): Promise<Playlist | null> => {
      try {
        let updated: Playlist | null = null;
        
        if (isElectron) {
          updated = await window.electronAPI!.updatePlaylist(id, data);
          setPlaylists((prev) =>
            prev.map((p) => (p.id === id ? { ...p, ...updated! } : p))
          );
        } else {
          // Web mode
          setPlaylists((prev) => {
            const updatedPlaylists = prev.map((p) =>
              p.id === id
                ? { ...p, ...data, updatedAt: new Date().toISOString() }
                : p
            );
            updated = updatedPlaylists.find((p) => p.id === id) || null;
            return updatedPlaylists;
          });
        }
        
        // Sync to Firebase
        if (updated) {
          try {
            const { firebaseSyncService } = await import('@/services/firebase-sync');
            const updatedPlaylists = playlists.map((p) => (p.id === id ? updated! : p));
            firebaseSyncService.queueSync('playlists', updatedPlaylists);
          } catch (error) {
            console.error('Error syncing playlists to Firebase:', error);
          }
        }
        
        return updated;
      } catch (err) {
        console.error("Failed to update playlist:", err);
        return null;
      }
    },
    [isElectron, playlists]
  );

  const deletePlaylist = useCallback(
    async (id: string) => {
      try {
        const playlistToDelete = playlists.find((p) => p.id === id);
        if (isElectron) {
          await window.electronAPI!.deletePlaylist(id);
        }
        const updatedPlaylists = playlists.filter((p) => p.id !== id);
        setPlaylists(updatedPlaylists);
        
        // Sync to Firebase
        try {
          const { firebaseSyncService } = await import('../services/firebase-sync');
          firebaseSyncService.queueSync('playlists', updatedPlaylists);
        } catch (error) {
          console.error('Error syncing playlists to Firebase:', error);
        }
        
        // Notify user
        if (playlistToDelete) {
          notificationService.playlistDeleted(playlistToDelete.name);
        }
      } catch (err) {
        console.error("Failed to delete playlist:", err);
      }
    },
    [isElectron, playlists]
  );

  const addTracksToPlaylist = useCallback(
    async (playlistId: string, trackIds: string[]) => {
      const playlist = playlists.find((p) => p.id === playlistId);
      if (!playlist) return;

      const newTrackIds = [...new Set([...playlist.trackIds, ...trackIds])];
      await updatePlaylist(playlistId, { trackIds: newTrackIds });
    },
    [playlists, updatePlaylist]
  );

  const removeTracksFromPlaylist = useCallback(
    async (playlistId: string, trackIds: string[]) => {
      const playlist = playlists.find((p) => p.id === playlistId);
      if (!playlist) return;

      const newTrackIds = playlist.trackIds.filter(
        (id) => !trackIds.includes(id)
      );
      await updatePlaylist(playlistId, { trackIds: newTrackIds });
    },
    [playlists, updatePlaylist]
  );

  const importPlaylist = useCallback(async (): Promise<Playlist | null> => {
    if (!isElectron) return null;

    try {
      const files = await window.electronAPI!.openFile([
        { name: "Playlist Files", extensions: ["m3u", "m3u8", "pls"] },
      ]);
      
      if (files.length === 0) return null;

      const playlist = await window.electronAPI!.importPlaylist(files[0]);
      if (playlist) {
        setPlaylists((prev) => [...prev, playlist]);
      }
      return playlist;
    } catch (err) {
      console.error("Failed to import playlist:", err);
      return null;
    }
  }, [isElectron]);

  const exportPlaylist = useCallback(
    async (playlistId: string, format: "m3u" | "pls") => {
      if (!isElectron) return;

      try {
        await window.electronAPI!.exportPlaylist(playlistId, format);
      } catch (err) {
        console.error("Failed to export playlist:", err);
      }
    },
    [isElectron]
  );

  const refreshPlaylists = useCallback(async () => {
    if (!isElectron) return;

    setLoading(true);
    try {
      const lists = await window.electronAPI!.getPlaylists();
      setPlaylists(lists);
    } catch (err) {
      console.error("Failed to refresh playlists:", err);
    } finally {
      setLoading(false);
    }
  }, [isElectron]);

  return {
    playlists,
    loading,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    addTracksToPlaylist,
    removeTracksFromPlaylist,
    importPlaylist,
    exportPlaylist,
    refreshPlaylists,
  };
}

