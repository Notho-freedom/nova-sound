/**
 * Hook optimisé pour la bibliothèque
 * Optimisations: déduplication en O(1), batch updates, mémorisation
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Track, ScanProgress } from "@/types/music";

interface UseLibraryReturn {
  tracks: Track[];
  loading: boolean;
  scanning: boolean;
  scanProgress: ScanProgress | null;
  error: string | null;
  scanLibrary: (directories?: string[]) => Promise<void>;
  selectMusicFolders: () => Promise<string[]>;
  refreshLibrary: () => Promise<void>;
  getTrackById: (id: string) => Track | undefined;
  getTracksByAlbum: (album: string, artist?: string) => Track[];
  getTracksByArtist: (artist: string) => Track[];
}

export function useLibrary(): UseLibraryReturn {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Maps d'index pour recherche O(1)
  const tracksByIdRef = useRef<Map<string, Track>>(new Map());
  const tracksByAlbumRef = useRef<Map<string, Track[]>>(new Map());
  const tracksByArtistRef = useRef<Map<string, Track[]>>(new Map());

  const isElectron = typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';

  // Indexation optimisée des tracks
  const indexTracks = useCallback((trackList: Track[]) => {
    const byId = new Map<string, Track>();
    const byAlbum = new Map<string, Track[]>();
    const byArtist = new Map<string, Track[]>();

    for (const track of trackList) {
      byId.set(track.id, track);

      if (track.album) {
        const key = `${track.album}:${track.artist || ''}`;
        const existing = byAlbum.get(key) || [];
        existing.push(track);
        byAlbum.set(key, existing);
      }

      if (track.artist) {
        const existing = byArtist.get(track.artist) || [];
        existing.push(track);
        byArtist.set(track.artist, existing);
      }
    }

    tracksByIdRef.current = byId;
    tracksByAlbumRef.current = byAlbum;
    tracksByArtistRef.current = byArtist;
  }, []);

  // Déduplication optimisée O(n)
  const deduplicateTracks = useCallback((trackList: Track[]): Track[] => {
    const seen = new Set<string>();
    const result: Track[] = [];
    
    for (const track of trackList) {
      if (!seen.has(track.id)) {
        seen.add(track.id);
        result.push(track);
      }
    }
    
    return result;
  }, []);

  // Load library on mount
  useEffect(() => {
    const loadLibrary = async () => {
      if (!isElectron) {
        const { demoTracks } = await import("@/data/tracks");
        const uniqueTracks = deduplicateTracks(demoTracks);
        indexTracks(uniqueTracks);
        setTracks(uniqueTracks);
        setLoading(false);
        return;
      }

      try {
        if (!window.electronAPI) {
          setTracks([]);
          setLoading(false);
          return;
        }
        const library = await window.electronAPI.getLibrary();
        const uniqueTracks = deduplicateTracks(library);
        indexTracks(uniqueTracks);
        setTracks(uniqueTracks);
      } catch (err) {
        console.error("Failed to load library:", err);
        setError("Erreur lors du chargement de la bibliothèque");
      } finally {
        setLoading(false);
      }
    };

    loadLibrary();
  }, [isElectron, deduplicateTracks, indexTracks]);

  // Listen for scan progress
  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;

    console.log('🎧 [useLibrary] Registering scan progress listener');
    const unsubscribe = window.electronAPI.onScanProgress((progress) => {
      console.log('📊 [useLibrary] Received scan progress:', progress);
      setScanProgress(progress);
      setScanning(true); // Ensure scanning is set to true when we receive progress
      if (progress.phase === "complete") {
        console.log('✅ [useLibrary] Scan complete, updating state');
        setScanning(false);
        setScanProgress(null);
        // Reload library when scan is complete
        window.electronAPI?.getLibrary().then((library) => {
          setTracks(prev => {
            // Use a functional update to avoid depending on deduplicateTracks/indexTracks
            const seen = new Set<string>();
            const unique = library.filter(t => {
              if (seen.has(t.id)) return false;
              seen.add(t.id);
              return true;
            });
            return unique;
          });
        });
      }
    });

    console.log('✅ [useLibrary] Scan progress listener registered');
    return () => {
      console.log('🔌 [useLibrary] Unregistering scan progress listener');
      unsubscribe();
    };
  }, [isElectron]); // Only depend on isElectron, not on functions that change

  // Listen for real-time track updates
  useEffect(() => {
    if (!isElectron || !window.electronAPI?.onTrackAdded) return;

    const unsubscribeAdded = window.electronAPI.onTrackAdded((track: Track) => {
      setTracks(prev => {
        if (tracksByIdRef.current.has(track.id)) {
          // Update existing
          return prev.map(t => t.id === track.id ? track : t);
        }
        // Add new
        const updated = [...prev, track];
        indexTracks(updated);
        return updated;
      });
    });

    const unsubscribeRemoved = window.electronAPI?.onTrackRemoved?.((filePath: string) => {
      setTracks(prev => {
        const updated = prev.filter(t => t.filePath !== filePath);
        indexTracks(updated);
        return updated;
      });
    });

    const unsubscribeUpdated = window.electronAPI?.onTrackUpdated?.((track: Track) => {
      setTracks(prev => {
        const updated = prev.map(t => t.id === track.id ? track : t);
        indexTracks(updated);
        return updated;
      });
    });

    return () => {
      unsubscribeAdded();
      unsubscribeRemoved?.();
      unsubscribeUpdated?.();
    };
  }, [isElectron, indexTracks]);

  const selectMusicFolders = useCallback(async (): Promise<string[]> => {
    if (!isElectron || !window.electronAPI) return [];
    try {
      return await window.electronAPI.openDirectory();
    } catch {
      return [];
    }
  }, [isElectron]);

  const scanLibrary = useCallback(async (directories?: string[]) => {
    if (!isElectron || !window.electronAPI) return;

    console.log('🚀 [useLibrary] Starting scan...', { directories });
    setScanning(true);
    setError(null);
    setScanProgress({ current: 0, total: 0, file: "", phase: "scanning" });

    try {
      let foldersToScan = directories;

      if (!foldersToScan?.length) {
        const settings = await window.electronAPI.getSettings();
        foldersToScan = settings.musicDirectories;
      }

      if (!foldersToScan?.length) {
        foldersToScan = await selectMusicFolders();
        if (foldersToScan.length > 0) {
          await window.electronAPI.updateSettings({ musicDirectories: foldersToScan });
        }
      }

      if (foldersToScan.length > 0) {
        console.log('📂 [useLibrary] Scanning folders:', foldersToScan);
        await window.electronAPI.scanLibrary(foldersToScan);
      } else {
        console.log('⚠️ [useLibrary] No folders to scan');
        setScanning(false);
        setScanProgress(null);
      }
    } catch (err) {
      console.error("Failed to scan library:", err);
      setError("Erreur lors du scan de la bibliothèque");
      setScanning(false);
      setScanProgress(null);
    }
  }, [isElectron, selectMusicFolders]);

  const refreshLibrary = useCallback(async () => {
    if (!isElectron || !window.electronAPI) return;

    setLoading(true);
    try {
      const library = await window.electronAPI.getLibrary();
      const uniqueTracks = deduplicateTracks(library);
      indexTracks(uniqueTracks);
      setTracks(uniqueTracks);
    } catch (err) {
      console.error("Failed to refresh library:", err);
      setError("Erreur lors du rafraîchissement");
    } finally {
      setLoading(false);
    }
  }, [isElectron, deduplicateTracks, indexTracks]);

  // Méthodes de recherche O(1)
  const getTrackById = useCallback((id: string): Track | undefined => {
    return tracksByIdRef.current.get(id);
  }, []);

  const getTracksByAlbum = useCallback((album: string, artist?: string): Track[] => {
    const key = `${album}:${artist || ''}`;
    return tracksByAlbumRef.current.get(key) || [];
  }, []);

  const getTracksByArtist = useCallback((artist: string): Track[] => {
    return tracksByArtistRef.current.get(artist) || [];
  }, []);

  return {
    tracks,
    loading,
    scanning,
    scanProgress,
    error,
    scanLibrary,
    selectMusicFolders,
    refreshLibrary,
    getTrackById,
    getTracksByAlbum,
    getTracksByArtist,
  };
}
