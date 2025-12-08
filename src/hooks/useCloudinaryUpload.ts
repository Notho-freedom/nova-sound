import { useState, useCallback, useEffect } from 'react';
import { cloudinaryService, UploadProgress } from '@/services/cloudinary';
import { useCloudSync } from './useCloudSync';
import { Track } from '@/types/music';
import { toast } from 'sonner';

interface UseCloudinaryUploadReturn {
  uploadTrack: (track: Track) => Promise<void>;
  uploadProgress: Map<string, UploadProgress>;
  overallProgress: number;
  isUploading: boolean;
  getTrackProgress: (trackId: string) => UploadProgress | undefined;
}

export function useCloudinaryUpload(): UseCloudinaryUploadReturn {
  const { cloudinaryConfigured, nexusIsPro } = useCloudSync();
  const [uploadProgress, setUploadProgress] = useState<Map<string, UploadProgress>>(new Map());
  const [isUploading, setIsUploading] = useState(false);

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
      
      // Upload to Cloudinary
      await cloudinaryService.uploadTrack(track, blob, (progress) => {
        // Progress is handled by the service's listeners
      });

      toast.success('Upload réussi', {
        description: `"${track.title}" a été uploadé vers Cloudinary.`,
      });
    } catch (error: any) {
      console.error('Error uploading track:', error);
      toast.error('Erreur d\'upload', {
        description: error.message || 'Une erreur est survenue lors de l\'upload.',
      });
    }
  }, [cloudinaryConfigured, nexusIsPro, uploadProgress]);

  return {
    uploadTrack,
    uploadProgress,
    overallProgress,
    isUploading,
    getTrackProgress,
  };
}

