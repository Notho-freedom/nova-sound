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
  addVideoFiles: (filePaths: string[]) => Promise<void>;
  addVideoFromUrl: (url: string, title?: string) => Promise<void>;
  refreshVideos: () => Promise<void>;
}

export function useVideos(): UseVideosReturn {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if running in Electron using centralized detector
  const isElectron = typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';

  // Load videos on mount
  useEffect(() => {
    const loadVideos = async () => {
      if (!isElectron) {
        setVideos([]);
        setLoading(false);
        return;
      }

      try {
        if (!window.electronAPI) {
          setVideos([]);
          setLoading(false);
          return;
        }
        const videoLibrary = await window.electronAPI.getVideos();
        console.log("Loaded videos from Electron:", videoLibrary);
        // Log thumbnail status for debugging
        const videosWithThumbs = videoLibrary?.filter(v => v.thumbnailUrl) || [];
        const videosWithoutThumbs = videoLibrary?.filter(v => !v.thumbnailUrl) || [];
        console.log(`Videos with thumbnails: ${videosWithThumbs.length}, without: ${videosWithoutThumbs.length}`);
        if (videosWithoutThumbs.length > 0) {
          console.log("Sample videos without thumbnails:", videosWithoutThumbs.slice(0, 3).map(v => ({ id: v.id, title: v.title, filePath: v.filePath })));
        }
        setVideos(videoLibrary || []);
      } catch (err) {
        console.error("Failed to load videos:", err);
        setError("Erreur lors du chargement des vidéos");
        setVideos([]);
      } finally {
        setLoading(false);
      }
    };

    loadVideos();
  }, [isElectron]);

  // Listen for scan progress and video updates
  useEffect(() => {
    if (!isElectron) return;

    const unsubscribeProgress = window.electronAPI!.onVideoScanProgress((progress) => {
      setScanProgress(progress);
      setScanning(progress.phase !== "complete" && progress.phase !== "indexing");
      if (progress.phase === "complete") {
        setScanning(false);
        setScanProgress(null);
        // Reload videos after scan to ensure we have all videos
        window.electronAPI!.getVideos().then(setVideos).catch(console.error);
      }
    });

    const unsubscribeAdded = window.electronAPI!.onVideoAdded((video) => {
      setVideos((prev) => {
        // Prevent duplicates
        if (prev.some(v => v.id === video.id || v.filePath === video.filePath)) {
          return prev;
        }
        return [...prev, video];
      });
    });

    const unsubscribeRemoved = window.electronAPI!.onVideoRemoved((filePath) => {
      setVideos((prev) => prev.filter((v) => v.filePath !== filePath));
    });

    // Listen for video updates (e.g., when thumbnail is generated)
    const unsubscribeUpdated = window.electronAPI!.onVideoUpdated?.((updatedVideo) => {
      setVideos((prev) => {
        const index = prev.findIndex(v => v.id === updatedVideo.id || v.filePath === updatedVideo.filePath);
        if (index >= 0) {
          const newVideos = [...prev];
          newVideos[index] = { ...newVideos[index], ...updatedVideo };
          return newVideos;
        }
        return prev;
      });
    });

    return () => {
      unsubscribeProgress();
      unsubscribeAdded();
      unsubscribeRemoved();
      unsubscribeUpdated?.();
    };
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

  // Add video files
  const addVideoFiles = useCallback(async (filePaths: string[]) => {
    if (!isElectron || filePaths.length === 0) return;

    try {
      await window.electronAPI!.addVideoFiles?.(filePaths);
      // Refresh videos list
      const videoLibrary = await window.electronAPI!.getVideos();
      setVideos(videoLibrary);
    } catch (err) {
      console.error("Failed to add video files:", err);
      setError("Erreur lors de l'ajout des vidéos");
    }
  }, [isElectron]);

  // Add video from URL
  const addVideoFromUrl = useCallback(async (url: string, title?: string) => {
    if (!isElectron || !url.trim()) return;

    try {
      await window.electronAPI!.addVideoFromUrl?.(url, title);
      // Refresh videos list
      const videoLibrary = await window.electronAPI!.getVideos();
      setVideos(videoLibrary);
    } catch (err) {
      console.error("Failed to add video from URL:", err);
      setError("Erreur lors de l'ajout de la vidéo depuis l'URL");
    }
  }, [isElectron]);

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
    addVideoFiles,
    addVideoFromUrl,
    refreshVideos,
  };
}

