import { useState, useCallback } from 'react';
import { nexusServerService } from '@/services/nexus-server';
import { notificationService } from '@/services/notification-service';
import { toast } from 'sonner';
import type { Track } from '@/types/music';
import { getUserStorageKey, getCurrentUserId } from '@/lib/storage-utils';

const UPLOADED_MEDIA_KEY = 'nexus-uploaded-media';

interface UploadedFile {
  id: string;
  name: string;
  uploadedAt: string;
  cloudProvider?: 'cloudinary' | 'nexus' | 'bunny' | 'planethoster';
  url?: string;
  size?: number;
  type?: 'audio' | 'video' | 'image' | 'other';
  cloudId?: string;
}

// Helper function to save uploaded file to localStorage
async function saveUploadedFile(file: UploadedFile): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    const storageKey = await getUserStorageKey(UPLOADED_MEDIA_KEY, userId);
    
    const saved = localStorage.getItem(storageKey);
    let uploadedMedia: UploadedFile[] = [];
    
    if (saved) {
      try {
        uploadedMedia = JSON.parse(saved);
      } catch (e) {
        console.error('[useNexusUpload] Error parsing localStorage:', e);
      }
    }
    
    // Check if file already exists
    const existingIndex = uploadedMedia.findIndex(f => f.id === file.id);
    if (existingIndex >= 0) {
      // Update existing file
      uploadedMedia[existingIndex] = file;
    } else {
      // Add new file
      uploadedMedia.push(file);
    }
    
    // Sort by upload date
    uploadedMedia.sort((a, b) => 
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
    
    localStorage.setItem(storageKey, JSON.stringify(uploadedMedia));
    console.log('[useNexusUpload] Saved file to localStorage:', file.name);
    
    // Dispatch event to notify CloudView
    window.dispatchEvent(new CustomEvent('uploadedMediaChanged', { detail: file }));
  } catch (error) {
    console.error('[useNexusUpload] Failed to save uploaded file:', error);
  }
}

export interface NexusUploadProgress {
  trackId: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
}

interface UseNexusUploadReturn {
  uploadTrack: (track: Track) => Promise<void>;
  uploadAlbum: (tracks: Track[]) => Promise<void>;
  uploadPlaylist: (tracks: Track[]) => Promise<void>;
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

    // Nexus/PlanetHoster is only for Pro users (serveur 2)
    if (!isPro) {
      toast.error('Plan Pro requis', {
        description: 'Passez au plan Pro pour utiliser PlanetHoster/Nexus (serveur 2). Les utilisateurs Free utilisent Cloudinary (serveur 0).',
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

      // Get file info to check size
      const fileInfo = await window.electronAPI.getFileInfo?.(track.filePath!);
      const fileSizeMB = fileInfo ? fileInfo.size / (1024 * 1024) : 0;
      const FILE_SIZE_LIMIT_MB = 100; // 100MB limit for base64

      // Generate filename
      const ext = track.filePath.split('.').pop()?.toLowerCase();
      const fileName = `${track.artist} - ${track.title}.${ext || 'mp3'}`;

      // Get access token
      let accessToken: string | null = null;
      try {
        const { firebaseService } = await import('@/services/firebase');
        if (firebaseService.isInitialized() && firebaseService.getCurrentUser()) {
          accessToken = await firebaseService.getIdToken();
        }
      } catch (error) {
        console.error('Failed to get Firebase token:', error);
      }

      if (!accessToken) {
        throw new Error('Not authenticated - no token available');
      }

      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');

      // Use streaming upload for large files (> 100MB)
      if (fileSizeMB > FILE_SIZE_LIMIT_MB && window.electronAPI.uploadToNexus) {
        console.log(`[NexusUpload] File too large (${fileSizeMB.toFixed(2)} MB), using streaming upload`);
        
        const result = await window.electronAPI.uploadToNexus({
          filePath: track.filePath!,
          apiUrl: `${API_BASE_URL}/api/storage/upload`,
          accessToken,
          fileName,
          onProgress: (progressValue) => {
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
          },
        });

        if (!result.success) {
          throw new Error(result.error || 'Upload failed');
        }

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

        // Save to localStorage
        await saveUploadedFile({
          id: result.id || track.id,
          name: fileName,
          uploadedAt: new Date().toISOString(),
          cloudProvider: 'nexus',
          url: result.url || `/api/storage/download/${result.id || track.id}`,
          size: fileInfo?.size,
          type: 'audio',
        });

        notificationService.uploadCompleted(track.title, 'PlanetHoster/Nexus (Serveur 2)');

        // Remove progress after 3 seconds
        setTimeout(() => {
          setUploadProgress(prev => {
            const updated = new Map(prev);
            updated.delete(track.id);
            return updated;
          });
        }, 3000);

        return;
      }

      // For smaller files, use base64 method
      let base64Data: string;
      try {
        base64Data = await window.electronAPI.readFileAsBase64(track.filePath!);
      } catch (error: any) {
        if (error.message?.includes('File too large')) {
          // Fallback to streaming if base64 fails
          if (window.electronAPI.uploadToNexus) {
            const result = await window.electronAPI.uploadToNexus({
              filePath: track.filePath!,
              apiUrl: `${API_BASE_URL}/api/storage/upload`,
              accessToken,
              fileName,
              onProgress: (progressValue) => {
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
              },
            });

            if (!result.success) {
              throw new Error(result.error || 'Upload failed');
            }

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

            notificationService.uploadCompleted(track.title, 'PlanetHoster/Nexus (Serveur 2)');
            setTimeout(() => {
              setUploadProgress(prev => {
                const updated = new Map(prev);
                updated.delete(track.id);
                return updated;
              });
            }, 3000);

            return;
          }
        }
        throw error;
      }
      
      // Convert base64 to blob
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      
      // Determine MIME type from file extension
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

      // Upload to Nexus/Bunny
      const uploadResult = await nexusServerService.uploadFile(blob, fileName, (progressValue) => {
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

      // Save to localStorage
      await saveUploadedFile({
        id: uploadResult?.id || track.id,
        name: fileName,
        uploadedAt: new Date().toISOString(),
        cloudProvider: 'nexus',
        url: uploadResult?.url || `/api/storage/download/${uploadResult?.id || track.id}`,
        size: blob.size,
        type: 'audio',
      });

      notificationService.uploadCompleted(track.title, 'PlanetHoster/Nexus (Serveur 2)');

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

      // Provide more specific error messages
      let errorMessage = error.message || 'Une erreur est survenue lors de l\'upload';
      
      // Check if error indicates cloud storage is not configured
      if (errorMessage.includes('Aucun service de stockage cloud configuré') || 
          errorMessage.includes('cloud storage configuré')) {
        errorMessage = 'Bunny Storage n\'est pas configuré côté serveur. Veuillez contacter le support.';
      } else if (errorMessage.includes('Upload vers le cloud storage a échoué')) {
        errorMessage = 'L\'upload vers Bunny Storage a échoué. Veuillez réessayer.';
      }

      notificationService.uploadFailed(track.title, errorMessage);
    }
  }, [uploadProgress]);

  // Upload an entire album (all tracks without duplicates)
  const uploadAlbum = useCallback(async (tracks: Track[]) => {
    // Check authentication and Pro status
    let isAuthenticated = false;
    let isPro = false;
    
    try {
      const { firebaseService } = await import('@/services/firebase');
      if (firebaseService.isInitialized() && firebaseService.getCurrentUser()) {
        isAuthenticated = true;
        isPro = firebaseService.isPro();
      }
    } catch (error) {
      isAuthenticated = nexusServerService.isAuthenticated();
      isPro = nexusServerService.isPro();
    }
    
    if (!isAuthenticated || !isPro) {
      toast.error('Plan Pro requis', {
        description: 'Passez au plan Pro pour utiliser PlanetHoster/Nexus (serveur 2). Les utilisateurs Free utilisent Cloudinary (serveur 0).',
      });
      return;
    }

    // Remove duplicates by ID
    const uniqueTracks = Array.from(new Map(tracks.map(t => [t.id, t])).values());
    
    if (uniqueTracks.length === 0) {
      toast.error('Aucune piste à uploader', {
        description: 'L\'album ne contient aucune piste valide.',
      });
      return;
    }

    toast.info(`Upload de l'album vers Nexus/Bunny en cours...`, {
      description: `${uniqueTracks.length} piste${uniqueTracks.length > 1 ? 's' : ''} à uploader.`,
    });

    // Upload tracks sequentially
    for (let i = 0; i < uniqueTracks.length; i++) {
      const track = uniqueTracks[i];
      try {
        await uploadTrack(track);
        // Small delay between uploads
        if (i < uniqueTracks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Failed to upload track ${track.title}:`, error);
        // Continue with next track even if one fails
      }
    }

    toast.success('Upload de l\'album terminé', {
      description: `${uniqueTracks.length} piste${uniqueTracks.length > 1 ? 's' : ''} uploadée${uniqueTracks.length > 1 ? 's' : ''}.`,
    });
  }, [uploadTrack]);

  // Upload an entire playlist (all tracks without duplicates)
  const uploadPlaylist = useCallback(async (tracks: Track[]) => {
    // Check authentication and Pro status
    let isAuthenticated = false;
    let isPro = false;
    
    try {
      const { firebaseService } = await import('@/services/firebase');
      if (firebaseService.isInitialized() && firebaseService.getCurrentUser()) {
        isAuthenticated = true;
        isPro = firebaseService.isPro();
      }
    } catch (error) {
      isAuthenticated = nexusServerService.isAuthenticated();
      isPro = nexusServerService.isPro();
    }
    
    if (!isAuthenticated || !isPro) {
      toast.error('Plan Pro requis', {
        description: 'Passez au plan Pro pour utiliser PlanetHoster/Nexus (serveur 2). Les utilisateurs Free utilisent Cloudinary (serveur 0).',
      });
      return;
    }

    // Remove duplicates by ID
    const uniqueTracks = Array.from(new Map(tracks.map(t => [t.id, t])).values());
    
    if (uniqueTracks.length === 0) {
      toast.error('Aucune piste à uploader', {
        description: 'La playlist ne contient aucune piste valide.',
      });
      return;
    }

    toast.info(`Upload de la playlist vers PlanetHoster/Nexus (serveur 2) en cours...`, {
      description: `${uniqueTracks.length} piste${uniqueTracks.length > 1 ? 's' : ''} à uploader.`,
    });

    // Upload tracks sequentially
    for (let i = 0; i < uniqueTracks.length; i++) {
      const track = uniqueTracks[i];
      try {
        await uploadTrack(track);
        // Small delay between uploads
        if (i < uniqueTracks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Failed to upload track ${track.title}:`, error);
        // Continue with next track even if one fails
      }
    }

    toast.success('Upload de la playlist terminé', {
      description: `${uniqueTracks.length} piste${uniqueTracks.length > 1 ? 's' : ''} uploadée${uniqueTracks.length > 1 ? 's' : ''}.`,
    });
  }, [uploadTrack]);

  return {
    uploadTrack,
    uploadAlbum,
    uploadPlaylist,
    uploadProgress,
    overallProgress,
    isUploading,
    getTrackProgress,
  };
}

