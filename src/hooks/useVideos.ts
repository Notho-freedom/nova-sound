import { useState, useEffect, useCallback } from "react";
import type { Video, ScanProgress } from "@/types/music";

interface UseVideosReturn {
  videos: Video[];
  loading: boolean;
  scanning: boolean;
  scanProgress: ScanProgress | null;
  error: string | null;
  scanVideos: (directories?: string[]) => Promise<void>;
  selectVideoFolders: () => Promise<string[]>;
  refreshVideos: () => Promise<void>;
}

export function useVideos(): UseVideosReturn {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if running in Electron
  const isElectron = !!window.electronAPI;

  // Load videos on mount
  useEffect(() => {
    const loadVideos = async () => {
      if (!isElectron) {
        setVideos([]);
        setLoading(false);
        return;
      }

      try {
        const videoLibrary = await window.electronAPI!.getVideos();
        setVideos(videoLibrary);
      } catch (err) {
        console.error("Failed to load videos:", err);
        setError("Erreur lors du chargement des vidéos");
      } finally {
        setLoading(false);
      }
    };

    loadVideos();
  }, [isElectron]);

  // Listen for scan progress
  useEffect(() => {
    if (!isElectron) return;

    const unsubscribe = window.electronAPI!.onVideoScanProgress((progress) => {
      setScanProgress(progress);
      if (progress.phase === "complete") {
        setScanning(false);
        setScanProgress(null);
        // Reload videos after scan
        window.electronAPI!.getVideos().then(setVideos);
      }
    });

    return unsubscribe;
  }, [isElectron]);

  // Select video folders
  const selectVideoFolders = useCallback(async (): Promise<string[]> => {
    if (!isElectron) return [];

    try {
      const folders = await window.electronAPI!.openDirectory();
      return folders;
    } catch (err) {
      console.error("Failed to select folders:", err);
      return [];
    }
  }, [isElectron]);

  // Scan videos
  const scanVideos = useCallback(async (directories?: string[]) => {
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
        foldersToScan = settings.videoDirectories || [];
      }

      if (foldersToScan.length === 0) {
        // Ask user to select folders
        foldersToScan = await selectVideoFolders();
        if (foldersToScan.length > 0) {
          // Save selected folders to settings
          await window.electronAPI!.updateSettings({
            videoDirectories: foldersToScan,
          });
        }
      }

      if (foldersToScan.length > 0) {
        await window.electronAPI!.scanVideos(foldersToScan);
      } else {
        setScanning(false);
        setScanProgress(null);
      }
    } catch (err) {
      console.error("Failed to scan videos:", err);
      setError("Erreur lors du scan des vidéos");
      setScanning(false);
      setScanProgress(null);
    }
  }, [isElectron, selectVideoFolders]);

  // Refresh videos
  const refreshVideos = useCallback(async () => {
    if (!isElectron) return;

    setLoading(true);
    try {
      const videoLibrary = await window.electronAPI!.getVideos();
      setVideos(videoLibrary);
    } catch (err) {
      console.error("Failed to refresh videos:", err);
      setError("Erreur lors du rafraîchissement");
    } finally {
      setLoading(false);
    }
  }, [isElectron]);

  return {
    videos,
    loading,
    scanning,
    scanProgress,
    error,
    scanVideos,
    selectVideoFolders,
    refreshVideos,
  };
}

