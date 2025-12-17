import { useState, useEffect, useCallback } from "react";
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
}

export function useLibrary(): UseLibraryReturn {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if running in Electron - use reliable detection
  const isElectron = typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';

  // Load library on mount
  useEffect(() => {
    const loadLibrary = async () => {
      if (!isElectron) {
        // Use demo tracks in web mode
        const { demoTracks } = await import("@/data/tracks");
        setTracks(demoTracks);
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
        // Remove duplicates by ID (additional safety check)
        const uniqueTracks = library.filter((track, index, self) => 
          index === self.findIndex(t => t.id === track.id)
        );
        setTracks(uniqueTracks);
      } catch (err) {
        console.error("Failed to load library:", err);
        setError("Erreur lors du chargement de la bibliothèque");
      } finally {
        setLoading(false);
      }
    };

    loadLibrary();
  }, [isElectron]);

  // Listen for scan progress
  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;

    const unsubscribe = window.electronAPI.onScanProgress((progress) => {
      setScanProgress(progress);
      if (progress.phase === "complete") {
        setScanning(false);
        setScanProgress(null);
        // Final reload to ensure everything is synced
        window.electronAPI?.getLibrary().then((library) => {
          // Additional safety check to remove duplicates
          const uniqueTracks = library.filter((track, index, self) => 
            index === self.findIndex(t => t.id === track.id)
          );
          setTracks(uniqueTracks);
        });
      }
    });

    return unsubscribe;
  }, [isElectron]);

  // Listen for real-time track updates during scan
  useEffect(() => {
    if (!isElectron || !window.electronAPI!.onTrackAdded) return;

    // Track added - add to library in real-time
    const unsubscribeAdded = window.electronAPI!.onTrackAdded((track: Track) => {
      setTracks(prev => {
        // Check if track already exists (by ID or filePath)
        const exists = prev.some(t => t.id === track.id || t.filePath === track.filePath);
        if (exists) {
          // Update existing track
          return prev.map(t => (t.id === track.id || t.filePath === track.filePath) ? track : t);
        }
        // Add new track
        return [...prev, track];
      });
    });

    // Track removed - remove from library in real-time
    const unsubscribeRemoved = window.electronAPI?.onTrackRemoved?.((filePath: string) => {
      setTracks(prev => prev.filter(t => t.filePath !== filePath));
    });

    // Track updated - update in library in real-time
    const unsubscribeUpdated = window.electronAPI?.onTrackUpdated?.((track: Track) => {
      setTracks(prev => prev.map(t => 
        (t.id === track.id || t.filePath === track.filePath) ? track : t
      ));
    });

    return () => {
      unsubscribeAdded();
      unsubscribeRemoved?.();
      unsubscribeUpdated?.();
    };
  }, [isElectron]);

  // Select music folders
  const selectMusicFolders = useCallback(async (): Promise<string[]> => {
    if (!isElectron || !window.electronAPI) return [];

    try {
      const folders = await window.electronAPI.openDirectory();
      return folders;
    } catch (err) {
      console.error("Failed to select folders:", err);
      return [];
    }
  }, [isElectron]);

  // Scan library
  const scanLibrary = useCallback(async (directories?: string[]) => {
    if (!isElectron) return;

    setScanning(true);
    setError(null);
    setScanProgress({
      current: 0,
      total: 0,
      file: "",
      phase: "scanning",
    });

    try {
      let foldersToScan = directories;

      if (!window.electronAPI) {
        setScanning(false);
        setScanProgress(null);
        return;
      }

      if (!foldersToScan || foldersToScan.length === 0) {
        // Get folders from settings
        const settings = await window.electronAPI.getSettings();
        foldersToScan = settings.musicDirectories;
      }

      if (foldersToScan.length === 0) {
        // Ask user to select folders
        foldersToScan = await selectMusicFolders();
        if (foldersToScan.length > 0) {
          // Save selected folders to settings
          await window.electronAPI.updateSettings({
            musicDirectories: foldersToScan,
          });
        }
      }

      if (foldersToScan.length > 0) {
        await window.electronAPI.scanLibrary(foldersToScan);
      } else {
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

  // Refresh library
  const refreshLibrary = useCallback(async () => {
    if (!isElectron || !window.electronAPI) return;

    setLoading(true);
    try {
      const library = await window.electronAPI.getLibrary();
      // Remove duplicates by ID (additional safety check)
      const uniqueTracks = library.filter((track, index, self) => 
        index === self.findIndex(t => t.id === track.id)
      );
      setTracks(uniqueTracks);
    } catch (err) {
      console.error("Failed to refresh library:", err);
      setError("Erreur lors du rafraîchissement");
    } finally {
      setLoading(false);
    }
  }, [isElectron]);

  return {
    tracks,
    loading,
    scanning,
    scanProgress,
    error,
    scanLibrary,
    selectMusicFolders,
    refreshLibrary,
  };
}

