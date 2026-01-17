import { useState, useCallback } from 'react';
import { notificationService } from '@/services/notification-service';
import { authService } from '@/services/auth';
import { stripeService } from '@/services/stripe';
import { toast } from 'sonner';
import { openProUploadCta } from '@/lib/pro-upload-cta';
import type { Track } from '@/types/music';

export interface BunnyUploadProgress {
  trackId: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
}

interface UseBunnyUploadReturn {
  uploadTrack: (track: Track) => Promise<void>;
  uploadAlbum: (tracks: Track[]) => Promise<void>;
  uploadPlaylist: (tracks: Track[]) => Promise<void>;
  uploadProgress: Map<string, BunnyUploadProgress>;
  overallProgress: number;
  isUploading: boolean;
  getTrackProgress: (trackId: string) => BunnyUploadProgress | undefined;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');

export function useBunnyUpload(): UseBunnyUploadReturn {
  const [uploadProgress, setUploadProgress] = useState<Map<string, BunnyUploadProgress>>(new Map());

  const getTrackProgress = useCallback((trackId: string): BunnyUploadProgress | undefined => {
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
    let isAuthenticated = false;
    let isPro = false;
    
    try {
      const { firebaseService } = await import('@/services/firebase');
      if (firebaseService.isInitialized() && firebaseService.getCurrentUser()) {
        isAuthenticated = true;
        isPro = firebaseService.isPro();
      }
    } catch (error) {
      // Firebase not available
    }

    if (!isAuthenticated) {
      isAuthenticated = authService.isAuthenticated();
    }
    if (isAuthenticated && !isPro) {
      isPro = authService.isPro();
    }
    if (isAuthenticated && !isPro) {
      try {
        const status = await stripeService.getSubscriptionStatus();
        isPro = status.isActive && status.plan === 'pro';
      } catch (error) {
        console.error('Failed to check Stripe subscription status:', error);
      }
    }
    
    if (!isAuthenticated) {
      toast.error('Authentification requise', {
        description: 'Connectez-vous pour uploader vers Bunny.',
      });
      return;
    }

    // Bunny is only for Pro users (serveur 1)
    if (!isPro) {
      openProUploadCta({ server: 'bunny' });
      openProUploadCta({ server: 'bunny' });
      openProUploadCta({ server: 'bunny' });
      toast.error('Plan Pro requis', {
        description: 'Passez au plan Pro pour utiliser Bunny Storage (serveur 1). Les utilisateurs Free utilisent Cloudinary (serveur 0).',
      });
      return;
    }

    // Check if Electron API is available
    if (!window.electronAPI) {
      toast.error('Mode Electron requis', {
        description: 'L\'upload Bunny nécessite le mode Electron.',
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
      const progress: BunnyUploadProgress = {
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
        try {
          accessToken = await authService.getAccessToken();
        } catch (error) {
          console.error('Failed to get authService token:', error);
        }
      }

      if (!accessToken) {
        throw new Error('Not authenticated - no token available');
      }

      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');

      // Use streaming upload for large files (> 100MB)
      if (fileSizeMB > FILE_SIZE_LIMIT_MB && window.electronAPI.uploadToNexus) {
        console.log(`[BunnyUpload] File too large (${fileSizeMB.toFixed(2)} MB), using streaming upload`);
        
        const result = await window.electronAPI.uploadToNexus({
          filePath: track.filePath!,
          apiUrl: `${API_BASE_URL}/api/storage/upload-bunny`,
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

        // Track uploaded media for sync
        (async () => {
          try {
            const { firebaseSyncService } = await import('@/services/firebase-sync');
            const { getUserStorageKey } = await import('@/lib/storage-utils');
            
            const storageKey = await getUserStorageKey('nexus-uploaded-media');
            const saved = localStorage.getItem(storageKey);
            const uploadedMedia: Array<{ id: string; name: string; uploadedAt: string; cloudProvider?: 'cloudinary' | 'nexus' | 'bunny' | 'planethoster'; url?: string; size?: number }> = saved ? JSON.parse(saved) : [];
            
            uploadedMedia.push({
              id: result.id || track.id,
              name: fileName,
              uploadedAt: new Date().toISOString(),
              cloudProvider: 'bunny',
              url: result.url,
              size: result.size || fileInfo?.size,
            });
            
            localStorage.setItem(storageKey, JSON.stringify(uploadedMedia));
            window.dispatchEvent(new CustomEvent('uploadedMediaChanged'));
          } catch (error) {
            console.error('Failed to track uploaded media:', error);
          }
        })();

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

        notificationService.uploadCompleted(track.title, 'Bunny CDN (Serveur 1)');

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
              apiUrl: `${API_BASE_URL}/api/storage/upload-bunny`,
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

            notificationService.uploadCompleted(track.title, 'Bunny CDN (Serveur 1)');
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

      // Create form data
      const formData = new FormData();
      formData.append('file', blob, fileName);

      // Upload with progress tracking using XMLHttpRequest
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progressValue = Math.round((e.loaded / e.total) * 100);
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
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result = JSON.parse(xhr.responseText);
              
              // Track uploaded media for sync
              (async () => {
                try {
                  const { firebaseSyncService } = await import('@/services/firebase-sync');
                  const { getUserStorageKey } = await import('@/lib/storage-utils');
                  
                  const storageKey = await getUserStorageKey('nexus-uploaded-media');
                  const saved = localStorage.getItem(storageKey);
                  const uploadedMedia: Array<{ id: string; name: string; uploadedAt: string; cloudProvider?: 'cloudinary' | 'nexus' | 'bunny' | 'planethoster'; url?: string; size?: number }> = saved ? JSON.parse(saved) : [];
                  
                  const newEntry = {
                    id: result.id,
                    name: fileName,
                    uploadedAt: new Date().toISOString(),
                    cloudProvider: 'bunny' as const,
                    url: result.url,
                    size: result.size || blob.size,
                  };
                  const updated = [newEntry, ...uploadedMedia.filter(m => m.id !== result.id)].slice(0, 100);
                  localStorage.setItem(storageKey, JSON.stringify(updated));
                  firebaseSyncService.queueSync('uploadedMedia', updated);
                  
                  // Dispatch custom event
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('uploadedMediaChanged', { 
                      detail: { storageKey, count: updated.length } 
                    }));
                  }
                } catch (error) {
                  // Silently fail if Firebase sync is not available
                  console.warn('Failed to track uploaded media:', error);
                }
              })();
              
              resolve();
            } catch {
              reject(new Error('Invalid response from server'));
            }
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              reject(new Error(error.message || `Upload failed: ${xhr.status}`));
            } catch {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload aborted'));
        });

        xhr.open('POST', `${API_BASE_URL}/api/storage/upload-bunny`);
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
        xhr.send(formData);
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

      notificationService.uploadCompleted(track.title, 'Bunny Storage (Serveur 1)');

      // Remove progress after 3 seconds
      setTimeout(() => {
        setUploadProgress(prev => {
          const updated = new Map(prev);
          updated.delete(track.id);
          return updated;
        });
      }, 3000);
    } catch (error: any) {
      console.error('Error uploading track to Bunny:', error);
      
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

      notificationService.uploadFailed(track.title, error.message || 'Une erreur est survenue lors de l\'upload vers Bunny');
    }
  }, [uploadProgress]);

  // Upload an entire album
  const uploadAlbum = useCallback(async (tracks: Track[]) => {
    let isAuthenticated = false;
    let isPro = false;
    
    try {
      const { firebaseService } = await import('@/services/firebase');
      if (firebaseService.isInitialized() && firebaseService.getCurrentUser()) {
        isAuthenticated = true;
        isPro = firebaseService.isPro();
      }
    } catch (error) {
      // Firebase not available
    }

    if (!isAuthenticated) {
      isAuthenticated = authService.isAuthenticated();
    }
    if (isAuthenticated && !isPro) {
      isPro = authService.isPro();
    }
    if (isAuthenticated && !isPro) {
      try {
        const status = await stripeService.getSubscriptionStatus();
        isPro = status.isActive && status.plan === 'pro';
      } catch (error) {
        console.error('Failed to check Stripe subscription status:', error);
      }
    }
    
    if (!isAuthenticated || !isPro) {
      toast.error('Plan Pro requis', {
        description: 'Passez au plan Pro pour utiliser Bunny Storage (serveur 1). Les utilisateurs Free utilisent Cloudinary (serveur 0).',
      });
      return;
    }

    const uniqueTracks = Array.from(new Map(tracks.map(t => [t.id, t])).values());
    
    if (uniqueTracks.length === 0) {
      toast.error('Aucune piste à uploader', {
        description: 'L\'album ne contient aucune piste valide.',
      });
      return;
    }

    toast.info(`Upload de l'album vers Bunny (serveur 1) en cours...`, {
      description: `${uniqueTracks.length} piste${uniqueTracks.length > 1 ? 's' : ''} à uploader.`,
    });

    for (let i = 0; i < uniqueTracks.length; i++) {
      const track = uniqueTracks[i];
      try {
        await uploadTrack(track);
        if (i < uniqueTracks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Failed to upload track ${track.title}:`, error);
      }
    }

    toast.success('Upload de l\'album terminé', {
      description: `${uniqueTracks.length} piste${uniqueTracks.length > 1 ? 's' : ''} uploadée${uniqueTracks.length > 1 ? 's' : ''}.`,
    });
  }, [uploadTrack]);

  // Upload an entire playlist
  const uploadPlaylist = useCallback(async (tracks: Track[]) => {
    let isAuthenticated = false;
    let isPro = false;
    
    try {
      const { firebaseService } = await import('@/services/firebase');
      if (firebaseService.isInitialized() && firebaseService.getCurrentUser()) {
        isAuthenticated = true;
        isPro = firebaseService.isPro();
      }
    } catch (error) {
      // Firebase not available
    }

    if (!isAuthenticated) {
      isAuthenticated = authService.isAuthenticated();
    }
    if (isAuthenticated && !isPro) {
      isPro = authService.isPro();
    }
    if (isAuthenticated && !isPro) {
      try {
        const status = await stripeService.getSubscriptionStatus();
        isPro = status.isActive && status.plan === 'pro';
      } catch (error) {
        console.error('Failed to check Stripe subscription status:', error);
      }
    }
    
    if (!isAuthenticated || !isPro) {
      toast.error('Plan Pro requis', {
        description: 'Passez au plan Pro pour utiliser Bunny Storage (serveur 1). Les utilisateurs Free utilisent Cloudinary (serveur 0).',
      });
      return;
    }

    const uniqueTracks = Array.from(new Map(tracks.map(t => [t.id, t])).values());
    
    if (uniqueTracks.length === 0) {
      toast.error('Aucune piste à uploader', {
        description: 'La playlist ne contient aucune piste valide.',
      });
      return;
    }

    toast.info(`Upload de la playlist vers Bunny (serveur 1) en cours...`, {
      description: `${uniqueTracks.length} piste${uniqueTracks.length > 1 ? 's' : ''} à uploader.`,
    });

    for (let i = 0; i < uniqueTracks.length; i++) {
      const track = uniqueTracks[i];
      try {
        await uploadTrack(track);
        if (i < uniqueTracks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Failed to upload track ${track.title}:`, error);
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
