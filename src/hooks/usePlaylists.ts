import { useState, useEffect, useCallback } from "react";
import type { Playlist } from "@/types/music";

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

  // Load playlists on mount
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
        if (isElectron) {
          const playlist = await window.electronAPI!.createPlaylist(name, trackIds);
          setPlaylists((prev) => [...prev, playlist]);
          return playlist;
        } else {
          // Web mode
          const playlist: Playlist = {
            id: crypto.randomUUID(),
            name,
            trackIds,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setPlaylists((prev) => [...prev, playlist]);
          return playlist;
        }
      } catch (err) {
        console.error("Failed to create playlist:", err);
        return null;
      }
    },
    [isElectron]
  );

  const updatePlaylist = useCallback(
    async (id: string, data: Partial<Playlist>): Promise<Playlist | null> => {
      try {
        if (isElectron) {
          const updated = await window.electronAPI!.updatePlaylist(id, data);
          setPlaylists((prev) =>
            prev.map((p) => (p.id === id ? { ...p, ...updated } : p))
          );
          return updated;
        } else {
          // Web mode
          setPlaylists((prev) =>
            prev.map((p) =>
              p.id === id
                ? { ...p, ...data, updatedAt: new Date().toISOString() }
                : p
            )
          );
          return playlists.find((p) => p.id === id) || null;
        }
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
        if (isElectron) {
          await window.electronAPI!.deletePlaylist(id);
        }
        setPlaylists((prev) => prev.filter((p) => p.id !== id));
      } catch (err) {
        console.error("Failed to delete playlist:", err);
      }
    },
    [isElectron]
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

