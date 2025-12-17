import { useState, useCallback, useEffect } from 'react';
import { cloudinaryService, UploadProgress } from '@/services/cloudinary';
import { useCloudSync } from './useCloudSync';
import type { Video } from '@/types/music';
import { toast } from 'sonner';

// Video MIME types
const VIDEO_MIME_TYPES: Record<string, string> = {
  'mp4': 'video/mp4',
  'mkv': 'video/x-matroska',
  'webm': 'video/webm',
  'avi': 'video/x-msvideo',
  'mov': 'video/quicktime',
  'wmv': 'video/x-ms-wmv',
  'flv': 'video/x-flv',
  'm4v': 'video/x-m4v',
  'mpeg': 'video/mpeg',
  'mpg': 'video/mpeg',
  '3gp': 'video/3gpp',
  'ts': 'video/mp2t',
};

interface VideoUploadProgress {
  videoId: string;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  error?: string;
  cloudUrl?: string;
  cloudId?: string;
  startedAt?: string;
  completedAt?: string;
}

interface UseVideoUploadReturn {
  // Cloudinary
  uploadVideoToCloudinary: (video: Video) => Promise<void>;
  uploadMultipleToCloudinary: (videos: Video[]) => Promise<void>;
  cloudinaryProgress: Map<string, VideoUploadProgress>;
  isUploadingToCloudinary: boolean;
  getCloudinaryProgress: (videoId: string) => VideoUploadProgress | null;
  
  // Nexus
  uploadVideoToNexus: (video: Video) => Promise<void>;
  uploadMultipleToNexus: (videos: Video[]) => Promise<void>;
  nexusProgress: Map<string, VideoUploadProgress>;
  isUploadingToNexus: boolean;
  getNexusProgress: (videoId: string) => VideoUploadProgress | null;
  
  // General
  cancelUpload: (videoId: string) => void;
  clearProgress: (videoId: string) => void;
}

export function useVideoUpload(): UseVideoUploadReturn {
  const { cloudinaryConfigured, nexusIsPro, nexusAuthenticated } = useCloudSync();
  const [cloudinaryProgress, setCloudinaryProgress] = useState<Map<string, VideoUploadProgress>>(new Map());
  const [nexusProgress, setNexusProgress] = useState<Map<string, VideoUploadProgress>>(new Map());
  const [isUploadingToCloudinary, setIsUploadingToCloudinary] = useState(false);
  const [isUploadingToNexus, setIsUploadingToNexus] = useState(false);

  // Get MIME type from file path
  const getMimeType = useCallback((filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    return VIDEO_MIME_TYPES[ext] || 'video/mp4';
  }, []);

  // Update progress helper
  const updateCloudinaryProgress = useCallback((videoId: string, update: Partial<VideoUploadProgress>) => {
    setCloudinaryProgress((prev) => {
      const current = prev.get(videoId) || { videoId, status: 'pending', progress: 0 };
      const updated = new Map(prev);
      updated.set(videoId, { ...current, ...update });
      return updated;
    });
  }, []);

  const updateNexusProgress = useCallback((videoId: string, update: Partial<VideoUploadProgress>) => {
    setNexusProgress((prev) => {
      const current = prev.get(videoId) || { videoId, status: 'pending', progress: 0 };
      const updated = new Map(prev);
      updated.set(videoId, { ...current, ...update });
      return updated;
    });
  }, []);

  // Upload video to Cloudinary
  const uploadVideoToCloudinary = useCallback(async (video: Video) => {
    if (!cloudinaryConfigured && !nexusIsPro) {
      toast.error('Cloudinary non configuré', {
        description: 'Configurez Cloudinary dans les paramètres ou passez au plan Pro.',
      });
      return;
    }

    if (!video.filePath) {
      toast.error('Fichier introuvable', {
        description: 'Le fichier vidéo n\'est pas disponible localement.',
      });
      return;
    }

    // Check if already uploading
    const existing = cloudinaryProgress.get(video.id);
    if (existing?.status === 'uploading') {
      toast.info('Upload déjà en cours', {
        description: `L'upload de "${video.title}" est déjà en cours.`,
      });
      return;
    }

    if (!window.electronAPI) {
      toast.error('Mode Electron requis', {
        description: 'L\'upload nécessite le mode Electron.',
      });
      return;
    }

    setIsUploadingToCloudinary(true);
    updateCloudinaryProgress(video.id, {
      status: 'uploading',
      progress: 0,
      startedAt: new Date().toISOString(),
    });

    try {
      toast.info('Upload démarré', {
        description: `Upload de "${video.title}" vers Cloudinary...`,
      });

      // Get Cloudinary config
      const config = cloudinaryService.getConfig();
      if (!config) {
        throw new Error('Cloudinary non configuré');
      }

      // Get file info first to check size
      const fileInfo = await window.electronAPI.getFileInfo?.(video.filePath);
      const fileSizeMB = fileInfo ? fileInfo.size / (1024 * 1024) : 0;

      let result: { success: boolean; url?: string; publicId?: string; error?: string };

      // Use streaming upload for files > 50MB, or native Electron upload if available
      if (window.electronAPI.uploadToCloud && fileSizeMB > 50) {
        // Use Electron's native streaming upload for large files
        updateCloudinaryProgress(video.id, { progress: 10 }); // Show some progress
        
        const uploadResult = await window.electronAPI.uploadToCloud({
          filePath: video.filePath,
          cloudName: config.cloudName,
          uploadPreset: config.uploadPreset,
          resourceType: 'video',
          publicId: `nexus-videos/${video.id}`,
        });

        result = uploadResult;
      } else if (fileSizeMB <= 100) {
        // For smaller files (< 100MB), use base64 method
        const base64Data = await window.electronAPI.readFileAsBase64(video.filePath);
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const mimeType = getMimeType(video.filePath);
        const blob = new Blob([byteArray], { type: mimeType });
        const fileName = video.filePath.split(/[\\/]/).pop() || `video_${video.id}`;

        // Upload to Cloudinary using XHR with progress
        const formData = new FormData();
        formData.append('file', blob, fileName);
        formData.append('upload_preset', config.uploadPreset);
        formData.append('resource_type', 'video');
        formData.append('public_id', `nexus-videos/${video.id}`);

        result = await new Promise<{ success: boolean; url?: string; publicId?: string; error?: string }>((resolve) => {
          const xhr = new XMLHttpRequest();
          
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100);
              updateCloudinaryProgress(video.id, { progress });
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const response = JSON.parse(xhr.responseText);
              resolve({
                success: true,
                url: response.secure_url,
                publicId: response.public_id,
              });
            } else {
              resolve({ success: false, error: `HTTP ${xhr.status}: ${xhr.statusText}` });
            }
          });

          xhr.addEventListener('error', () => {
            resolve({ success: false, error: 'Network error during upload' });
          });

          xhr.open('POST', `https://api.cloudinary.com/v1_1/${config.cloudName}/upload`);
          xhr.send(formData);
        });
      } else {
        // File too large and no streaming support
        throw new Error(`Le fichier est trop volumineux (${fileSizeMB.toFixed(0)} MB). Maximum: 100 MB pour les fichiers sans streaming.`);
      }

      if (result.success) {
        updateCloudinaryProgress(video.id, {
          status: 'completed',
          progress: 100,
          cloudUrl: result.url,
          cloudId: result.publicId,
          completedAt: new Date().toISOString(),
        });

        // Save to uploaded media localStorage
        saveUploadedVideo(video, 'cloudinary', result.url!, result.publicId);

        toast.success('Upload terminé', {
          description: `"${video.title}" a été uploadé sur Cloudinary.`,
        });
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error: any) {
      console.error('Cloudinary video upload error:', error);
      updateCloudinaryProgress(video.id, {
        status: 'error',
        error: error.message,
      });
      toast.error('Erreur d\'upload', {
        description: error.message || 'Une erreur est survenue lors de l\'upload.',
      });
    } finally {
      setIsUploadingToCloudinary(false);
    }
  }, [cloudinaryConfigured, nexusIsPro, cloudinaryProgress, getMimeType, updateCloudinaryProgress]);

  // Upload video to Nexus
  const uploadVideoToNexus = useCallback(async (video: Video) => {
    if (!nexusIsPro || !nexusAuthenticated) {
      toast.error('Nexus Pro requis', {
        description: 'Passez au plan Pro et connectez-vous à Nexus pour utiliser cette fonctionnalité.',
      });
      return;
    }

    if (!video.filePath) {
      toast.error('Fichier introuvable', {
        description: 'Le fichier vidéo n\'est pas disponible localement.',
      });
      return;
    }

    const existing = nexusProgress.get(video.id);
    if (existing?.status === 'uploading') {
      toast.info('Upload déjà en cours', {
        description: `L'upload de "${video.title}" est déjà en cours.`,
      });
      return;
    }

    if (!window.electronAPI) {
      toast.error('Mode Electron requis', {
        description: 'L\'upload nécessite le mode Electron.',
      });
      return;
    }

    setIsUploadingToNexus(true);
    updateNexusProgress(video.id, {
      status: 'uploading',
      progress: 0,
      startedAt: new Date().toISOString(),
    });

    try {
      toast.info('Upload démarré', {
        description: `Upload de "${video.title}" vers Nexus...`,
      });

      // Read file as base64
      const base64Data = await window.electronAPI.readFileAsBase64(video.filePath);
      const mimeType = getMimeType(video.filePath);
      const fileName = video.filePath.split(/[\\/]/).pop() || `video_${video.id}`;

      // Prepare form data for Nexus upload
      const nexusUrl = process.env.NEXT_PUBLIC_NEXUS_API_URL || 'http://localhost:3001';
      
      // Create FormData with base64 data
      const formData = new FormData();
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      formData.append('file', blob, fileName);
      formData.append('type', 'video');
      formData.append('metadata', JSON.stringify({
        id: video.id,
        title: video.title,
        duration: video.duration,
        width: video.width,
        height: video.height,
      }));

      // Upload with progress tracking
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          updateNexusProgress(video.id, { progress });
        }
      };

      const result = await new Promise<{ success: boolean; url?: string; id?: string; error?: string }>((resolve) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const response = JSON.parse(xhr.responseText);
            resolve({ success: true, url: response.url, id: response.id });
          } else {
            resolve({ success: false, error: `HTTP ${xhr.status}: ${xhr.statusText}` });
          }
        };
        xhr.onerror = () => resolve({ success: false, error: 'Network error' });
        xhr.open('POST', `${nexusUrl}/api/storage/upload`);
        xhr.send(formData);
      });

      if (result.success) {
        updateNexusProgress(video.id, {
          status: 'completed',
          progress: 100,
          cloudUrl: result.url,
          cloudId: result.id,
          completedAt: new Date().toISOString(),
        });

        saveUploadedVideo(video, 'nexus', result.url!, result.id);

        toast.success('Upload terminé', {
          description: `"${video.title}" a été uploadé sur Nexus.`,
        });
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error: any) {
      console.error('Nexus video upload error:', error);
      updateNexusProgress(video.id, {
        status: 'error',
        error: error.message,
      });
      toast.error('Erreur d\'upload', {
        description: error.message || 'Une erreur est survenue lors de l\'upload.',
      });
    } finally {
      setIsUploadingToNexus(false);
    }
  }, [nexusIsPro, nexusAuthenticated, nexusProgress, getMimeType, updateNexusProgress]);

  // Upload multiple videos
  const uploadMultipleToCloudinary = useCallback(async (videos: Video[]) => {
    // Deduplicate by ID
    const uniqueVideos = videos.filter((v, i, arr) => arr.findIndex(x => x.id === v.id) === i);
    
    toast.info(`Démarrage de l'upload de ${uniqueVideos.length} vidéo(s)...`);
    
    for (const video of uniqueVideos) {
      await uploadVideoToCloudinary(video);
    }
    
    toast.success(`Upload de ${uniqueVideos.length} vidéo(s) terminé`);
  }, [uploadVideoToCloudinary]);

  const uploadMultipleToNexus = useCallback(async (videos: Video[]) => {
    const uniqueVideos = videos.filter((v, i, arr) => arr.findIndex(x => x.id === v.id) === i);
    
    toast.info(`Démarrage de l'upload de ${uniqueVideos.length} vidéo(s)...`);
    
    for (const video of uniqueVideos) {
      await uploadVideoToNexus(video);
    }
    
    toast.success(`Upload de ${uniqueVideos.length} vidéo(s) terminé`);
  }, [uploadVideoToNexus]);

  // Get progress
  const getCloudinaryProgress = useCallback((videoId: string) => {
    return cloudinaryProgress.get(videoId) || null;
  }, [cloudinaryProgress]);

  const getNexusProgress = useCallback((videoId: string) => {
    return nexusProgress.get(videoId) || null;
  }, [nexusProgress]);

  // Cancel upload
  const cancelUpload = useCallback((videoId: string) => {
    // Note: Actual XHR cancellation would need more implementation
    setCloudinaryProgress((prev) => {
      const updated = new Map(prev);
      updated.delete(videoId);
      return updated;
    });
    setNexusProgress((prev) => {
      const updated = new Map(prev);
      updated.delete(videoId);
      return updated;
    });
  }, []);

  // Clear progress
  const clearProgress = useCallback((videoId: string) => {
    setCloudinaryProgress((prev) => {
      const updated = new Map(prev);
      updated.delete(videoId);
      return updated;
    });
    setNexusProgress((prev) => {
      const updated = new Map(prev);
      updated.delete(videoId);
      return updated;
    });
  }, []);

  return {
    uploadVideoToCloudinary,
    uploadMultipleToCloudinary,
    cloudinaryProgress,
    isUploadingToCloudinary,
    getCloudinaryProgress,
    uploadVideoToNexus,
    uploadMultipleToNexus,
    nexusProgress,
    isUploadingToNexus,
    getNexusProgress,
    cancelUpload,
    clearProgress,
  };
}

// Helper to save uploaded video to localStorage
async function saveUploadedVideo(
  video: Video,
  provider: 'cloudinary' | 'nexus' | 'bunny' | 'planethoster',
  url: string,
  cloudId?: string
) {
  try {
    const UPLOADED_MEDIA_KEY = 'nexus-uploaded-media';
    
    // Get user ID using storage utils
    const { getCurrentUserId, getUserStorageKey } = await import('@/lib/storage-utils');
    const userId = await getCurrentUserId() || 'anonymous';
    const storageKey = await getUserStorageKey(UPLOADED_MEDIA_KEY, userId);
    
    const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
    
    const newEntry = {
      id: video.id,
      type: 'video',
      cloudProvider: provider,
      name: video.title,
      url,
      cloudId,
      size: video.fileSize,
      uploadedAt: new Date().toISOString(),
      metadata: {
        duration: video.duration,
        width: video.width,
        height: video.height,
        format: video.format,
      },
    };
    
    // Remove existing entry for this video
    const filtered = existing.filter((e: any) => e.id !== video.id);
    filtered.push(newEntry);
    
    localStorage.setItem(storageKey, JSON.stringify(filtered));
    
    // Dispatch event to notify other components
    window.dispatchEvent(new CustomEvent('uploadedMediaChanged'));
  } catch (error) {
    console.error('Failed to save uploaded video:', error);
  }
}

