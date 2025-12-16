import { useState, useCallback, useRef } from 'react';
import { nexusServerService } from '@/services/nexus-server';
import { toast } from 'sonner';
import type { Track } from '@/types/music';

// Upload configuration
const MAX_FILE_SIZE_FREE = 100 * 1024 * 1024; // 100MB for free users
const MAX_FILE_SIZE_PRO = 500 * 1024 * 1024; // 500MB for Pro users
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_BASE = 1000; // 1 second base delay

export interface NexusUploadProgress {
  trackId: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error' | 'retrying';
  error?: string;
  retryCount?: number;
}

interface UseNexusUploadReturn {
  uploadTrack: (track: Track) => Promise<void>;
  uploadProgress: Map<string, NexusUploadProgress>;
  overallProgress: number;
  isUploading: boolean;
  getTrackProgress: (trackId: string) => NexusUploadProgress | undefined;
  cancelUpload: (trackId: string) => void;
  retryUpload: (trackId: string) => void;
}

// Store tracks for retry
const pendingTracks = new Map<string, Track>();

export function useNexusUpload(): UseNexusUploadReturn {
  const [uploadProgress, setUploadProgress] = useState<Map<string, NexusUploadProgress>>(new Map());
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  const getTrackProgress = useCallback((trackId: string): NexusUploadProgress | undefined => {
    return uploadProgress.get(trackId);
  }, [uploadProgress]);

  const overallProgress = uploadProgress.size > 0
    ? Math.round(
        Array.from(uploadProgress.values()).reduce((sum, p) => sum + p.progress, 0) /
        uploadProgress.size
      )
    : 0;

  const isUploading = Array.from(uploadProgress.values()).some(
    p => p.status === 'uploading' || p.status === 'retrying'
  );

  const cancelUpload = useCallback((trackId: string) => {
    const controller = abortControllers.current.get(trackId);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(trackId);
    }
    pendingTracks.delete(trackId);
    setUploadProgress(prev => {
      const updated = new Map(prev);
      updated.delete(trackId);
      return updated;
    });
    toast.info('Upload annulé');
  }, []);

  const uploadWithRetry = useCallback(async (
    track: Track, 
    blob: Blob, 
    fileName: string, 
    retryCount: number = 0
  ): Promise<void> => {
    // Create abort controller for this upload
    const controller = new AbortController();
    abortControllers.current.set(track.id, controller);
    
    try {
      // Upload with progress callback
      await nexusServerService.uploadFile(blob, fileName, (progressValue) => {
        setUploadProgress(prev => {
          const updated = new Map(prev);
          const current = updated.get(track.id);
          if (current) {
            updated.set(track.id, {
              ...current,
              progress: progressValue,
              status: 'uploading',
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

      // Cleanup
      abortControllers.current.delete(track.id);
      pendingTracks.delete(track.id);

      // Remove progress after 3 seconds
      setTimeout(() => {
        setUploadProgress(prev => {
          const updated = new Map(prev);
          updated.delete(track.id);
          return updated;
        });
      }, 3000);
    } catch (error: any) {
      // Check if aborted
      if (error.name === 'AbortError') {
        return;
      }
      
      // Retry logic
      if (retryCount < MAX_RETRY_ATTEMPTS) {
        const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount);
        
        setUploadProgress(prev => {
          const updated = new Map(prev);
          updated.set(track.id, {
            trackId: track.id,
            fileName: track.title,
            progress: 0,
            status: 'retrying',
            retryCount: retryCount + 1,
            error: `Tentative ${retryCount + 2}/${MAX_RETRY_ATTEMPTS + 1}...`,
          });
          return updated;
        });

        toast.warning('Nouvelle tentative', {
          description: `Nouvel essai dans ${delay / 1000}s pour "${track.title}"`,
        });

        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Check if still not aborted
        if (!abortControllers.current.has(track.id)) {
          return;
        }
        
        return uploadWithRetry(track, blob, fileName, retryCount + 1);
      }
      
      // Max retries reached
      console.error('Error uploading track to Nexus after retries:', error);
      
      setUploadProgress(prev => {
        const updated = new Map(prev);
        updated.set(track.id, {
          trackId: track.id,
          fileName: track.title,
          progress: 0,
          status: 'error',
          error: error.message || 'Échec après plusieurs tentatives',
        });
        return updated;
      });

      toast.error('Échec de l\'upload', {
        description: error.message || 'Une erreur est survenue après plusieurs tentatives.',
      });
      
      // Cleanup
      abortControllers.current.delete(track.id);
    }
  }, []);

  const retryUpload = useCallback((trackId: string) => {
    const track = pendingTracks.get(trackId);
    if (track) {
      // Clear error state
      setUploadProgress(prev => {
        const updated = new Map(prev);
        updated.delete(trackId);
        return updated;
      });
      // Retry upload
      uploadTrackInternal(track, 0);
    }
  }, []);

  const uploadTrackInternal = useCallback(async (track: Track, retryCount: number = 0) => {
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

    // Store track for potential retry
    pendingTracks.set(track.id, track);

    try {
      // Initialize progress
      const progress: NexusUploadProgress = {
        trackId: track.id,
        fileName: track.title,
        progress: 0,
        status: 'uploading',
        retryCount,
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
      
      // Validate file size
      const maxSize = isPro ? MAX_FILE_SIZE_PRO : MAX_FILE_SIZE_FREE;
      if (blob.size > maxSize) {
        const maxSizeMB = Math.round(maxSize / (1024 * 1024));
        toast.error('Fichier trop volumineux', {
          description: `La taille maximale est de ${maxSizeMB}MB${isPro ? ' (Pro)' : ''}`,
        });
        setUploadProgress(prev => {
          const updated = new Map(prev);
          updated.set(track.id, {
            trackId: track.id,
            fileName: track.title,
            progress: 0,
            status: 'error',
            error: `Fichier trop volumineux (max ${maxSizeMB}MB)`,
          });
          return updated;
        });
        return;
      }
      
      // Generate filename
      const fileName = `${track.artist} - ${track.title}.${ext || 'mp3'}`;

      // Upload with retry mechanism
      await uploadWithRetry(track, blob, fileName, retryCount);
    } catch (error: any) {
      console.error('Error preparing track for upload:', error);
      
      // Mark as error
      setUploadProgress(prev => {
        const updated = new Map(prev);
        updated.set(track.id, {
          trackId: track.id,
          fileName: track.title,
          progress: 0,
          status: 'error',
          error: error.message || 'Erreur de préparation du fichier',
        });
        return updated;
      });

      toast.error('Erreur d\'upload', {
        description: error.message || 'Une erreur est survenue lors de la préparation du fichier.',
      });
    }
  }, [uploadWithRetry]);

  const uploadTrack = useCallback(async (track: Track) => {
    return uploadTrackInternal(track, 0);
  }, [uploadTrackInternal]);

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

