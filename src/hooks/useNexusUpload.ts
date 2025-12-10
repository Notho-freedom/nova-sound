import { useState, useCallback } from 'react';
import { nexusServerService } from '@/services/nexus-server';
import { toast } from 'sonner';
import type { Track } from '@/types/music';

export interface NexusUploadProgress {
  trackId: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
}

interface UseNexusUploadReturn {
  uploadTrack: (track: Track) => Promise<void>;
  uploadProgress: Map<string, NexusUploadProgress>;
  overallProgress: number;
  isUploading: boolean;
  getTrackProgress: (trackId: string) => NexusUploadProgress | undefined;
}

export function useNexusUpload(): UseNexusUploadReturn {
  const [uploadProgress, setUploadProgress] = useState<Map<string, NexusUploadProgress>>(new Map());

  const getTrackProgress = useCallback((trackId: string): NexusUploadProgress | undefined => {
    return uploadProgress.get(trackId);
  }, [uploadProgress]);

  const overallProgress = uploadProgress.size > 0
    ? Math.round(
        Array.from(uploadProgress.values()).reduce((sum, p) => sum + p.progress, 0) /
        uploadProgress.size
      )
    : 0;

  const isUploading = Array.from(uploadProgress.values()).some(p => p.status === 'uploading');

  const uploadTrack = useCallback(async (track: Track) => {
    // Check if user is authenticated and Pro
    // Try Firebase first
    let isAuthenticated = false;
    let isPro = false;
    
    try {
      const { firebaseService } = await import('@/services/firebase');
      if (firebaseService.isInitialized() && firebaseService.getCurrentUser()) {
        isAuthenticated = true;
        isPro = firebaseService.isPro();
      }
    } catch (error) {
      // Firebase not available, use nexusServerService
      isAuthenticated = nexusServerService.isAuthenticated();
      isPro = nexusServerService.isPro();
    }
    
    if (!isAuthenticated) {
      toast.error('Authentification requise', {
        description: 'Connectez-vous pour uploader vers Nexus/Bunny.',
      });
      return;
    }

    if (!isPro) {
      toast.error('Plan Pro requis', {
        description: 'Passez au plan Pro pour utiliser Bunny Storage.',
      });
      return;
    }

    // Check if Electron API is available
    if (!window.electronAPI) {
      toast.error('Mode Electron requis', {
        description: 'L\'upload Nexus/Bunny nécessite le mode Electron.',
      });
      return;
    }

    // Check if track has file path
    if (!track.filePath) {
      toast.error('Fichier introuvable', {
        description: 'Le fichier de la piste n\'est pas disponible.',
      });
      return;
    }

    try {
      // Initialize progress
      const progress: NexusUploadProgress = {
        trackId: track.id,
        fileName: track.title,
        progress: 0,
        status: 'uploading',
      };
      setUploadProgress(prev => new Map(prev).set(track.id, progress));

      // Read file as base64 from Electron
      const base64Data = await window.electronAPI.readFileAsBase64(track.filePath!);
      
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
      
      // Generate filename
      const fileName = `${track.artist} - ${track.title}.${ext || 'mp3'}`;

      // Upload to Nexus/Bunny
      await nexusServerService.uploadFile(blob, fileName, (progressValue) => {
        setUploadProgress(prev => {
          const updated = new Map(prev);
          const current = updated.get(track.id);
          if (current) {
            updated.set(track.id, {
              ...current,
              progress: progressValue,
            });
          }
          return updated;
        });
      });

      // Mark as completed
      setUploadProgress(prev => {
        const updated = new Map(prev);
        const current = updated.get(track.id);
        if (current) {
          updated.set(track.id, {
            ...current,
            progress: 100,
            status: 'completed',
          });
        }
        return updated;
      });

      toast.success('Upload réussi', {
        description: `"${track.title}" a été uploadé vers Nexus/Bunny.`,
      });

      // Remove progress after 3 seconds
      setTimeout(() => {
        setUploadProgress(prev => {
          const updated = new Map(prev);
          updated.delete(track.id);
          return updated;
        });
      }, 3000);
    } catch (error: any) {
      console.error('Error uploading track to Nexus:', error);
      
      // Mark as error
      setUploadProgress(prev => {
        const updated = new Map(prev);
        const current = updated.get(track.id);
        if (current) {
          updated.set(track.id, {
            ...current,
            status: 'error',
          });
        }
        return updated;
      });

      toast.error('Erreur d\'upload', {
        description: error.message || 'Une erreur est survenue lors de l\'upload vers Nexus/Bunny.',
      });
    }
  }, [uploadProgress]);

  return {
    uploadTrack,
    uploadProgress,
    overallProgress,
    isUploading,
    getTrackProgress,
  };
}

