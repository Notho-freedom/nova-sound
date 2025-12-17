import { useState, useEffect, useCallback } from 'react';
import { Track } from '@/types/music';
import { getUserStorageKey, getCurrentUserId } from '@/lib/storage-utils';

const UPLOADED_MEDIA_KEY = "nexus-uploaded-media";

interface UploadedFile {
  id: string;
  name: string;
  uploadedAt: string;
  cloudProvider?: "cloudinary" | "nexus" | "bunny" | "planethoster";
  url?: string;
  size?: number;
}

interface UseUploadedStatusReturn {
  isUploaded: (trackId: string) => boolean;
  getUploadedProvider: (trackId: string) => "cloudinary" | "nexus" | "bunny" | "planethoster" | null;
  uploadedTracks: Set<string>;
  refresh: () => Promise<void>;
}

export function useUploadedStatus(): UseUploadedStatusReturn {
  const [uploadedTracks, setUploadedTracks] = useState<Set<string>>(new Set());
  const [uploadedData, setUploadedData] = useState<Map<string, UploadedFile>>(new Map());

  const loadUploadedStatus = useCallback(async () => {
    try {
      const userId = await getCurrentUserId();
      const storageKey = await getUserStorageKey(UPLOADED_MEDIA_KEY, userId);
      
      // Also check old key for backward compatibility
      const oldKey = UPLOADED_MEDIA_KEY;
      const oldSaved = localStorage.getItem(oldKey);
      const saved = localStorage.getItem(storageKey);
      
      let uploadedMedia: UploadedFile[] = [];
      
      if (saved) {
        try {
          uploadedMedia = JSON.parse(saved);
        } catch (e) {
          console.error("Error parsing uploaded media:", e);
        }
      } else if (oldSaved) {
        try {
          uploadedMedia = JSON.parse(oldSaved);
        } catch (e) {
          console.error("Error parsing old uploaded media:", e);
        }
      }

      const trackIds = new Set<string>();
      const dataMap = new Map<string, UploadedFile>();
      
      uploadedMedia.forEach((file) => {
        trackIds.add(file.id);
        dataMap.set(file.id, file);
      });

      setUploadedTracks(trackIds);
      setUploadedData(dataMap);
    } catch (error) {
      console.error("Failed to load uploaded status:", error);
    }
  }, []);

  useEffect(() => {
    loadUploadedStatus();
    
    // Listen for changes
    const handleStorageChange = async () => {
      await loadUploadedStatus();
    };
    
    const handleCustomEvent = async () => {
      await loadUploadedStatus();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("uploadedMediaChanged", handleCustomEvent as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("uploadedMediaChanged", handleCustomEvent as EventListener);
    };
  }, [loadUploadedStatus]);

  const isUploaded = useCallback((trackId: string): boolean => {
    return uploadedTracks.has(trackId);
  }, [uploadedTracks]);

  const getUploadedProvider = useCallback((trackId: string): "cloudinary" | "nexus" | "bunny" | "planethoster" | null => {
    const file = uploadedData.get(trackId);
    return file?.cloudProvider || null;
  }, [uploadedData]);

  return {
    isUploaded,
    getUploadedProvider,
    uploadedTracks,
    refresh: loadUploadedStatus,
  };
}
