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

  // Check if running in Electron
  const isElectron = !!window.electronAPI;

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
        const library = await window.electronAPI!.getLibrary();
        setTracks(library);
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
    if (!isElectron) return;

    const unsubscribe = window.electronAPI!.onScanProgress((progress) => {
      setScanProgress(progress);
      if (progress.phase === "complete") {
        setScanning(false);
        setScanProgress(null);
        // Reload library after scan
        window.electronAPI!.getLibrary().then(setTracks);
      }
    });

    return unsubscribe;
  }, [isElectron]);

  // Select music folders
  const selectMusicFolders = useCallback(async (): Promise<string[]> => {
    if (!isElectron) return [];

    try {
      const folders = await window.electronAPI!.openDirectory();
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

      if (!foldersToScan || foldersToScan.length === 0) {
        // Get folders from settings
        const settings = await window.electronAPI!.getSettings();
        foldersToScan = settings.musicDirectories;
      }

      if (foldersToScan.length === 0) {
        // Ask user to select folders
        foldersToScan = await selectMusicFolders();
        if (foldersToScan.length > 0) {
          // Save selected folders to settings
          await window.electronAPI!.updateSettings({
            musicDirectories: foldersToScan,
          });
        }
      }

      if (foldersToScan.length > 0) {
        await window.electronAPI!.scanLibrary(foldersToScan);
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
    if (!isElectron) return;

    setLoading(true);
    try {
      const library = await window.electronAPI!.getLibrary();
      setTracks(library);
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

