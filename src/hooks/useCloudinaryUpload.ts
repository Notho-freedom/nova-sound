import { useState, useCallback, useEffect, useRef } from 'react';
import { cloudinaryService, UploadProgress } from '@/services/cloudinary';
import { useCloudSync } from './useCloudSync';
import { Track } from '@/types/music';
import { toast } from 'sonner';

// Upload configuration
const MAX_FILE_SIZE_FREE = 100 * 1024 * 1024; // 100MB
const MAX_FILE_SIZE_PRO = 500 * 1024 * 1024; // 500MB
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_BASE = 1000; // 1 second

interface UseCloudinaryUploadReturn {
  uploadTrack: (track: Track) => Promise<void>;
  uploadProgress: Map<string, UploadProgress>;
  overallProgress: number;
  isUploading: boolean;
  getTrackProgress: (trackId: string) => UploadProgress | undefined;
  cancelUpload: (trackId: string) => void;
  retryUpload: (trackId: string) => void;
}

// Store tracks for retry
const pendingTracks = new Map<string, Track>();

export function useCloudinaryUpload(): UseCloudinaryUploadReturn {
  const { cloudinaryConfigured, nexusIsPro } = useCloudSync();
  const [uploadProgress, setUploadProgress] = useState<Map<string, UploadProgress>>(new Map());
  const [isUploading, setIsUploading] = useState(false);
  const retryCountRef = useRef<Map<string, number>>(new Map());

  // Subscribe to Cloudinary progress updates
  useEffect(() => {
    const unsubscribe = cloudinaryService.onProgressUpdate((progress) => {
      setUploadProgress(new Map(progress));
      setIsUploading(progress.size > 0 && Array.from(progress.values()).some(p => p.status === 'uploading'));
    });

    return unsubscribe;
  }, []);

  // Get overall progress
  const overallProgress = cloudinaryService.getOverallProgress();

  // Get progress for a specific track
  const getTrackProgress = useCallback((trackId: string): UploadProgress | undefined => {
    return uploadProgress.get(trackId);
  }, [uploadProgress]);

  // Cancel upload
  const cancelUpload = useCallback((trackId: string) => {
    cloudinaryService.cancelUpload(trackId);
    pendingTracks.delete(trackId);
    retryCountRef.current.delete(trackId);
    toast.info('Upload annulé');
  }, []);

  // Retry upload
  const retryUpload = useCallback((trackId: string) => {
    const track = pendingTracks.get(trackId);
    if (track) {
      retryCountRef.current.set(trackId, 0);
      uploadTrackWithRetry(track);
    }
  }, []);

  // Upload with retry mechanism
  const uploadTrackWithRetry = useCallback(async (track: Track, blob?: Blob): Promise<void> => {
    const retryCount = retryCountRef.current.get(track.id) || 0;
    
    try {
      // Get blob if not provided
      let uploadBlob = blob;
      if (!uploadBlob) {
        if (!window.electronAPI) {
          throw new Error('Mode Electron requis');
        }
        
        const base64Data = await window.electronAPI.readFileAsBase64(track.filePath!);
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        
        const ext = track.filePath!.split('.').pop()?.toLowerCase();
        const mimeTypes: Record<string, string> = {
          'mp3': 'audio/mpeg',
          'flac': 'audio/flac',
          'ogg': 'audio/ogg',
          'wav': 'audio/wav',
          'm4a': 'audio/mp4',
          'aac': 'audio/aac',
        };
        const mimeType = mimeTypes[ext || ''] || 'audio/mpeg';
        uploadBlob = new Blob([byteArray], { type: mimeType });
      }
      
      await cloudinaryService.uploadTrack(track, uploadBlob, () => {});
      
      toast.success('Upload réussi', {
        description: `"${track.title}" a été uploadé vers Cloudinary.`,
      });
      
      pendingTracks.delete(track.id);
      retryCountRef.current.delete(track.id);
    } catch (error: any) {
      if (retryCount < MAX_RETRY_ATTEMPTS) {
        const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount);
        retryCountRef.current.set(track.id, retryCount + 1);
        
        toast.warning('Nouvelle tentative', {
          description: `Nouvel essai dans ${delay / 1000}s pour "${track.title}"`,
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        if (pendingTracks.has(track.id)) {
          return uploadTrackWithRetry(track, blob);
        }
      } else {
        console.error('Error uploading track after retries:', error);
        toast.error('Échec de l\'upload', {
          description: error.message || 'Une erreur est survenue après plusieurs tentatives.',
        });
      }
    }
  }, []);

  // Upload a track to Cloudinary
  const uploadTrack = useCallback(async (track: Track) => {
    // Check if Cloudinary is configured or user has Pro subscription
    if (!cloudinaryConfigured && !nexusIsPro) {
      toast.error('Cloudinary non configuré', {
        description: 'Configurez Cloudinary dans les paramètres ou passez au plan Pro pour utiliser le stockage Nexus.',
      });
      return;
    }

    // Check if already uploading
    const existingProgress = uploadProgress.get(track.id);
    if (existingProgress && existingProgress.status === 'uploading') {
      toast.info('Upload déjà en cours', {
        description: `L'upload de "${track.title}" est déjà en cours.`,
      });
      return;
    }

    // Check if file path exists (Electron mode)
    if (!track.filePath) {
      toast.error('Fichier introuvable', {
        description: 'Le fichier audio n\'est pas disponible localement.',
      });
      return;
    }

    // Store track for potential retry
    pendingTracks.set(track.id, track);
    retryCountRef.current.set(track.id, 0);

    try {
      // Get file blob from Electron
      if (!window.electronAPI) {
        toast.error('Mode Electron requis', {
          description: 'L\'upload Cloudinary nécessite le mode Electron.',
        });
        return;
      }

      // Read file as base64 from Electron
      const base64Data = await window.electronAPI.readFileAsBase64(track.filePath);
      
      // Convert base64 to blob
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      
      // Determine MIME type from file extension
      const ext = track.filePath.split('.').pop()?.toLowerCase();
      const mimeTypes: Record<string, string> = {
        'mp3': 'audio/mpeg',
        'flac': 'audio/flac',
        'ogg': 'audio/ogg',
        'wav': 'audio/wav',
        'm4a': 'audio/mp4',
        'aac': 'audio/aac',
        'opus': 'audio/opus',
        'wma': 'audio/x-ms-wma',
        'aiff': 'audio/aiff',
      };
      const mimeType = mimeTypes[ext || ''] || 'audio/mpeg';
      
      const blob = new Blob([byteArray], { type: mimeType });
      
      // Validate file size
      const maxSize = nexusIsPro ? MAX_FILE_SIZE_PRO : MAX_FILE_SIZE_FREE;
      if (blob.size > maxSize) {
        const maxSizeMB = Math.round(maxSize / (1024 * 1024));
        toast.error('Fichier trop volumineux', {
          description: `La taille maximale est de ${maxSizeMB}MB`,
        });
        pendingTracks.delete(track.id);
        return;
      }
      
      // Upload with retry mechanism
      await uploadTrackWithRetry(track, blob);
    } catch (error: any) {
      console.error('Error uploading track:', error);
      toast.error('Erreur d\'upload', {
        description: error.message || 'Une erreur est survenue lors de l\'upload.',
      });
    }
  }, [cloudinaryConfigured, nexusIsPro, uploadProgress, uploadTrackWithRetry]);

  return {
    uploadTrack,
    uploadProgress,
    overallProgress,
    isUploading,
    getTrackProgress,
    cancelUpload,
    retryUpload,
  };
}

